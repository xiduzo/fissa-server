import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../../lib/constants/credentials";
import { Room } from "../../lib/interfaces/Room";
import { cleanupDbClient, mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
import { getMe } from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "token::refresh",
      });
      break;
    case "POST":
      try {
        const spotifyApi = new SpotifyWebApi({
          ...SPOTIFY_CREDENTIALS,
          redirectUri: request.body.redirect_uri,
        });
        spotifyApi.setAccessToken(request.body.access_token);
        spotifyApi.setRefreshToken(request.body.refresh_token);

        const tokens = await spotifyApi.refreshAccessToken();

        const rooms = await mongoCollection<Room>("room");
        const accessToken = tokens.body.access_token;

        const me = await getMe(accessToken);

        await rooms.updateMany(
          { createdBy: me?.id },
          { $set: { accessToken } }
        );

        response.status(StatusCodes.OK).json(tokens.body);
      } catch (error) {
        logger.error(`Token refresh POST handler: ${error}`);
      } finally {
        await cleanupDbClient();
      }
      break;
  }
};

export default handler;
