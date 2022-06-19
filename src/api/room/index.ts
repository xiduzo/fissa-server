import {VercelApiHandler} from '@vercel/node';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send({
        app: 'room',
      });
      break;
  }
};

export default handler;
