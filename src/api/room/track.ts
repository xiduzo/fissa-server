import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { VoteState } from "../../lib/interfaces/Vote";
import { addTracks, mongoCollection, vote } from "../../utils/database";
import { getTracks } from "../../utils/spotify";
import { publishAsync } from "../../utils/mqtt";
import { Track } from "../../lib/interfaces/Track";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET": {
      const pin = (request.query.pin as string)?.toUpperCase();

      if (!pin) {
        return response
          .status(StatusCodes.BAD_REQUEST)
          .json(ReasonPhrases.BAD_REQUEST);
      }

      try {
        const tracks = await mongoCollection<Track>("track");
        const roomTracks = await tracks.find({ pin }).toArray();
        const sortedTracks = roomTracks.sort((a, b) => a.index - b.index);
        response.status(StatusCodes.OK).json(sortedTracks);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
    }

    case "POST": {
      const {
        pin,
        trackIds,
        accessToken: userAccessToken,
      } = request.body as {
        pin: string;
        trackIds: string[];
        accessToken: string;
      };

      try {
        const rooms = await mongoCollection<Room>("room");
        const room = await rooms.findOne({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        const { accessToken } = room;
        const spotifyTracks = await getTracks(accessToken, trackIds);

        const addedTracksPromise = addTracks(spotifyTracks, pin, trackIds);

        const votes = trackIds.map(async (id) => {
          return vote(room.pin, userAccessToken, id, VoteState.Upvote);
        });

        await publishAsync(`fissa/room/${pin}/tracks/added`, trackIds.length);
        await Promise.all(votes);
        await addedTracksPromise;

        // const votes = await mongoCollectionAsync<Vote>("vote");
        // const roomVotes = await votes.find({ pin }).toArray();

        // await reorderPlaylist(room, roomVotes);
        // await publishAsync(`fissa/room/${room.pin}/tracks/reordered`);

        response.status(StatusCodes.OK).json(trackIds.length);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
    }
  }
};

export default handler;
