import {VercelApiHandler} from '@vercel/node';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/credentials';
import {Room} from '../../lib/interfaces/Room';
import {mongo} from '../../utils/database';
import {publish} from '../../utils/mqtt';
import {addTracksToPlaylistAsync} from '../../utils/spotify';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'room::tracks',
        }),
      );
      break;
    case 'POST':
      const {pin, accessToken, trackUris} = request.body;
      const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
      spotifyApi.setAccessToken(accessToken);

      console.log(pin, accessToken, trackUris);
      try {
        mongo(async (err, database) => {
          if (err) {
            response.status(StatusCodes.INTERNAL_SERVER_ERROR).send(err);
            return;
          }

          const collection = database.collection('room');

          const room = await collection.findOne<Room>({pin});

          if (!room) {
            response
              .status(StatusCodes.NOT_FOUND)
              .json(ReasonPhrases.NOT_FOUND);
            return;
          }

          const numberOfAddedTracks = await addTracksToPlaylistAsync(
            accessToken,
            room.playlistId,
            trackUris,
          );

          publish(
            `fissa/room/${pin}/tracks/added`,
            JSON.stringify(trackUris.length),
            err => {
              if (err) {
                response.status(StatusCodes.INTERNAL_SERVER_ERROR).send(err);
                return;
              }

              response.status(StatusCodes.OK).json(trackUris.length);
            },
          );
        });
      } catch (e) {
        console.warn(e);
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
      }
      break;
  }
};

export default handler;
