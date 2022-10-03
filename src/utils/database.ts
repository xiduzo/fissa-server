import {
  Collection,
  CollectionOptions,
  Db,
  Document,
  MongoClient,
  ServerApiVersion,
} from "mongodb";
import { MONGO_CREDENTIALS } from "../lib/constants/credentials";
import { Vote, VoteState } from "../lib/interfaces/Vote";
import { getMe, getTracks } from "./spotify";
import { logger } from "./logger";
import { Track } from "../lib/interfaces/Track";
import { Room } from "../lib/interfaces/Room";

const { user, password } = MONGO_CREDENTIALS;

const mongoClient = new MongoClient(
  `mongodb+srv://${user}:${password}@fissa.yp209.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: ServerApiVersion.v1,
  }
);

const mongoDb = async (): Promise<Db> => {
  return new Promise(async (resolve, reject) => {
    try {
      const client = await mongoClient.connect();
      resolve(client.db("fissa"));
    } catch (error) {
      logger.error("mongoDbAsync", error);
      await mongoClient.close();
      reject(error);
    }
  });
};

export const mongoCollection = async <T>(
  name: string,
  options?: CollectionOptions
): Promise<Collection<T & Document>> => {
  try {
    const database = await mongoDb();
    return database.collection<T>(name, options);
  } catch (error) {
    logger.error("mongoCollectionAsync", error);
  }
};

const saveVote = async (vote: Vote) => {
  const votes = await mongoCollection<Vote>("vote");

  const _vote = await votes.findOne({
    pin: vote.pin,
    createdBy: vote.createdBy,
    trackId: vote.trackId,
  });

  if (!_vote) {
    logger.info(`Inserting vote ${JSON.stringify(vote)}`);
    return await votes.insertOne(vote);
  }

  if (vote.state === _vote.state) {
    logger.info(`Deleting vote ${JSON.stringify(vote)}`);
    return await votes.deleteOne({ _id: _vote._id });
  }

  logger.info(`Updating vote ${JSON.stringify(vote)}`);
  return await votes.updateOne(
    { _id: _vote._id },
    {
      $set: {
        state: vote.state,
      },
    }
  );
};

export const vote = async (
  pin: string,
  accessToken: string,
  trackId: string,
  state: VoteState
): Promise<Vote> => {
  try {
    const me = await getMe(accessToken);

    const vote: Vote = {
      pin,
      createdBy: me.id,
      trackId,
      state,
    };

    await saveVote(vote);
    return vote;
  } catch (error) {
    logger.error("voteAsync", error);
    throw new Error("Unable to vote");
  }
};

export const addTracks = async (
  accessToken: string,
  pin: string,
  trackIdsToAdd: string[]
) => {
  const tracks = await mongoCollection<Track>("track");
  const roomTracks = await tracks.find({ pin }).toArray();

  const spotifyTracks = await getTracks(accessToken, trackIdsToAdd);

  const roomTrackIds = roomTracks.map((track) => track.id);
  const tracksToAdd = trackIdsToAdd.filter(
    (trackId) => !roomTrackIds.includes(trackId)
  );

  const inserts = tracksToAdd.map(async (trackId, index) => {
    const track = spotifyTracks.find((track) => track.id === trackId);

    return tracks.insertOne({
      pin,
      index: roomTracks.length + index,
      artists: track.artists.map((artist) => artist.name).join(", "),
      name: track.name,
      id: track.id,
      image: track.album.images[0]?.url,
      duration_ms: track.duration_ms,
    });
  });

  await Promise.all(inserts);
};

export const getRoomVotes = async (pin: string) => {
  const votes = await mongoCollection<Vote>("vote");

  const roomVotes = await votes.find({ pin }).toArray();

  return roomVotes;
};

/**
 * @returns sorted room tracks based on their index
 */
export const getRoomTracks = async (pin: string) => {
  const tracks = await mongoCollection<Track>("track");

  const roomTracks = await tracks.find({ pin }).toArray();
  const orderedTracks = roomTracks.sort((a, b) => a.index - b.index);
  return orderedTracks;
};

export const getRoom = async (pin: string) => {
  const rooms = await mongoCollection<Room>("room");

  const room = await rooms.findOne({ pin });
  return room;
};
