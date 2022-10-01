import { StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { Vote } from "../../lib/interfaces/Vote";
import {
  addTracks,
  getRoomTracks,
  mongoCollection,
} from "../../utils/database";
import { logger } from "../../utils/logger";
import { publish } from "../../utils/mqtt";
import {
  addTackToQueue,
  getMyCurrentPlaybackState,
  getRecommendedTracks,
} from "../../utils/spotify";

const T_MINUS = 1000;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, expectedEndTime, currentIndex } = room;
          if (!accessToken) return;
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(expectedEndTime).diff(
            DateTime.now()
          ).milliseconds;

          if (tMinus > T_MINUS) return;
          logger.info(tMinus);

          await updateRoom(room);
        } catch (error) {
          await catchError(error, room);
        } finally {
          // Whatever happens we need to return a resolved promise
          // so all promises are resolved and we can loop again
          resolve();
        }
      })
  );

  if (promises?.length) {
    await Promise.all(promises);
  }

  setTimeout(() => syncCurrentlyPlaying(appCache), T_MINUS);
};

export const updateRoom = async (room: Room) => {
  const { accessToken, pin, currentIndex } = room;
  const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

  const { is_playing, item, progress_ms } = currentlyPlaying;
  const newState = { currentIndex: -1, expectedEndTime: undefined };

  if (!is_playing) {
    await saveAndPublishRoom(room, newState);
    return;
  }

  const deleteVotesPromise = deleteVotesForTrack(pin, item.id);

  const tracks = await getRoomTracks(pin);

  newState.currentIndex =
    tracks.find((track) => track.id === item.id)?.index ?? -1;

  if (newState.currentIndex >= 0) {
    newState.expectedEndTime = DateTime.now()
      .plus({
        milliseconds: item.duration_ms - progress_ms,
      })
      .toISO();
  }

  logger.info(
    `new index: ${newState.currentIndex}, current index: ${currentIndex}`
  );

  if (newState.currentIndex >= 0 && newState.currentIndex !== currentIndex) {
    const nextTrack = tracks[newState.currentIndex + 1];
    const trackAfterNext = tracks[newState.currentIndex + 2];

    if (nextTrack) {
      await addTackToQueue(accessToken, nextTrack.id);
    }

    if (!trackAfterNext) {
      const seedIds = tracks.slice(-5).map((track) => track.id);
      const recommendations = await getRecommendedTracks(accessToken, seedIds);
      const recommendedIds = recommendations.map((track) => track.id);
      logger.info(`adding ${recommendations.length} recommendations to room`);

      await addTracks(accessToken, pin, recommendedIds);
      await publish(`fissa/room/${pin}/tracks/added`, seedIds.length);
      if (!nextTrack) {
        await addTackToQueue(accessToken, recommendedIds[0]);
      }
    }
  }

  await saveAndPublishRoom(room, newState);
  await deleteVotesPromise;
};

const deleteVotesForTrack = async (pin: string, trackId: string) => {
  const votes = await mongoCollection<Vote>("vote");

  // We want to remove all votes for the current playing track
  await votes.deleteMany({
    pin,
    trackId,
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
      if (message.includes("Spotify's Web API")) {
        const rooms = await mongoCollection<Room>("room");

        await rooms.updateOne(
          { pin },
          { $set: { accessToken: undefined, currentIndex: -1 } }
        );
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

const saveAndPublishRoom = async (
  room: Room,
  state: { currentIndex: number; expectedEndTime: string | undefined }
) => {
  const rooms = await mongoCollection<Room>("room");

  const { pin } = room;

  await rooms.updateOne({ pin }, { $set: state });

  delete room.accessToken;
  await publish(`fissa/room/${pin}`, {
    ...room,
    ...state,
  });
};
