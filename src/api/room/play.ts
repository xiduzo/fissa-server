import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { pinValidation } from "../../lib/zod/pin";
import { z } from "zod";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    if (method === "POST") {
      const { pin } = z
        .object({
          pin: pinValidation,
        })
        .parse(body);

      const roomService = new RoomService();
      await roomService.restartRoom(pin);

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  } finally {
    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  }
};

export default handler;
