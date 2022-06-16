import {MongoClient, ServerApiVersion, Db, AnyError} from 'mongodb';

export const mongoClient = new MongoClient(
  'mongodb+srv://xiduzo:enm8mr7lX5qjTqV1@fissa.yp209.mongodb.net/?retryWrites=true&w=majority',
  {
    serverApi: ServerApiVersion.v1,
  },
);

type CloseConnection = () => void;

export const mongo = async (
  callback: (err: AnyError, database: Db) => Promise<any>,
) => {
  const close = () => mongoClient.close();
  try {
    mongoClient.connect((err, client) => {
      if (err) {
        callback(err, null).finally(close);
      } else {
        callback(err, client.db('fissa')).finally(close);
      }
    });
  } catch (e) {
    console.error(e);
  }
};
