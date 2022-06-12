import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import {credentials} from '..';

const tokenRouter = express.Router();

tokenRouter.get('/', async (req, res) => {
  res.send(
    JSON.stringify({
      hi: 'there',
    }),
  );
});

tokenRouter.post('/', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);

  res.send(JSON.stringify(response.body));
});

tokenRouter.post('/refresh', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  spotifyApi.setAccessToken(req.body.access_token);
  spotifyApi.setRefreshToken(req.body.refresh_token);

  const response = await spotifyApi.refreshAccessToken();
  res.send(JSON.stringify(response.body));
});

export default tokenRouter;
