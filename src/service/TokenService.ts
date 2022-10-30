import SpotifyWebApi from "spotify-web-api-node";
import { TokenStore } from "../store/TokenStore";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { getMe, updateTokens } from "../utils/spotify";

export class TokenService {
  store = new TokenStore();

  codeGrant = async (code: string, redirect_uri: string) => {
    const spotifyApi = new SpotifyWebApi({
      ...SPOTIFY_CREDENTIALS,
      redirectUri: redirect_uri,
    });
    const tokens = await spotifyApi.authorizationCodeGrant(code);

    return tokens;
  };

  refresh = async (accessToken: string, refreshToken: string) => {
    const tokens = await updateTokens(accessToken, refreshToken);

    const me = await getMe(tokens.access_token);

    this.store.refreshToken(accessToken, me.id);

    return tokens;
  };
}
