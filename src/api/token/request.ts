import {VercelApiHandler} from '@vercel/node';
import SpotifyWebApi from 'spotify-web-api-node';
import {credentials} from '../token';

const handleAccessToken: VercelApiHandler = async (req, res) => {
  const spotifyApi = new SpotifyWebApi({
    ...credentials,
    redirectUri: req.body.redirect_uri,
  });
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);
  res.status(200).send(JSON.stringify(response.body));
};

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
      const response = await spotifyApi.authorizationCodeGrant(req.body.code);
      res.status(200).send(JSON.stringify(response.body));
      break;
  }
};

export default handler;
