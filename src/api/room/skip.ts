import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { z } from "zod";
import { pinValidation } from "../../lib/zod/pin";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    const roomService = new RoomService();

    if (method === "POST") {
      // TODO: add track id in the request body
      // to validate if we still want to skip this track
      const { pin, createdBy } = z
        .object({
          pin: pinValidation,
          createdBy: z.string(),
        })
        .parse(body);

      await roomService.skipTrack(pin, createdBy);

      await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
      return;
    }

    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
