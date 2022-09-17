import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { logger } from "../../utils/logger";

const setCache = async (appCache: cache) => {
  const collection = await mongoCollectionAsync<Room>("room");

  const rooms = await collection.find({ accessToken: { $ne: null } }).toArray();

  if (rooms.length > 0) appCache.set("rooms", rooms);
};

export const syncRooms = async (appCache: cache) => {
  await setCache(appCache);

  watch(appCache);
};

export const watch = async (appCache: cache) => {
  const collection = await mongoCollectionAsync<Room>("room");

  collection.watch<Room>().on("change", () => {
    setCache(appCache);
  });
};
