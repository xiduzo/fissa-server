import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { FissaError } from "./_FissaError";

export class UnprocessableEntity extends FissaError {
  constructor(message: string) {
    super(
      message,
      StatusCodes.UNPROCESSABLE_ENTITY,
      ReasonPhrases.UNPROCESSABLE_ENTITY
    );
  }
}
