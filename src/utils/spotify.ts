import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { logger } from "./logger";

enum SpotifyLimits {
  MaxTracksToAddPerRequest = 100,
}

const spotifyClient = (accessToken: string) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);
  return spotifyApi;
};

export const updateTokens = async (
  accessToken: string,
  refreshToken: string,
  attempt = 0
) => {
  const spotifyApi = spotifyClient(accessToken);
  spotifyApi.setRefreshToken(refreshToken);

  try {
    const { body } = await spotifyApi.refreshAccessToken();
    return body;
  } catch (error) {
    await generalCatchHandler(
      error,
      updateTokens,
      0,
      accessToken,
      refreshToken,
      attempt
    );
  }
};

export const addTracksToPlaylist = async (
  accessToken: string,

  playlistId: string,

  trackUris: string[],
  attempt = 0
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
    await generalCatchHandler(
      error,
      addTracksToPlaylist,
      attempt,
      accessToken,
      playlistId
    );
    return 0;
  }
};

export const getTracks = async (
  accessToken: string,
  trackIds: string[],
  attempt = 0
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getTracks(trackIds);
    return response.body.tracks;
  } catch (error) {
    await generalCatchHandler(error, getTracks, attempt, accessToken, trackIds);
  }
};

export const createPlaylist = async (
  accessToken: string,
  trackUris: string[],
  attempt = 0
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
    await generalCatchHandler(
      error,
      createPlaylist,
      attempt,
      accessToken,
      trackUris
    );
  }
};

export const getPlaylistTracks = async (
  accessToken: string,
  playlistId: string,
  attempt = 0
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
    await generalCatchHandler(
      error,
      getPlaylistTracks,
      attempt,
      accessToken,
      playlistId
    );
  }
};

export const getMyCurrentPlaybackState = async (
  accessToken: string,
  attempt = 0
): Promise<SpotifyApi.CurrentlyPlayingResponse> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyCurrentPlaybackState();

    return response.body;
  } catch (error) {
    await generalCatchHandler(
      error,
      getMyCurrentPlaybackState,
      attempt,
      accessToken
    );
  }
};

export const getMe = async (accessToken: string, attempt = 0) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMe();

    return response.body;
  } catch (error) {
    await generalCatchHandler(error, getMe, attempt, accessToken);
  }
};

export const getMyTopTracks = async (accessToken: string, attempt = 0) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyTopTracks({ limit: 20 });
    return response.body.items;
  } catch (error) {
    await generalCatchHandler(error, getMyTopTracks, attempt, accessToken);
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

export const startPlayingTrack = async (
  accessToken: string,
  uri: string,
  attempt = 0
) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    // TODO: clear user queue
    //await clearQueue(accessToken);
    await spotifyApi.play({
      uris: [uri],
    });
  } catch (error) {
    await generalCatchHandler(
      error,
      startPlayingTrack,
      attempt,
      accessToken,
      uri
    );
  }
};

export const addTackToQueue = async (
  accessToken: string,
  trackId: string,
  attempt = 0
) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  logger.info(`adding spotify:track:${trackId} to queue`);

  try {
    await spotifyApi.addToQueue(`spotify:track:${trackId}`);
  } catch (error) {
    await generalCatchHandler(
      error,
      addTackToQueue,
      attempt,
      accessToken,
      trackId
    );
  }
};

export const getRecommendedTracks = async (
  accessToken: string,
  seedTrackIds: string[],
  attempt = 0
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
    await generalCatchHandler(
      error,
      getRecommendedTracks,
      attempt,
      accessToken,
      seedTrackIds
    );
  }
};

const generalCatchHandler = async (
  error: any,
  originalMethod: Function,
  attempt: number,
  ...args: any
) => {
  const accessToken = args["accessToken"];
  try {
    if (error.message.includes("active device")) {
      const spotifyApi = spotifyClient(accessToken);
      logger.warn(
        `${originalMethod.name}: no active device, trying to connect to a device`
      );

      const {
        body: { devices },
      } = await spotifyApi.getMyDevices();
      if (devices.length >= attempt) {
        await spotifyApi.transferMyPlayback([devices[attempt].id]);
      }

      if (attempt < devices.length) {
        originalMethod(...args, attempt + 1);
      }
      return;
    }

    logger.error(`${originalMethod.name}: ${JSON.stringify(error)}`);
  } catch (error) {
    logger.error(`generalCatchHandler ${JSON.stringify(error)}`);
  }
};
