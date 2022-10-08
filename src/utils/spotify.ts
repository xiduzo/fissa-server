import SpotifyWebApi from "spotify-web-api-node";
import { updateRoom } from "../client-sync/processes/sync-currently-playing";
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
  }
};

export const createPlaylist = async (
  accessToken: string,
  trackUris: string[],
  attempt = 0
): Promise<string> => {
  try {
    const spotifyApi = spotifyClient(accessToken);

    const {
      body: { id },
    } = await spotifyApi.createPlaylist("🟣🔴🟢🔵🟠🟡", {
      public: true,
      collaborative: false,
      description: "Playlist created with FISSA",
    });

    await addTracksToPlaylist(accessToken, id, trackUris);

    return id;
  } catch (error) {
    logger.warn(`${createPlaylist.name}(${attempt}): ${JSON.stringify(error)}`);
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
    logger.warn(
      `${getPlaylistTracks.name}(${attempt}): ${JSON.stringify(error)}`
    );
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
  }
};

export const getMe = async (accessToken: string, attempt = 0) => {
  const spotifyApi = spotifyClient(accessToken);

  try {
    const { body } = await spotifyApi.getMe();

    return body;
  } catch (error) {
    logger.warn(`${getMe.name}(${attempt}): ${JSON.stringify(error)}`);
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
  }
};

const clearQueue = async (accessToken: string, attempt = 0) => {
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
    logger.warn(`${clearQueue.name}(${attempt}): ${JSON.stringify(error)}`);
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
    logger.warn(
      `${startPlayingTrack.name}(${attempt}): ${JSON.stringify(error)}`
    );

    if (error.body.error.reason === "NO_ACTIVE_DEVICE") {
      logger.info(
        `${startPlayingTrack.name}(${attempt}): Setting active device`
      );
      try {
        const {
          body: { devices },
        } = await spotifyApi.getMyDevices();

        if (devices.length >= attempt) {
          await spotifyApi.transferMyPlayback([devices[attempt].id]);
          await startPlayingTrack(accessToken, uri, attempt + 1);
          const rooms = await mongoCollection<Room>("room");
          const room = await rooms.findOne({ accessToken });
          await updateRoom(room);
        }
      } catch {
        logger.error(
          `${startPlayingTrack.name}(${attempt}): ${JSON.stringify(error)}`
        );
      }
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
    logger.warn(`${addTackToQueue.name}(${attempt}): ${JSON.stringify(error)}`);
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
  }
};
