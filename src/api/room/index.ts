import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { z } from "zod";

const POST_SCHEMA = z.object({
  playlistId: z.string().optional(),
  trackUris: z.array(z.string()).optional(),
  createdBy: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
});

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    const roomService = new RoomService();

    if (method === "POST") {
      const { accessToken, refreshToken, playlistId, createdBy, trackUris } =
        POST_SCHEMA.parse(body);

      const pin = await roomService.createRoom(
        accessToken,
        refreshToken,
        createdBy,
        playlistId,
        trackUris
      );

      await responseAsync(response, StatusCodes.OK, pin);
      return;
    }

    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
