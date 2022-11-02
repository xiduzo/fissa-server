import { Collection, Document } from "mongodb";
import { mongoCollection } from "../utils/database";

export class Store<T> {
  private _name = "Store";
  // @ts-ignore-next-line
  protected collection: Collection<T & Document>;

  constructor(name: string) {
    this._name = name;
    mongoCollection<T>(name).then((collection) => {
      this.collection = collection;
    });
  }

  waitForCollection = async () => {
    const TIMEOUTS = [500, 1000, 2000, 5000, 7500];
    let attempt = 0;
    while (!this.collection && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS[attempt]));
      attempt++;
    }
  };
}
