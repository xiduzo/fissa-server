import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { mongoCollectionAsync } from "../../utils/database";
import { createPin } from "../../utils/pin";
import { createPlaylistAsync } from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::create",
      });
      break;
    case "POST":
      const { playlistId, accessToken } = request.body;

      let pin: string;
      let blockedPins: string[] = [];

      try {
        const collection = await mongoCollectionAsync("room");
        do {
          pin = createPin(blockedPins);
          const room = await collection.findOne({ pin });

          if (room) {
            blockedPins.push(pin);
            pin = undefined;
            return;
          }
        } while (pin === undefined);

        const { playlistId: createdPlaylistId, createdBy } =
          await createPlaylistAsync(accessToken, playlistId);

        const room = {
          pin,
          playlistId: createdPlaylistId,
          createdBy,
          accessToken,
        };

        await collection.insertOne(room);

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
