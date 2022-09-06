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
      await mongoClient.close();
      reject(error);
    }
  });
};

export const mongoCollectionAsync = async (
  name: string,
  options?: CollectionOptions
): Promise<Collection<Document>> => {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await mongoDbAsync();
      resolve(database.collection(name, options));
    } catch (error) {
      reject(error);
    }
  });
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
    await collection.insertOne(vote as Omit<Vote, "_id">);
    return;
  }

  await collection.updateOne(
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
  return new Promise(async (resolve, reject) => {
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
      resolve(vote);
    } catch (error) {
      reject(error);
    }
  });
};
