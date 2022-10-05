import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { Track } from "../../lib/interfaces/Track";
import {
  getScores,
  highToLow,
  negativeScore,
  positiveScore,
  SortedVoteData,
} from "../../lib/interfaces/Vote";
import {
  getRoomTracks,
  getRoomVotes,
  mongoCollection,
} from "../../utils/database";
import { logger } from "../../utils/logger";
import { publish } from "../../utils/mqtt";
import { updateRoom } from "./sync-currently-playing";

const TRACK_ORDER_SYNC_TIME = 5_000;
const NO_SYNC_MARGIN = 10_000;

export const syncTrackOrder = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(
    async (room): Promise<void> =>
      new Promise(async (resolve) => {
        try {
          const { accessToken, expectedEndTime, currentIndex, pin } = room;
          if (!accessToken) return;
          if (currentIndex < 0) return;

          const tMinus = DateTime.fromISO(expectedEndTime).diff(
            DateTime.now()
          ).milliseconds;

          if (tMinus <= NO_SYNC_MARGIN) return;

          const reorders = await reorderPlaylist(room);
          if (reorders) await publish(`fissa/room/${pin}/tracks/reordered`);
        } catch (error) {
          logger.error(`syncTrackOrder ${JSON.stringify(error)}`);
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
    const votes = await getRoomVotes(pin);
    const sortedVotes = getScores(votes);
    const tracks = await getRoomTracks(pin);
    const currentTrackId = tracks[currentIndex].id;
    const tracksCollection = mongoCollection<Track>("track");
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
    newTracksOrder = [
      ...newTracksOrder.slice(0, currentIndex + playlistOffset),
      ...mapTo(tracks, positiveVotes),
      ...newTracksOrder.slice(currentIndex + playlistOffset),
    ];

    // 3 add negative tracks at the end of the playlist
    const negativeVotes = sortedVotes.filter(negativeScore).sort(highToLow);
    newTracksOrder = [...newTracksOrder, ...mapTo(tracks, negativeVotes)];

    const roomTracks = await tracksCollection;

    // TODO: tak into account when the a track moved from before the current index
    // 4 reorder playlist
    let reorders = 0;
    const reorderUpdates = newTracksOrder.map(async (track, index) => {
      const originalIndex = tracks.findIndex(
        (original) => original.id === track.id
      );

      if (originalIndex === index) return;
      logger.info(`${pin}: reorder ${track.name} ${originalIndex} -> ${index}`);

      reorders++;
      await roomTracks.updateOne({ pin, id: track.id }, { $set: { index } });
    });

    // update room track indexes in DB
    await Promise.all(reorderUpdates);

    const newCurrentTrackIndex = newTracksOrder.findIndex(
      (track) => track.id === currentTrackId
    );

    if (newCurrentTrackIndex !== currentIndex) await updateRoom(room);
    return reorders;
  } catch (error) {
    logger.error(`reorderPlaylist ${JSON.stringify(error)}`);
  }
};
