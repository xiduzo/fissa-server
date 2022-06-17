import {VercelApiHandler} from '@vercel/node';
import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../../lib/constants/spotify';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'token::refresh',
        }),
      );
      break;
    case 'POST':
      const spotifyApi = new SpotifyWebApi({
        ...SPOTIFY_CREDENTIALS,
        redirectUri: request.body.redirect_uri,
      });
      console.log(SPOTIFY_CREDENTIALS);
      spotifyApi.setAccessToken(request.body.access_token);
      spotifyApi.setRefreshToken(request.body.refresh_token);
      const tokens = await spotifyApi.refreshAccessToken();
      response.status(200).send(JSON.stringify(tokens.body));
      break;
  }
};

export default handler;
