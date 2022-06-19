import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../lib/constants/credentials';

export const addTracksToPlaylistAsync = async (
  accessToken: string,

  playlistId: string,

  trackUris: string[],
): Promise<number> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  // We can only add 100 tracks at a time due to spotify constraints
  const spotifyMaxTracksPerRequest = 100;

  let tracksAdded = 0;

  while (tracksAdded < trackUris.length) {
    await spotifyApi.addTracksToPlaylist(
      playlistId,

      trackUris.slice(tracksAdded, tracksAdded + spotifyMaxTracksPerRequest),
    );

    tracksAdded += spotifyMaxTracksPerRequest;
  }

  return tracksAdded;
};

export const createPlaylistAsync = async (
  accessToken: string,

  playlistId?: string,
): Promise<string> => {
  try {
    const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
    spotifyApi.setAccessToken(accessToken);

    let trackUris: string[] = [];

    if (playlistId) {
      const trackObjects = await getPlaylistTracksAsync(
        accessToken,
        playlistId,
      );

      trackUris = trackObjects.map(track => track.uri);
    }

    const playlist = await spotifyApi.createPlaylist('🟣🔴🟢🔵🟠🟡', {
      public: true,
      collaborative: true,

      description: 'Playlist created with FISSA',
    });

    if (trackUris.length > 0) {
      await addTracksToPlaylistAsync(accessToken, playlist.body.id, trackUris);
    }

    return playlist.body.id;
  } catch (e) {
    console.error(e);
  }
};

const getPlaylistTracksAsync = async (
  accessToken: string,

  playlistId: string,
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
      item => item.track as SpotifyApi.TrackObjectFull,
    );

    return tracks;
  } catch (error) {
    console.error(error);
  }
};
