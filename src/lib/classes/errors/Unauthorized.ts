import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { FissaError } from "./_FissaError";

export class Unauthorized extends FissaError {
  constructor(message: string) {
    super(message, StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
  }
}
