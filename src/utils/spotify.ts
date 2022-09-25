import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { Room } from "../lib/interfaces/Room";
import { SortedVotes, Vote } from "../lib/interfaces/Vote";
import { logger } from "./logger";
import { publishAsync } from "./mqtt";

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

const getScores = (votes: Vote[]): { total: number; trackUri: string }[] => {
  return Object.values(
    votes.reduce((acc, vote) => {
      const currentScore = acc[vote.trackUri]?.total ?? 0;
      const addition = vote.state === "up" ? 1 : -1;
      return {
        ...acc,
        [vote.trackUri]: {
          total: currentScore + addition,
          trackUri: vote.trackUri,
        },
      };
    }, {})
  );
};

const sortHighToLow = (a: { total: number }, b: { total: number }): number =>
  b.total - a.total;

const sortLowToHigh = (a: { total: number }, b: { total: number }): number =>
  a.total - b.total;

const positiveScore = (score: { total: number; trackUri: string }) =>
  score.total > 0;
const negativeScore = (score: { total: number; trackUri: string }) =>
  score.total < 0;

export const reorderPlaylist = async (room: Room, votes: Vote[]) => {
  const { accessToken, playlistId } = room;
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
    const currentlyPlaying = await getMyCurrentPlaybackStateAsync(accessToken);
    const currentIndex = poorMansTrackIndex(tracks, currentlyPlaying.item?.uri);

    const scores = getScores(votes);

    const positiveScores = scores.filter(positiveScore).sort(sortLowToHigh);
    const negativeScores = scores.filter(negativeScore).sort(sortHighToLow);

    // positiveScores.forEach(async (score) => {
    //   const trackIndex = poorMansTrackIndex(tracks, score.trackUri);

    //   if (trackIndex < currentIndex) {
    //     logger.info(
    //       `Track is already in playlist, sorting it with ${score.total} points`
    //     );
    //   }
    // });
    // await publishAsync(`fissa/room/${room.pin}/tracks/reordered`, votes);
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
