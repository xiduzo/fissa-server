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
      const { pin, trackUris, accessToken } = request.body;

      try {
        const collection = await mongoCollectionAsync("room");
        const room = await collection.findOne<Room>({ pin });

        if (!room) {
          response.status(StatusCodes.NOT_FOUND).json(ReasonPhrases.NOT_FOUND);
          return;
        }

        const tracks = await getPlaylistTracksAsync(
          room.accessToken,
          room.playlistId
        );

        const _trackUrisInPlaylist = tracks.map((track) => track.uri);

        const _tracks = trackUris.reduce(
          (acc, uri) => {
            _trackUrisInPlaylist.includes(uri)
              ? acc.alreadyInPlaylist.push(uri)
              : acc.toAdd.push(uri);
            return acc;
          },
          {
            alreadyInPlaylist: [] as string[],
            toAdd: [] as string[],
          }
        );

        await addTracksToPlaylistAsync(
          // TODO: give specific error if the room owner access token doesn't work anymore
          room.accessToken,
          room.playlistId,
          _tracks.toAdd
        );

        // vote for all of the tracks to put them back in the queue
        await Promise.all(
          _tracks.alreadyInPlaylist.map(async (uri) => {
            await voteAsync(room.pin, accessToken, uri, VoteState.Upvote);
          })
        );

        const sortedVotes = await updateVotes(room.pin);
        if (_tracks.alreadyInPlaylist.length) {
          await reorderPlaylist(room, sortedVotes);
        }
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
