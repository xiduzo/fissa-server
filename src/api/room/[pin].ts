import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cleanupDbClient, getRoom } from "../../utils/database";
import { logger } from "../../utils/logger";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      const pin = (request.query.pin as string)?.toUpperCase();

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

        delete room.accessToken;
        response.status(StatusCodes.OK).json(room);
      } catch (error) {
        logger.error(`[pin] GET handler: ${error}`);

        if (error instanceof Error) {
          if (error.message === ReasonPhrases.NOT_FOUND) {
            response
              .status(StatusCodes.NOT_FOUND)
              .json(ReasonPhrases.NOT_FOUND);
            return;
          }
        }

        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      } finally {
        await cleanupDbClient();
      }
      break;
  }
};

export default handler;
