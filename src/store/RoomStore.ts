import { Store } from "./_Store";
import { Room } from "../lib/interfaces/Room";

export class RoomStore extends Store<Room> {
  constructor() {
    super("room");
  }

  getRoom = async (pin: string) => {
    return await this.collection.findOne({ pin });
  };

  createRoom = async (room: Room) => {
    return await this.collection.insertOne(room);
  };

  deleteRoomsOfUser = async (createdBy: string) => {
    return await this.collection.deleteMany({ createdBy });
  };
}
