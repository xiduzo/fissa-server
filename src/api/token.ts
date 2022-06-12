import {VercelApiHandler} from '@vercel/node';
import SpotifyWebApi from 'spotify-web-api-node';

// app.get('/api', (req, res) => {
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

const credentials = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
};

const handleAccessToken: VercelApiHandler = async (req, res) => {
  const spotifyApi = new SpotifyWebApi({
    ...credentials,
    redirectUri: req.body.redirect_uri,
  });
  const response = await spotifyApi.authorizationCodeGrant(req.body.code);
  res.status(200).send(JSON.stringify(response.body));
};

const handleRefreshToken: VercelApiHandler = async (req, res) => {
  const spotifyApi = new SpotifyWebApi({
    ...credentials,
    redirectUri: req.body.redirect_uri,
  });
  spotifyApi.setAccessToken(req.body.access_token);
  spotifyApi.setRefreshToken(req.body.refresh_token);
  const response = await spotifyApi.refreshAccessToken();
  res.status(200).send(JSON.stringify(response.body));
};

const handler: VercelApiHandler = (req, res) => {
  switch (req.method) {
    case 'GET':
      res.send(
        JSON.stringify({
          hi: 'there',
        }),
      );
      break;
    case 'POST':
      if (req.url?.endsWith('/request')) handleAccessToken(req, res);
      if (req.url?.endsWith('/refresh')) handleRefreshToken(req, res);
      break;
  }
};

export default handler;
