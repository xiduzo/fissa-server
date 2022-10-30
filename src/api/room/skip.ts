import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { z } from "zod";
import { pinValidation } from "../../lib/zod/pin";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    if (method === "POST") {
      const { pin, createdBy } = z
        .object({
          pin: pinValidation,
          createdBy: z.string(),
        })
        .parse(body);

      const roomService = new RoomService();
      await roomService.skipTrack(pin, createdBy);

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
    }
  } catch (error) {
    await handleRequestError(response, error);
  } finally {
    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  }
};

export default handler;
