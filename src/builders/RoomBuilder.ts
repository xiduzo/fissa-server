import { DateTime } from "luxon";
import { Room } from "../lib/interfaces/Room";
import { Builder } from "./_Builder";

export class RoomBuilder extends Builder<Room> {
  constructor(
    pin: string,
    createdBy: string,
    accessToken: string,
    refreshToken: string
  ) {
    super();

    this.value = {
      pin: pin.toUpperCase(),
      createdBy,
      accessToken,
      refreshToken,
      currentIndex: -1,
      lastPlayedIndex: -1,
      createdAt: DateTime.now().toISO(),
    };
  }
}
