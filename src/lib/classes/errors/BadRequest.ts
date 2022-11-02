import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { FissaError } from "./_FissaError";

export class BadRequest extends FissaError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
  }
}
