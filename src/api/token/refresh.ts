import {VercelApiHandler} from '@vercel/node';
import {StatusCodes} from 'http-status-codes';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/credentials';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.json({
        app: 'token::refresh',
      });
      break;
    case 'POST':
      const spotifyApi = new SpotifyWebApi({
        ...SPOTIFY_CREDENTIALS,
        redirectUri: request.body.redirect_uri,
      });
      spotifyApi.setAccessToken(request.body.access_token);
      spotifyApi.setRefreshToken(request.body.refresh_token);

      const tokens = await spotifyApi.refreshAccessToken();

      response.status(StatusCodes.OK).json(tokens.body);
      break;
  }
};

export default handler;
