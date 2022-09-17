import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { logger } from "../../utils/logger";
import { createPin } from "../../utils/pin";
import {
  createPlaylistAsync,
  startPlaylistFromTopAsync,
} from "../../utils/spotify";

// TODO: dont give back the accessToken in response object
const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room",
      });
      break;
    case "POST":
      const { playlistId, accessToken } = request.body;

      let newPin: string;
      let blockedPins: string[] = [];

      try {
        const collection = await mongoCollectionAsync<Room>("room");
        do {
          newPin = createPin(blockedPins);
          const room = await collection.findOne({ pin: newPin });

          if (room) {
            blockedPins.push(newPin);
            newPin = undefined;
            return;
          }
        } while (newPin === undefined);

        const { playlistId: createdPlaylistId, createdBy } =
          await createPlaylistAsync(accessToken, playlistId);

        const room: Room = {
          pin: newPin,
          playlistId: createdPlaylistId,
          createdBy,
          accessToken,
          currentIndex: -1,
        };

        await collection.insertOne(room);
        await startPlaylistFromTopAsync(room);

        response.status(StatusCodes.OK).json(newPin);
      } catch (error) {
        logger.error(error);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
