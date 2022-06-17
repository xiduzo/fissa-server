import {MongoClient, ServerApiVersion, Db, AnyError} from 'mongodb';

const user = process.env.MONGO_DB_USER;
const password = process.env.MONGO_DB_PASSWORD;
export const mongoClient = new MongoClient(
  `mongodb+srv://${user}:${password}@fissa.yp209.mongodb.net/?retryWrites=true&w=majority`,
  {
    serverApi: ServerApiVersion.v1,
  },
);

export const mongo = async (
  callback: (err: AnyError, database: Db) => Promise<any>,
) => {
  const close = () => mongoClient.close();
  try {
    console.log('connecting to db', user, password);
    mongoClient.connect((error, client) => {
      if (error) {
        console.log('can not connect to mongo', error);
        callback(error, null).finally(close);
        return;
      }

      callback(error, client.db('fissa')).finally(close);
    });
  } catch (e) {
    console.error(e);
  }
};

export const getRoomByPin = async (pin: string): Promise<any | void> => {
  mongo(async (err, database) => {
    if (err) Promise.reject(err);

    const rooms = database.collection('room');
    const query = {pin};
    const room = await rooms.findOne(query);

    console.log('room for pin', pin, room);
    Promise.resolve(room);
  });
};
