import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Vote, VoteState } from "../../lib/interfaces/Vote";
import { mongoCollectionAsync, voteAsync } from "../../utils/database";
import { publishAsync } from "../../utils/mqtt";
import { getMeAsync } from "../../utils/spotify";

const countVotes = (votes: Vote[]) => {
  return votes.reduce((acc, vote) => {
    const currentVote = acc[vote.trackUri] ?? { total: 0 };

    currentVote.total += vote.state === VoteState.Upvote ? 1 : -1;
    return {
      ...acc,
      [vote.trackUri]: currentVote,
    };
  }, {});
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
        const vote = await voteAsync(pin, accessToken, trackUri, state);
        console.log("VercelApiHandler vote", vote);
        response.status(StatusCodes.OK).json(vote);
        // If the track has already been played -> add it to the bottom of the playlist
        // Rearrange tracks in playlist based on vote
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
