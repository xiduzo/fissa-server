import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { getRoom, getRoomTracks } from "../../utils/database";
import {
  addTackToQueue,
  getMyCurrentPlaybackState,
  startPlayingTrack,
} from "../../utils/spotify";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";
import { responseAsync } from "../../utils/response";

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

      if (!pin) {
        await responseAsync(
          response,
          StatusCodes.BAD_REQUEST,
          ReasonPhrases.BAD_REQUEST
        );
        return;
      }

      try {
        const room = await getRoom(pin);

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        const { accessToken } = room;

        const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

        const { item, is_playing } = currentlyPlaying;

        const tracks = await getRoomTracks(pin);

        if (is_playing && tracks.map((track) => track.id).includes(item.id)) {
          logger.warn(`tried to restart ${pin} but it was already playing`);
          await updateRoom(room);
          await responseAsync(
            response,
            StatusCodes.CONFLICT,
            ReasonPhrases.CONFLICT
          );
          return;
        }

        await startPlayingTrack(
          accessToken,
          `spotify:track:${tracks[Math.max(0, room.lastPlayedIndex)].id}`
        );

        const nextTrackId = await updateRoom(room);
        await addTackToQueue(accessToken, nextTrackId);

        await responseAsync(response, StatusCodes.OK, ReasonPhrases.OK);
      } catch (error) {
        logger.error(`play POST handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
  }
};

export default handler;
