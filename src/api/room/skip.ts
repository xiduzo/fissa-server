import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { cleanupDbClient, getRoom, getRoomTracks } from "../../utils/database";
import {
  addTackToQueue,
  getMyCurrentPlaybackState,
  skipTrack,
  startPlayingTrack,
} from "../../utils/spotify";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::skip",
      });
      break;
    case "POST":
      const { pin } = request.body as {
        pin: string;
      };

      if (!pin) {
        return response
          .status(StatusCodes.BAD_REQUEST)
          .json(ReasonPhrases.BAD_REQUEST);
      }

      try {
        const room = await getRoom(pin);

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        const { accessToken } = room;

        const skipped = await skipTrack(accessToken);

        if (!skipped) {
          return response
            .status(StatusCodes.UNPROCESSABLE_ENTITY)
            .json(ReasonPhrases.UNPROCESSABLE_ENTITY);
        }

        await updateRoom(room);

        response.status(StatusCodes.OK).json(ReasonPhrases.OK);
      } catch (error) {
        logger.error(`skip POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      } finally {
        await cleanupDbClient();
      }
      break;
  }
};

export default handler;
