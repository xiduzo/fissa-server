import { updateRoom } from "../processes/sync-currently-playing";
import { Conflict } from "../lib/classes/errors/Conflict";
import { NotFound } from "../lib/classes/errors/NotFound";
import { Unauthorized } from "../lib/classes/errors/Unauthorized";
import { UnprocessableEntity } from "../lib/classes/errors/UnprocessableEntity";
import { deleteMyOtherRooms } from "../utils/database";
import { logger } from "../utils/logger";
import { createPin } from "../utils/pin";
import {
  getPlaylistTracks,
  getMyTopTracks,
  startPlayingTrack,
  addTackToQueue,
  getMyCurrentPlaybackState,
  skipTrack,
} from "../utils/spotify";
import { RoomStore } from "../store/RoomStore";
import { RoomBuilder } from "../builders/RoomBuilder";
import { TrackService } from "./TrackService";
import { Service } from "./_Service";
import { Room } from "../lib/interfaces/Room";

export class RoomService extends Service<RoomStore> {
  constructor() {
    super(RoomStore);
  }

  createRoom = async (
    accessToken: string,
    refreshToken: string,
    createdBy: string,
    playlistId?: string
  ) => {
    let pin: string | undefined;
    let blockedPins: string[] = [];

    do {
      pin = createPin(blockedPins);
      const room = await this.store.getRoom(pin);

      if (room) {
        blockedPins.push(pin);
        pin = undefined;
        return;
      }
    } while (pin === undefined);

    await deleteMyOtherRooms(createdBy);

    const room = new RoomBuilder(
      pin,
      createdBy,
      accessToken,
      refreshToken
    ).build();
    await this.store.createRoom(room);

    const tracks = playlistId
      ? await getPlaylistTracks(accessToken, playlistId)
      : await getMyTopTracks(accessToken);

    const trackService = new TrackService();
    await trackService.addTracks(
      room.pin,
      tracks.map((track) => track.id)
    );

    await startPlayingTrack(accessToken, tracks[0].uri);

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);

    return pin;
  };

  /**
   * Use the `getRoomDto` method when exposing the room to the client
   */
  getRoom = async (pin: string) => {
    const room = await this.store.getRoom(pin);

    if (!room) throw new NotFound(`Room with pin ${pin} not found`);

    return room;
  };

  getRoomDto = async (pin: string) => {
    const room = (await this.getRoom(pin)) as Partial<Room>;

    delete room.accessToken;
    delete room.refreshToken;

    return room;
  };

  restartRoom = async (pin: string) => {
    const room = await this.getRoom(pin);

    const { accessToken } = room;

    const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

    const { item, is_playing } = currentlyPlaying;

    const trackService = new TrackService();

    const tracks = await trackService.getTracks(pin);

    if (
      is_playing &&
      item &&
      tracks.map((track) => track.id).includes(item.id)
    ) {
      await updateRoom(room);
      throw new Conflict(`room ${pin} is already playing`);
    }

    const nextTrackIndex = Math.max(0, room.lastPlayedIndex, room.currentIndex);
    await startPlayingTrack(
      accessToken,
      `spotify:track:${tracks[nextTrackIndex].id}`
    );

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);
  };

  skipTrack = async (pin: string, createdBy: string) => {
    const room = await this.getRoom(pin);

    if (room.createdBy !== createdBy)
      throw new Unauthorized(`You are not the room owner`);

    const { accessToken } = room;

    const skipped = await skipTrack(accessToken);

    logger.info(`${pin}: skipped track: ${skipped}`);

    if (!skipped) throw new UnprocessableEntity("Could not skip track");

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);
  };
}
