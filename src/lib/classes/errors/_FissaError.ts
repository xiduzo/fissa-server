import { ReasonPhrases, StatusCodes } from "http-status-codes";

export class FissaError extends Error {
  code = StatusCodes.IM_A_TEAPOT;

  constructor(message: string, code: StatusCodes, name: ReasonPhrases) {
    super(message);
    this.name = name;
    this.code = code;
  }

  toString() {
    return `${this.name}(${this.code}): ${this.message}`;
  }
}