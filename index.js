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
  const config = {
    ...credentials,
    redirectUri: req.body.redirect_uri,
    clientId: req.body.clientId,
    codeVerifier: req.body.code_verifier,
  };

  console.log(req.body, credentials, config);

  const spotifyApi = new SpotifyWebApi(config);
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);

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
