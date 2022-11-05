import { Store } from "./_Store";
import { Room } from "../lib/interfaces/Room";

export class RoomStore extends Store<Room> {
  constructor() {
    super("room");
  }

  getRoom = async (pin: string) => {
    await this.waitForCollection();

    return await this.collection.findOne({ pin: pin.toUpperCase() });
  };

  createRoom = async (room: Room) => {
    await this.waitForCollection();

    return await this.collection.insertOne({
      ...room,
      pin: room.pin.toUpperCase(),
    });
  };

  updateRoom = async (room: Partial<Room>) => {
    await this.waitForCollection();

    const { pin } = room;

    return await this.collection.updateOne({ pin }, { $set: room });
  };

  deleteRoomsOfUser = async (createdBy: string) => {
    return await this.collection.deleteMany({ createdBy });
  };
}
