import SpotifyWebApi from "spotify-web-api-node";
import { NotFound } from "../../lib/classes/errors/NotFound";
import { SPOTIFY_CREDENTIALS } from "../../lib/constants/credentials";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollection } from "../../utils/database";
import { updateTokens, getMe } from "../../utils/spotify";

export class TokenService {
  public authorizationCodeGrant = async (
    code: string,
    redirect_uri: string
  ) => {
    const spotifyApi = new SpotifyWebApi({
      ...SPOTIFY_CREDENTIALS,
      redirectUri: redirect_uri,
    });
    const tokens = await spotifyApi.authorizationCodeGrant(code);

    return tokens;
  };

  public refreshToken = async (accessToken: string, refreshToken: string) => {
    const tokens = await updateTokens(accessToken, refreshToken);

    const rooms = await mongoCollection<Room>("room");

    const me = await getMe(tokens.access_token);

    if (!me) throw new NotFound("User not found");

    await rooms.updateMany(
      { createdBy: me?.id },
      {
        $set: { accessToken: tokens.access_token },
      }
    );

    return tokens;
  };
}
