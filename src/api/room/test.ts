import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getMyQueue } from "../../utils/spotify";
import { responseAsync } from "../../utils/response";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::skip",
      });
      break;
    case "POST":
      const { accessToken } = request.body as {
        accessToken: string;
      };

      if (!accessToken) {
        logger.warn(`No access token provided`, { request });
        await responseAsync(
          response,
          StatusCodes.BAD_REQUEST,
          ReasonPhrases.BAD_REQUEST
        );
        return;
      }

      try {
        const result = await getMyQueue(accessToken);

        logger.info("adadsafaf");
        logger.info("adadsdfg sdfg asdf gsafaf");

        await responseAsync(response, StatusCodes.OK, result);
      } catch (error) {
        logger.error(`skip POST handler: ${error}`);

        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );

        return;
      }
      break;
  }
};

export default handler;
