import { StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import cache from "node-cache";

import { Room } from "../../lib/interfaces/Room";
import { Vote } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync } from "../../utils/database";
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

const T_MINUS = 500;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(async (room): Promise<void> => {
    // Whatever happens we need to return a resolved promise
    // so all promises are resolved and we can loop again
    return new Promise(async (resolve) => {
      try {
        const { pin, accessToken, expectedEndTime, currentIndex } = room;
        logger.info(`Syncing room ${pin}`);
        if (!accessToken) return;
        logger.info(`currentIndex ${currentIndex}`);
        if (currentIndex < 0) return;
        // TODO: create a new room endpoint to manually sync up with the room as a host

        const tMinus = DateTime.fromISO(expectedEndTime).diff(
          DateTime.now()
        ).milliseconds;

        logger.info(`tMinus: ${tMinus}ms`);
        if (tMinus > T_MINUS) return;

        const currentlyPlaying = await getMyCurrentPlaybackStateAsync(
          accessToken
        );

        await updateRoom(currentlyPlaying, room);
      } catch (error) {
        catchError(error, room);
      } finally {
        resolve();
      }
    });
  });

  if (promises?.length) {
    await Promise.all(promises);
  }

  setTimeout(() => syncCurrentlyPlaying(appCache), T_MINUS);
};

const updateRoom = async (
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse,
  room: Room
) => {
  const { is_playing, context, item, progress_ms } = currentlyPlaying;
  const { accessToken, pin, playlistId } = room;
  const collection = await mongoCollectionAsync<Room>("room");

  if (!is_playing) {
    await collection.updateOne({ pin }, { $set: { currentIndex: -1 } });
  }

  if (!context?.uri.includes(playlistId)) {
    await collection.updateOne({ pin }, { $set: { currentIndex: -1 } });
  }

  const currentIndex = await poorMansCurrentIndexAsync(
    accessToken,
    playlistId,
    currentlyPlaying
  );

  const durationOfTrackToGo = item.duration_ms - progress_ms;
  const expectedEndTime = DateTime.now()
    .plus({
      milliseconds: durationOfTrackToGo,
    })
    .toISO();

  await collection.updateOne(
    { pin },
    { $set: { currentIndex, expectedEndTime } }
  );

  // Reset votes for this track
  await deleteVotesForTrack(room.pin, currentlyPlaying.item.uri);
};

const deleteVotesForTrack = async (pin: string, trackUri: string) => {
  const collection = await mongoCollectionAsync<Vote>("votes");

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

  const collection = await mongoCollectionAsync<Room>("room");
  await collection.updateOne({ pin: room.pin }, { $set: { currentIndex } });
  await publishAsync(`fissa/room/${room.pin}/tracks/active`, state);
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
