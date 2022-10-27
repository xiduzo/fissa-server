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

          const lastAddedTrack = appCache.get(pin);
          const nextTrackId = await updateRoom(room);
          appCache.set(pin, nextTrackId);

          if (!nextTrackId) return;

          if (lastAddedTrack == nextTrackId) {
            logger.warn(`${room.pin}: trying to add same track to the queue`);
            return;
          }

          await addTackToQueue(accessToken, nextTrackId);
        } catch (error) {
          logger.error(
            `${syncCurrentlyPlaying.name}(${room.pin}): ${JSON.stringify(
              error
            )}`
          );
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
  try {
    const { pin, currentIndex, accessToken } = room;
    const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

    let newState: Partial<Room> = {
      currentIndex: -1,
      lastPlayedIndex: currentIndex,
      expectedEndTime: undefined,
    };

    if (!currentlyPlaying?.is_playing) {
      logger.warn(`${pin}: not playing anymore`);
      await saveAndPublishRoom({ ...room, ...newState });
      return;
    }

    const tracks = await getRoomTracks(pin);
    newState = getNextState(tracks, currentlyPlaying);

    const newRoom = { ...room, ...newState };

    logger.info(`${pin}: index ${currentIndex} -> ${newState.currentIndex}`);
    if (currentIndex === newState.currentIndex) {
      logger.warn(`${pin}: same index, update new end time`);
      await saveAndPublishRoom(newRoom);

      return undefined;
    }

    const nextTrackId = await getNextTrackId(newRoom, tracks);

    await saveAndPublishRoom(newRoom);
    return nextTrackId;
  } catch (error) {
    logger.error(`${updateRoom.name}: ${JSON.stringify(error)}`);
    return undefined;
  }
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

const saveAndPublishRoom = async (room: Room) => {
  const rooms = await mongoCollection<Room>("room");

  const { pin, currentIndex, expectedEndTime } = room;

  delete room.accessToken;
  await publish(`fissa/room/${pin}`, room);

  await rooms.updateOne({ pin }, { $set: { currentIndex, expectedEndTime } });
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

  try {
    if (currentIndex >= 0) {
      const nextTrack = tracks[newState.currentIndex + 1];
      const trackAfterNext = tracks[newState.currentIndex + 2];

      if (nextTrack) {
        nextTrackId = nextTrack.id;
        await deleteVotesForTrack(pin, nextTrack.id);
      }

      if (!trackAfterNext) {
        const seedIds = tracks.slice(-5).map((track) => track.id);
        const recommendations = await getRecommendedTracks(
          accessToken,
          seedIds
        );
        const recommendedIds = recommendations?.map((track) => track.id);

        await addTracks(accessToken, pin, recommendedIds);
        await publish(`fissa/room/${pin}/tracks/added`, seedIds.length);
        if (!nextTrack) {
          nextTrackId = recommendedIds[0];
        }
      }
    }
  } catch (error) {
    logger.error(`${getNextTrackId.name}(${pin}): ${error}`);
  }

  return nextTrackId;
};
