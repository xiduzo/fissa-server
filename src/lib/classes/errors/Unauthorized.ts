import { ReasonPhrases } from "http-status-codes";

export class Unauthorized extends Error {
  constructor(message: string) {
    super(message);
    this.name = ReasonPhrases[ReasonPhrases.UNAUTHORIZED];
  }
}
