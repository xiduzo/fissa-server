import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { vote } from "../../utils/database";
import { publish } from "../../utils/mqtt";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { BadRequest } from "../../lib/classes/errors/BadRequest";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body, query } = request;

  const service = new RoomService();

  try {
    if (method === "GET") {
      const pin = (query.pin as string)?.toUpperCase();

      if (!pin) throw new BadRequest("Pin is required");

      const votes = await service.getVotes(pin);

      await responseAsync(response, StatusCodes.OK, votes);
    }

    if (method === "POST") {
      const { pin, accessToken, trackId, state, createdBy } = body;

      if (!createdBy || !state || !trackId || !pin || !accessToken) {
        throw new BadRequest("Missing required fields");
      }

      await vote(pin, createdBy, trackId, state);
      const votes = await service.getVotes(pin);

      await publish(`fissa/room/${pin}/votes`, votes);
      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
