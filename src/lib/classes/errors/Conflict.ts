import { ReasonPhrases } from "http-status-codes";

export class Conflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = ReasonPhrases[ReasonPhrases.CONFLICT];
  }
}
