import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../lib/interfaces/Room";
import { Track } from "../lib/interfaces/Track";
import { mongoCollection } from "../utils/database";
import { logger } from "../utils/logger";
import { publish } from "../utils/mqtt";
import {
  getMyCurrentPlaybackState,
  getRecommendedTracks,
  startPlayingTrack,
} from "../utils/spotify";
import { TrackService } from "../service/TrackService";
import { VoteService } from "../service/VoteService";
import { Conflict } from "../lib/classes/errors/Conflict";
import { FissaError } from "../lib/classes/errors/_FissaError";

const CURRENTLY_PLAYING_SYNC_TIME = 500;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, expectedEndTime, currentIndex, pin } = room;
          if (!accessToken) return;
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(
            expectedEndTime ?? DateTime.now().toISO()
          ).diff(DateTime.now()).milliseconds;

          if (tMinus > CURRENTLY_PLAYING_SYNC_TIME) return;

          const lastAddedTrack = appCache.get(pin);
          const nextTrackId = await updateRoom(room);
          appCache.set(pin, nextTrackId);

          if (!nextTrackId) return;

          if (lastAddedTrack == nextTrackId) {
            throw new Conflict("trying to play the same track");
          }

          await startPlayingTrack(accessToken, `spotify:track:${nextTrackId}`);
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
    const trackService = new TrackService();

    const { pin, currentIndex, accessToken } = room;
    const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

    let newState: Partial<Room> = {
      currentIndex: -1,
      lastPlayedIndex: currentIndex,
      expectedEndTime: undefined,
    };

    if (!currentlyPlaying?.is_playing) {
      await saveAndPublishRoom({ ...room, ...newState });
      logger.warn(`${updateRoom.name}(${pin}): not playing`);
      return undefined;
    }

    const tracks = await trackService.getTracks(pin);
    newState = getNextState(tracks, currentlyPlaying);

    const newRoom = { ...room, ...newState };

    logger.info(`${pin}: index ${currentIndex} -> ${newState.currentIndex}`);
    if (currentIndex === newState.currentIndex) {
      await saveAndPublishRoom(newRoom);
      logger.warn(`${updateRoom.name}(${pin}): same index`);
      return undefined;
    }

    const nextTrackId = await getNextTrackId(newRoom, tracks);

    await saveAndPublishRoom(newRoom);
    return nextTrackId;
  } catch (error) {
    if (error instanceof FissaError) {
      logger.warn(`${updateRoom.name}: ${error.toString()}`);
      return undefined;
    }
    logger.error(`${updateRoom.name}: ${JSON.stringify(error)}`);
    return undefined;
  }
};

const saveAndPublishRoom = async (room: Partial<Room>) => {
  const rooms = await mongoCollection<Room>("room");

  const { pin, currentIndex, expectedEndTime } = room;

  delete room.accessToken;
  delete room.refreshToken;
  await publish(`fissa/room/${pin}`, room);

  await rooms.updateOne({ pin }, { $set: { currentIndex, expectedEndTime } });
};

const getNextState = (
  tracks: Track[],
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
): Partial<Room> => {
  const newState = { currentIndex: -1, expectedEndTime: "" };
  const { item, progress_ms } = currentlyPlaying;

  if (!item) return newState;
  if (!progress_ms) return newState;

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
    const voteService = new VoteService();
    const trackService = new TrackService();

    if (currentIndex >= 0) {
      const nextTrack = tracks[newState.currentIndex + 1];
      const trackAfterNext = tracks[newState.currentIndex + 2];

      if (nextTrack) {
        nextTrackId = nextTrack.id;
        await voteService.deleteVotes(pin, nextTrackId);
      }

      if (!trackAfterNext) {
        const seedIds = tracks.slice(-5).map((track) => track.id);
        const recommendations = await getRecommendedTracks(
          accessToken,
          seedIds
        );
        const recommendedIds = recommendations?.map((track) => track.id);

        await trackService.addTracks(pin, recommendedIds, "bot");
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
