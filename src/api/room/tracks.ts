import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { VoteState } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync, voteAsync } from "../../utils/database";
import { publishAsync } from "../../utils/mqtt";
import {
  addTracksToPlaylistAsync,
  getPlaylistTracksAsync,
  trackIndex,
  updatePlaylistTrackIndexAsync,
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

        // filter out tracks that are already in the playlist
        const tracksAlreadyInPlaylist = tracks
          .filter((track) => trackUris.includes(track.uri))
          .map((track) => track.uri);

        const tracksToAdd = (trackUris as string[]).filter(
          (trackUri) => !tracksAlreadyInPlaylist.includes(trackUri)
        );

        await addTracksToPlaylistAsync(
          // TODO: give specific error if the room owner access token doesn't work anymore
          room.accessToken,
          room.playlistId,
          tracksToAdd
        );

        await Promise.all(
          tracksAlreadyInPlaylist.map(async (uri) => {
            const index = trackIndex(tracks, uri);
            if (index < room.currentIndex) {
              await updatePlaylistTrackIndexAsync(
                room.playlistId,
                room.accessToken,
                [uri],
                index,
                tracks.length
              );
            }

            await voteAsync(room, accessToken, uri, VoteState.Upvote);
          })
        );

        await publishAsync(`fissa/room/${pin}/tracks/added`, trackUris.length);
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
