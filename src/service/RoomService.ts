import { updateRoom } from "../processes/sync-currently-playing";
import { Conflict } from "../lib/classes/errors/Conflict";
import { NotFound } from "../lib/classes/errors/NotFound";
import { Unauthorized } from "../lib/classes/errors/Unauthorized";
import { UnprocessableEntity } from "../lib/classes/errors/UnprocessableEntity";
import { Room } from "../lib/interfaces/Room";
import { VoteState } from "../lib/interfaces/Vote";
import { deleteMyOtherRooms } from "../utils/database";
import { logger } from "../utils/logger";
import { publish } from "../utils/mqtt";
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
import { VoteStore } from "../store/VoteStore";
import { TrackStore } from "../store/TrackStore";
import { RoomBuilder } from "../builders/RoomBuilder";

export class RoomService {
  rooms = new RoomStore();
  votes = new VoteStore();
  tracks = new TrackStore();

  createRoom = async (
    accessToken: string,
    refreshToken: string,
    playlistId: string,
    createdBy: string
  ) => {
    let pin: string;
    let blockedPins: string[] = [];

    do {
      pin = createPin(blockedPins);
      const room = await this.rooms.getRoom(pin);

      if (room) {
        blockedPins.push(pin);
        pin = undefined;
        return;
      }
    } while (pin === undefined);

    await deleteMyOtherRooms(createdBy);

    const room = new RoomBuilder(
      pin.toUpperCase(),
      createdBy,
      accessToken,
      refreshToken
    ).build();
    await this.rooms.createRoom(room);

    const tracks = playlistId
      ? await getPlaylistTracks(accessToken, playlistId)
      : await getMyTopTracks(accessToken);

    await this.tracks.addTracks(
      room,
      tracks.map((track) => track.id)
    );

    await startPlayingTrack(accessToken, tracks[0].uri);

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);

    return pin;
  };

  getRoom = async (pin: string) => {
    const room = await this.rooms.getRoom(pin.toUpperCase());

    if (!room) throw new NotFound(`Room with pin ${pin} not found`);

    delete room.accessToken;
    return room;
  };

  restartRoom = async (pin: string) => {
    const room = await this.rooms.getRoom(pin);

    const { accessToken } = room;

    const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

    const { item, is_playing } = currentlyPlaying;

    const tracks = await this.tracks.getTracks(pin);

    if (is_playing && tracks.map((track) => track.id).includes(item.id)) {
      logger.warn(`tried to restart ${pin} but it was already playing`);
      await updateRoom(room);
      throw new Conflict(`Room ${pin} is already playing`);
    }

    await startPlayingTrack(
      accessToken,
      `spotify:track:${tracks[Math.max(0, room.lastPlayedIndex)].id}`
    );

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);
  };

  // TODO: add tracks service and votes service
  skipTrack = async (pin: string, createdBy: string) => {
    const room = await this.rooms.getRoom(pin);

    if (room.createdBy !== createdBy)
      throw new Unauthorized(`You are not the room owner`);

    const { accessToken } = room;

    const skipped = await skipTrack(accessToken);

    logger.info(`${pin}: skipped track: ${skipped}`);

    if (!skipped) throw new UnprocessableEntity("Could not skip track");

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);
  };

  addTracks = async (pin: string, trackIds: string[], createdBy: string) => {
    const room = await this.rooms.getRoom(pin);

    await this.tracks.addTracks(room, trackIds);
    await publish(`fissa/room/${pin}/tracks/added`, trackIds.length);

    await this.voteForTracks(room, trackIds, createdBy);
    const votes = await this.getVotes(pin);
    await publish(`fissa/room/${pin}/votes`, votes);
  };

  getTracks = async (pin: string) => {
    const tracks = await this.tracks.getTracks(pin);

    return tracks;
  };

  getVotes = async (pin: string) => {
    const votes = await this.votes.getVotes(pin);

    return votes;
  };

  voteForTracks = async (room: Room, trackIds: string[], createdBy: string) => {
    const { currentIndex, pin } = room;

    const roomTracks = await this.tracks.getTracks(pin);

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
        const _vote = await this.votes.getVote(pin, trackId, createdBy);

        if (!_vote) {
          await this.votes.addVote({
            pin: room.pin,
            createdBy,
            trackId,
            state: VoteState.Upvote,
          });
        } else {
          await this.votes.updateVote(_vote.id, VoteState.Upvote);
        }
      });

    await Promise.all(votePromises);

    const votes = await this.getVotes(pin);

    await publish(`fissa/room/${pin}/votes`, votes);
  };

  deleteVotes = async (pin: string, trackId: string) => {
    return this.votes.deleteVotes(pin, trackId);
  };
}
