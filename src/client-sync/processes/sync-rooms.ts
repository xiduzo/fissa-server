import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";

const setCache = async (appCache: cache) => {
  const collection = await mongoCollectionAsync("room");

  const rooms = await collection
    .find<Room>({ accessToken: { $ne: null } })
    .toArray();

  if (rooms.length > 0) appCache.set("rooms", rooms);
};

export const syncRooms = async (appCache: cache) => {
  await setCache(appCache);

  watch(appCache);
};

export const watch = async (appCache: cache) => {
  const collection = await mongoCollectionAsync("room");

  collection.watch<Room>().on("change", () => {
    setCache(appCache);
  });
};
