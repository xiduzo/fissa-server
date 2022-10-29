import { ReasonPhrases } from "http-status-codes";

export class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = ReasonPhrases[ReasonPhrases.BAD_REQUEST];
  }
}
