import { StatusCodes } from "http-status-codes";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
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
};

// TODO: move this to a share cache?
const states = new Map<string, State>();

const SPOTIFY_PING_TIME = 2_000;

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
          console.warn(message);
          break;
        default:
          console.warn(message);
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
  const { state, previousState } = getState(room.pin, currentlyPlaying);

  if (!previousState) {
    await publish(state, room, currentlyPlaying);
    return;
  }

  if (state.uri !== previousState.uri) {
    const collection = await mongoCollectionAsync("votes");
    console.log(
      `removing votes for track ${previousState.uri} in room ${room.pin}`
    );
    await collection.deleteMany({
      pin: room.pin,
      trackUri: previousState.uri,
    });
    await publish(state, room, currentlyPlaying);
    return;
  }
  if (state.is_playing !== previousState.is_playing) {
    await publish(state, room, currentlyPlaying);
    return;
  }

  const diff = Math.abs(currentlyPlaying.progress_ms - state.progress_ms);

  // Just sync the room once every X spotify pings
  // The rest of the progress should be handled by the client
  if (diff > SPOTIFY_PING_TIME * 10) {
    await publish(state, room, currentlyPlaying);
    return;
  }
};

const publish = async (
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
  pin: string,
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
) => {
  const {
    is_playing,
    progress_ms,
    item: { uri },
  } = currentlyPlaying;

  const previousState = states.get(pin);

  const state: State = {
    uri,
    progress_ms: previousState?.progress_ms ?? progress_ms,
    is_playing,
    currentIndex: 0,
  };

  states.set(pin, state);

  return { state, previousState };
};
