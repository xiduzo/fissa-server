import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { HttpError } from "./_HttpError";

export class Unauthorized extends HttpError {
  constructor(message: string) {
    super(message, StatusCodes.UNAUTHORIZED, ReasonPhrases.UNAUTHORIZED);
  }
}
