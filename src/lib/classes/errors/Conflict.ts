import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { FissaError } from "./_FissaError";

export class Conflict extends FissaError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT, ReasonPhrases.CONFLICT);
  }
}
