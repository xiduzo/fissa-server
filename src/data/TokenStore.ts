import { Store } from "../lib/classes/Store";
import { Room } from "../lib/interfaces/Room";
import { getMe, updateTokens } from "../utils/spotify";

export class TokenStore extends Store<Room> {
  constructor() {
    super("room");
  }

  refreshToken = async (accessToken: string, refreshToken: string) => {
    const tokens = await updateTokens(accessToken, refreshToken);

    const me = await getMe(tokens.access_token);

    await this.collection.updateMany(
      { createdBy: me?.id },
      {
        $set: { accessToken: tokens.access_token },
      }
    );

    return tokens;
  };
}
