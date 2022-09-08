import { logger } from "@utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { mongoCollectionAsync } from "../../utils/database";
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
        const collection = await mongoCollectionAsync("room");
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

        const room = {
          pin: newPin,
          playlistId: createdPlaylistId,
          createdBy,
          accessToken,
        };

        await collection.insertOne(room);
        // await startPlaylistFromTopAsync({ ...room, currentIndex: 0 });

        response.status(StatusCodes.OK).json(room);
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
