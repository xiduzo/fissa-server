export enum VoteState {
  None = "none",
  Upvote = "up",
  Downvote = "down",
}

export type Vote = {
  id?: string;
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
