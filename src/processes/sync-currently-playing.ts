import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../lib/interfaces/Room";
import { logger } from "../utils/logger";
import { startPlayingTrack } from "../utils/spotify";
import { RoomService } from "../service/RoomService";
import { TrackService } from "../service/TrackService";

const CURRENTLY_PLAYING_SYNC_TIME = 500;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");
  const roomService = new RoomService();
  const trackService = new TrackService();

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
          const tracks = await trackService.getTracks(pin);
          const nextIndex = currentIndex + 1;
          const nextTrackId = tracks[nextIndex].id;

          logger.info(`${lastAddedTrack}, ${nextTrackId}`);
          if (lastAddedTrack === nextTrackId) return;

          await startPlayingTrack(accessToken, `spotify:track:${nextTrackId}`);
          await roomService.updateRoom(room, nextIndex);
          appCache.set(pin, nextTrackId);
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
