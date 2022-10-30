import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { HttpError } from "./_HttpError";

export class BadRequest extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.BAD_REQUEST, ReasonPhrases.BAD_REQUEST);
  }
}
