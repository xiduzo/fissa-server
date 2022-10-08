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
  trackId: string;
};

export type SortedVoteData = {
  trackId: string;
  total: number;
};

export type SortedVotes = { [trackId: string]: SortedVoteData };

export const positiveScore = (score: SortedVoteData) => score.total >= 0;
export const negativeScore = (score: SortedVoteData) => score.total < 0;

export const highToLow = (a: SortedVoteData, b: SortedVoteData): number =>
  b.total - a.total;

export const getScores = (votes: Vote[]): SortedVoteData[] => {
  return Object.values(
    votes.reduce((acc, vote) => {
      const currentScore = acc[vote.trackId]?.total ?? 0;
      const addition = vote.state === "up" ? 1 : -1;
      return {
        ...acc,
        [vote.trackId]: {
          total: currentScore + addition,
          trackId: vote.trackId,
        },
      };
    }, {})
  );
};

export const sortVotes = (votes: Vote[]): SortedVotes => {
  const reduced = votes.reduce((curr, vote) => {
    const track = curr[vote.trackId] ?? {
      trackId: vote.trackId,
      total: 0,
      votes: [],
    };

    const addToTotal = vote.state === VoteState.Upvote ? 1 : -1;

    return {
      ...curr,
      [vote.trackId]: {
        ...track,
        total: track.total + addToTotal,
      },
    };
  }, {} as SortedVotes);

  return reduced;
};
