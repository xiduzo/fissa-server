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
    if (error.message.includes("active device")) {
      const {
        body: { devices },
      } = await spotifyApi.getMyDevices();
      if (devices.length >= attempt) {
        await spotifyApi.transferMyPlayback([devices[attempt].id]);
      }

      if (attempt < devices.length) {
        startPlayingTrack(accessToken, uri, attempt + 1);
      }
      return;
    }
    logger.error(`startPlayingTrack ${JSON.stringify(error)}`);
  }
};

export const addTackToQueue = async (accessToken: string, trackId: string) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  logger.info(`adding spotify:track:${trackId} to queue`);

  try {
    await spotifyApi.addToQueue(`spotify:track:${trackId}`);
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
