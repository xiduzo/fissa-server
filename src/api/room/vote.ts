import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { vote } from "../../utils/database";
import { mongoCollection } from "../../utils/database";
import { Vote } from "../../lib/interfaces/Vote";
import { publishAsync } from "../../utils/mqtt";
import { logger } from "../../utils/logger";
import { reorderPlaylist } from "../../utils/spotify";
import { Room } from "../../lib/interfaces/Room";

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

        const votes = await mongoCollection<Vote>("vote");

        const roomVotes = await votes.find({ pin }).toArray();
        response.status(StatusCodes.OK).json(roomVotes);
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
        const votes = await mongoCollection<Vote>("vote");

        const roomVotes = await votes.find({ pin }).toArray();
        await publishAsync(`fissa/room/${pin}/votes`, roomVotes);

        const rooms = await mongoCollection<Room>("room");
        const room = await rooms.findOne({ pin });
        await reorderPlaylist(room, roomVotes);
        await publishAsync(`fissa/room/${room.pin}/tracks/reordered`);

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
};

export default handler;
