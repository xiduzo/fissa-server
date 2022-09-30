import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollection } from "../../utils/database";
import {
  getMyCurrentPlaybackState,
  startPlaylistFromTrack,
} from "../../utils/spotify";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";
import { Track } from "../../lib/interfaces/Track";

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
        const rooms = await mongoCollection<Room>("room");
        const room = await rooms.findOne({ pin });

        logger.info("restart playlist");

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        // TODO: check if room is already playing
        const { accessToken } = room;

        const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

        const { item, is_playing } = currentlyPlaying;

        const tracks = await mongoCollection<Track>("track");
        const roomTracks = await tracks.find({ pin }).toArray();

        if (
          !is_playing ||
          !roomTracks.map((track) => track.id).includes(item?.id)
        ) {
          await startPlaylistFromTrack(
            accessToken,
            `spotify:track:${roomTracks[0].id}`
          );
        } else {
          logger.warn(`tried to restart ${pin} but it was already playing`);
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
