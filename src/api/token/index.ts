import {VercelApiHandler} from '@vercel/node';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/credentials';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'token',
        }),
      );
      break;
    case 'POST':
      const {code, redirect_uri} = request.body;
      const spotifyApi = new SpotifyWebApi({
        ...SPOTIFY_CREDENTIALS,
        redirectUri: redirect_uri,
      });
      const tokens = await spotifyApi.authorizationCodeGrant(code);
      response.status(200).send(JSON.stringify(tokens.body));
      break;
  }
};

export default handler;
