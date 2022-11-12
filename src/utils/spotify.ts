import { StatusCodes } from "http-status-codes";
import SpotifyWebApi from "spotify-web-api-node";
import { logger } from "./logger";

import { NotFound } from "../lib/classes/errors/NotFound";

enum SpotifyLimits {
  MaxTracksToAddPerRequest = 100,
}

const spotifyClient = (accessToken: string) => {
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
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
    logger.warn(`${updateTokens.name}(${attempt}): ${JSON.stringify(error)}`);
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
    logger.warn(
      `${addTracksToPlaylist.name}(${attempt}): ${JSON.stringify(error)}`
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
    const {
      body: { tracks },
    } = await spotifyApi.getTracks(trackIds);
    return tracks;
  } catch (error) {
    logger.warn(`${getTracks.name}(${attempt}): ${JSON.stringify(error)}`);
    return [];
  }
};

const getMyLikedTracks = async (
  accessToken: string,
  attempt = 0
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  let received: SpotifyApi.SavedTrackObject[] = [];

  try {
    const {
      body: { total, items },
    } = await spotifyApi.getMySavedTracks();

    received = received.concat(items);

    while (received.length < total) {
      const { body } = await spotifyApi.getMySavedTracks({
        offset: received.length,
      });

      received = received.concat(body.items);
    }

    const tracks = received.map((track) => track.track);

    return tracks;
  } catch (error) {
    logger.warn(
      `${getMyLikedTracks.name}(${attempt}): ${JSON.stringify(error)}`
    );
    return [];
  }
};

export const getPlaylistTracks = async (
  accessToken: string,
  playlistId: string,
  attempt = 0
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    if (playlistId === "saved-tracks") {
      return await getMyLikedTracks(accessToken);
    }
    let received: SpotifyApi.PlaylistTrackObject[] = [];

    const {
      body: { total, items },
    } = await spotifyApi.getPlaylistTracks(playlistId);

    received = received.concat(items);

    while (received.length < total) {
      const { body } = await spotifyApi.getPlaylistTracks(playlistId, {
        offset: received.length,
      });

      received = received.concat(body.items);
    }

    const tracks = received
      .map((item) => item.track)
      .filter((track) => track !== null) as SpotifyApi.TrackObjectFull[];

    return tracks;
  } catch (error) {
    logger.warn(
      `${getPlaylistTracks.name}(${attempt}): ${JSON.stringify(error)}`
    );
    return [];
  }
};

export const getMyCurrentPlaybackState = async (
  accessToken: string,
  attempt = 0
): Promise<SpotifyApi.CurrentlyPlayingResponse> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const { body } = await spotifyApi.getMyCurrentPlaybackState();

    return body;
  } catch (error) {
    logger.warn(
      `${getMyCurrentPlaybackState.name}(${attempt}): ${JSON.stringify(error)}`
    );
    return Promise.reject(error);
  }
};

export const getMe = async (accessToken: string, attempt = 0) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const { body } = await spotifyApi.getMe();

    return body;
  } catch (error) {
    logger.warn(`${getMe.name}(${attempt}): ${JSON.stringify(error)}`);
    return Promise.reject(error);
  }
};

export const getMyTopTracks = async (
  accessToken: string,
  attempt = 0
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const {
      body: { items },
    } = await spotifyApi.getMyTopTracks({ limit: 20 });
    return items;
  } catch (error) {
    logger.warn(`${getMyTopTracks.name}(${attempt}): ${JSON.stringify(error)}`);
    return [];
  }
};

export const setActiveDevice = async (accessToken: string, attempt = 0) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const {
      body: { devices },
    } = await spotifyApi.getMyDevices();

    const activeDevice = devices.find((device) => device.is_active);

    if (activeDevice) return;
    if (attempt >= devices.length) return;

    const device = devices[attempt];
    if (device.id) {
      spotifyApi.transferMyPlayback([device.id]);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await setActiveDevice(accessToken, attempt + 1);
  } catch (error) {
    logger.warn(
      `${setActiveDevice.name}(${attempt}): ${JSON.stringify(error)}`
    );
  }
};

export const startPlayingTrack = async (
  accessToken: string,
  /**
   * Should be in the format `spotify:track:{trackId}`
   */
  uri: string,
  attempt = 0
) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    await spotifyApi.play({
      uris: [uri],
    });

    // Spotify needs some time to actually start playing the track
    // so we create a loop that checks if the track is playing
    // and if it is, we return
    // it can take at most N seconds before we return anyway
    await new Promise(async (resolve) => {
      setTimeout(resolve, 5_000);
      for (let i = 0; i < 5; i++) {
        const {
          body: { is_playing },
        } = await spotifyApi.getMyCurrentPlaybackState();

        if (!is_playing) continue;

        resolve(i);
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 2000)); // give spotify some slack

    return true;
  } catch (error) {
    logger.warn(
      `${startPlayingTrack.name}(${attempt}): ${JSON.stringify(error)}`
    );

    if ((error as any).body?.error?.status === StatusCodes.NOT_FOUND) {
      throw new NotFound("No active device found");
    }

    return false;
  }
};

export const getRecommendedTracks = async (
  accessToken: string,
  seedTrackIds: string[],
  attempt = 0
): Promise<SpotifyApi.TrackObjectSimplified[]> => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const {
      body: { tracks },
    } = await spotifyApi.getRecommendations({
      limit: 3,
      seed_tracks: seedTrackIds,
      seed_artists: [],
      seed_genres: [],
    });
    return tracks;
  } catch (error) {
    logger.warn(
      `${getRecommendedTracks.name}(${attempt}): ${JSON.stringify(error)}`
    );
    return [];
  }
};
