import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { RoomService } from "../../service/RoomService";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    const roomService = new RoomService();

    if (method === "POST") {
      const { accessToken, refreshToken, playlistId, createdBy } = body;

      const pin = roomService.createRoom(
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
