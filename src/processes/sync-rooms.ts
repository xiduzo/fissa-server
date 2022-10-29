import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../lib/interfaces/Room";
import { Track } from "../lib/interfaces/Track";
import { Vote } from "../lib/interfaces/Vote";
import { mongoCollection } from "../utils/database";
import { logger } from "../utils/logger";

const setRoomsCache = async (appCache: cache) => {
  const rooms = await mongoCollection<Room>("room");

  const allRooms = await rooms.find({ accessToken: { $ne: null } }).toArray();

  appCache.set("rooms", allRooms);
};

export const syncActiveRooms = async (appCache: cache) => {
  const rooms = await mongoCollection<Room>("room");
  setRoomsCache(appCache);

  rooms.watch().on("change", () => {
    setRoomsCache(appCache);
  });
};

const HOUR = 1000 * 60 * 60;
const CLEAR_INACTIVE_ROOMS_DAYS = 14;
const CLEAR_INACTIVE_ROOMS_SYNC_TIME = HOUR * 12;

export const clearInactiveRooms = async () => {
  const rooms = await mongoCollection<Room>("room");

  const allRooms = await rooms.find().toArray();

  const deletes = allRooms.map(async (room) => {
    const { createdAt, pin } = room;

    const maxLifetime = DateTime.now()
      .minus({ days: CLEAR_INACTIVE_ROOMS_DAYS })
      .toISO();

    if (createdAt < maxLifetime) {
      logger.info(`Deleting room ${pin} because it is inactive`);
      const votes = await mongoCollection<Vote>("vote");
      const tracks = await mongoCollection<Track>("track");
      await rooms.deleteOne({ pin });
      await votes.deleteMany({ pin });
      await tracks.deleteMany({ pin });
    }
  });

  await Promise.all(deletes);

  setTimeout(clearInactiveRooms, CLEAR_INACTIVE_ROOMS_SYNC_TIME);
};
