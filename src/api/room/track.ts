import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { BadRequest } from "../../lib/classes/errors/BadRequest";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  const service = new RoomService();

  try {
    if (method === "GET") {
      const pin = (request.query.pin as string)?.toUpperCase();

      if (!pin) throw new BadRequest("Pin is required");

      const tracks = await service.getTracks(pin);
      await responseAsync(response, StatusCodes.OK, tracks);
    }
    if (method === "POST") {
      // TODO: add validation
      const { pin, trackIds, createdBy } = body as {
        pin: string;
        trackIds: string[];
        createdBy: string;
      };

      await service.addTracks(pin, trackIds, createdBy);

      await responseAsync(response, StatusCodes.OK, trackIds.length);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
