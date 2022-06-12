// import SpotifyWebApi from 'spotify-web-api-node';
// import express from 'express';
// import {clientErrorHandler, credentials, errorHandler, logErrors} from '..';

// export const app = express();

// app.use(express.json());
// app.use(express.urlencoded({extended: true}));
// app.use(logErrors);
// app.use(clientErrorHandler);
// app.use(errorHandler);

// app.get('/api/token', async (req, res) => {
//   res.send(
//     JSON.stringify({
//       hi: 'there',
//     }),
//   );
// });

// app.post('/api/token', async (req, res) => {
//   const spotifyApi = new SpotifyWebApi(credentials);
//   const response = await spotifyApi.authorizationCodeGrant(req.body.code);

//   res.send(JSON.stringify(response.body));
// });

// app.post('/api/token/refresh', async (req, res) => {
//   const spotifyApi = new SpotifyWebApi(credentials);
//   spotifyApi.setAccessToken(req.body.access_token);
//   spotifyApi.setRefreshToken(req.body.refresh_token);

//   const response = await spotifyApi.refreshAccessToken();
//   res.send(JSON.stringify(response.body));
// });

// export default app;

const app = require('express')();

app.get('/api', (req, res) => {
  const path = `/api/item/1234`;
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
  res.end(`Hello! Go to item: <a href="${path}">${path}</a>`);
});

app.get('/api/item/:slug', (req, res) => {
  const {slug} = req.params;
  res.end(`Item: ${slug}`);
});

module.exports = app;
