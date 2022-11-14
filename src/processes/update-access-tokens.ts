import cache from "node-cache";
import { NotFound } from "../lib/classes/errors/NotFound";
import { FissaError } from "../lib/classes/errors/_FissaError";
import { Room } from "../lib/interfaces/Room";
import { mongoCollection } from "../utils/database";
import { logger } from "../utils/logger";
import { updateTokens } from "../utils/spotify";

const UPDATE_ACCESS_TOKEN_TIME = 1000 * 60 * 25;

export const updateAccessTokens = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, refreshToken, pin } = room;

          if (!accessToken) return;
          if (!refreshToken) return;
          if (!pin) return;

          const tokens = await updateTokens(accessToken, refreshToken);

          if (!tokens) throw new NotFound("Tokens not found");

          const rooms = await mongoCollection<Room>("room");

          logger.info(`${pin}: Updating access token`);

          await rooms.updateOne(
            { pin },
            {
              $set: { accessToken: tokens.access_token },
            }
          );
        } catch (error) {
          if (error instanceof FissaError) {
            logger.warn(`${updateAccessTokens.name}: ${error.toString()}`);
            return;
          }
          logger.error(
            `${updateAccessTokens.name}(${room.pin}): ${JSON.stringify(error)}`
          );
        } finally {
          resolve();
        }
      })
  );

  if (promises) await Promise.all(promises);

  setTimeout(() => updateAccessTokens(appCache), UPDATE_ACCESS_TOKEN_TIME);
};
