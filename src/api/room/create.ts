import {VercelApiHandler} from '@vercel/node';
import {ReasonPhrases, StatusCodes} from 'http-status-codes';
import {mongoCollectionAsync} from '../../utils/database';
import {createPin} from '../../utils/pin';
import {createPlaylistAsync} from '../../utils/spotify';
import fetch from 'node-fetch';

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case 'GET':
      response.json({
        app: 'room::create',
      });
      break;
    case 'POST':
      const {playlistId, accessToken} = request.body;

      let pin: string;
      let blockedPins: string[] = [];

      try {
        const collection = await mongoCollectionAsync('room');
        do {
          const _pin = createPin(blockedPins);
          const room = await collection.findOne({pin: _pin});

          if (room) {
            blockedPins.push(_pin);
            return;
          }

          pin = _pin;
        } while (pin === undefined);

        const createdPlaylistId = await createPlaylistAsync(
          accessToken,
          playlistId,
        );

        const room = {
          pin,
          playlistId: createdPlaylistId,
          currentIndex: 0,
        };

        await collection.insertOne(room);

        await fetch('http://xiduzo.synology.me:8000/api/token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            pin,
          }),
        });

        response.status(StatusCodes.OK).json(room);
      } catch (error) {
        console.error(error);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
