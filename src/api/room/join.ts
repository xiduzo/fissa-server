import {VercelApiHandler} from '@vercel/node';
import {MongoClient, ServerApiVersion, Db} from 'mongodb';

export const mongoClient = new MongoClient(
  'mongodb+srv://xiduzo:enm8mr7lX5qjTqV1@fissa.yp209.mongodb.net/?retryWrites=true&w=majority',
  {
    serverApi: ServerApiVersion.v1,
  },
);

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'room::join',
        }),
      );
      break;
    case 'POST':
      try {
        const {pin} = request.body;
        console.log(pin);
        mongoClient.connect(async err => {
          if (err) response.status(500).send(JSON.stringify(err));

          const database = mongoClient.db('fissa');
          console.log(database.databaseName);
          const collection = await database.collection('rooms').findOne({pin});

          console.log(collection);

          response.status(200).send(JSON.stringify(collection));
        });
      } catch (e) {
        console.error(e);
        response.status(500).send(JSON.stringify(e));
      }
      // find room by pin
      // if room exists, return false
      // if room does not exist, create room and return true
      break;
  }
};

export default handler;
