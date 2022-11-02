import { VoteState } from "../lib/interfaces/Vote";
import { VoteStore } from "../store/VoteStore";
import { publish } from "../utils/mqtt";
import { RoomService } from "./RoomService";
import { TrackService } from "./TrackService";
import { Service } from "./_Service";

export class VoteService extends Service<VoteStore> {
  constructor() {
    super(VoteStore);
  }

  voteForTracks = async (
    roomPin: string,
    trackIds: string[],
    createdBy: string,
    state: VoteState = VoteState.Upvote
  ) => {
    const roomService = new RoomService();
    const room = await roomService.getRoom(roomPin);
    const { currentIndex, pin } = room;

    const trackService = new TrackService();
    const roomTracks = await trackService.getTracks(pin);

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
            state,
          });
        } else {
          await this.store.updateVote(_vote.id, state);
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
    const deletedVotes = await this.store.deleteVotes(pin, trackId);
    return deletedVotes;
  };
}
