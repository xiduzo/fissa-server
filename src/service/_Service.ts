export class Service<T> {
  protected store: T;

  constructor(Store: { new (): T }) {
    this.store = new Store();
  }
}
