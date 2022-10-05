import SpotifyWebApi from "spotify-web-api-node";
import { updateRoom } from "../client-sync/processes/sync-currently-playing";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { Room } from "../lib/interfaces/Room";
import { Track } from "../lib/interfaces/Track";
import {
  getScores,
  negativeScore,
  positiveScore,
  highToLow,
  Vote,
  SortedVoteData,
} from "../lib/interfaces/Vote";
import { getRoomTracks, getRoomVotes, mongoCollection } from "./database";
import { logger } from "./logger";

enum SpotifyLimits {
  MaxTracksToAddPerRequest = 100,
}

const spotifyClient = (accessToken: string) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);
  return spotifyApi;
};

export const addTracksToPlaylist = async (
  accessToken: string,

  playlistId: string,

  trackUris: string[]
): Promise<number> => {
  try {
    const spotifyApi = spotifyClient(accessToken);

    let tracksAdded = 0;

    while (tracksAdded < trackUris.length) {
      const nextTacksIndex =
        tracksAdded + SpotifyLimits.MaxTracksToAddPerRequest;

      await spotifyApi.addTracksToPlaylist(
        playlistId,
        trackUris.slice(tracksAdded, nextTacksIndex)
      );

      tracksAdded = nextTacksIndex;
    }

    return tracksAdded;
  } catch (error) {
    logger.error(`addTracksToPlaylist ${JSON.stringify(error)}`);
    return 0;
  }
};

export const getTracks = async (
  accessToken: string,
  trackIds: string[]
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  const response = await spotifyApi.getTracks(trackIds);
  return response.body.tracks;
};

export const createPlaylist = async (
  accessToken: string,
  trackUris: string[]
): Promise<string> => {
  try {
    const spotifyApi = spotifyClient(accessToken);

    const playlist = await spotifyApi.createPlaylist("🟣🔴🟢🔵🟠🟡", {
      public: true,
      collaborative: false,
      description: "Playlist created with FISSA",
    });

    await addTracksToPlaylist(accessToken, playlist.body.id, trackUris);

    return playlist.body.id;
  } catch (error) {
    logger.error(`createPlaylist ${JSON.stringify(error)}`);
  }
};

export const getPlaylistTracks = async (
  accessToken: string,
  playlistId: string
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    let total = 0;

    let received: SpotifyApi.PlaylistTrackObject[] = [];

    let response = await spotifyApi.getPlaylistTracks(playlistId);

    total = response.body.total;

    received = received.concat(response.body.items);

    while (received.length < total) {
      response = await spotifyApi.getPlaylistTracks(playlistId, {
        offset: received.length,
      });

      received = received.concat(response.body.items);
    }

    const tracks = received.map(
      (item) => item.track as SpotifyApi.TrackObjectFull
    );

    return tracks;
  } catch (error) {
    logger.error(`getPlaylistTracks ${JSON.stringify(error)}`);
  }
};

export const getMyCurrentPlaybackState = async (
  accessToken: string
): Promise<SpotifyApi.CurrentlyPlayingResponse> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyCurrentPlaybackState();

    return response.body;
  } catch (error) {
    logger.error(`getMyCurrentPlaybackState ${JSON.stringify(error)}`);
    throw error;
  }
};

export const getMe = async (accessToken: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMe();

    return response.body;
  } catch (error) {
    logger.error(`getMe ${JSON.stringify(error)}`);
    throw error;
  }
};

const mapTo = <T extends { id: string }>(arr: T[], mapFrom: SortedVoteData[]) =>
  mapFrom.map((from) => arr.find((item) => item.id === from.trackId));

export const reorderPlaylist = async (room: Room) => {
  try {
    const { pin, currentIndex } = room;
    const votes = await getRoomVotes(pin);
    const sortedVotes = getScores(votes);
    const tracks = await getRoomTracks(pin);
    const tracksCollection = mongoCollection<Track>("track");
    const voteIds = votes.map((vote) => vote.trackId);
    const playlistOffset = 2; // 1 for the current track + 1 for the next track

    // 1 remove voted tracks from new order
    let newTracksOrder = tracks.filter((track) => {
      // Keep the current track and the next track
      if (track.index === currentIndex) return true;
      if (track.index === currentIndex + 1) return true;
      // Remove all other tracks
      return !voteIds.includes(track.id);
    });

    // 2 add positive tracks
    const positiveVotes = sortedVotes.filter(positiveScore).sort(highToLow);
    newTracksOrder = [
      ...newTracksOrder.slice(0, currentIndex + playlistOffset),
      ...mapTo(tracks, positiveVotes),
      ...newTracksOrder.slice(currentIndex + playlistOffset),
    ];

    // 3 add negative tracks at the end of the playlist
    const negativeVotes = sortedVotes.filter(negativeScore).sort(highToLow);
    newTracksOrder = [...newTracksOrder, ...mapTo(tracks, negativeVotes)];

    const roomTracks = await tracksCollection;

    // TODO: tak into account when the a track moved from before the current index
    // 4 reorder playlist
    let reorders = 0;
    const reorderUpdates = newTracksOrder.map(async (track, index) => {
      const originalIndex = tracks.findIndex(
        (original) => original.id === track.id
      );

      if (originalIndex === index) return;
      logger.info(`reorder ${track.name} ${originalIndex} -> ${index}`);

      reorders++;
      await roomTracks.updateOne({ pin, id: track.id }, { $set: { index } });
    });

    // update room track indexes in DB
    await Promise.all(reorderUpdates);
    if (reorders > 0) await updateRoom(room);
  } catch (error) {
    logger.error(`reorderPlaylist ${JSON.stringify(error)}`);
  }
};

export const getMyTopTracks = async (accessToken: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyTopTracks({ limit: 20 });
    return response.body.items;
  } catch (error) {
    logger.error(`getMyTopTracks ${JSON.stringify(error)}`);
  }
};

const clearQueue = async (accessToken: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const {
      actions: { disallows },
    } = await getMyCurrentPlaybackState(accessToken);

    if (!Boolean(disallows.skipping_next)) {
      await spotifyApi.skipToNext();
      await clearQueue(accessToken);
    }
  } catch (error) {
    logger.error(`clearQueue ${JSON.stringify(error)}`);
  }
};

export const startPlayingTrack = async (accessToken: string, uri: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    // TODO: clear user queue
    //await clearQueue(accessToken);
    await spotifyApi.play({
      uris: [uri],
    });
  } catch (error) {
    logger.error(`startPlayingTrack ${JSON.stringify(error)}`);
  }
};

export const addTackToQueue = async (
  accessToken: string,
  trackId: string,
  deviceId?: string
) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  logger.info(`adding spotify:track:${trackId} to queue`);

  try {
    await spotifyApi.addToQueue(`spotify:track:${trackId}`, {
      device_id: deviceId,
    });
  } catch (error) {
    logger.error(`addTackToQueue ${JSON.stringify(error)}`);
  }
};

export const getRecommendedTracks = async (
  accessToken: string,
  seedTrackIds: string[]
) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const request = await spotifyApi.getRecommendations({
      limit: 3,
      seed_tracks: seedTrackIds,
      seed_artists: [],
      seed_genres: [],
    });
    return request.body.tracks;
  } catch (error) {
    logger.error(`getRecommendedTracks ${JSON.stringify(error)}`);
  }
};
