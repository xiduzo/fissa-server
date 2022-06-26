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

export const voteAsync = async (
  pin: string,
  createdBy: string,
  trackUri: string,
  state: VoteState
): Promise<Partial<Vote>> => {
  return new Promise(async (resolve, reject) => {
    try {
      const collection = await mongoCollectionAsync("votes");
      const _vote: Partial<Vote> = {
        pin,
        createdBy,
        trackUri,
      };
      const vote = await collection.findOne<Vote>(_vote);

      console.log(vote);
      // See if user voted before -> update vote
      if (vote) {
        await collection.updateOne(
          { _id: vote._id },
          {
            $set: {
              state,
            },
          }
        );
        resolve(vote);
      } else {
        console.log(
          `vote on track by ${createdBy} on room ${pin} with state ${state}`
        );

        // TODO: do we need this else before after we resolve?
        // If user has not voted before -> add vote
        await collection.insertOne({
          pin,
          createdBy,
          trackUri,
          state,
        });

        resolve(_vote);
      }
    } catch (error) {
      reject(error);
    }
  });
};
