import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { BadRequest } from "../../lib/classes/errors/BadRequest";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    const roomService = new RoomService();

    if (method === "POST") {
      // TODO: only creator should be able to restart room
      const pin = body.pin as string;

      if (!pin) throw new BadRequest("Pin is required");

      await roomService.restartRoom(pin);

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
