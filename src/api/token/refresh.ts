import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../../lib/constants/credentials";
import { mongoCollectionAsync } from "../../utils/database";
import { getMeAsync, disableShuffleAsync } from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "token::refresh",
      });
      break;
    case "POST":
      const spotifyApi = new SpotifyWebApi({
        ...SPOTIFY_CREDENTIALS,
        redirectUri: request.body.redirect_uri,
      });
      spotifyApi.setAccessToken(request.body.access_token);
      spotifyApi.setRefreshToken(request.body.refresh_token);

      const tokens = await spotifyApi.refreshAccessToken();

      const collection = await mongoCollectionAsync("room");
      const accessToken = tokens.body.access_token;

      const disableShuffle = disableShuffleAsync(accessToken);

      const me = await getMeAsync(accessToken);

      await collection.updateMany(
        { createdBy: me?.id },
        { $set: { accessToken } }
      );

      await disableShuffle;

      response.status(StatusCodes.OK).json(tokens.body);
      break;
  }
};

export default handler;
