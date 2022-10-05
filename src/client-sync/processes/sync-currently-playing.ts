import { StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { Track } from "../../lib/interfaces/Track";
import { Vote } from "../../lib/interfaces/Vote";
import {
  addTracks,
  getRoomTracks,
  getRoomVotes,
  mongoCollection,
} from "../../utils/database";
import { logger } from "../../utils/logger";
import { publish } from "../../utils/mqtt";
import {
  addTackToQueue,
  getMyCurrentPlaybackState,
  getRecommendedTracks,
} from "../../utils/spotify";

const CURRENTLY_PLAYING_SYNC_TIME = 250;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, expectedEndTime, currentIndex, pin } = room;
          if (!accessToken) return;
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(expectedEndTime).diff(
            DateTime.now()
          ).milliseconds;

          if (tMinus > CURRENTLY_PLAYING_SYNC_TIME) return;

          logger.info(`${room.pin}: updating...`);
          const lastAddedTrack = appCache.get(pin);
          const nextTrackId = await updateRoom(room);
          appCache.set(pin, nextTrackId);

          if (!nextTrackId) {
            logger.error(`${room.pin}: no next track`);
            return;
          }

          if (lastAddedTrack == nextTrackId) {
            logger.warn(`${room.pin}: trying to add same track to the queue`);
            return;
          }

          await addTackToQueue(accessToken, nextTrackId);
        } catch (error) {
          await catchError(error, room);
        } finally {
          // Whatever happens we need to return a resolved promise
          // so all promises are resolved and we can loop again
          resolve();
        }
      })
  );

  if (promises?.length) await Promise.all(promises);

  setTimeout(() => syncCurrentlyPlaying(appCache), CURRENTLY_PLAYING_SYNC_TIME);
};

export const updateRoom = async (room: Room): Promise<string | undefined> => {
  const { accessToken, pin, currentIndex } = room;
  const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

  const { is_playing } = currentlyPlaying;

  let newState: Partial<Room> = {
    currentIndex: -1,
    expectedEndTime: undefined,
  };

  if (!is_playing) {
    logger.warn(`${pin}: not playing anymore`);
    await saveAndPublishRoom({ ...room, ...newState });
    return;
  }

  const tracks = await getRoomTracks(pin);
  newState = getNextState(tracks, currentlyPlaying);

  logger.info(`${pin}: index ${currentIndex} -> ${newState.currentIndex}`);

  const newRoom = { ...room, ...newState };
  const nextTrackId = await getNextTrackId(newRoom, tracks);

  await saveAndPublishRoom(newRoom);
  return nextTrackId;
};

const deleteVotesForTrack = async (pin: string, trackId: string) => {
  const votes = await mongoCollection<Vote>("vote");

  await votes.deleteMany({
    pin,
    trackId,
  });

  const roomVotes = await getRoomVotes(pin);
  await publish(`fissa/room/${pin}/votes`, roomVotes);
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

const saveAndPublishRoom = async (room: Room) => {
  const rooms = await mongoCollection<Room>("room");

  const { pin } = room;

  await rooms.updateOne(
    { pin },
    {
      $set: {
        currentIndex: room.currentIndex,
        expectedEndTime: room.expectedEndTime,
      },
    }
  );

  delete room.accessToken;
  await publish(`fissa/room/${pin}`, room);
};

const getNextState = (
  tracks: Track[],
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
): Partial<Room> => {
  const newState = { currentIndex: -1, expectedEndTime: undefined };
  const { item, progress_ms } = currentlyPlaying;

  newState.currentIndex =
    tracks.find((track) => track.id === item.id)?.index ?? -1;

  if (newState.currentIndex >= 0) {
    newState.expectedEndTime = DateTime.now()
      .plus({
        milliseconds: item.duration_ms - progress_ms,
      })
      .toISO();
  }

  return newState;
};

const getNextTrackId = async (
  newState: Room,
  tracks: Track[]
): Promise<string | undefined> => {
  let nextTrackId: string | undefined;
  const { currentIndex, pin, accessToken } = newState;

  if (currentIndex >= 0) {
    const nextTrack = tracks[newState.currentIndex + 1];
    const trackAfterNext = tracks[newState.currentIndex + 2];

    if (nextTrack) {
      nextTrackId = nextTrack.id;
      await deleteVotesForTrack(pin, nextTrack.id);
    }

    if (!trackAfterNext) {
      const seedIds = tracks.slice(-5).map((track) => track.id);
      const recommendations = await getRecommendedTracks(accessToken, seedIds);
      const recommendedIds = recommendations.map((track) => track.id);

      await addTracks(accessToken, pin, recommendedIds);
      await publish(`fissa/room/${pin}/tracks/added`, seedIds.length);
      if (!nextTrack) {
        nextTrackId = recommendedIds[0];
      }
    }
  }

  return nextTrackId;
};
