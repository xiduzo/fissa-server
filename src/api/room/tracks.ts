import {VercelApiHandler} from '@vercel/node';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/credentials';
import {getRoomByPin} from '../../utils/database';
import {addTracksToPlaylistAsync} from '../../utils/spotify';
import {publish} from '../../utils/mqtt';

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

      try {
        const room = await getRoomByPin(pin);

        if (!room)
          return response
            .status(StatusCodes.NOT_FOUND)
            .json(ReasonPhrases.NOT_FOUND);

        const numberOfAddedTracks = await addTracksToPlaylistAsync(
          accessToken,
          room.playlistId,
          trackUris,
        );

        await publish(
          `fissa/room/${pin}/tracksAdded`,
          JSON.stringify(numberOfAddedTracks),
        );

        response.status(StatusCodes.OK).json(numberOfAddedTracks);
      } catch (e) {
        console.warn(e);
        response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
      }
      break;
  }
};

export default handler;
