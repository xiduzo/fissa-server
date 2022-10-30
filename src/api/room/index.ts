import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";
import { z } from "zod";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    if (method === "POST") {
      const { accessToken, refreshToken, playlistId, createdBy } = z
        .object({
          playlistId: z.string().optional(),
          createdBy: z.string(),
          accessToken: z.string(),
          refreshToken: z.string(),
        })
        .parse(body);

      const roomService = new RoomService();
      const pin = await roomService.createRoom(
        accessToken,
        refreshToken,
        playlistId,
        createdBy
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
