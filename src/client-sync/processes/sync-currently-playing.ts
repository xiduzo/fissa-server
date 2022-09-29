import { StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import cache from "node-cache";

import { Room } from "../../lib/interfaces/Room";
import { Track } from "../../lib/interfaces/Track";
import { Vote } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync } from "../../utils/database";
import { logger } from "../../utils/logger";
import { publishAsync } from "../../utils/mqtt";
import {
  addTackToQueueAsync,
  getMyCurrentPlaybackStateAsync,
  getPlaylistTracksAsync,
  poorMansTrackIndex,
} from "../../utils/spotify";

const T_MINUS = 500;

export const syncCurrentlyPlaying = async (appCache: cache) => {
  const rooms = appCache.get<Room[]>("rooms");

  const promises = rooms?.map(async (room): Promise<void> => {
    // Whatever happens we need to return a resolved promise
    // so all promises are resolved and we can loop again
    return new Promise(async (resolve) => {
      try {
        const { accessToken, expectedEndTime, currentIndex } = room;
        if (!accessToken) return;
        if (currentIndex < 0) return;

        const tMinus = DateTime.fromISO(expectedEndTime).diff(
          DateTime.now()
        ).milliseconds;

        logger.info(tMinus);
        if (tMinus > T_MINUS) return;

        await updateRoom(room);
      } catch (error) {
        await catchError(error, room);
      } finally {
        resolve();
      }
    });
  });

  if (promises?.length) {
    await Promise.all(promises);
  }

  setTimeout(() => syncCurrentlyPlaying(appCache), T_MINUS);
};

export const updateRoom = async (room: Room) => {
  const { accessToken, pin, currentIndex } = room;
  const currentlyPlaying = await getMyCurrentPlaybackStateAsync(accessToken);

  const { is_playing, item, progress_ms } = currentlyPlaying;
  const newState = { currentIndex: -1, expectedEndTime: undefined };

  if (!is_playing) {
    await saveAndPublishRoom(room, newState);
    return;
  }

  const deleteVotesPromise = deleteVotesForTrack(pin, item.id);

  logger.info("update room");
  const tracks = await mongoCollectionAsync<Track>("track");
  const playlistTracks = await tracks.find({ pin }).toArray();
  const sortedTracks = playlistTracks.sort((a, b) => a.index - b.index);

  newState.currentIndex = playlistTracks.find(
    (track) => track.id === item.id
  ).index;

  if (newState.currentIndex >= 0) {
    newState.expectedEndTime = DateTime.now()
      .plus({
        milliseconds: item.duration_ms - progress_ms,
      })
      .toISO();
  }

  logger.info(
    `new index: ${newState.currentIndex}, current index: ${currentIndex}`
  );
  if (newState.currentIndex >= currentIndex + 1) {
    logger.info("Adding next track to queue");
    console.log(
      `Adding next track to queue: ${
        sortedTracks[newState.currentIndex + 1].name
      }`
    );
    await addTackToQueueAsync(
      accessToken,
      sortedTracks[newState.currentIndex + 1].id
    );
  }
  if (newState.currentIndex >= playlistTracks.length - 1) {
    logger.warn("playlist will finished");
  }
  // TODO if index is tracks length - 1, add X new tracks based on previous tracks

  await saveAndPublishRoom(room, newState);
  await deleteVotesPromise;
};

const deleteVotesForTrack = async (pin: string, trackId: string) => {
  const votes = await mongoCollectionAsync<Vote>("vote");

  // We want to remove all votes for the current playing track
  await votes.deleteMany({
    pin,
    trackId,
  });
};

const catchError = async (error: any, room: Room) => {
  if (error.statusCode) return await catchHttpError(error, room);

  logger.warn(`${room.pin}: ${error}`);
};

const catchHttpError = async (
  error: { statusCode: number; message: string },
  room: Room
) => {
  const { statusCode, message } = error;
  const { pin } = room;

  switch (statusCode) {
    case StatusCodes.UNAUTHORIZED:
      logger.warn("UNAUTHORIZED", message);
      if (message.includes("Spotify's Web API")) {
        const rooms = await mongoCollectionAsync<Room>("room");

        await rooms.updateOne(
          { pin },
          { $set: { accessToken: undefined, currentIndex: -1 } }
        );
      }
      break;
    case StatusCodes.INTERNAL_SERVER_ERROR:
      logger.warn("INTERNAL_SERVER_ERROR", message);
      break;
    case StatusCodes.NOT_FOUND:
      if (message.includes("NO_ACTIVE_DEVICE")) return;
      logger.warn("NOT_FOUND", message);
    default:
      logger.warn("UNKOWN ERROR", message);
      break;
  }
};

const saveAndPublishRoom = async (
  room: Room,
  state: { currentIndex: number; expectedEndTime: string | undefined }
) => {
  const rooms = await mongoCollectionAsync<Room>("room");

  const { pin } = room;

  await rooms.updateOne({ pin }, { $set: state });

  delete room.accessToken;
  await publishAsync(`fissa/room/${pin}`, {
    ...room,
    ...state,
  });
};
