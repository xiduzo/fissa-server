const express = require('express');
const actuator = require('express-actuator');
const SpotifyWebApi = require('spotify-web-api-node');
const http = require('http');
const https = require('https');

const credentials = {
  clientId: process.env.CLIENT_ID ?? 'a2a88c4618324942859ce3e1f888b938',
  clientSecret: process.env.CLIENT_ID ?? 'bfce3e5d96074c21ac4db8b4991c2f37',
  redirectUri: 'com.fissa:/oauth',
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(actuator());

const server = http.createServer(app);
const serverHttps = https.createServer(app);

app.post('/api/token', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);

  res.send(JSON.stringify(response.body));
});

app.post('/api/refresh', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  console.log(req.query);
  spotifyApi.setAccessToken(req.body.accessToken);
  spotifyApi.setRefreshToken(req.body.refreshToken);

  const response = await spotifyApi.refreshAccessToken();
  res.send(JSON.stringify(response.body));
});

const port = process.env.NODE_PORT ?? process.env.PORT ?? 8080;
const portHttps = process.env.HTTPS_PORT ?? 8443;

server.listen(port, async () => {
  console.log('Server running', server.address());
});

serverHttps.listen(portHttps, async () => {
  console.log('Https server running', serverHttps.address());
});
