import SpotifyWebApi from "spotify-web-api-node";
import { updateRoom } from "../client-sync/processes/sync-currently-playing";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { Room } from "../lib/interfaces/Room";
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

type CreatePlaylistAsync = {
  playlistId: string;
  createdBy: string;
};

export const addTracksToPlaylistAsync = async (
  accessToken: string,

  playlistId: string,

  trackUris: string[]
): Promise<number> => {
  try {
    const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
    spotifyApi.setAccessToken(accessToken);

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

export const createPlaylistAsync = async (
  accessToken: string,
  playlistId?: string
): Promise<CreatePlaylistAsync> => {
  try {
    const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
    spotifyApi.setAccessToken(accessToken);

    let trackUris: string[] = [];

    if (playlistId) {
      const trackObjects = await getPlaylistTracksAsync(
        accessToken,
        playlistId
      );

      trackUris = trackObjects.map((track) => track.uri);
    }

    const playlist = await spotifyApi.createPlaylist("🟣🔴🟢🔵🟠🟡", {
      public: true,
      collaborative: false,
      description: "Playlist created with FISSA",
    });

    if (trackUris.length > 0) {
      await addTracksToPlaylistAsync(accessToken, playlist.body.id, trackUris);
    }

    await disableShuffleAsync(accessToken);

    return {
      playlistId: playlist.body.id,
      createdBy: playlist.body.owner.id,
    };
  } catch (error) {
    logger.error("createPlaylistAsync", error);
  }
};

export const getPlaylistTracksAsync = async (
  accessToken: string,
  playlistId: string
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

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

export const getMyCurrentPlaybackStateAsync = async (
  accessToken: string
): Promise<SpotifyApi.CurrentlyPlayingResponse> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    const response = await spotifyApi.getMyCurrentPlaybackState();

    return response.body;
  } catch (error) {
    logger.error("getMyCurrentPlaybackStateAsync", error);
    throw error;
  }
};

export const getMeAsync = async (accessToken: string) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    const response = await spotifyApi.getMe();

    return response.body;
  } catch (error) {
    logger.error("getMeAsync", error);
    throw error;
  }
};

export const disableShuffleAsync = async (
  accessToken: string
): Promise<void> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

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

export const poorMansTrackIndex = (
  tracks: SpotifyApi.TrackObjectFull[],
  currentUri?: string
): number => {
  try {
    const trackUris = tracks?.map((track) => track.uri) ?? [];

    const index = trackUris.indexOf(currentUri);
    return index;
  } catch (error) {
    logger.error("poorMansCurrentIndexAsync", error);
    return -1;
  }
};

const updatePlaylistTrackIndexAsync = async (
  playlistId: string,
  accessToken: string,
  options: {
    trackIndex: number;
    newTrackIndex: number;
    snapshotId?: string;
  }
): Promise<string> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  const { trackIndex, newTrackIndex, snapshotId } = options;

  logger.warn(
    `insert track on index ${trackIndex} on ${newTrackIndex} for snapshot ${snapshotId}`
  );
  try {
    const response = await spotifyApi.reorderTracksInPlaylist(
      playlistId,
      trackIndex,
      newTrackIndex,
      {
        range_length: 1,
        snapshot_id: snapshotId,
      }
    );
    return response.body.snapshot_id;
  } catch (error) {
    logger.error("updatePlaylistTrackIndexAsync", error);
    return null;
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
  const { accessToken, playlistId } = room;
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    const scores = getScores(votes).sort((a, b) =>
      a.trackUri.localeCompare(b.trackUri)
    );

    const positiveScores = scores.filter(positiveScore).sort(highToLow);
    const negativeScores = scores.filter(negativeScore).sort(lowToHigh);

    logger.info(`positiveScores ${JSON.stringify(positiveScores)}`);

    const { item } = await getMyCurrentPlaybackStateAsync(accessToken);
    let snapshotId: string | undefined;
    const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
    let startIndex = poorMansTrackIndex(tracks, item?.uri);
    const nextTrackOffset = 1; // 1 to insert after the current index, 1 to make sure the next track is locked

    for (let index = 0; index < positiveScores.length; index++) {
      logger.info(">>>>>>>>>>>>>>");
      const score = positiveScores[index];
      const trackIndex = poorMansTrackIndex(tracks, score.trackUri);

      const expectedNewIndex = startIndex + index + nextTrackOffset;
      logger.info(
        JSON.stringify({ total: score.total, trackIndex, expectedNewIndex })
      );

      if (trackIndex === expectedNewIndex) {
        logger.info("track is already in the right place");
        continue;
      }

      if (trackIndex < startIndex) {
        startIndex -= 1; // We are going to move a track from above the playlistIndex, so we need to adjust the playlistIndex
      } else {
        startIndex += 1;
      }

      snapshotId = await updatePlaylistTrackIndexAsync(
        playlistId,
        accessToken,
        {
          trackIndex: trackIndex,
          newTrackIndex: expectedNewIndex,
          snapshotId,
        }
      );
    }

    logger.info(">>>>>>>>>>>>>>");
    logger.info("done sorting positive scores");
    await updateRoom(room);
  } catch (error) {
    logger.error("reorderPlaylist", error);
  }
};

export const startPlaylistFromTopAsync = async (room: Room) => {
  const { accessToken, playlistId } = room;
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    await disableShuffleAsync(accessToken);

    await spotifyApi.play({
      context_uri: `spotify:playlist:${playlistId}`,
      offset: {
        position: 0,
      },
    });
  } catch (error) {
    logger.error("startPlaylistFromTopAsync", error);
  }
};
