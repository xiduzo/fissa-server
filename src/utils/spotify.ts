import { access } from "fs";
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
  lowToHigh,
  Vote,
} from "../lib/interfaces/Vote";
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
    logger.error("addTracksToPlaylistAsync", error);
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
    logger.error("createPlaylistAsync", error);
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
    logger.error("getPlaylistTracksAsync", error);
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
    logger.error("getMyCurrentPlaybackStateAsync", error);
    throw error;
  }
};

export const getMe = async (accessToken: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMe();

    return response.body;
  } catch (error) {
    logger.error("getMeAsync", error);
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

    logger.error("disableShuffleAsync", error);
  } finally {
    return Promise.resolve();
  }
};

export const poorMansTrackIndex = (tracks: Track[], id?: string): number => {
  try {
    const trackIDs = tracks?.map((track) => track.id) ?? [];

    const index = trackIDs.indexOf(id);
    return index;
  } catch (error) {
    logger.error("poorMansCurrentIndexAsync", error);
    return -1;
  }
};

type NewIndex = (props: {
  totalTracks: number;
  playlistIndex: number;
  trackIndex: number;
  sortedItems: number;
  voteIndex: number;
}) => number;

const positiveNewIndex: NewIndex = ({
  playlistIndex,
  sortedItems,
  trackIndex,
}) => playlistIndex + sortedItems + Number(trackIndex > playlistIndex);

const negativeNewIndex: NewIndex = ({
  totalTracks,
  trackIndex,
  playlistIndex,
  voteIndex,
}) => totalTracks - Number(trackIndex > playlistIndex) - voteIndex;

export const reorderPlaylist = async (room: Room, votes: Vote[]) => {
  const { accessToken } = room;
  const spotifyApi = spotifyClient(accessToken);

  try {
    // const scores = getScores(votes).sort((a, b) =>
    //   a.trackUri.localeCompare(b.trackUri)
    // );

    // const positiveScores = scores.filter(positiveScore).sort(highToLow);
    // const negativeScores = scores.filter(negativeScore).sort(lowToHigh);

    // logger.info(`positiveScores ${JSON.stringify(positiveScores)}`);

    // const { item } = await getMyCurrentPlaybackStateAsync(accessToken);
    // let snapshotId: string | undefined;
    // const nextTrackOffset = 2; // 1 to insert after the current index, 1 to make sure the next track is locked

    // for (let index = 0; index < positiveScores.length; index++) {
    //   logger.info(">>>>>>>>>>>>>>");
    //   const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
    //   let currentIndex = poorMansTrackIndex(tracks, item?.uri);
    //   const score = positiveScores[index];
    //   const trackIndex = poorMansTrackIndex(tracks, score.trackUri);

    //   const expectedNewIndex = currentIndex + index + nextTrackOffset;
    //   logger.info(
    //     JSON.stringify({
    //       total: score.total,
    //       currentIndex,
    //       trackIndex,
    //       expectedNewIndex,
    //     })
    //   );

    //   if (trackIndex === expectedNewIndex) {
    //     logger.info("track is already in the right place");
    //     continue;
    //   }

    //   if (trackIndex < currentIndex) {
    //     currentIndex -= 1; // We are going to move a track from above the playlistIndex, so we need to adjust the playlistIndex
    //   }

    //   snapshotId = await updatePlaylistTrackIndexAsync(
    //     playlistId,
    //     accessToken,
    //     {
    //       trackIndex: trackIndex,
    //       newTrackIndex: expectedNewIndex,
    //       snapshotId,
    //     }
    //   );
    // }

    logger.info(">>>>>>>>>>>>>>");
    logger.info("done sorting positive scores");
    await updateRoom(room);
  } catch (error) {
    logger.error("reorderPlaylist", error);
  }
};

export const getMyTopTracks = async (accessToken: string) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyTopTracks({ limit: 20 });
    return response.body.items;
  } catch (error) {
    logger.error(`getMyTopTracksAsync ${JSON.stringify(error)}`);
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

    if (tryIndex < 5) {
      const { is_playing, item } = await getMyCurrentPlaybackState(accessToken);
      if (is_playing) return;
      if (item.uri === uri) return;
      await startPlaylistFromTrack(accessToken, uri, tryIndex + 1);
      return;
    }
  } catch (error) {
    logger.error("startPlaylistFromTrackAsync", error);
  }
};

export const addTackToQueue = async (
  accessToken: string,
  trackId: string,
  deviceId?: string
) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  logger.info(`spotify:track:${trackId}`);

  try {
    await spotifyApi.addToQueue(`spotify:track:${trackId}`, {
      device_id: deviceId,
    });
  } catch (error) {
    logger.error("addTackToQueueAsync", error);
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
    logger.error("getRandomTracksAsync", error);
  }
};
