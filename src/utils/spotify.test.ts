const sorting = jest.fn();

const tracks: SpotifyApi.TrackObjectFull[] = [
  {
    uri: "0",
  } as SpotifyApi.TrackObjectFull,
  {
    uri: "1",
  } as SpotifyApi.TrackObjectFull,
  {
    uri: "2",
  } as SpotifyApi.TrackObjectFull,
  {
    uri: "3",
  } as SpotifyApi.TrackObjectFull,
  {
    uri: "4",
  } as SpotifyApi.TrackObjectFull,
  {
    uri: "5",
  } as SpotifyApi.TrackObjectFull,
  {
    uri: "6",
  } as SpotifyApi.TrackObjectFull,
];

const sortPositiveVotes = (
  sortedVotes: { total: number; uri: string }[]
): string[] => {
  let playlistIndex = 2;
  let tracksCopy = [...tracks];
  let sortedItems = 0;

  sortedVotes.forEach((vote) => {
    const trackIndex = tracksCopy.findIndex((track) => track.uri === vote.uri);
    const newTrackIndex =
      playlistIndex + sortedItems + Number(trackIndex > playlistIndex);

    if (trackIndex === newTrackIndex) {
      return;
    }

    sortedItems += 1;
    playlistIndex -= Number(trackIndex < playlistIndex);
    sorting();
    const track = tracksCopy[trackIndex];
    tracksCopy.splice(trackIndex, 1);
    tracksCopy = [
      ...tracksCopy.slice(0, newTrackIndex),
      track,
      ...tracksCopy.slice(newTrackIndex),
    ];
  });

  return tracksCopy.map((x) => x.uri);
};

const sortNegativeVotes = (
  sortedVotes: { total: number; uri: string }[]
): string[] => {
  let playlistIndex = 2;
  let tracksCopy = [...tracks];
  let sortedItems = 0;

  sortedVotes.forEach((vote) => {
    const trackIndex = tracksCopy.findIndex((track) => track.uri === vote.uri);
    const newTrackIndex = tracksCopy.length - sortedItems;
    console.log(
      `vote: ${vote.uri}, trackIndex: ${trackIndex}, newTrackIndex: ${newTrackIndex}`
    );

    if (trackIndex === newTrackIndex) {
      return;
    }

    sortedItems += 1;
    playlistIndex -= Number(trackIndex < playlistIndex);
    sorting();
    const track = tracksCopy[trackIndex];
    tracksCopy.splice(trackIndex, 1);
    tracksCopy = [
      ...tracksCopy.slice(0, newTrackIndex),
      track,
      ...tracksCopy.slice(newTrackIndex),
    ];
  });

  return tracksCopy.map((x) => x.uri);
};

describe("sorting positive votes", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should sort a single vote", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: 2,
        uri: "4",
      },
    ];

    const result = sortPositiveVotes(sortedVotes);

    expect(result).toStrictEqual(["0", "1", "2", "4", "3", "5", "6"]);
    expect(sorting).toHaveBeenCalledTimes(1);
  });

  it("should sort multiple votes", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: 2,
        uri: "4",
      },
      {
        total: 1,
        uri: "6",
      },
    ];

    const result = sortPositiveVotes(sortedVotes);

    expect(result).toStrictEqual(["0", "1", "2", "4", "6", "3", "5"]);
    expect(sorting).toHaveBeenCalledTimes(2);
  });

  it("should sort passed items", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: 2,
        uri: "0",
      },
    ];

    const result = sortPositiveVotes(sortedVotes);

    expect(result).toStrictEqual(["1", "2", "0", "3", "4", "5", "6"]);
    expect(sorting).toHaveBeenCalledTimes(1);
  });

  it("should sort complex votes", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: 6,
        uri: "0",
      },
      {
        total: 3,
        uri: "6",
      },
      {
        total: 2,
        uri: "4",
      },
    ];

    const result = sortPositiveVotes(sortedVotes);

    expect(result).toStrictEqual(["1", "2", "0", "6", "4", "3", "5"]);
    expect(sorting).toHaveBeenCalledTimes(3);
  });

  it("should not sort items which are already in the correct position", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: 6,
        uri: "2",
      },
      {
        total: 3,
        uri: "6",
      },
    ];

    const result = sortPositiveVotes(sortedVotes);

    expect(result).toStrictEqual(["0", "1", "2", "6", "3", "4", "5"]);
    expect(sorting).toHaveBeenCalledTimes(1);
  });
});

describe("sorting negative votes", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should sort a single vote", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: -2,
        uri: "4",
      },
    ];

    const result = sortNegativeVotes(sortedVotes);

    expect(result).toStrictEqual(["0", "1", "2", "3", "5", "6", "4"]);
    expect(sorting).toHaveBeenCalledTimes(1);
  });

  it("should sort multiple votes", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: -2,
        uri: "4",
      },
      {
        total: -1,
        uri: "2",
      },
    ];

    const result = sortNegativeVotes(sortedVotes);

    expect(result).toStrictEqual(["0", "1", "3", "5", "6", "4", "2"]);
    expect(sorting).toHaveBeenCalledTimes(2);
  });

  it("should sort passed items", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: -2,
        uri: "0",
      },
    ];

    const result = sortNegativeVotes(sortedVotes);

    expect(result).toStrictEqual(["1", "2", "3", "4", "5", "6", "0"]);
    expect(sorting).toHaveBeenCalledTimes(1);
  });

  it.only("should sort complex items", () => {
    const sortedVotes: { total: number; uri: string }[] = [
      {
        total: -2,
        uri: "0",
      },
      {
        total: -3,
        uri: "6",
      },
      {
        total: -4,
        uri: "4",
      },
    ];

    const result = sortNegativeVotes(sortedVotes);

    expect(result).toStrictEqual(["1", "2", "3", "5", "0", "6", "4"]);
    expect(sorting).toHaveBeenCalledTimes(1);
  });
});
