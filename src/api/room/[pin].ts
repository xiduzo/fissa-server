import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { z } from "zod";
import { pinValidation } from "../../lib/zod/pin";

const handler: VercelApiHandler = async (request, response) => {
  const { method, query } = request;

  try {
    if (method === "GET") {
      const { pin } = z
        .object({
          pin: pinValidation,
        })
        .parse(query);

      const roomService = new RoomService();
      const room = await roomService.getRoom(pin);

      delete room.accessToken;
      delete room.refreshToken;
      await responseAsync(response, StatusCodes.OK, room);
    }
  } catch (error) {
    await handleRequestError(response, error);
  } finally {
    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  }
};

export default handler;
