import {VercelApiHandler} from '@vercel/node';
import {StatusCodes} from 'http-status-codes';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/credentials';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.json({
        app: 'token',
      });
      break;
    case 'POST':
      const {code, redirect_uri} = request.body;
      const spotifyApi = new SpotifyWebApi({
        ...SPOTIFY_CREDENTIALS,
        redirectUri: redirect_uri,
      });
      const tokens = await spotifyApi.authorizationCodeGrant(code);

      response.status(StatusCodes.OK).json(tokens.body);
      break;
  }
};

export default handler;
