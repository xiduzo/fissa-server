import { ReasonPhrases } from "http-status-codes";

export class NotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = ReasonPhrases[ReasonPhrases.NOT_FOUND];
  }
}
