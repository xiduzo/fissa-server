import SpotifyWebApi from "spotify-web-api-node";
import { SPOTIFY_CREDENTIALS } from "../lib/constants/credentials";
import { SortedVote, Vote } from "../lib/interfaces/Vote";

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
  } catch (e) {
    console.error(e);
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

export const getMeAsync = async (accessToken: string) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  try {
    const response = await spotifyApi.getMe();

    return response.body;
  } catch (error: any) {
    console.error("failed to get me", error);
  }
};

export const setShuffleAsync = async (
  accessToken: string,
  shuffle = false
): Promise<void> => {
  try {
    const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
    spotifyApi.setAccessToken(accessToken);

    await spotifyApi.setShuffle(shuffle);
  } catch (e) {
    console.error(e);
  }
};

export const poorMansCurrentIndexAsync = async (
  accessToken: string,
  playlistId: string,
  currentlyPlaying: SpotifyApi.CurrentlyPlayingResponse
): Promise<number> => {
  try {
    const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
    const index = trackIndex(tracks, currentlyPlaying.item.uri);
    return index;
  } catch (e) {
    console.error(e);
    return -1;
  }
};

export const trackIndex = (
  tracks: SpotifyApi.TrackObjectFull[],
  trackUri: string
): number => {
  const trackUris = tracks.map((track) => track.uri);

  const index = trackUris.indexOf(trackUri);

  return index;
};

/**
 * @param rangeStart The position of the first track to be reordered.
 * @param insertBefore The position where the tracks should be inserted.
 */
export const updatePlaylistTrackIndexAsync = async (
  playlistId: string,
  accessToken: string,
  uris: string[],
  rangeStart: number,
  insertBefore: number
) => {
  try {
    const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
    spotifyApi.setAccessToken(accessToken);

    await spotifyApi.reorderTracksInPlaylist(
      playlistId,
      rangeStart,
      insertBefore,
      {
        range_length: uris.length,
      }
    );
  } catch (e) {
    console.error(e);
  }
};

export const reorderPlaylist = async (
  accessToken: string,
  playlistId: string,
  votes: SortedVote[]
) => {
  const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
  spotifyApi.setAccessToken(accessToken);

  const tracks = await getPlaylistTracksAsync(accessToken, playlistId);
  const currentlyPlaying = await getMyCurrentPlaybackStateAsync(accessToken);
  const currentIndex = await poorMansCurrentIndexAsync(
    accessToken,
    playlistId,
    currentlyPlaying
  );

  const lowToHighTotalSortedVotes = votes.sort((a, b) => a.total - b.total);
  lowToHighTotalSortedVotes.forEach((vote) => {
    const voteIndex = trackIndex(tracks, vote.trackUri);
    // If our voteIndex is higher than the current index it is a track in the queue
    // and we move it to the top of the queue
    // Sorting should go a bit like this:
    // With track queue of length 10: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    // Our voteIndex is 6
    // Our currentIndex is 2
    // Our new queue should be: 0, 1, 2, 6, 3, 4, 5, 7, 8, 9
    //                                   ~
    //             voteIndex<6> has moved to after currentIndex<2>
    if (voteIndex > currentIndex) {
      updatePlaylistTrackIndexAsync(
        playlistId,
        accessToken,
        [vote.trackUri],
        voteIndex,
        currentIndex
      );
    }
  });

  try {
  } catch (e) {
    console.error(e);
  }
};
