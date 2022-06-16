import {MongoClient, ServerApiVersion, Db, AnyError} from 'mongodb';

export const mongoClient = new MongoClient(
  'mongodb+srv://xiduzo:enm8mr7lX5qjTqV1@fissa.yp209.mongodb.net/?retryWrites=true&w=majority',
  {
    serverApi: ServerApiVersion.v1,
  },
);

export const mongo = async (
  callback: (err: AnyError, database: Db) => void,
) => {
  try {
    mongoClient.connect((err, client) => {
      if (err) {
        callback(err, null);
      } else {
        callback(err, client.db('fissa'));
      }
    });
  } catch (e) {
    console.error(e);
  }
};
