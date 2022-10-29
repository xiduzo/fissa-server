import { ReasonPhrases } from "http-status-codes";
import { DateTime } from "luxon";
import { updateRoom } from "../client-sync/processes/sync-currently-playing";
import { Conflict } from "../lib/classes/errors/Conflict";
import { NotFound } from "../lib/classes/errors/NotFound";
import { Unauthorized } from "../lib/classes/errors/Unauthorized";
import { UnprocessableEntity } from "../lib/classes/errors/UnprocessableEntity";
import { Room } from "../lib/interfaces/Room";
import { Track } from "../lib/interfaces/Track";
import { Vote, VoteState } from "../lib/interfaces/Vote";
import {
  addTracks,
  deleteMyOtherRooms,
  getRoom,
  mongoCollection,
  vote,
} from "../utils/database";
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

export class RoomService {
  public createRoom = async (
    accessToken: string,
    refreshToken: string,
    playlistId: string,
    createdBy: string
  ) => {
    let pin: string;
    let blockedPins: string[] = [];

    const rooms = await mongoCollection<Room>("room");

    do {
      pin = createPin(blockedPins);
      const room = await rooms.findOne({ pin });

      if (room) {
        blockedPins.push(pin);
        pin = undefined;
        return;
      }
    } while (pin === undefined);

    await deleteMyOtherRooms(createdBy);

    const room: Room = {
      pin,
      createdBy,
      accessToken,
      refreshToken,
      currentIndex: -1,
      lastPlayedIndex: -1,
      createdAt: DateTime.now().toISO(),
    };
    await rooms.insertOne(room);

    const tracks = playlistId
      ? await getPlaylistTracks(accessToken, playlistId)
      : await getMyTopTracks(accessToken);

    await addTracks(
      accessToken,
      pin,
      tracks.map((track) => track.id)
    );

    await startPlayingTrack(accessToken, tracks[0].uri);

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);

    return pin;
  };

  public getRoom = async (pin: string) => {
    const room = await getRoom(pin);

    if (!room) throw Error(ReasonPhrases.NOT_FOUND);

    delete room.accessToken;
    return room;
  };

  public restartRoom = async (pin: string) => {
    const room = await getRoom(pin);

    if (!room) throw new NotFound(`Room ${pin} not found`);

    const { accessToken } = room;

    const currentlyPlaying = await getMyCurrentPlaybackState(accessToken);

    const { item, is_playing } = currentlyPlaying;

    const tracks = await this.getTracks(pin);

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

  public skipTrack = async (pin: string, createdBy: string) => {
    const room = await getRoom(pin);

    if (!room) throw new NotFound(`Room ${pin} not found`);
    if (room.createdBy !== createdBy)
      throw new Unauthorized(`You are not the room owner`);

    const { accessToken } = room;

    const skipped = await skipTrack(accessToken);

    logger.info(`${pin}: skipped track: ${skipped}`);

    if (!skipped) throw new UnprocessableEntity("Could not skip track");

    const nextTrackId = await updateRoom(room);
    await addTackToQueue(accessToken, nextTrackId);
  };

  public addTracks = async (
    pin: string,
    trackIds: string[],
    createdBy: string
  ) => {
    const room = await getRoom(pin);

    if (!room) throw new NotFound(`Room ${pin} not found`);

    const { accessToken } = room;

    await addTracks(accessToken, pin, trackIds);
    await publish(`fissa/room/${pin}/tracks/added`, trackIds.length);

    await this.voteForTracks(room, trackIds, createdBy);
    const votes = await this.getVotes(pin);
    await publish(`fissa/room/${pin}/votes`, votes);
  };

  /**
   * @returns sorted room tracks based on their index
   */
  public getTracks = async (pin: string) => {
    const tracks = await mongoCollection<Track>("track");

    const roomTracks = await tracks.find({ pin }).toArray();
    const orderedTracks = roomTracks.sort((a, b) => a.index - b.index);
    return orderedTracks;
  };

  public getVotes = async (pin: string) => {
    const votes = await mongoCollection<Vote>("vote");

    const roomVotes = await votes.find({ pin }).toArray();

    return roomVotes;
  };

  private voteForTracks = async (
    room: Room,
    trackIds: string[],
    createdBy: string
  ) => {
    const { currentIndex, pin } = room;

    const roomTracks = await this.getTracks(pin);

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
      .map(async (trackId) => vote(pin, createdBy, trackId, VoteState.Upvote));

    return Promise.all(votePromises);
  };
}
