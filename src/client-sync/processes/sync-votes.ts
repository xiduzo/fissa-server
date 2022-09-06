import NodeCache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { SortedVotes, sortVotes, Vote } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync } from "../../utils/database";
import { publishAsync } from "../../utils/mqtt";
import { reorderPlaylist } from "../../utils/spotify";

const updateVotes = async (pin: string): Promise<void> => {
  try {
    const collection = await mongoCollectionAsync("votes");
    const allVotes = await collection.find<Vote>({ pin }).toArray();
    const sorted = sortVotes(allVotes);
    await publishAsync(`fissa/room/${pin}/votes`, sorted);
  } catch (error) {
    console.warn(error);
  }
};

export const syncVotes = (appCache: NodeCache) => {
  const rooms = appCache.get<Room[]>("rooms");

  rooms?.forEach(async ({ pin }) => await updateVotes(pin));

  setTimeout(() => syncVotes(appCache), 10_000);
};

export const syncPlaylistOrder = async (appCache: NodeCache) => {
  // await reorderPlaylist(room, votes);
  console.log("syncPlaylistOrder");
  setTimeout(() => syncPlaylistOrder(appCache), 10_000);
};
