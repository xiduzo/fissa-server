import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { TokenService } from "../../service/TokenService";
import { z } from "zod";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    if (method === "POST") {
      const { access_token, refresh_token } = z
        .object({
          access_token: z.string(),
          refresh_token: z.string(),
        })
        .parse(body);

      const tokenService = new TokenService();
      const tokens = await tokenService.refresh(access_token, refresh_token);

      await responseAsync(response, StatusCodes.OK, tokens);
    }
  } catch (error) {
    await handleRequestError(response, error);
  } finally {
    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  }
};

export default handler;
