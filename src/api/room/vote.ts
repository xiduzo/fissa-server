import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cleanupDbClient, getRoomVotes, vote } from "../../utils/database";
import { publish } from "../../utils/mqtt";
import { logger } from "../../utils/logger";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET": {
      try {
        const pin = (request.query.pin as string)?.toUpperCase();

        if (!pin) {
          response
            .status(StatusCodes.BAD_REQUEST)
            .json(ReasonPhrases.BAD_REQUEST);
          return;
        }

        const votes = await getRoomVotes(pin);

        response.status(StatusCodes.OK).json(votes);
      } catch (error) {
        logger.error(`Votes GET handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
    }
    case "POST": {
      const { pin, accessToken, trackId, state } = request.body;

      if (!accessToken) return;
      if (!pin) return;
      if (!trackId) return;
      if (!state) return;

      try {
        await vote(pin, accessToken, trackId, state);
        const votes = await getRoomVotes(pin);

        await publish(`fissa/room/${pin}/votes`, votes);
        response.status(StatusCodes.OK).json(ReasonPhrases.OK);
      } catch (error) {
        logger.error(`Votes POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
    }
  }

  cleanupDbClient();
};

export default handler;
