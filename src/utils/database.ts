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
import { publishAsync } from "./mqtt";
import { sortVotes } from "../lib/interfaces/Vote";
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
      mongoClient.connect(async (error, client) => {
        if (error) {
          throw new Error(error.message);
        }

        resolve(client.db("fissa"));
      });
    } catch (error) {
      logger.error("mongoDbAsync error", error);
      await mongoClient.close();
      reject(error);
    }
  });
};

export const mongoCollectionAsync = async (
  name: string,
  options?: CollectionOptions
): Promise<Collection<Document>> => {
  try {
    const database = await mongoDbAsync();
    return database.collection(name, options);
  } catch (error) {
    logger.error("mongoCollectionAsync error", error);
  }
};

const saveVote = async (
  collection: Collection<Document>,
  state: VoteState,
  vote: Vote
) => {
  const _vote = await collection.findOne<Vote>({
    pin: vote.pin,
    createdBy: vote.createdBy,
    trackUri: vote.trackUri,
  });

  if (!_vote) {
    return await collection.insertOne(vote as Omit<Vote, "_id">);
  }

  return await collection.updateOne(
    { _id: _vote._id },
    {
      $set: {
        state,
      },
    }
  );
};

export const voteAsync = async (
  pin: string,
  accessToken: string,
  trackUri: string,
  state: VoteState
): Promise<Partial<Vote>> => {
  try {
    const me = await getMeAsync(accessToken);

    const collection = await mongoCollectionAsync("votes");
    const vote: Vote = {
      pin,
      createdBy: me.id,
      trackUri,
      state,
    };

    await saveVote(collection, state, vote);
    return vote;
  } catch (error) {
    logger.error("voteAsync error", error);
    throw new Error("Unable to vote");
  }
};
