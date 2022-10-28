import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getRoomVotes, vote } from "../../utils/database";
import { publish } from "../../utils/mqtt";
import { logger } from "../../utils/logger";
import { responseAsync } from "../../utils/response";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET": {
      try {
        const pin = (request.query.pin as string)?.toUpperCase();

        if (!pin) {
          await responseAsync(
            response,
            StatusCodes.BAD_REQUEST,
            ReasonPhrases.BAD_REQUEST
          );
          return;
        }

        const votes = await getRoomVotes(pin);

        await responseAsync(response, StatusCodes.OK, votes);
      } catch (error) {
        logger.error(`Votes GET handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
    }
    case "POST": {
      const { pin, accessToken, trackId, state, createdBy } = request.body;

      if (!createdBy || !state || !trackId || !pin || !accessToken) {
        await responseAsync(
          response,
          StatusCodes.BAD_REQUEST,
          ReasonPhrases.BAD_REQUEST
        );
        return;
      }

      try {
        await vote(pin, createdBy, trackId, state);
        const votes = await getRoomVotes(pin);

        await publish(`fissa/room/${pin}/votes`, votes);
        await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
      } catch (error) {
        logger.error(`Votes POST handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
    }
  }
};

export default handler;
