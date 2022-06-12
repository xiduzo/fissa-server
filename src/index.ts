import {NextFunction, Request, Response} from 'express';
import http from 'http';
import https from 'https';
import app from './api/index';

export const credentials = {
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

export const clientErrorHandler: Middleware = (err, req, res, next) => {
  if (req.xhr) {
    res.status(500).send({error: 'Something failed!'});
  } else {
    next(err);
  }
};

export const errorHandler: Middleware = (err, req, res, next) => {
  res.status(500);
  res.render('error', {error: err});
};

export const logErrors: Middleware = (err, req, res, next) => {
  console.error(err.stack);
  next(err);
};

/* Local server */
const server = http.createServer(app);
const serverHttps = https.createServer(app);

const port = process.env.NODE_PORT ?? process.env.PORT ?? 8080;
const portHttps = process.env.HTTPS_PORT ?? 8443;

server.listen(port, async () => {
  console.log('Server running', server.address());
});

serverHttps.listen(portHttps, async () => {
  console.log('Https server running', serverHttps.address());
});
