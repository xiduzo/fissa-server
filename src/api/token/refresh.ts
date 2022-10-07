import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../../lib/constants/credentials";
import { Room } from "../../lib/interfaces/Room";
import { cleanupDbClient, mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
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

        await rooms.updateMany(
          { createdBy: me?.id },
          {
            $set: { accessToken: tokens.access_token },
          }
        );

        response.status(StatusCodes.OK).json(tokens);
      } catch (error) {
        logger.error(`Token refresh POST handler: ${error}`);
      } finally {
        await cleanupDbClient();
      }
      break;
  }
};

export default handler;
