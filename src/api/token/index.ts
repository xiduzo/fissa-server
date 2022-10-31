import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { handleRequestError, responseAsync } from "../../utils/http";
import { TokenService } from "../../service/TokenService";
import { z } from "zod";

const handler: VercelApiHandler = async (request, response) => {
  const { method, body } = request;

  try {
    const tokenService = new TokenService();

    if (method === "GET") {
      const { code, redirect_uri } = z
        .object({
          code: z.string(),
          redirect_uri: z.string(),
        })
        .parse(body);

      const tokens = await tokenService.codeGrant(code, redirect_uri);

      await responseAsync(response, StatusCodes.OK, tokens.body);
      return;
    }

    await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
  } catch (error) {
    await handleRequestError(response, error);
  }
};

export default handler;
