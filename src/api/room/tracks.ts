import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { VoteState } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync, voteAsync } from "../../utils/database";
import { publishAsync, updateVotes } from "../../utils/mqtt";
import {
  addTracksToPlaylistAsync,
  getPlaylistTracksAsync,
  reorderPlaylist,
} from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::tracks",
      });
      break;
    case "POST":
      const { pin, trackUris, accessToken } = request.body as {
        pin: string;
        trackUris: string[];
        accessToken: string;
      };

      try {
        const collection = await mongoCollectionAsync("room");
        const room = await collection.findOne<Room>({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        const playlistTracks = await getPlaylistTracksAsync(
          room.accessToken,
          room.playlistId
        );

        const trackUrisInPlaylist = playlistTracks.map((track) => track.uri);

        const tracksToAdd = trackUris.filter(
          (uri) => !trackUrisInPlaylist.includes(uri)
        );

        await addTracksToPlaylistAsync(
          // TODO: give specific error if the room owner access token doesn't work anymore
          room.accessToken,
          room.playlistId,
          tracksToAdd
        );

        // vote for all of the tracks to put them back in the queue
        await Promise.all(
          trackUris.map(async (uri) => {
            return voteAsync(room.pin, accessToken, uri, VoteState.Upvote);
          })
        );
        const sortedVotes = await updateVotes(room.pin);
        await reorderPlaylist(room, sortedVotes);
        response.status(StatusCodes.OK).json(trackUris.length);
      } catch (error) {
        console.error(error);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
