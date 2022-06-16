import {VercelApiHandler} from '@vercel/node';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'room',
        }),
      );
      break;
  }
};

export default handler;
