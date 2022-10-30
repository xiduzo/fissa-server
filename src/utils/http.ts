import { VercelResponse } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cleanupDbClient } from "./database";
import { logger, waitForLogSinks } from "./logger";
import { ZodError } from "zod";
import { HttpError } from "../lib/classes/errors/_HttpError";

export const responseAsync = async (
  response: VercelResponse,
  statusCode: StatusCodes,
  body: any
): Promise<VercelResponse> => {
  await waitForLogSinks();
  await cleanupDbClient();

  return response.status(statusCode).json(body);
};

export const handleRequestError = async (
  response: VercelResponse,
  error: Error
) => {
  let code = StatusCodes.INTERNAL_SERVER_ERROR;
  let phrase: string = ReasonPhrases.INTERNAL_SERVER_ERROR;

  if (error instanceof ZodError) {
    code = StatusCodes.BAD_REQUEST;
    phrase = error.errors
      .map((err) => `${err.path.join()}: ${err.message}`.toLowerCase())
      .join(", ");
  } else if (error instanceof HttpError) {
    code = error.code;
    phrase = error.name;
  } else if (error instanceof Error) {
    logger.warn(error);
  } else {
    logger.error(error);
  }

  await responseAsync(response, code, phrase);
};
