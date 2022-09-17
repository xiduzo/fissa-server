import { logger } from "../../utils/logger";
import NodeCache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { sortVotes, Vote } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync } from "../../utils/database";
import { reorderPlaylist } from "../../utils/spotify";

const updatePlaylist = async (room: Room): Promise<void> => {
  try {
    const collection = await mongoCollectionAsync<Vote>("votes");
    const allVotes = await collection.find({ pin: room.pin }).toArray();
    const sorted = sortVotes(allVotes);
    // await reorderPlaylist(room, sorted);
  } catch (error) {
    logger.warn("updatePlaylist", error);
  }
};

export const syncPlaylistOrder = async (appCache: NodeCache) => {
  const rooms = appCache.get<Room[]>("rooms");
  rooms?.forEach(async (room) => await updatePlaylist(room));
  setTimeout(() => syncPlaylistOrder(appCache), 5_000);
};
