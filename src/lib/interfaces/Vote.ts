export enum VoteState {
  None = "none",
  Upvote = "up",
  Downvote = "down",
}

export type Vote = {
  _id?: string;
  pin: string;
  createdBy: string;
  state: VoteState;
  trackUri: string;
};

export type SortedVote = {
  trackUri: string;
  total: number;
  votes: Vote[];
};

export const sortVotes = (votes: Vote[]): SortedVote[] => {
  const reduced = votes.reduce((curr, vote) => {
    const index = curr.findIndex(
      (sortedVote) => sortedVote.trackUri === vote.trackUri
    );

    const addToTotal = vote.state === VoteState.Upvote ? 1 : -1;
    if (index === -1) {
      curr.push({
        trackUri: vote.trackUri,
        total: addToTotal,
        votes: [vote],
      });
    } else {
      curr[index].total = curr[index].total + addToTotal;
      curr[index].votes.push(vote);
    }

    return curr;
  }, [] as SortedVote[]);

  return reduced.sort((a, b) => b.total - a.total);
};
