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
import { getMeAsync } from "./spotify";
import { logger } from "./logger";

const { user, password } = MONGO_CREDENTIALS;

export const mongoClient = new MongoClient(
  `mongodb+srv://${user}:${password}@fissa.yp209.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: ServerApiVersion.v1,
  }
);

export const mongoDbAsync = async (): Promise<Db> => {
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

export const mongoCollectionAsync = async <T>(
  name: string,
  options?: CollectionOptions
): Promise<Collection<T & Document>> => {
  try {
    const database = await mongoDbAsync();
    return database.collection<T>(name, options);
  } catch (error) {
    logger.error("mongoCollectionAsync", error);
  }
};

const saveVote = async (vote: Vote) => {
  const votes = await mongoCollectionAsync<Vote>("votes");

  const _vote = await votes.findOne({
    pin: vote.pin,
    createdBy: vote.createdBy,
    trackUri: vote.trackUri,
  });

  if (!_vote) {
    return await votes.insertOne(vote);
  }

  if (vote.state === _vote.state) {
    return await votes.deleteOne({ _id: _vote._id });
  }

  return await votes.updateOne(
    { _id: _vote._id },
    {
      $set: {
        state: vote.state,
      },
    }
  );
};

export const voteAsync = async (
  pin: string,
  accessToken: string,
  trackUri: string,
  state: VoteState
): Promise<Vote> => {
  try {
    const me = await getMeAsync(accessToken);

    const vote: Vote = {
      pin,
      createdBy: me.id,
      trackUri,
      state,
    };

    await saveVote(vote);
    return vote;
  } catch (error) {
    logger.error("voteAsync", error);
    throw new Error("Unable to vote");
  }
};
