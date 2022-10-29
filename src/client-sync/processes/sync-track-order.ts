import { DateTime } from "luxon";
import cache from "node-cache";
import { RoomService } from "../../service/RoomService";
import { Room } from "../../lib/interfaces/Room";
import { Track } from "../../lib/interfaces/Track";
import {
  getScores,
  highToLow,
  negativeScore,
  positiveScore,
  SortedVoteData,
} from "../../lib/interfaces/Vote";
import { mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
import { publish } from "../../utils/mqtt";
import { updateRoom } from "./sync-currently-playing";

const TRACK_ORDER_SYNC_TIME = 1000 * 2;
const NO_SYNC_MARGIN = 1000 * 5;

const roomService = new RoomService();

export const syncTrackOrder = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        const { accessToken, expectedEndTime, currentIndex, pin } = room;
        try {
          if (!accessToken) return;
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(expectedEndTime).diff(
            DateTime.now()
          ).milliseconds;

          if (tMinus <= NO_SYNC_MARGIN) return;

          const reorders = await reorderPlaylist(room);
          if (reorders) await publish(`fissa/room/${pin}/tracks/reordered`);
        } catch (error) {
          logger.error(
            `${syncTrackOrder.name}(${pin}): ${JSON.stringify(error)}`
          );
        } finally {
          resolve();
        }
      })
  );

  await Promise.all(promises);

  setTimeout(() => syncTrackOrder(appCache), TRACK_ORDER_SYNC_TIME);
};

const mapTo = <T extends { id: string }>(arr: T[], mapFrom: SortedVoteData[]) =>
  mapFrom.map((from) => arr.find((item) => item.id === from.trackId));

const reorderPlaylist = async (room: Room): Promise<number> => {
  try {
    const { pin, currentIndex } = room;
    const votes = await roomService.getVotes(pin);
    const sortedVotes = getScores(votes);
    const tracks = await roomService.getTracks(pin);
    const currentTrackId = tracks[currentIndex].id;
    const roomTracks = await mongoCollection<Track>("track");
    const voteIds = votes.map((vote) => vote.trackId);
    const playlistOffset = 2; // 1 for the current track + 1 for the next track

    // 1 remove voted tracks from new order
    let newTracksOrder = tracks.filter((track) => {
      // Keep the current track and the next track
      if (track.index === currentIndex) return true;
      if (track.index === currentIndex + 1) return true;
      // Remove all other tracks
      return !voteIds.includes(track.id);
    });

    // 2 add positive tracks
    const positiveVotes = sortedVotes.filter(positiveScore).sort(highToLow);
    if (positiveVotes.length) {
      newTracksOrder = [
        ...newTracksOrder.slice(0, currentIndex + playlistOffset),
        ...mapTo(tracks, positiveVotes),
        ...newTracksOrder.slice(currentIndex + playlistOffset),
      ];
    }

    // 3 add negative tracks at the end of the playlist
    const negativeVotes = sortedVotes.filter(negativeScore).sort(highToLow);
    if (negativeVotes.length) {
      newTracksOrder = [...newTracksOrder, ...mapTo(tracks, negativeVotes)];
    }

    // TODO: take into account when the a track moved from before the current index
    // 4 reorder playlist
    let reorders = 0;
    for (let index = 0; index < newTracksOrder.length; index++) {
      const track = newTracksOrder[index];
      const originalIndex = tracks.findIndex(
        (original) => original.id === track.id
      );
      if (originalIndex === index) continue;

      reorders++;
      logger.info(
        `${pin}: ${track.name} (${track.id}) ${originalIndex} -> ${index}`
      );

      await roomTracks.updateOne({ pin, id: track.id }, { $set: { index } });
    }

    const newCurrentTrackIndex = newTracksOrder.findIndex(
      (track) => track.id === currentTrackId
    );

    if (newCurrentTrackIndex !== currentIndex) await updateRoom(room);
    if (reorders) logger.info(`${pin}: reorders: ${reorders}`);
    return reorders;
  } catch (error) {
    logger.info(error);
    logger.error(
      `${reorderPlaylist.name}(${room.pin}): ${JSON.stringify(error)}`
    );
  }
};
