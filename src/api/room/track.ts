import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { VoteState } from "../../lib/interfaces/Vote";
import {
  addTracks,
  cleanupDbClient,
  getRoom,
  getRoomTracks,
  getRoomVotes,
  vote,
} from "../../utils/database";
import { publish } from "../../utils/mqtt";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET": {
      const pin = (request.query.pin as string)?.toUpperCase();

      if (!pin) {
        return response
          .status(StatusCodes.BAD_REQUEST)
          .json(ReasonPhrases.BAD_REQUEST);
      }

      try {
        const tracks = await getRoomTracks(pin);
        response.status(StatusCodes.OK).json(tracks);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      } finally {
        await cleanupDbClient();
      }
      break;
    }

    case "POST": {
      const {
        pin,
        trackIds,
        accessToken: userAccessToken,
      } = request.body as {
        pin: string;
        trackIds: string[];
        accessToken: string;
      };

      try {
        const room = await getRoom(pin);

        if (!room) {
          return response
            .status(StatusCodes.NOT_FOUND)
            .json(ReasonPhrases.NOT_FOUND);
        }

        const { accessToken } = room;

        await addTracks(accessToken, pin, trackIds);
        await publish(`fissa/room/${pin}/tracks/added`, trackIds.length);

        const votePromises = trackIds.map(async (id) =>
          vote(room.pin, userAccessToken, id, VoteState.Upvote)
        );

        await Promise.all(votePromises);

        const votes = await getRoomVotes(pin);
        await publish(`fissa/room/${pin}/votes`, votes);

        response.status(StatusCodes.OK).json(trackIds.length);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      } finally {
        await cleanupDbClient();
      }
      break;
    }
  }
};

export default handler;
