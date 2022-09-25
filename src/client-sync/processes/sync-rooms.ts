import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { logger } from "../../utils/logger";

const setCache = async (appCache: cache) => {
  const rooms = await mongoCollectionAsync<Room>("room");

  const allRooms = await rooms.find({ accessToken: { $ne: null } }).toArray();

  if (allRooms.length > 0) appCache.set("rooms", allRooms);
};

export const syncRooms = async (appCache: cache) => {
  await setCache(appCache);

  watch(appCache);
};

export const watch = async (appCache: cache) => {
  const rooms = await mongoCollectionAsync<Room>("room");

  rooms.watch().on("change", () => {
    setCache(appCache);
  });
};
