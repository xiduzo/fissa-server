import {VercelApiHandler} from '@vercel/node';
import {MongoClient, ServerApiVersion} from 'mongodb';

const mongo = new MongoClient(
  'mongodb+srv://xiduzo:enm8mr7lX5qjTqV1@fissa.yp209.mongodb.net/?retryWrites=true&w=majority',
  {
    serverApi: ServerApiVersion.v1,
  },
);
const database = mongo.db('fissa');

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
      const {pin} = request.body;

      const room = await database.collection('rooms').findOne({pin: pin});

      console.log(room);

      // find room by pin
      // if room exists, return false
      // if room does not exist, create room and return true
      break;
  }
};

export default handler;
