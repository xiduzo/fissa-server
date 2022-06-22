import { Console } from "console";
import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";

export const addTracksToPlaylistAsync = async (
  accessToken: string,

  playlistId: string,

  trackUris: string[]
): Promise<number> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  // We can only add 100 tracks at a time due to spotify constraints
  const spotifyMaxTracksPerRequest = 100;

  let tracksAdded = 0;

  while (tracksAdded < trackUris.length) {
    await spotifyApi.addTracksToPlaylist(
      playlistId,

      trackUris.slice(tracksAdded, tracksAdded + spotifyMaxTracksPerRequest)
    );

    tracksAdded += spotifyMaxTracksPerRequest;
  }

  return tracksAdded;
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

    setShuffleAsync(accessToken);

    if (playlistId) {
      const trackObjects = await getPlaylistTracksAsync(
        accessToken,
        playlistId
      );

      trackUris = trackObjects.map((track) => track.uri);
    }

    const playlist = await spotifyApi.createPlaylist("🟣🔴🟢🔵🟠🟡", {
      public: false,
      collaborative: true,
      description: "Playlist created with FISSA",
    });

    if (trackUris.length > 0) {
      await addTracksToPlaylistAsync(accessToken, playlist.body.id, trackUris);
    }

    return {
      playlistId: playlist.body.id,
      createdBy: playlist.body.owner.id,
    };
  } catch (e) {
    console.error(e);
  }
};

const getPlaylistTracksAsync = async (
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
    console.error(error);
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
  } catch (error: any) {
    console.error("No current playback state", error);
    // throw 'No current playback state'
  }
};

export const setShuffleAsync = async (
  accessToken: string,
  shuffle = false
): Promise<void> => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);

  spotifyApi.setAccessToken(accessToken);

  await spotifyApi.setShuffle(shuffle);
};

export const poorMansCurrentIndexAsync = async (
  accessToken: string,
  playlistId: string,
  current: SpotifyApi.CurrentlyPlayingResponse
): Promise<number> => {
  const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
  const trackIds = tracks.map((track) => track.id);

  const index = trackIds.reverse().indexOf(current.item.id);

  console.log(tracks.length - 1, index, tracks.length - 1 - index);
  if (index === -1) {
    // We are not in the playlist anymore
    return -1;
  }

  return tracks.length - 1 - index;
};
