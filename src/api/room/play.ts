import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { BadRequest } from "../../lib/classes/errors/BadRequest";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  const service = new RoomService();

  try {
    if (method === "POST") {
      // TODO: only creator should be able to restart room
      const pin = body.pin as string;

      if (!pin) throw new BadRequest("Pin is required");

      await service.restartRoom(pin.toUpperCase());

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
