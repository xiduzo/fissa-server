import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../lib/interfaces/Room";
import { logger } from "../utils/logger";
import { getMyCurrentPlaybackState, startPlayingTrack } from "../utils/spotify";
import { RoomService } from "../service/RoomService";
import { TrackService } from "../service/TrackService";

const CURRENTLY_PLAYING_SYNC_TIME = 500;
const PRE_MATURE_IS_PLAYING_FETCH = 1000 * 2;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");
  const roomService = new RoomService();
  const trackService = new TrackService();

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, expectedEndTime, currentIndex, pin } = room;
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(
            expectedEndTime ?? DateTime.now().toISO()
          ).diff(DateTime.now()).milliseconds;

          if (
            tMinus < PRE_MATURE_IS_PLAYING_FETCH &&
            tMinus > CURRENTLY_PLAYING_SYNC_TIME
          ) {
            const { is_playing } = await getMyCurrentPlaybackState(accessToken);
            logger.info(`${pin} - is still playing: ${is_playing}`);
            appCache.set(pin, is_playing);
          }
          if (tMinus > CURRENTLY_PLAYING_SYNC_TIME) return;

          const isPlaying = appCache.get<boolean>(pin);
          if (!isPlaying) {
            await roomService.updateRoom(room, -1);
            return;
          }

          const tracks = await trackService.getTracks(pin);
          const nextIndex = currentIndex + 1;
          const { id, name } = tracks[nextIndex];

          await startPlayingTrack(accessToken, `spotify:track:${id}`);
          await roomService.updateRoom(room, nextIndex);

          logger.info(`${pin} - playing track ${nextIndex} (${name})`);
        } catch (error) {
          logger.error(
            `${syncCurrentlyPlaying.name}(${room.pin}): ${JSON.stringify(
              error
            )}, ${error}`
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
