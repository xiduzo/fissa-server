import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { VoteState } from "../../lib/interfaces/Vote";
import {
  addTracks,
  getRoom,
  getRoomTracks,
  getRoomVotes,
  vote,
} from "../../utils/database";
import { publish } from "../../utils/mqtt";
import { responseAsync } from "../../utils/response";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET": {
      const pin = (request.query.pin as string)?.toUpperCase();

      if (!pin) {
        await responseAsync(
          response,
          StatusCodes.BAD_REQUEST,
          ReasonPhrases.BAD_REQUEST
        );
        return;
      }

      try {
        const tracks = await getRoomTracks(pin);
        await responseAsync(response, StatusCodes.OK, tracks);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
    }

    case "POST": {
      const { pin, trackIds, createdBy } = request.body as {
        pin: string;
        trackIds: string[];
        createdBy: string;
      };

      try {
        const room = await getRoom(pin);

        if (!room) {
          await responseAsync(
            response,
            StatusCodes.NOT_FOUND,
            ReasonPhrases.NOT_FOUND
          );
          return;
        }

        const { accessToken, currentIndex } = room;

        await addTracks(accessToken, pin, trackIds);
        await publish(`fissa/room/${pin}/tracks/added`, trackIds.length);

        const roomTracks = await getRoomTracks(pin);
        // TODO: don't vote on tracks you've already voted on
        const votePromises = trackIds
          .filter((trackId) => {
            const currentTrack = roomTracks.find(
              (track) => track.index === currentIndex
            );
            // Don't vote on currently playing track
            if (currentTrack?.id === trackId) return;

            const nextTrack = roomTracks.find(
              (track) => track.index === currentIndex + 1
            );
            // Don't vote on next track
            if (nextTrack?.id === trackId) return;

            return trackId;
          })
          .map(async (id) => vote(room.pin, createdBy, id, VoteState.Upvote));

        await Promise.all(votePromises);

        const votes = await getRoomVotes(pin);
        await publish(`fissa/room/${pin}/votes`, votes);

        await responseAsync(response, StatusCodes.OK, trackIds.length);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        await responseAsync(
          response,
          StatusCodes.INTERNAL_SERVER_ERROR,
          ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
    }
  }
};

export default handler;
