import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { createPin } from "../../utils/pin";
import {
  createPlaylistAsync,
  startPlaylistFromTopAsync,
} from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      const { pin } = request.body;
      if (!pin) {
        response
          .status(StatusCodes.BAD_REQUEST)
          .json(ReasonPhrases.BAD_REQUEST);
        return;
      }

      try {
        const collection = await mongoCollectionAsync("room");

        const room = await collection.findOne<Room>({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        response.status(StatusCodes.OK).json(room);
      } catch (error) {
        console.error(error);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
      break;
    case "POST":
      const { playlistId, accessToken } = request.body;

      let newPin: string;
      let blockedPins: string[] = [];

      try {
        const collection = await mongoCollectionAsync("room");
        do {
          newPin = createPin(blockedPins);
          const room = await collection.findOne({ pin: newPin });

          if (room) {
            blockedPins.push(pin);
            newPin = undefined;
            return;
          }
        } while (newPin === undefined);

        const { playlistId: createdPlaylistId, createdBy } =
          await createPlaylistAsync(accessToken, playlistId);

        const room = {
          pin: newPin,
          playlistId: createdPlaylistId,
          createdBy,
          accessToken,
        };

        await collection.insertOne(room);
        await startPlaylistFromTopAsync({ ...room, currentIndex: 0 });

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
