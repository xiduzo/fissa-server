import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { cleanupDbClient, mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
import { responseAsync } from "../../utils/response";
import { getMe, updateTokens } from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "token::refresh",
      });
      break;
    case "POST":
      try {
        const { access_token, refresh_token } = request.body;

        const tokens = await updateTokens(access_token, refresh_token);

        const rooms = await mongoCollection<Room>("room");

        const me = await getMe(tokens.access_token);

        // TODO: temporary add refresh token of user in DB via this route
        // It should be added when creating the room
        await rooms.updateMany(
          { createdBy: me?.id },
          {
            $set: { accessToken: tokens.access_token },
          }
        );

        await responseAsync(response, StatusCodes.OK, tokens);
      } catch (error) {
        logger.error(`Token refresh POST handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
  }
};

export default handler;
