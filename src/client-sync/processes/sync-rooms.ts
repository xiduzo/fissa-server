import { DateTime } from "luxon";
import cache from "node-cache";
import { Room } from "../../lib/interfaces/Room";
import { Track } from "../../lib/interfaces/Track";
import { Vote } from "../../lib/interfaces/Vote";
import { mongoCollection } from "../../utils/database";

export const syncActiveRooms = async (appCache: cache) => {
  const rooms = await mongoCollection<Room>("room");

  const allRooms = await rooms.find({ accessToken: { $ne: null } }).toArray();

  if (allRooms.length > 0) appCache.set("rooms", allRooms);

  allRooms.forEach(async (room) => {
    const { createdAt, pin } = room;

    const maxLifetime = DateTime.now().minus({ days: 3 }).toISO();

    if (createdAt < maxLifetime) {
      await rooms.deleteOne({ pin });
    }
  });

  rooms.watch().on("change", () => {
    syncActiveRooms(appCache);
  });
};

export const clearInactiveRooms = async () => {
  const rooms = await mongoCollection<Room>("room");

  const allRooms = await rooms.find({ accessToken: { $eq: null } }).toArray();

  const deletes = allRooms.map(async (room) => {
    const { createdAt, pin } = room;

    const maxLifetime = DateTime.now().minus({ days: 3 }).toISO();

    if (createdAt < maxLifetime) {
      const votes = await mongoCollection<Vote>("vote");
      const tracks = await mongoCollection<Track>("track");
      await rooms.deleteOne({ pin });
      await votes.deleteMany({ pin });
      await tracks.deleteMany({ pin });
    }
  });

  await Promise.all(deletes);

  setTimeout(clearInactiveRooms, 1000 * 60 * 60);
};
