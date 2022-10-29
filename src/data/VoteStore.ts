import { Collection, Document } from "mongodb";
import { Vote, VoteState } from "../lib/interfaces/Vote";
import { mongoCollection } from "../utils/database";

export class VoteStore {
  private collection: Collection<Vote & Document>;

  constructor() {
    mongoCollection<Vote>("vote").then((collection) => {
      this.collection = collection;
    });
  }

  getVotes = async (pin: string) => {
    return await this.collection.find({ pin }).toArray();
  };

  getVote = async (pin: string, createdBy: string, trackId: string) => {
    return await this.collection.findOne({
      pin,
      createdBy,
      trackId,
    });
  };

  deleteVotes = async (pin: string, trackId: string) => {
    return await this.collection.deleteMany({ pin, trackId });
  };

  addVote = async (vote: Vote) => {
    return await this.collection.insertOne(vote);
  };

  deleteVote = async (id: string) => {
    return await this.collection.deleteOne({ _id: id });
  };

  updateVote = async (id: string, state: VoteState) => {
    return await this.collection.updateOne({ _id: id }, { $set: { state } });
  };
}
