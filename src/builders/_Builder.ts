export class Builder<T> {
  protected value: T;

  build = () => {
    return this.value;
  };
}
