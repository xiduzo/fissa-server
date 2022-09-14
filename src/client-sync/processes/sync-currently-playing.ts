import { StatusCodes } from "http-status-codes";
import cache from "node-cache";

import { Room } from "../../lib/interfaces/Room";
import {
  mongoCollectionAsync,
  setTimeTillNextTrackAsync,
} from "../../utils/database";
import { logger } from "../../utils/logger";
import { publishAsync } from "../../utils/mqtt";
import {
  getMyCurrentPlaybackStateAsync,
  poorMansCurrentIndexAsync,
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
const NEXT_CHECK_MARGIN = 500;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms: Room[] = appCache.get<Room[]>("rooms");
  logger.info(rooms?.length);

  const promises = rooms?.map(async (room): Promise<void> => {
    // Whatever happens we need to return a resolved promise
    // so all promises are resolved and we can loop again
    return new Promise(async (resolve) => {
      try {
        const { pin, accessToken, expectedEndTime, currentIndex } = room;
        if (!accessToken) return;
        logger.info(`currentIndex ${currentIndex}`);
        if (currentIndex <= 0) return;

        // TODO: create a new room endpoint to manually sync up with the room as a host

        // Check the current playback state
        // 1) If the track could have changed changed
        //    - 1.1) Calculate the started time based on now - current progress
        //    - 1.2) Update the room
        //      - index
        //      - start time
        // 2) If the playlist is different than the rooms, stop session

        logger.info(`expectedEndTime: ${expectedEndTime}`);
        const millisecondsTillTrackEnds =
          new Date().valueOf() -
          new Date(expectedEndTime ?? new Date()).valueOf();

        if (millisecondsTillTrackEnds > NEXT_CHECK_MARGIN) {
          logger.info(
            `millisecondsTillTrackEnds: ${millisecondsTillTrackEnds}`
          );
          return;
        }

        logger.info("fetching currently playing");

        const currentlyPlaying = await getMyCurrentPlaybackStateAsync(
          accessToken
        );

        // Update room
      } catch (error) {
        catchError(error, room);
      } finally {
        logger.info("finally");
        resolve();
      }
    });
  });

  if (promises?.length) {
    await Promise.all(promises);
  }

  setTimeout(() => syncCurrentlyPlaying(appCache), 3_000);
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

const catchError = (error: any, room: Room) => {
  if (error.statusCode) return catchHttpError(error, room);

  logger.warn(`${room.pin}: ${error}`);
};

const catchHttpError = (
  error: { statusCode: number; message: string },
  room: Room
) => {
  const { statusCode, message } = error;

  switch (statusCode) {
    case StatusCodes.UNAUTHORIZED:
      logger.warn("UNAUTHORIZED", message);
      // Reset access token for the room. This should sort itself out
      // with the sync-rooms process
      if (message.includes("Spotify's Web API")) {
        // Overwrite app cache so we don't keep using the old access token
        // TODO: refresh token in DB
        // logger.warn("Overwriting access token in room cache", room.pin);
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
