import {VercelApiHandler} from '@vercel/node';
import {MongoClient, ServerApiVersion} from 'mongodb';
import {mongo} from '../../database';

const user = process.env.MONGO_DB_USER;
const password = process.env.MONGO_DB_PASSWORD;
export const mongoClient = new MongoClient(
  `mongodb+srv://${user}:${password}@fissa.yp209.mongodb.net/?retryWrites=true&w=majority`,
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
        console.log(JSON.parse(request.body), request.body, pin);
        mongo(async (err, database) => {
          if (err) response.status(500).send(JSON.stringify(err));

          const rooms = database.collection('rooms');
          const query = {pin};
          console.log(query);
          const room = await rooms.findOne(query);

          console.log(room);
          if (!room) {
            response.status(404).send('');
            return;
          }

          response.status(200).send(JSON.stringify(room));
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
