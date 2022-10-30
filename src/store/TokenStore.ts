import { Store } from "./_Store";
import { Room } from "../lib/interfaces/Room";

export class TokenStore extends Store<Room> {
  constructor() {
    super("room");
  }

  refreshToken = async (accessToken: string, createdBy: string) => {
    return await this.collection.updateMany(
      { createdBy },
      {
        $set: { accessToken },
      }
    );
  };
}
