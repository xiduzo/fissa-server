import { Collection, Document } from "mongodb";
import { mongoCollection } from "../utils/database";

export class Store<T> {
  protected collection: Collection<T & Document>;

  constructor(collection: string) {
    mongoCollection<T>(collection).then((collection) => {
      this.collection = collection;
    });
  }
}
