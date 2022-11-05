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
import { RoomService } from "../service/RoomService";

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

          const tMinus = DateTime.fromISO(
            expectedEndTime ?? DateTime.now().toISO()
          ).diff(DateTime.now()).milliseconds;

          if (tMinus > CURRENTLY_PLAYING_SYNC_TIME) return;

          const roomService = new RoomService();
          const lastAddedTrack = appCache.get(pin);
          const newTrackId = await roomService.updateRoom(
            room,
            currentIndex + 1
          );
          if (lastAddedTrack === newTrackId) return;

          appCache.set(pin, newTrackId);
          await startPlayingTrack(accessToken, `spotify:track:${newTrackId}`);
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
