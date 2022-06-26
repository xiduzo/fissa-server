import { VercelApiHandler } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../../lib/constants/credentials";
import { mongoCollectionAsync } from "../../utils/database";
import { getMeAsync, setShuffleAsync } from "../../utils/spotify";

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
      const me = await getMeAsync(accessToken);
      const result = await collection.updateMany(
        { createdBy: me?.id },
        { $set: { accessToken } }
      );

      if (result.modifiedCount > 0) {
        // Make sure the shuffle is set to false
        // For owners of rooms
        console.log("Setting shuffle to false");
        await setShuffleAsync(accessToken, false);
      }

      response.status(StatusCodes.OK).json(tokens.body);
      break;
  }
};

export default handler;
