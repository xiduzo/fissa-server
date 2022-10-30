import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { BadRequest } from "../../lib/classes/errors/BadRequest";
import { VoteService } from "../../service/VoteService";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body, query } = request;

  try {
    const voteService = new VoteService();

    if (method === "GET") {
      const pin = query.pin as string;

      if (!pin) throw new BadRequest("Pin is required");

      const votes = await voteService.getVotes(pin);

      await responseAsync(response, StatusCodes.OK, votes);
    }

    if (method === "POST") {
      const { pin, accessToken, trackId, state, createdBy } = body;

      if (!createdBy || !state || !trackId || !pin || !accessToken) {
        throw new BadRequest("Missing required fields");
      }

      await voteService.voteForTracks(pin, [trackId], createdBy);

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
