import {VercelApiHandler} from '@vercel/node';
import SpotifyWebApi from 'spotify-web-api-node';
import {credentials} from '../token';

const handler: VercelApiHandler = async (req, res) => {
  switch (req.method) {
    case 'GET':
      res.send(
        JSON.stringify({
          hi: 'there',
        }),
      );
      break;
    case 'POST':
      const spotifyApi = new SpotifyWebApi({
        ...credentials,
        redirectUri: req.body.redirect_uri,
      });
      spotifyApi.setAccessToken(req.body.access_token);
      spotifyApi.setRefreshToken(req.body.refresh_token);
      const response = await spotifyApi.refreshAccessToken();
      res.status(200).send(JSON.stringify(response.body));
      break;
  }
};

export default handler;
