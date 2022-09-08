import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";

export const syncRooms = async (appCache: cache) => {
  const collection = await mongoCollectionAsync("room");
  const rooms = await collection
    .find<Room>({ accessToken: { $ne: null } })
    .toArray();

  appCache.set("rooms", rooms ?? []);

  setTimeout(() => syncRooms(appCache), 5_000);
};
