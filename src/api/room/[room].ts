import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";

const handler: VercelApiHandler = async (request, response) => {
  response
    .status(StatusCodes.OK)
    .json({ query: request.query, other: request.body });
  return;
  switch (request.method) {
    case "GET":
      const query = request.query;
      const pin = "1234";
      response
        .status(StatusCodes.OK)
        .json({ query: request.query, other: request.body });
      return;
      if (!pin) {
        response
          .status(StatusCodes.BAD_REQUEST)
          .json(ReasonPhrases.BAD_REQUEST);
        return;
      }

      try {
        const collection = await mongoCollectionAsync("room");

        const room = await collection.findOne<Room>({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

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
