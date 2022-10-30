import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { BadRequest } from "../../lib/classes/errors/BadRequest";
import { VoteService } from "../../service/VoteService";
import { pinValidation } from "../../lib/zod/pin";
import { z } from "zod";
import { VoteState } from "../../lib/interfaces/Vote";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body, query } = request;

  try {
    if (method === "GET") {
      const { pin } = z
        .object({
          pin: pinValidation,
        })
        .parse(query);

      const voteService = new VoteService();
      const votes = await voteService.getVotes(pin);

      await responseAsync(response, StatusCodes.OK, votes);
    }

    if (method === "POST") {
      const { pin, trackId, state, createdBy } = z
        .object({
          pin: pinValidation,
          trackId: z.string(),
          state: z.nativeEnum(VoteState),
          createdBy: z.string(),
        })
        .parse(body);

      const voteService = new VoteService();
      await voteService.voteForTracks(pin, [trackId], createdBy, state);

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  } finally {
    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  }
};

export default handler;
