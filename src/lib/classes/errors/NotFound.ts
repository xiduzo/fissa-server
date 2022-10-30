import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { HttpError } from "./_HttpError";

export class NotFound extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.NOT_FOUND, ReasonPhrases.NOT_FOUND);
  }
}
