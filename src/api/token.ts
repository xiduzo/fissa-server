import SpotifyWebApi from 'spotify-web-api-node';
import express from 'express';
import {clientErrorHandler, credentials, errorHandler, logErrors} from '..';

const app = express();

const tokenRoutes = express.Router();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);
app.use('/api/token', tokenRoutes);

tokenRoutes.get('/', async (req, res) => {
  res.send(
    JSON.stringify({
      hi: 'there',
    }),
  );
});

tokenRoutes.post('/', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);

  res.send(JSON.stringify(response.body));
});

tokenRoutes.post('/refresh', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  spotifyApi.setAccessToken(req.body.access_token);
  spotifyApi.setRefreshToken(req.body.refresh_token);

  const response = await spotifyApi.refreshAccessToken();
  res.send(JSON.stringify(response.body));
});

module.exports = app;
