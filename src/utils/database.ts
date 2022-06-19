import {
  Collection,
  CollectionOptions,
  Db,
  Document,
  MongoClient,
  ServerApiVersion,
} from 'mongodb';
import {MONGO_CREDENTIALS} from '../lib/constants/credentials';

const {user, password} = MONGO_CREDENTIALS;

export const mongoClient = new MongoClient(
  `mongodb+srv://${user}:${password}@fissa.yp209.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: ServerApiVersion.v1,
  },
);

export const mongoDbAsync = async (): Promise<Db> => {
  return new Promise(async (resolve, reject) => {
    try {
      mongoClient.connect(async (error, client) => {
        if (error) {
          await mongoClient.close();
          reject(error);
        }

        resolve(client.db('fissa'));
      });
    } catch (error) {
      await mongoClient.close();
      reject(error);
    }
  });
};

export const mongoCollectionAsync = async (
  name: string,
  options?: CollectionOptions,
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
