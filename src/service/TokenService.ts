import SpotifyWebApi from "spotify-web-api-node";
import { TokenStore } from "../store/TokenStore";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";

export class TokenService {
  store = new TokenStore();

  authorizationCodeGrant = async (code: string, redirect_uri: string) => {
    const spotifyApi = new SpotifyWebApi({
      ...SPOTIFY_CREDENTIALS,
      redirectUri: redirect_uri,
    });
    const tokens = await spotifyApi.authorizationCodeGrant(code);

    return tokens;
  };

  refreshToken = async (accessToken: string, refreshToken: string) => {
    const tokens = this.store.refreshToken(accessToken, refreshToken);

    return tokens;
  };
}
