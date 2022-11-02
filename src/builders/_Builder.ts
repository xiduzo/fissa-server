export class Builder<T extends object> {
  protected value: T = {} as T;

  build = () => {
    return this.value;
  };
}
