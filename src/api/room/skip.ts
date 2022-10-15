import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cleanupDbClient, getRoom } from "../../utils/database";
import { addTackToQueue, skipTrack } from "../../utils/spotify";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::skip",
      });
      break;
    case "POST":
      const { pin, createdBy } = request.body as {
        pin: string;
        createdBy: string;
      };

      if (!pin) {
        response
          .status(StatusCodes.BAD_REQUEST)
          .json(ReasonPhrases.BAD_REQUEST);
        return;
      }

      try {
        const room = await getRoom(pin);

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        if (room.createdBy !== createdBy) {
          response
            .status(StatusCodes.METHOD_NOT_ALLOWED)
            .json(ReasonPhrases.METHOD_NOT_ALLOWED);
          return;
        }

        const { accessToken } = room;

        const skipped = await skipTrack(accessToken);

        logger.info(`${pin}: skipped track: ${skipped}`);
        if (!skipped) {
          response
            .status(StatusCodes.UNPROCESSABLE_ENTITY)
            .json(ReasonPhrases.UNPROCESSABLE_ENTITY);
          return;
        }

        const nextTrackId = await updateRoom(room);
        await addTackToQueue(accessToken, nextTrackId);

        response.status(StatusCodes.OK).json(ReasonPhrases.OK);
      } catch (error) {
        logger.error(`skip POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
        return;
      } finally {
        await cleanupDbClient();
      }
      break;
  }
};

export default handler;
