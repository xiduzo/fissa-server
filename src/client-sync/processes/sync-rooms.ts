import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";

export const syncRooms = (appCache: cache) => {
  const getPins = async () => {
    const collection = await mongoCollectionAsync("room");
    const rooms = await collection.find<Room>({}).toArray();
    const pins = rooms.map((room) => ({
      pin: room.pin,
      accessToken: room.accessToken,
      playlistId: room.playlistId,
    }));

    appCache.set("pins", pins);
  };

  setInterval(getPins, 15_000);

  getPins();
};
