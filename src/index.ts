import express, {Request, Response, NextFunction} from 'express';
import actuator from 'express-actuator';
import SpotifyWebApi from 'spotify-web-api-node';
import http from 'http';
import https from 'https';

const credentials = {
  clientId: process.env.CLIENT_ID ?? 'a2a88c4618324942859ce3e1f888b938',
  clientSecret: process.env.CLIENT_SECRET ?? 'bfce3e5d96074c21ac4db8b4991c2f37',
  redirectUri: 'com.fissa:/oauth',
};

type Middleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => void;

const clientErrorHandler: Middleware = (err, req, res, next) => {
  if (req.xhr) {
    res.status(500).send({error: 'Something failed!'});
  } else {
    next(err);
  }
};

const errorHandler: Middleware = (err, req, res, next) => {
  res.status(500);
  res.render('error', {error: err});
};

const logErrors: Middleware = (err, req, res, next) => {
  console.error(err.stack);
  next(err);
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(actuator());
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);

const server = http.createServer(app);
const serverHttps = https.createServer(app);

app.post('/api/token', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);

  res.send(JSON.stringify(response.body));
});

app.post('/api/refresh', async (req, res) => {
  const spotifyApi = new SpotifyWebApi(credentials);
  spotifyApi.setAccessToken(req.body.access_token);
  spotifyApi.setRefreshToken(req.body.refresh_token);

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