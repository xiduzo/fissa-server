import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { Room } from "../lib/interfaces/Room";
import { SortedVotes } from "../lib/interfaces/Vote";
import { logger } from "./logger";
import { publishAsync } from "./mqtt";

enum SpotifyLimits {
  MaxTracksToAddPerRequest = 100,
}

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

type CreatePlaylistAsync = {
  playlistId: string;
  createdBy: string;
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
      logger.info("trying to set active device of user");

      const myDevices = await spotifyApi.getMyDevices();

      if (myDevices.body.devices.length > 0) {
        await spotifyApi.transferMyPlayback([myDevices.body.devices[0].id]);
        return;
      }

      logger.warn("no devices found for user");

      return;
    }

    logger.error("disableShuffleAsync", error);
  } finally {
    return Promise.resolve();
  }
};

export const poorMansCurrentIndexAsync = async (
  accessToken: string,
  playlistId: string,
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
): Promise<number> => {
  try {
    const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
    const index = trackIndex(tracks, currentlyPlaying.item?.uri ?? "");
    return index;
  } catch (error) {
    logger.error("poorMansCurrentIndexAsync", error);
    return -1;
  }
};

const trackIndex = (
  tracks: SpotifyApi.TrackObjectFull[],
  trackUri: string
): number => {
  const trackUris = tracks?.map((track) => track.uri) ?? [];

  const index = trackUris.indexOf(trackUri);

  return index;
};

/**
 * @param rangeStart The position of the first track to be reordered.
 * @param insertBefore The position where the tracks should be inserted.
 */
const updatePlaylistTrackIndexAsync = async (
  playlistId: string,
  accessToken: string,
  uris: string[],
  rangeStart: number,
  insertBefore: number
) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    await spotifyApi.reorderTracksInPlaylist(
      playlistId,
      rangeStart,
      insertBefore,
      {
        range_length: uris.length,
      }
    );
  } catch (error) {
    logger.error("updatePlaylistTrackIndexAsync", error);
  }
};

export const reorderPlaylist = async (room: Room, votes: SortedVotes) => {
  const { accessToken, playlistId } = room;
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
    const currentlyPlaying = await getMyCurrentPlaybackStateAsync(accessToken);
    const currentIndex = await poorMansCurrentIndexAsync(
      accessToken,
      playlistId,
      currentlyPlaying
    );

    const lowToHighTotalSortedVotes = Object.values(votes).sort(
      (a, b) => a.total - b.total
    );
    const updatePromises = lowToHighTotalSortedVotes.map((vote) => {
      const voteIndex = trackIndex(tracks, vote.trackUri);
      const newIndex = vote.total < 0 ? tracks.length : currentIndex + 2; // The next track in queue is locked

      const promise = updatePlaylistTrackIndexAsync(
        playlistId,
        accessToken,
        [vote.trackUri],
        voteIndex,
        newIndex
      );

      return promise;
    });

    await Promise.all(updatePromises);
    await publishAsync(`fissa/room/${room.pin}/tracks/reordered`, votes);
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
