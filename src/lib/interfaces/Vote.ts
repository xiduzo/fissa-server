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

export type SortedVoteData = {
  trackUri: string;
  total: number;
  votes: Vote[];
};

export type SortedVotes = { [trackUri: string]: SortedVoteData };

export const sortVotes = (votes: Vote[]): SortedVotes => {
  const reduced = votes.reduce((curr, vote) => {
    const track = curr[vote.trackUri] ?? {
      trackUri: vote.trackUri,
      total: 0,
      votes: [],
    };

    const addToTotal = vote.state === VoteState.Upvote ? 1 : -1;

    return {
      ...curr,
      [vote.trackUri]: {
        ...track,
        total: track.total + addToTotal,
        votes: [...track.votes, vote],
      },
    };
  }, {} as SortedVotes);

  return reduced;
};
