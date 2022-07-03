import { StatusCodes } from "http-status-codes";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { publishAsync, updateVotes } from "../../utils/mqtt";
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

// TODO: move this to a share cache?
const states = new Map<string, State>();

const SPOTIFY_PING_TIME = 2_000;
const PROGRESS_SYNC_TIME = 20_000;

export const syncCurrentlyPlaying = (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");
  rooms?.forEach(async (room) => {
    const { accessToken } = room;
    if (!accessToken) {
      // Somehow we have an active room without an access token
      return;
    }

    try {
      const myCurrentPlayingTrack = await getMyCurrentPlaybackStateAsync(
        accessToken
      );

      if (!myCurrentPlayingTrack) return;

      await updateRoom(myCurrentPlayingTrack, room);
    } catch (error) {
      const { statusCode, message } = error;
      switch (statusCode) {
        case StatusCodes.UNAUTHORIZED:
          console.warn(StatusCodes.UNAUTHORIZED, message);
          break;
        case StatusCodes.INTERNAL_SERVER_ERROR:
          console.warn(StatusCodes.INTERNAL_SERVER_ERROR, message);
          break;

        default:
          console.warn("UNKOWN ERROR", message);
          break;
      }
    }
  });

  setTimeout(() => syncCurrentlyPlaying(appCache), SPOTIFY_PING_TIME);
};

const updateRoom = async (
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse,
  room: Room
) => {
  const { state, previousState } = getState(room, currentlyPlaying);

  if (!previousState) {
    await publishNewRoomState(state, room, currentlyPlaying);
    await publishVotes(room.pin, currentlyPlaying.item.uri);
    return;
  }

  if (state.uri !== previousState.uri) {
    await publishNewRoomState(state, room, currentlyPlaying);
    await publishVotes(room.pin, currentlyPlaying.item.uri);
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

const publishVotes = async (pin: string, trackUri: string) => {
  const collection = await mongoCollectionAsync("votes");

  // We want to remove all votes for the current playing track
  await collection.deleteMany({
    pin,
    trackUri,
  });
  await updateVotes(pin);
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
    is_in_playlist: currentlyPlaying.context.uri.includes(room.playlistId),
    currentIndex: 0,
  };

  states.set(room.pin, state);

  return { state, previousState };
};
