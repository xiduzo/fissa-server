import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { TokenService } from "./TokenService";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  const service = new TokenService();

  try {
    if (method === "GET") {
      // TODO type validations
      const { code, redirect_uri } = body;

      const tokens = await service.authorizationCodeGrant(code, redirect_uri);

      await responseAsync(response, StatusCodes.OK, tokens.body);
    }
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
