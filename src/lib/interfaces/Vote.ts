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
