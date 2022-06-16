import {MongoClient, ServerApiVersion, Db} from 'mongodb';

export const mongoClient = new MongoClient(
  'mongodb+srv://xiduzo:enm8mr7lX5qjTqV1@fissa.yp209.mongodb.net/?retryWrites=true&w=majority',
  {
    serverApi: ServerApiVersion.v1,
  },
);

export const useDatabase = async (
  db: string,
  callback: Function,
): Promise<Db> => {
  console.log('connecting to database ' + db);
  try {
    await mongoClient.connect(err => {});
    Promise.resolve(mongoClient.db(db));
  } catch (e) {
    console.error(e);
    Promise.reject(e);
    return;
  }
};
