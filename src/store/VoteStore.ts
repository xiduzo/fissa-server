import { Collection, Document } from "mongodb";
import { Vote, VoteState } from "../lib/interfaces/Vote";
import { mongoCollection } from "../utils/database";
import { Store } from "./_Store";

export class VoteStore extends Store<Vote> {
  constructor() {
    super("vote");
  }

  getVotes = async (pin: string) => {
    return await this.collection.find({ pin: pin.toUpperCase() }).toArray();
  };

  getVote = async (pin: string, createdBy: string, trackId: string) => {
    return await this.collection.findOne({
      pin: pin.toUpperCase(),
      createdBy,
      trackId,
    });
  };

  deleteVotes = async (pin: string, trackId: string) => {
    return await this.collection.deleteMany({
      pin: pin.toUpperCase(),
      trackId,
    });
  };

  addVote = async (vote: Vote) => {
    return await this.collection.insertOne(vote);
  };

  updateVote = async (id: string, state: VoteState) => {
    return await this.collection.updateOne({ _id: id }, { $set: { state } });
  };
}
