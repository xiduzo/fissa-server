import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { NotFound } from "../../lib/classes/errors/NotFound";

const handler: VercelApiHandler = async (request, response) => {
  const { method, query } = request;

  const service = new RoomService();

  try {
    if (method === "GET") {
      // TODO type validations using ZOD
      const pin = query.pin as string;

      if (!pin) throw new NotFound(`Room ${pin} not found`);

      const room = await service.getRoom(pin.toUpperCase());

      delete room.accessToken;
      await responseAsync(response, StatusCodes.OK, room);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
