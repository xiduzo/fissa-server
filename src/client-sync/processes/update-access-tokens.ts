import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
import { getMe, updateTokens } from "../../utils/spotify";

const UPDATE_ACCESS_TOKEN_TIME = 1000 * 60 * 20;

export const updateAccessTokens = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, refreshToken, currentIndex, pin } = room;
          if (!accessToken || !refreshToken) return;

          if (currentIndex < 0) {
            logger.info(
              `${pin}: not updating token as the room does not seem to be playing`
            );
            return;
          }
          const tokens = await updateTokens(accessToken, refreshToken);

          const rooms = await mongoCollection<Room>("room");

          const me = await getMe(tokens.access_token);

          logger.info(`${pin}: Updating access token`);

          await rooms.updateMany(
            { createdBy: me?.id },
            {
              $set: { accessToken: tokens.access_token },
            }
          );
        } catch (error) {
          logger.error(`${updateAccessTokens.name}: ${JSON.stringify(error)}`);
        } finally {
          resolve();
        }
      })
  );

  await Promise.all(promises);

  setTimeout(() => updateAccessTokens(appCache), UPDATE_ACCESS_TOKEN_TIME);
};
