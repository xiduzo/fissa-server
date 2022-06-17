import {VercelApiHandler} from '@vercel/node';
import {MongoClient, ServerApiVersion} from 'mongodb';
import {getRoomByPin, mongo} from '../../utils/database';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';
import {createPin} from '../../utils/pin';
import {Room} from '../../lib/interfaces/Room';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/spotify';
import {createPlaylistAsync} from '../../utils/spotify';

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
      const {playlistId, accessToken} = request.body;
      const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
      spotifyApi.setAccessToken(accessToken);

      try {
        let pin: string;
        while (pin === undefined) {
          try {
            const _pin = createPin();
            const room = await getRoomByPin(pin);

            if (!room) return;

            pin = _pin;
          } catch (e) {
            console.log(e);
          }
        }

        mongo(async (err, database) => {
          if (err) response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(err);

          const rooms = database.collection<Partial<Room>>('room');
          const createdPlaylistId = await createPlaylistAsync(
            accessToken,
            playlistId,
          );

          const room = {
            pin,
            playlistId: createdPlaylistId,
            currentIndex: 0,
          };

          rooms.insertOne(room);

          response.status(StatusCodes.OK).json(room);
        });
      } catch (e) {
        console.error(e);
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
      }
      break;
  }
};

export default handler;
