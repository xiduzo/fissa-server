import { VercelResponse } from "@vercel/node";
import { StatusCodes } from "http-status-codes";
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
