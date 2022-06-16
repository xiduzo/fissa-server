import {VercelApiHandler} from '@vercel/node';
import {useDatabase} from '../../database';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.send(
        JSON.stringify({
          app: 'room::join',
        }),
      );
      break;
    case 'POST':
      try {
        const {pin} = request.body;
        console.log(pin);
        const database = await useDatabase('fissa');
        console.log(database.databaseName);
        // const room = await database.collection('rooms').findOne({pin});

        // console.log(room);

        response.status(200).send(JSON.stringify(pin));
      } catch (e) {
        console.error(e);
        response.status(500).send(JSON.stringify(e));
      }
      // find room by pin
      // if room exists, return false
      // if room does not exist, create room and return true
      break;
  }
};

export default handler;
