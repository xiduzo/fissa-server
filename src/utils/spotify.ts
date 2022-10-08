import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { Room } from "../lib/interfaces/Room";
import { mongoCollection } from "./database";
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      updateTokens
    );

    if (shouldRetry) {
      return updateTokens(accessToken, refreshToken, attempt + 1);
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      addTracksToPlaylist
    );

    if (shouldRetry) {
      return await addTracksToPlaylist(
        accessToken,
        playlistId,
        trackUris,
        attempt + 1
      );
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      getTracks
    );

    if (shouldRetry) {
      return await getTracks(accessToken, trackIds, attempt + 1);
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      createPlaylist
    );

    if (shouldRetry) {
      return await createPlaylist(accessToken, trackUris, attempt + 1);
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      getPlaylistTracks
    );

    if (shouldRetry) {
      return await getPlaylistTracks(accessToken, playlistId, attempt + 1);
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      getMyCurrentPlaybackState
    );

    if (shouldRetry) {
      return await getMyCurrentPlaybackState(accessToken, attempt + 1);
    }
  }
};

export const getMe = async (accessToken: string, attempt = 0) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMe();

    return response.body;
  } catch (error) {
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      getMe
    );

    if (shouldRetry) {
      return await getMe(accessToken, attempt + 1);
    }
  }
};

export const getMyTopTracks = async (
  accessToken: string,
  attempt = 0
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const response = await spotifyApi.getMyTopTracks({ limit: 20 });
    return response.body.items;
  } catch (error) {
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      getMyTopTracks
    );

    if (shouldRetry) {
      return await getMyTopTracks(accessToken, attempt + 1);
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      addTackToQueue
    );

    if (shouldRetry) {
      await startPlayingTrack(accessToken, uri, attempt + 1);
    }
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      addTackToQueue
    );

    if (shouldRetry) {
      await addTackToQueue(accessToken, trackId, attempt + 1);
    }
  }
};

export const getRecommendedTracks = async (
  accessToken: string,
  seedTrackIds: string[],
  attempt = 0
): Promise<SpotifyApi.TrackObjectSimplified[]> => {
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
    const shouldRetry = await generalCatchHandler(
      error,
      accessToken,
      attempt,
      getRecommendedTracks
    );

    if (shouldRetry) {
      return await getRecommendedTracks(accessToken, seedTrackIds, attempt + 1);
    }
  }
};

const generalCatchHandler = async (
  error: any,
  accessToken: string,
  attempt: number,
  originalMethod: Function,
  otherParams?: object
): Promise<boolean> => {
  logger.warn(`${originalMethod.name}(${attempt}): ${JSON.stringify(error)}`);
  const spotifyApi = spotifyClient(accessToken);

  try {
    if (error.message.includes("active device")) {
      logger.info(
        `${originalMethod.name}(${attempt}): trying to connect to a device`
      );

      const {
        body: { devices },
      } = await spotifyApi.getMyDevices();
      if (devices.length >= attempt) {
        await spotifyApi.transferMyPlayback([devices[attempt].id]);
      }

      if (attempt < devices.length) return true;
    }

    if (error.message.includes("access token expired")) {
      logger.info(
        `${originalMethod.name}(${attempt}): trying to update access token`
      );

      if (attempt > 5) return false;
      const refreshToken = otherParams["refreshToken"];
      if (!refreshToken) throw new Error("refresh token is not provided");
      spotifyApi.setRefreshToken(refreshToken);
      const rooms = await mongoCollection<Room>("room");
      const response = await spotifyApi.refreshAccessToken();
      const me = await getMe(response.body.access_token);

      logger.info(`Updating access token for ${me?.id}`);

      await rooms.updateMany(
        { createdBy: me?.id },
        {
          $set: { accessToken: response.body.access_token },
        }
      );

      return true;
    }
    logger.error(
      `${originalMethod.name}(${attempt}): ${JSON.stringify(error)}`
    );
    return false;
  } catch (error) {
    logger.error(`generalCatchHandler(${attempt}): ${JSON.stringify(error)}`);
    return false;
  }
};
