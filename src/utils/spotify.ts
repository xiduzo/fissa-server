import SpotifyWebApi from 'spotify-web-api-node';
import {SPOTIFY_CREDENTIALS} from '../lib/constants/spotify';

export const addTracksToPlaylistAsync = async (
  token: string,

  playlistId: string,

  trackUris: string[],
): Promise<number> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);

  spotifyApi.setAccessToken(token);

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
  token: string,

  playlistId?: string,
): Promise<string> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);

  spotifyApi.setAccessToken(token);

  let tracks: string[] = [];

  if (playlistId) {
    const trackObjects = await getPlaylistTracksAsync(token, playlistId);

    tracks = trackObjects.map(track => track.uri);
  }

  const playlist = await spotifyApi.createPlaylist('🟣🔴🟢🔵🟠🟡', {
    public: true,

    description: 'Playlist created with https://spotify-x.herokuapp.com/',
  });

  if (tracks.length > 0) {
    await addTracksToPlaylistAsync(token, playlist.body.id, tracks);
  }

  return playlist.body.id;
};

const getPlaylistTracksAsync = async (
  token: string,

  playlistId: string,
): Promise<SpotifyApi.TrackObjectFull[]> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(token);

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
