import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { HttpError } from "./_HttpError";

export class UnprocessableEntity extends HttpError {
  constructor(message: string) {
    super(
      message,
      StatusCodes.UNPROCESSABLE_ENTITY,
      ReasonPhrases.UNPROCESSABLE_ENTITY
    );
  }
}
