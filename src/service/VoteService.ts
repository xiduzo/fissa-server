import { Room } from "../lib/interfaces/Room";
import { VoteState } from "../lib/interfaces/Vote";
import { TrackStore } from "../store/TrackStore";
import { VoteStore } from "../store/VoteStore";
import { publish } from "../utils/mqtt";
import { RoomService } from "./RoomService";
import { TrackService } from "./TrackService";
import { Service } from "./_Service";

export class VoteService extends Service<VoteStore> {
  private trackService = new TrackService();
  private roomService = new RoomService();

  constructor() {
    super(VoteStore);
  }

  voteForTracks = async (
    roomPin: string,
    trackIds: string[],
    createdBy: string
  ) => {
    const room = await this.roomService.getRoom(roomPin);
    const { currentIndex, pin } = room;

    const roomTracks = await this.trackService.getTracks(pin);

    // TODO: don't vote on tracks you've already voted on
    const votePromises = trackIds
      .filter((trackId) => {
        // Don't vote on currently playing track
        // and don't vote on next track
        const doNotVote = roomTracks.find(
          ({ index }) => index === currentIndex || index === currentIndex + 1
        );
        if (doNotVote?.id === trackId) return;

        return trackId;
      })
      .map(async (trackId) => {
        const _vote = await this.store.getVote(pin, trackId, createdBy);

        if (!_vote) {
          await this.store.addVote({
            pin: room.pin,
            createdBy,
            trackId,
            state: VoteState.Upvote,
          });
        } else {
          await this.store.updateVote(_vote.id, VoteState.Upvote);
        }
      });

    await Promise.all(votePromises);

    const votes = await this.getVotes(pin);

    await publish(`fissa/room/${pin}/votes`, votes);
  };

  getVotes = async (pin: string) => {
    const votes = await this.store.getVotes(pin);

    return votes;
  };

  deleteVotes = async (pin: string, trackId: string) => {
    return this.store.deleteVotes(pin, trackId);
  };
}
