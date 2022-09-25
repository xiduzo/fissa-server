import { logger } from "../../utils/logger";
import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { Vote, VoteState } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync, voteAsync } from "../../utils/database";
import {
  addTracksToPlaylistAsync,
  getPlaylistTracksAsync,
  reorderPlaylist,
} from "../../utils/spotify";
import { publishAsync } from "../../utils/mqtt";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::track",
      });
      break;
    case "POST":
      const {
        pin,
        trackUris,
        accessToken: userAccessToken,
      } = request.body as {
        pin: string;
        trackUris: string[];
        accessToken: string;
      };

      try {
        const rooms = await mongoCollectionAsync<Room>("room");
        const room = await rooms.findOne({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        const { accessToken, playlistId } = room;

        const playlistTracks = await getPlaylistTracksAsync(
          accessToken,
          playlistId
        );

        const trackUrisInPlaylist = playlistTracks.map((track) => track.uri);
        const trackUrisToAdd = trackUris.filter(
          (uri) => !trackUrisInPlaylist.includes(uri)
        );

        await addTracksToPlaylistAsync(
          // TODO: give specific error if the room owner access token doesn't work anymore
          accessToken,
          playlistId,
          trackUrisToAdd
        );

        // vote for all of the tracks you just added
        await Promise.all(
          trackUris.map(async (uri) => {
            return voteAsync(room.pin, userAccessToken, uri, VoteState.Upvote);
          })
        );

        await publishAsync(
          `fissa/room/${pin}/tracks/added`,
          trackUrisToAdd.length
        );

        const votes = await mongoCollectionAsync<Vote>("votes");
        const roomVotes = await votes.find({ pin }).toArray();

        await reorderPlaylist(room, roomVotes);
        await publishAsync(`fissa/room/${room.pin}/tracks/reordered`);

        response.status(StatusCodes.OK).json(trackUris.length);
      } catch (error) {
        logger.error(`track POST handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
