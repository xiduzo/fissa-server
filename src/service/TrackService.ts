import { TrackStore } from "../store/TrackStore";
import { publish } from "../utils/mqtt";
import { getTracks } from "../utils/spotify";
import { RoomService } from "./RoomService";
import { VoteService } from "./VoteService";
import { Service } from "./_Service";

export class TrackService extends Service<TrackStore> {
  private roomService = new RoomService();
  private voteService = new VoteService();

  constructor() {
    super(TrackStore);
  }

  addTracks = async (pin: string, trackIds: string[], createdBy: string) => {
    const room = await this.roomService.getRoom(pin);

    const tracks = await getTracks(room.accessToken, trackIds);
    await this.store.addTracks(pin, tracks);
    await publish(`fissa/room/${pin}/tracks/added`, trackIds.length);

    await this.voteService.voteForTracks(pin, trackIds, createdBy);
  };

  getTracks = async (pin: string) => {
    const tracks = await this.store.getTracks(pin);

    return tracks;
  };
}
