import { Conflict } from "../lib/classes/errors/Conflict";
import { NotFound } from "../lib/classes/errors/NotFound";
import { Unauthorized } from "../lib/classes/errors/Unauthorized";
import { UnprocessableEntity } from "../lib/classes/errors/UnprocessableEntity";
import { deleteMyOtherRooms } from "../utils/database";
import { createPin } from "../utils/pin";
import {
  getPlaylistTracks,
  getMyTopTracks,
  startPlayingTrack,
  getMyCurrentPlaybackState,
  setActiveDevice,
} from "../utils/spotify";
import { RoomStore } from "../store/RoomStore";
import { RoomBuilder } from "../builders/RoomBuilder";
import { TrackService } from "./TrackService";
import { Service } from "./_Service";
import { Room } from "../lib/interfaces/Room";
import { logger } from "../utils/logger";
import { DateTime } from "luxon";
import { publish } from "../utils/mqtt";
import { VoteService } from "./VoteService";

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

    await setActiveDevice(accessToken);
    await startPlayingTrack(accessToken, tracks[0].uri);

    await this.updateRoom(room, 0);

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

  stopRoom = async (pin: string) => {
    const room = await this.getRoom(pin);

    await this.updateRoom(room, -1);
  };

  restartRoom = async (pin: string) => {
    const room = await this.getRoom(pin);

    const { accessToken } = room;

    const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

    const { item, is_playing } = currentlyPlaying;

    const trackService = new TrackService();

    const tracks = await trackService.getTracks(pin);

    const trackIndex = item && tracks.map((track) => track.id).indexOf(item.id);

    if (is_playing && trackIndex) {
      await this.updateRoom(room, trackIndex);
      logger.warn(`room ${pin} is already playing`);
      throw new Conflict(`room ${pin} is already playing`);
    }

    const nextTrackIndex = Math.max(0, room.lastPlayedIndex, room.currentIndex);
    await setActiveDevice(accessToken);
    await startPlayingTrack(
      accessToken,
      `spotify:track:${tracks[nextTrackIndex].id}`
    );

    await this.updateRoom(room, nextTrackIndex);
  };

  skipTrack = async (pin: string, createdBy: string) => {
    const trackService = new TrackService();
    const room = await this.getRoom(pin);

    if (room.createdBy !== createdBy)
      throw new Unauthorized(`You are not the room owner`);

    const { accessToken, currentIndex } = room;
    const tracks = await trackService.getTracks(pin);
    const nextIndex = currentIndex + 1;

    const playing = await startPlayingTrack(
      accessToken,
      `spotify:track:${tracks[nextIndex].id}`
    );

    if (!playing) throw new UnprocessableEntity("Could not skip track");

    await this.updateRoom(room, nextIndex);
  };

  updateRoom = async (room: Room, trackIndex: number) => {
    const trackService = new TrackService();
    const voteService = new VoteService();

    const currentlyPlaying = await getMyCurrentPlaybackState(room.accessToken);

    const { pin, accessToken } = room;

    let newState: Partial<Room> = {
      ...room,
      currentIndex: currentlyPlaying?.is_playing ? trackIndex : -1,
      lastPlayedIndex: Math.max(room.lastPlayedIndex, trackIndex),
      expectedEndTime: undefined,
    };

    const tracks = await trackService.getTracks(pin);
    const track = tracks[trackIndex];
    const trackAfter = tracks[trackIndex + 1];
    if (track) {
      newState.expectedEndTime = DateTime.now()
        .plus({
          milliseconds:
            track.duration_ms - (currentlyPlaying?.progress_ms ?? 0),
        })
        .toISO();

      await voteService.deleteVotes(pin, track.id);
    }

    await this.store.updateRoom(newState);

    delete newState.accessToken;
    delete newState.refreshToken;
    await publish(`fissa/room/${pin}`, newState);

    if (!trackAfter) {
      await trackService.addRandomTracks(pin, accessToken);
    }

    return track?.id;
  };
}
