import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getRoom } from "../../utils/database";
import { logger } from "../../utils/logger";
import { responseAsync } from "../../utils/response";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      const pin = (request.query.pin as string)?.toUpperCase();

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

        delete room.accessToken;
        await responseAsync(response, StatusCodes.OK, room);
      } catch (error) {
        logger.error(`[pin] GET handler: ${error}`);

        if (error instanceof Error) {
          if (error.message === ReasonPhrases.NOT_FOUND) {
            await responseAsync(
              response,
              StatusCodes.NOT_FOUND,
              ReasonPhrases.NOT_FOUND
            );
            return;
          }
        }

        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
  }
};

export default handler;
