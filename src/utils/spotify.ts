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
import { getRoomTracks, mongoCollection } from "./database";
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

export const disableShuffle = async (accessToken: string): Promise<void> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    await spotifyApi.setShuffle(false);
  } catch (error) {
    if (error.message?.includes("NO_ACTIVE_DEVICE")) {
      const myDevices = await spotifyApi.getMyDevices();

      if (myDevices.body.devices.length <= 0) {
        logger.warn("no devices found for user");
        return;
      }

      await spotifyApi.transferMyPlayback([myDevices.body.devices[0].id]);
      return;
    }

    logger.error(`disableShuffle ${JSON.stringify(error)}`);
  } finally {
    return Promise.resolve();
  }
};

const mapToTracks = <T extends { id: string }>(
  tracks: T[],
  votes: SortedVoteData[]
) => {
  return votes.map((vote) => tracks.find((track) => track.id === vote.trackId));
};

export const reorderPlaylist = async (room: Room, votes: Vote[]) => {
  try {
    const { pin, currentIndex } = room;
    const sortedVotes = getScores(votes);
    const tracks = await getRoomTracks(pin);
    const tracksCollection = mongoCollection<Track>("track");
    const voteIds = votes.map((vote) => vote.trackId);

    // 1 remove voted tracks from playlist
    let newTracksOrder = tracks.filter((track) => !voteIds.includes(track.id));

    // 2 add positive tracks right after current index
    const positiveVotes = sortedVotes.filter(positiveScore).sort(highToLow);
    newTracksOrder = [
      ...newTracksOrder.slice(0, currentIndex),
      ...mapToTracks(tracks, positiveVotes),
      ...newTracksOrder.slice(currentIndex),
    ];

    // 3 add negative tracks at the end of the playlist
    const negativeVotes = sortedVotes.filter(negativeScore).sort(highToLow);
    newTracksOrder = [...newTracksOrder, ...mapToTracks(tracks, negativeVotes)];

    const roomTracks = await tracksCollection;

    // 4 reorder playlist
    const reorderUpdates = newTracksOrder.map(async (track, index) => {
      const originalIndex = tracks.indexOf(track);
      if (originalIndex === index) return;

      logger.info(`${pin}: reorder ${track.name} ${originalIndex} -> ${index}`);
      await roomTracks.updateOne({ pin }, { $set: { index } });
    });
    // update room track indexes in DB
    await Promise.all(reorderUpdates);
    await updateRoom(room);
  } catch (error) {
    logger.error(`reorderPlaylist ${JSON.stringify(error)}`);
  }
};

export const getMyTopTracks = async (accessToken: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyTopTracks({ limit: 20 });
    logger.info(`got ${response.body.items.length} top tracks`);
    return response.body.items;
  } catch (error) {
    logger.error(`getMyTopTracks ${JSON.stringify(error)}`);
  }
};

export const startPlaylistFromTrack = async (
  accessToken: string,
  uri: string,
  tryIndex: number = 0
) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    await spotifyApi.play({
      uris: [uri],
    });
    await disableShuffle(accessToken);

    if (tryIndex > 5) return;

    const { is_playing, item } = await getMyCurrentPlaybackState(accessToken);
    if (is_playing) return;
    if (item.uri === uri) return;
    await startPlaylistFromTrack(accessToken, uri, tryIndex + 1);
  } catch (error) {
    logger.error(`startPlaylistFromTrack ${JSON.stringify(error)}`);
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
      limit: 5,
      seed_tracks: seedTrackIds,
      seed_artists: [],
      seed_genres: [],
    });
    return request.body.tracks;
  } catch (error) {
    logger.error(`getRecommendedTracks ${JSON.stringify(error)}`);
  }
};
