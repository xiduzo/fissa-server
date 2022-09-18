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

        const newRoom = await updateRoom(currentlyPlaying, room);
        if (!newRoom) return;

        await publishAsync(`fissa/room/${pin}`, newRoom);
      } catch (error) {
        await catchError(error, room);
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
): Promise<Room | undefined> => {
  const { is_playing, context, item, progress_ms } = currentlyPlaying;
  const { accessToken, pin, playlistId } = room;
  const collection = await mongoCollectionAsync<Room>("room");
  const clearState = { currentIndex: -1, expectedEndTime: undefined };

  if (!is_playing) {
    await collection.updateOne({ pin }, { $set: clearState });
    return;
  }

  if (!context?.uri.includes(playlistId)) {
    await collection.updateOne({ pin }, { $set: clearState });
    return;
  }

  const deleteVotesPromise = deleteVotesForTrack(
    room.pin,
    currentlyPlaying.item.uri
  );

  const currentIndex = await poorMansCurrentIndexAsync(
    accessToken,
    playlistId,
    currentlyPlaying
  );

  const expectedEndTime = DateTime.now()
    .plus({
      milliseconds: item.duration_ms - progress_ms,
    })
    .toISO();

  await collection.updateOne(
    { pin },
    { $set: { currentIndex, expectedEndTime } }
  );
  await deleteVotesPromise;

  return {
    ...room,
    currentIndex,
    expectedEndTime,
  };
};

const deleteVotesForTrack = async (pin: string, trackUri: string) => {
  const collection = await mongoCollectionAsync<Vote>("votes");

  // We want to remove all votes for the current playing track
  await collection.deleteMany({
    pin,
    trackUri,
  });
};

const catchError = async (error: any, room: Room) => {
  if (error.statusCode) return await catchHttpError(error, room);

  logger.warn(`${room.pin}: ${error}`);
};

const catchHttpError = async (
  error: { statusCode: number; message: string },
  room: Room
) => {
  const { statusCode, message } = error;
  const { pin } = room;

  switch (statusCode) {
    case StatusCodes.UNAUTHORIZED:
      logger.warn("UNAUTHORIZED", message);
      // Reset access token for the room. This should sort itself out
      // with the sync-rooms process
      if (message.includes("Spotify's Web API")) {
        const collection = await mongoCollectionAsync<Room>("room");

        await collection.updateOne(
          { pin },
          { $set: { accessToken: undefined } }
        );
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
