import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { TrackService } from "../../service/TrackService";
import { z } from "zod";
import { pinValidation } from "../../lib/zod/pin";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body, query } = request;

  try {
    const trackService = new TrackService();

    if (method === "GET") {
      const { pin } = z
        .object({
          pin: pinValidation,
        })
        .parse(query);

      const tracks = await trackService.getTracks(pin);
      await responseAsync(response, StatusCodes.OK, tracks);
      return;
    }

    if (method === "POST") {
      const { pin, trackIds, createdBy } = z
        .object({
          pin: pinValidation,
          createdBy: z.string(),
          trackIds: z.array(z.string()),
        })
        .parse(body);

      await trackService.addTracks(pin, trackIds, createdBy);

      await responseAsync(response, StatusCodes.OK, trackIds.length);
      return;
    }

    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
