import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollection } from "../../utils/database";

export const syncRooms = async (appCache: cache) => {
  const rooms = await mongoCollection<Room>("room");

  const allRooms = await rooms.find({ accessToken: { $ne: null } }).toArray();

  if (allRooms.length > 0) appCache.set("rooms", allRooms);

  rooms.watch().on("change", () => {
    syncRooms(appCache);
  });
};
