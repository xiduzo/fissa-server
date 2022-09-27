import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync, voteAsync } from "../../utils/database";
import {
  getMyCurrentPlaybackStateAsync,
  startPlaylistFromTopAsync,
} from "../../utils/spotify";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::play",
      });
      break;
    case "POST":
      const { pin } = request.body as {
        pin: string;
      };

      try {
        const rooms = await mongoCollectionAsync<Room>("room");
        const room = await rooms.findOne({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        // TODO: check if room is already playing
        const { playlistId, accessToken } = room;

        const currentlyPlaying = await getMyCurrentPlaybackStateAsync(
          accessToken
        );

        const { context } = currentlyPlaying;

        if (!context?.uri.includes(playlistId)) {
          await startPlaylistFromTopAsync(room);
        }

        await updateRoom(room);

        response.status(StatusCodes.OK).json(ReasonPhrases.OK);
      } catch (error) {
        logger.error(`play POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
