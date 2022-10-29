import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  const service = new RoomService();

  try {
    const { accessToken, refreshToken, playlistId, createdBy } = body;

    if (method === "POST") {
      const pin = service.createRoom(
        accessToken,
        refreshToken,
        playlistId,
        createdBy
      );

      await responseAsync(response, StatusCodes.OK, pin);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
