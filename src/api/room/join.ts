import {VercelApiHandler} from '@vercel/node';
import {MongoClient, ServerApiVersion} from 'mongodb';
import {mongo} from '../../database';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';

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
        if (!pin)
          response
            .status(StatusCodes.BAD_REQUEST)
            .json(ReasonPhrases.BAD_REQUEST);
        mongo(async (err, database) => {
          if (err) response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(err);

          const rooms = database.collection('room');
          const query = {pin};
          const room = await rooms.findOne(query);

          if (!room) {
            response
              .status(StatusCodes.NOT_FOUND)
              .json(ReasonPhrases.NOT_FOUND);
            return;
          }

          response.status(StatusCodes.OK).json(room);
        });
      } catch (e) {
        console.error(e);
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
      }
      // find room by pin
      // if room not exists, return 500
      // if room does exist, return room
      break;
  }
};

export default handler;
