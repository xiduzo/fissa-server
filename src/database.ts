import {MongoClient, ServerApiVersion, Db} from 'mongodb';

export const mongoClient = new MongoClient(
  'mongodb+srv://xiduzo:enm8mr7lX5qjTqV1@fissa.yp209.mongodb.net/?retryWrites=true&w=majority',
  {
    serverApi: ServerApiVersion.v1,
  },
);

export const useDatabase = async (db: string): Promise<Db> => {
  await mongoClient.connect();
  return mongoClient.db(db);
};
