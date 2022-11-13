import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../lib/interfaces/Room";
import {
  getScores,
  highToLow,
  negativeScore,
  positiveScore,
  SortedVoteData,
} from "../lib/interfaces/Vote";
import { logger } from "../utils/logger";
import { publish } from "../utils/mqtt";
import { VoteService } from "../service/VoteService";
import { TrackService } from "../service/TrackService";
import { FissaError } from "../lib/classes/errors/_FissaError";
import { RoomService } from "../service/RoomService";

const TRACK_ORDER_SYNC_TIME = 1000 * 2;
const NO_SYNC_MARGIN = 1000 * 5;

export const syncTrackOrder = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        const { expectedEndTime, currentIndex, pin } = room;
        try {
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(
            expectedEndTime ?? DateTime.now().toISO()
          ).diff(DateTime.now()).milliseconds;

          if (tMinus <= NO_SYNC_MARGIN) return;

          const reorders = await reorderPlaylist(room);
          if (reorders) await publish(`fissa/room/${pin}/tracks/reordered`);
        } catch (error) {
          if (error instanceof FissaError) {
            logger.warn(`${syncTrackOrder.name}: ${error.toString()}`);
            return;
          }
          logger.error(
            `${syncTrackOrder.name}(${pin}): ${JSON.stringify(error)}`
          );
        } finally {
          resolve();
        }
      })
  );

  if (promises?.length) await Promise.all(promises);

  setTimeout(() => syncTrackOrder(appCache), TRACK_ORDER_SYNC_TIME);
};

const mapTo = <T extends { id: string }>(
  arr: T[],
  mapFrom: SortedVoteData[]
): T[] =>
  mapFrom.map((from) => {
    const index = arr.findIndex((item) => item.id === from.trackId);
    return arr[index];
  });

const reorderPlaylist = async (room: Room): Promise<number> => {
  try {
    const voteService = new VoteService();
    const trackService = new TrackService();
    const roomService = new RoomService();

    const { pin, currentIndex } = room;
    const votes = await voteService.getVotes(pin);
    const sortedVotes = getScores(votes);
    const tracks = await trackService.getTracks(pin);
    const currentTrackId = tracks[currentIndex].id;

    const voteIds = votes.map((vote) => vote.trackId);

    // 1 remove voted tracks from new order
    let newTracksOrder = tracks.filter((track) => !voteIds.includes(track.id));
    const newCurrentTrackIndex = newTracksOrder.findIndex(
      (track) => track.id === currentTrackId
    );

    // // 2 add positive tracks
    const positiveVotes = sortedVotes.filter(positiveScore).sort(highToLow);
    if (positiveVotes.length) {
      newTracksOrder = newTracksOrder
        .slice(0, newCurrentTrackIndex + 1)
        .concat(mapTo(tracks, positiveVotes))
        .concat(newTracksOrder.slice(newCurrentTrackIndex + 1));
    }

    // // 3 add negative tracks at the end of the playlist
    const negativeVotes = sortedVotes.filter(negativeScore).sort(highToLow);
    if (negativeVotes.length) {
      newTracksOrder = newTracksOrder.concat(mapTo(tracks, negativeVotes));
    }

    // 4 reorder playlist
    let reorders = 0;
    const promises = newTracksOrder.map(async (track, index) => {
      const original = tracks.find((t) => t.index === index);

      if (original?.id === track.id) return;

      reorders++;
      logger.info(`${pin}: #${index} -> ${track.name}`);

      await trackService.setNewIndex(pin, track.id, index);
    });

    await Promise.all(promises);

    if (newCurrentTrackIndex !== currentIndex || reorders) {
      await roomService.updateRoom(room, newCurrentTrackIndex);
      if (reorders) logger.info(`${pin} - ${reorders} reorders`);
    }

    return reorders;
  } catch (error) {
    if (error instanceof FissaError) {
      logger.info(`${reorderPlaylist.name}: ${JSON.stringify(error)}`);
      return 0;
    }
    logger.error(
      `${reorderPlaylist.name}(${room.pin}): ${JSON.stringify(error)}`
    );
    return 0;
  }
};
