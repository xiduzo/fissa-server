import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { mongoCollectionAsync } from "../../utils/database";
import { publishAsync } from "../../utils/mqtt";
import { addTracksToPlaylistAsync, getMeAsync } from "../../utils/spotify";

enum VoteState {
  None = "none",
  Upvote = "up",
  Downvote = "down",
}

type Vote = {
  id?: string;
  pin: string;
  createdBy: string;
  state: VoteState;
};

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
        const me = await getMeAsync(accessToken);
        const collection = await mongoCollectionAsync("votes");
        const vote = await collection.findOne<Vote>({
          pin,
          createdBy: me.id,
          trackUri,
        });

        // See if user voted before -> update vote
        if (vote) {
          collection.updateOne(
            { id: vote.id },
            {
              $set: {
                state,
              },
            }
          );
        } else {
          // If user has not voted before -> add vote
          collection.insertOne({
            pin,
            createdBy: me.id,
            trackUri,
            state,
          });
        }

        const allVotes = await collection.find<Vote>({ pin }).toArray();
        await publishAsync(`fissa/room/${pin}/votes`, allVotes);

        // If the track has already been played -> add it to the bottom of the playlist
        // Rearrange tracks in playlist based on vote
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
