import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getRoom } from "../../utils/database";
import { addTackToQueue, skipTrack } from "../../utils/spotify";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";
import { responseAsync } from "../../utils/response";

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
        await responseAsync(
          response,
          StatusCodes.BAD_REQUEST,
          ReasonPhrases.BAD_REQUEST
        );
        return;
      }

      try {
        const room = await getRoom(pin);

        if (!room) {
          await responseAsync(
            response,
            StatusCodes.NOT_FOUND,
            ReasonPhrases.NOT_FOUND
          );
          return;
        }

        if (room.createdBy !== createdBy) {
          await responseAsync(
            response,
            StatusCodes.UNAUTHORIZED,
            ReasonPhrases.UNAUTHORIZED
          );
          return;
        }

        const { accessToken } = room;

        const skipped = await skipTrack(accessToken);

        logger.info(`${pin}: skipped track: ${skipped}`);
        if (!skipped) {
          await responseAsync(
            response,
            StatusCodes.UNPROCESSABLE_ENTITY,
            ReasonPhrases.UNPROCESSABLE_ENTITY
          );
          return;
        }

        const nextTrackId = await updateRoom(room);
        await addTackToQueue(accessToken, nextTrackId);

        await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
      } catch (error) {
        logger.error(`skip POST handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
        return;
      }
      break;
  }
};

export default handler;
