import SpotifyWebApi from "spotify-web-api-node";
import { TokenStore } from "../store/TokenStore";
import { getMe, updateTokens } from "../utils/spotify";
import { Service } from "./_Service";
import { NotFound } from "../lib/classes/errors/NotFound";

export class TokenService extends Service<TokenStore> {
  constructor() {
    super(TokenStore);
  }

  codeGrant = async (code: string, redirect_uri: string) => {
    const spotifyApi = new SpotifyWebApi({
      ...{
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      },
      redirectUri: redirect_uri,
    });
    const tokens = await spotifyApi.authorizationCodeGrant(code);

    return tokens;
  };

  refresh = async (accessToken: string, refreshToken: string) => {
    const tokens = await updateTokens(accessToken, refreshToken);

    if (!tokens) throw new NotFound("Tokens not found");

    const me = await getMe(tokens.access_token);

    this.store.refreshToken(accessToken, me.id);

    return tokens;
  };
}
