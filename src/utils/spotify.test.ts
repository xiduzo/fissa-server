import { SortedVoteData } from "../lib/interfaces/Vote";

const sorting = jest.fn();

const tracks: SpotifyApi.TrackObjectFull[] = Array.from({ length: 10 }).map(
  (_, index) =>
    ({
      uri: `${index}`,
    } as SpotifyApi.TrackObjectFull)
);

const trackUris = tracks.map((track) => track.uri);

const sortPositiveVotes = async (votes: SortedVoteData[]) => {
  const positionChanges = new Map(tracks.map((_, index) => [index, 0]));
  let sortedItems = 0;

  const playlistIndex = trackUris.indexOf(tracks[2]?.uri);
  for (let i = 0; i < votes.length; i++) {
    const trackIndex = trackUris.indexOf(votes[i]?.trackUri);
    const actualTrackIndex = trackIndex + positionChanges.get(trackIndex);
    const actualPlaylistIndex =
      playlistIndex + positionChanges.get(playlistIndex);

    const insertBefore = actualPlaylistIndex + sortedItems + 1;

    if (insertBefore === actualTrackIndex) continue;
    console.log({
      vote: votes[i],
      trackIndex,
      actualTrackIndex,
      playlistIndex,
      actualPlaylistIndex,
      insertBefore,
      positionChanges,
    });

    if (insertBefore > actualPlaylistIndex) {
      const start = playlistIndex + 1;
      const diff = Math.abs(actualTrackIndex - actualPlaylistIndex) - 1;
      for (let j = 0; j < tracks.length; j++) {
        const otherActualIndex = j + positionChanges.get(j);
        console.log({ j, otherActualIndex, start });
        if (otherActualIndex >= start && otherActualIndex < insertBefore) {
          positionChanges.set(j, positionChanges.get(j) + 1);
        }
      }
      // loop over all tracks
      // if actual track index is between start and insertBefore
      // increase position change by 1
      console.log({ trackIndex, diff });
      positionChanges.set(trackIndex, positionChanges.get(trackIndex) - diff);
    }

    sortedItems += 1;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 5 * 200)
    );
  }

  return positionChanges;
};

describe("reorder playlist", () => {
  it.skip("sorts the votes", async () => {
    const votes: SortedVoteData[] = [
      {
        trackUri: "5",
        total: 2,
      },
      {
        trackUri: "4",
        total: 1,
      },
    ];

    const result = await sortPositiveVotes(votes);

    expect(result).toStrictEqual(
      new Map([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 2],
        [4, 0],
        [5, -2],
        [6, 0],
        [7, 0],
        [8, 0],
        [9, 0],
      ])
    );
  });

  it("sorts complex votes", async () => {
    const votes: SortedVoteData[] = [
      {
        trackUri: "8",
        total: 4,
      },
      {
        trackUri: "6",
        total: 3,
      },
      {
        trackUri: "4",
        total: 2,
      },
      {
        trackUri: "7",
        total: 1,
      },
    ];

    const result = await sortPositiveVotes(votes);

    expect(result).toStrictEqual(
      new Map([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 4],
        [4, 1],
        [5, 3],
        [6, -2],
        [7, -1],
        [8, -5],
        [9, 0],
      ])
    );
  });
});
