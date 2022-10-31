import cache from "node-cache";
import { Conflict } from "../lib/classes/errors/Conflict";
import { Room } from "../lib/interfaces/Room";
import { mongoCollection } from "../utils/database";
import { logger } from "../utils/logger";
import { updateTokens } from "../utils/spotify";

const UPDATE_ACCESS_TOKEN_TIME = 1000 * 60 * 20;

export const updateAccessTokens = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { createdBy, accessToken, refreshToken, currentIndex, pin } =
            room;
          if (!accessToken || !refreshToken) return;

          if (currentIndex < 0) {
            throw new Conflict(
              "not updating token as the room does not seem to be playing"
            );
          }
          const tokens = await updateTokens(accessToken, refreshToken);

          const rooms = await mongoCollection<Room>("room");

          logger.info(`${pin}: Updating access token`);

          await rooms.updateMany(
            { createdBy },
            {
              $set: { accessToken: tokens.access_token },
            }
          );
        } catch (error) {
          logger.error(
            `${updateAccessTokens.name}(${room.pin}): ${JSON.stringify(error)}`
          );
        } finally {
          resolve();
        }
      })
  );

  await Promise.all(promises);

  setTimeout(() => updateAccessTokens(appCache), UPDATE_ACCESS_TOKEN_TIME);
};
