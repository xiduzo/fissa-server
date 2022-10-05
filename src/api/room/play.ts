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

        const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

        const { item, is_playing } = currentlyPlaying;

        const tracks = await getRoomTracks(pin);

        if (
          !is_playing ||
          !tracks.map((track) => track.id).includes(item?.id)
        ) {
          await startPlayingTrack(accessToken, `spotify:track:${tracks[0].id}`);
        } else {
          logger.warn(`tried to restart ${pin} but it was already playing`);
        }

        const nextTrackId = await updateRoom(room);
        if (nextTrackId) {
          await addTackToQueue(accessToken, nextTrackId);
        }

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
