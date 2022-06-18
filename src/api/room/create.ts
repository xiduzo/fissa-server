import {VercelApiHandler} from '@vercel/node';
import {StatusCodes} from 'http-status-codes';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/credentials';
import {Room} from '../../lib/interfaces/Room';
import {mongo} from '../../utils/database';
import {createPin} from '../../utils/pin';
import {createPlaylistAsync} from '../../utils/spotify';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'room::create',
        }),
      );
      break;
    case 'POST':
      const {playlistId, accessToken} = request.body;
      const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
      spotifyApi.setAccessToken(accessToken);

      try {
        let pin: string;
        let blockedPins: string[] = [];
        mongo(async (err, database) => {
          if (err) {
            response.status(StatusCodes.INTERNAL_SERVER_ERROR).send(err);
            return;
          }

          do {
            const collection = database.collection('room');
            const _pin = createPin(blockedPins);
            const room = await collection.findOne({pin: _pin});

            if (room) {
              blockedPins.push(_pin);
              return;
            }

            pin = _pin;
          } while (pin === undefined);

          console.log('use available pin', pin);

          const createdPlaylistId = await createPlaylistAsync(
            accessToken,
            playlistId,
          );

          const room = {
            pin,
            playlistId: createdPlaylistId,
            currentIndex: 0,
          };

          console.log('creating room', room);
          const rooms = database.collection<Room>('room');
          await rooms.insertOne(room);

          response.status(StatusCodes.OK).json(room);
        });
      } catch (e) {
        console.warn(e);
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
      }
      break;
  }
};

export default handler;
