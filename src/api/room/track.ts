import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { BadRequest } from "../../lib/classes/errors/BadRequest";
import { TrackService } from "../../service/TrackService";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    const trackService = new TrackService();

    if (method === "GET") {
      const pin = request.query.pin as string;

      if (!pin) throw new BadRequest("Pin is required");

      const tracks = await trackService.getTracks(pin);
      await responseAsync(response, StatusCodes.OK, tracks);
    }

    if (method === "POST") {
      // TODO: add validation
      const { pin, trackIds, createdBy } = body as {
        pin: string;
        trackIds: string[];
        createdBy: string;
      };

      await trackService.addTracks(pin, trackIds, createdBy);

      await responseAsync(response, StatusCodes.OK, trackIds.length);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
