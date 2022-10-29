import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { TokenService } from "../../service/TokenService";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  const service = new TokenService();

  try {
    if (method === "POST") {
      const { access_token, refresh_token } = body;

      const tokens = await service.refreshToken(access_token, refresh_token);

      await responseAsync(response, StatusCodes.OK, tokens);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
