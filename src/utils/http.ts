import { VercelResponse } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cleanupDbClient } from "./database";
import { waitForLogSinks } from "./logger";

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
  let phrase = ReasonPhrases.INTERNAL_SERVER_ERROR;

  if (Object.values(StatusCodes).includes(error?.name)) {
    code = StatusCodes[error.name];
  }

  if (Object.values(ReasonPhrases).includes(error?.name as ReasonPhrases)) {
    code = ReasonPhrases[error.name];
  }

  await responseAsync(response, code, phrase);
};
