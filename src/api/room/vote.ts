import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { voteAsync } from "../../utils/database";
import { mongoCollectionAsync } from "../../utils/database";
import { Vote } from "../../lib/interfaces/Vote";
import { publishAsync } from "../../utils/mqtt";
import { logger } from "../../utils/logger";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::vote",
      });
      break;
    case "POST":
      const { pin, accessToken, trackUri, state } = request.body;

      if (!accessToken) return;
      if (!pin) return;
      if (!trackUri) return;
      if (!state) return;

      try {
        await voteAsync(pin, accessToken, trackUri, state);
        const votes = await mongoCollectionAsync<Vote>("votes");

        const roomVotes = await votes.find({ pin }).toArray();
        await publishAsync(`fissa/room/${pin}/votes`, roomVotes);

        response.status(StatusCodes.OK).json(ReasonPhrases.OK);
      } catch (error) {
        logger.error(error);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
