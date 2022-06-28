import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { voteAsync } from "../../utils/database";
import { updateVotes } from "../../utils/mqtt";

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
        console.log("VercelApiHandler", pin, accessToken, trackUri, state);
        const vote = await voteAsync(pin, accessToken, trackUri, state);
        console.log("VercelApiHandler vote", vote);
        updateVotes(pin);
        response.status(StatusCodes.OK).json(vote);
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
