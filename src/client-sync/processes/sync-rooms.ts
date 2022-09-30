import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollection } from "../../utils/database";

const setCache = async (appCache: cache) => {
  const rooms = await mongoCollection<Room>("room");

  const allRooms = await rooms.find({ accessToken: { $ne: null } }).toArray();

  if (allRooms.length > 0) appCache.set("rooms", allRooms);
};

export const syncRooms = async (appCache: cache) => {
  await setCache(appCache);

  watch(appCache);
};

export const watch = async (appCache: cache) => {
  const rooms = await mongoCollection<Room>("room");

  rooms.watch().on("change", () => {
    setCache(appCache);
  });
};
