import {VercelApiHandler} from '@vercel/node';

export const credentials = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
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
  }
};

export default handler;
