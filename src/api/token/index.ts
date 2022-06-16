import {VercelApiHandler} from '@vercel/node';
import SpotifyWebApi from 'spotify-web-api-node';

export const credentials = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
};

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
        ...credentials,
        redirectUri: redirect_uri,
      });
      const tokens = await spotifyApi.authorizationCodeGrant(code);
      response.status(200).send(JSON.stringify(tokens.body));
      break;
  }
};

export default handler;
