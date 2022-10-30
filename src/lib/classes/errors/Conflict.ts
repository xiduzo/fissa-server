import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { HttpError } from "./_HttpError";

export class Conflict extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.CONFLICT, ReasonPhrases.CONFLICT);
  }
}
