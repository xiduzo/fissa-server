import { Collection, Document } from "mongodb";
import { mongoCollection } from "../utils/database";

export class Store<T> {
  // @ts-ignore-next-line
  protected collection: Collection<T & Document>;

  constructor(name: string) {
    mongoCollection<T>(name).then((collection) => {
      this.collection = collection;
    });
  }

  waitForCollection = async () => {
    const TIMEOUTS = [
      250, 250, 500, 500, 500, 1000, 1000, 1000, 1000, 2000, 5000,
    ];
    let attempt = 0;
    while (!this.collection && attempt < TIMEOUTS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS[attempt]));
      attempt++;
    }
  };
}
