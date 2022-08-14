import NodeCache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { SortedVotes, sortVotes, Vote } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync } from "../../utils/database";
import { publishAsync } from "../../utils/mqtt";
import { reorderPlaylist } from "../../utils/spotify";

const updateVotes = async (pin: string): Promise<SortedVotes> => {
  try {
    const collection = await mongoCollectionAsync("votes");
    const allVotes = await collection.find<Vote>({ pin }).toArray();
    const sorted = sortVotes(allVotes);
    await publishAsync(`fissa/room/${pin}/votes`, sorted);
    return sorted;
  } catch (error) {
    console.warn(error);
    return {};
  }
};

export const syncVotes = (appCache: NodeCache) => {
  const rooms = appCache.get<Room[]>("rooms");

  rooms?.forEach(async (room) => {
    const { pin } = room;

    const votes = await updateVotes(pin);
    await reorderPlaylist(room, votes);
  });

  setTimeout(() => syncVotes(appCache), 10_000);
};
