import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync, voteAsync } from "../../utils/database";
import { updateVotes } from "../../utils/mqtt";
import { reorderPlaylist } from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room::vote",
      });
      break;
    case "POST":
      const { pin, accessToken, trackUri, state } = request.body;

      if (!accessToken) return;
      if (!pin) return;
      if (!trackUri) return;
      if (!state) return;

      try {
        const vote = await voteAsync(pin, accessToken, trackUri, state);
        const sortedVotes = await updateVotes(pin);
        const collection = await mongoCollectionAsync("room");
        const room = await collection.findOne<Room>({ pin });
        await reorderPlaylist(accessToken, room.playlistId, sortedVotes);
        response.status(StatusCodes.OK).json(vote);
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
