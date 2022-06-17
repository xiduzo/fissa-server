import {VercelApiHandler} from '@vercel/node';
import {getRoomByPin, mongo} from '../../utils/database';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';
import {createPin} from '../../utils/pin';
import {Room} from '../../lib/interfaces/Room';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/spotify';
import {createPlaylistAsync} from '../../utils/spotify';

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
      console.log('accessToken', accessToken);

      try {
        let pin: string;
        let blockedPins: string[] = [];
        do {
          const _pin = createPin(blockedPins);
          const room = await getRoomByPin(_pin);

          if (room) {
            blockedPins.push(_pin);
            return;
          }

          pin = _pin;
        } while (pin === undefined);

        console.log('use available pin', pin);

        mongo(async (err, database) => {
          if (err) {
            response
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
            return;
          }

          const rooms = database.collection<Partial<Room>>('room');
          //   const createdPlaylistId = await createPlaylistAsync(
          //     accessToken,
          //     playlistId,
          //   );

          const room = {
            pin,
            playlistId: playlistId,
            currentIndex: 0,
          };

          console.log('creating room', room);
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
