import { Collection, Document } from "mongodb";
import { mongoCollection } from "../utils/database";
import { logger } from "../utils/logger";

export class Store<T> {
  protected collection: Collection<T & Document>;

  constructor(name: string) {
    mongoCollection<T>(name).then((collection) => {
      this.collection = collection;
    });
  }

  waitForCollection = async () => {
    const TIMEOUTS = [500, 1000, 2000, 5000, 7500];
    let attempt = 0;
    while (!this.collection && attempt < 5) {
      logger.debug("collection not ready");
      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS[attempt]));
      attempt++;
    }
  };
}
