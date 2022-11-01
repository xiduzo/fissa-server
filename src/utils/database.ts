import {
  Collection,
  CollectionOptions,
  Db,
  Document,
  MongoClient,
  ServerApiVersion,
} from "mongodb";
import { MONGODB_URI } from "../lib/constants/credentials";
import { Vote } from "../lib/interfaces/Vote";
import { logger } from "./logger";
import { Track } from "../lib/interfaces/Track";
import { Room } from "../lib/interfaces/Room";

const mongoClient = new MongoClient(MONGODB_URI ?? `MONGODB_URI`, {
  serverApi: ServerApiVersion.v1,
  appName: "fissa",
});

let client: MongoClient | undefined;
let db: Db | undefined;

export const cleanupDbClient = async () => {
  await client?.close();
  client = undefined;
  db = undefined;
};

export const getDb = () => db;

export const mongoDb = (): Promise<Db> => {
  if (client && db) return Promise.resolve(db);

  logger.info("Connecting to MongoDB");
  return new Promise(async (resolve, reject) => {
    try {
      client = await mongoClient.connect();
      db = client.db("fissa", {
        logger: logger.info,
        retryWrites: true,
      });
      client
        .on("close", cleanupDbClient)
        .on("error", cleanupDbClient)
        .on("connectionClosed", cleanupDbClient)
        .on("serverClosed", cleanupDbClient)
        .on("connectionPoolClosed", cleanupDbClient);

      resolve(db);
    } catch (error) {
      logger.error(`${mongoDb.name}: ${JSON.stringify(error)}`);
      await mongoClient.close();
      reject(error);
    }
  });
};

export const warmupDbConnection = async () => {
  logger.info("Initializing database");
  await mongoDb();
};

export const mongoCollection = async <T>(
  name: string,
  options?: CollectionOptions
): Promise<Collection<T & Document>> => {
  try {
    const database = await mongoDb();
    return database.collection<T & Document>(name, options);
  } catch (error) {
    logger.error(`${mongoCollection.name}(${name}): ${JSON.stringify(error)}`);
    return Promise.reject(error);
  }
};

// TODO: move to room service?
export const deleteMyOtherRooms = async (createdBy: string) => {
  const rooms = await mongoCollection<Room>("room");
  const tracks = await mongoCollection<Track>("track");
  const votes = await mongoCollection<Vote>("vote");

  const myRooms = await rooms.find({ createdBy }).toArray();

  const promises = myRooms.map(async (room) => {
    await rooms.deleteOne({ pin: room.pin });
    await votes.deleteMany({ pin: room.pin });
    await tracks.deleteMany({ pin: room.pin });
  });

  await Promise.all(promises);
};
