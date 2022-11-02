import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { FissaError } from "./_FissaError";

export class NotFound extends FissaError {
  constructor(message: string) {
    super(message, StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND);
  }
}
