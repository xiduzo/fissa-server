import { ReasonPhrases } from "http-status-codes";

export class UnprocessableEntity extends Error {
  constructor(message: string) {
    super(message);
    this.name = ReasonPhrases[ReasonPhrases.UNPROCESSABLE_ENTITY];
  }
}
