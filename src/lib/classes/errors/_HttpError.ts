import { ReasonPhrases, StatusCodes } from "http-status-codes";

export class HttpError extends Error {
  code = StatusCodes.IM_A_TEAPOT;

  constructor(message: string, code: StatusCodes, name: ReasonPhrases) {
    super(message);
    this.name = name;
    this.code = code;
  }
}
