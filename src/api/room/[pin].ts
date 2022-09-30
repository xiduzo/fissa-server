import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { Vote } from "../../lib/interfaces/Vote";
import { mongoCollection } from "../../utils/database";
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
        const rooms = await mongoCollection<Room>("room");

        const room = await rooms.findOne({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        delete room.accessToken;
        response.status(StatusCodes.OK).json(room);
      } catch (error) {
        logger.error(`[pin] GET handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
