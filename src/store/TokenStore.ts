import { Store } from "./_Store";
import { Room } from "../lib/interfaces/Room";
import { logger } from "../utils/logger";

export class TokenStore extends Store<Room> {
  constructor() {
    super("room");
  }

  refreshToken = async (accessToken: string, createdBy: string) => {
    await this.waitForCollection();

    logger.info(`Refreshing token for ${createdBy}: ${accessToken}`);

    return await this.collection.updateMany(
      { createdBy },
      {
        $set: { accessToken },
      }
    );
  };
}
