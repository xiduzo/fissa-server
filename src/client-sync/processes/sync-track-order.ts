import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { logger } from "../../utils/logger";
import { publish } from "../../utils/mqtt";
import { reorderPlaylist } from "../../utils/spotify";

const TRACK_ORDER_SYNC_TIME = 10_000;
const NO_SYNC_MARGIN = 1_000;

export const syncTrackOrder = async (appCache: cache) => {
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

          logger.info(`${pin}: tMinus: ${tMinus}`);
          if (tMinus <= NO_SYNC_MARGIN) return;

          await reorderPlaylist(room);
          await publish(`/fissa/room/${pin}/tracks/reordered`);
        } catch (error) {
          logger.error(`syncTrackOrder ${JSON.stringify(error)}`);
        } finally {
          resolve();
        }
      })
  );

  await Promise.all(promises);

  setTimeout(() => syncTrackOrder(appCache), TRACK_ORDER_SYNC_TIME);
};
