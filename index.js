const express = require('express');
const actuator = require('express-actuator');
const SpotifyWebApi = require('spotify-web-api-node');
const http = require('http');
const https = require('https');

const baseSpotifyAuth = {
  client_secret: process.env.CLIENT_ID,
};

const spotifyApi = new SpotifyWebApi(baseSpotifyAuth);

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(actuator());

const server = http.createServer(app);
const serverHttps = https.createServer(app);

app.post('/api/token', async (req, res) => {
  console.log({
    ...req.body,
    ...baseSpotifyAuth,
  });
  const response = await spotifyApi.authorizationCodeGrant({
    ...req.body,
    ...baseSpotifyAuth,
  });

  console.log('response', response);

  res.send(JSON.stringify(response));
});

app.post('/api/refresh', (req, res) => {});

const port = process.env.NODE_PORT ?? process.env.PORT ?? 8080;
const portHttps = process.env.HTTPS_PORT ?? 8443;

server.listen(port, async () => {
  console.log('Server running', server.address());
});

serverHttps.listen(portHttps, async () => {
  console.log('Https server running', serverHttps.address());
});
