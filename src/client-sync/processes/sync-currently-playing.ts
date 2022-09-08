import { logger } from "@utils/logger";
import { StatusCodes } from "http-status-codes";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { publishAsync } from "../../utils/mqtt";
import {
  getMyCurrentPlaybackStateAsync,
  poorMansCurrentIndexAsync,
  startPlaylistFromTopAsync,
} from "../../utils/spotify";

type State = {
  uri: string;
  progress_ms: number;
  is_playing: boolean;
  currentIndex: number;
  is_in_playlist: boolean;
};

// TODO: move this to a shared cache?
const states = new Map<string, State>();

const PROGRESS_SYNC_TIME = 20_000;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  // const rooms: Room[] = appCache.get<Room[]>("rooms") ?? [
  //   {
  //     pin: "1234",
  //     playlistId: "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
  //     accessToken: "ad",
  //     currentIndex: 0,
  //     expectedEndTime: 0,
  //     id: "1234",
  //   },
  // ];
  const rooms: Room[] = Array.from({ length: 2 }).map((_, i) => {
    const now = new Date();
    now.setTime(now.getTime() + 1000 * (Math.random() * 15));
    logger.warn(now);
    return {
      pin: "1234",
      playlistId: "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M",
      accessToken: "ad",
      currentIndex: 0,
      expectedEndTime: 1234,
      id: "1234",
    };
  });

  const promises = rooms.map(async (room) => {
    // Whatever happens we need to return a resolved promise
    // so all promises are resolved and we can loop again
    return new Promise(async (resolve) => {
      try {
        const { accessToken } = room;
        if (!accessToken) {
          // Somehow we have an active room without an access token
          // TODO add refresh token to DB and use to get new access token
          throw new Error("No access token for room");
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        catchError(error, appCache, room);
      } finally {
        resolve(undefined);
      }
    });
  });

  await Promise.all(promises);
  syncCurrentlyPlaying(appCache);
};

const updateRoom = async (
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse,
  room: Room
) => {
  const { state, previousState } = getState(room, currentlyPlaying);

  if (!previousState) {
    await publishNewRoomState(state, room, currentlyPlaying);
    await deleteVotesForTrack(room.pin, currentlyPlaying.item.uri);
    return;
  }

  if (state.uri !== previousState?.uri) {
    await publishNewRoomState(state, room, currentlyPlaying);
    await deleteVotesForTrack(room.pin, currentlyPlaying.item.uri);
    return;
  }
  if (state.is_playing !== previousState.is_playing) {
    await publishNewRoomState(state, room, currentlyPlaying);
    return;
  }

  const diff = Math.abs(currentlyPlaying.progress_ms - state.progress_ms);

  // Just sync the room once every X spotify pings
  // The rest of the progress should be handled by the client
  if (diff > PROGRESS_SYNC_TIME) {
    await publishNewRoomState(state, room, currentlyPlaying);
    return;
  }
};

const deleteVotesForTrack = async (pin: string, trackUri: string) => {
  const collection = await mongoCollectionAsync("votes");

  // We want to remove all votes for the current playing track
  await collection.deleteMany({
    pin,
    trackUri,
  });
};

const publishNewRoomState = async (
  state: State,
  room: Room,
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
) => {
  state.progress_ms = currentlyPlaying.progress_ms; // Update state
  const currentIndex = await poorMansCurrentIndexAsync(
    room.accessToken,
    room.playlistId,
    currentlyPlaying
  );
  state.currentIndex = currentIndex;

  // TODO: if current index = -1, we are not in the playlist anymore
  // Start the playlist from the start?
  // Creator of the playlist should stop party from room?

  const collection = await mongoCollectionAsync("room");
  await collection.updateOne({ pin: room.pin }, { $set: { currentIndex } });
  await publishAsync(`fissa/room/${room.pin}/tracks/active`, state);
};

const getState = (
  room: Room,
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
) => {
  const {
    is_playing,
    progress_ms,
    item: { uri },
  } = currentlyPlaying;

  const previousState = states.get(room.pin);

  const state: State = {
    uri,
    progress_ms: previousState?.progress_ms ?? progress_ms,
    is_playing,
    is_in_playlist: currentlyPlaying?.context?.uri.includes(room.playlistId),
    currentIndex: 0,
  };

  states.set(room.pin, state);

  return { state, previousState };
};

const catchError = (error: any, appCache: cache, room: Room) => {
  const rooms = appCache.get<Room[]>("rooms");
  const { statusCode, message } = error;
  switch (statusCode) {
    case StatusCodes.UNAUTHORIZED:
      logger.warn("UNAUTHORIZED", message);
      // Reset access token for the room. This should sort itself out
      // with the sync-rooms process
      if (message.includes("Spotify's Web API")) {
        // Overwrite app cache so we don't keep using the old access token
        logger.warn("Overwriting access token in room cache", room.pin);
        appCache.set("rooms", [
          ...rooms.filter((_room) => _room.accessToken !== room.accessToken),
          {
            ...room,
            accessToken: null,
          },
        ]);
      }
      break;
    case StatusCodes.INTERNAL_SERVER_ERROR:
      logger.warn("INTERNAL_SERVER_ERROR", message);
      break;
    case StatusCodes.NOT_FOUND:
      if (message.includes("NO_ACTIVE_DEVICE")) return;
      logger.warn("NOT_FOUND", message);
    default:
      logger.warn("UNKOWN ERROR", message);
      break;
  }
};
