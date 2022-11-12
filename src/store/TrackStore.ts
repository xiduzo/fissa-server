import { Store } from "./_Store";
import { Track } from "../lib/interfaces/Track";

export class TrackStore extends Store<Track> {
  constructor() {
    super("track");
  }

  /**
   * @returns sorted room tracks based on their index
   */
  getTracks = async (pin: string) => {
    await this.waitForCollection();

    const roomTracks = await this.collection
      .find({ pin: pin.toUpperCase() })
      .toArray();
    const orderedTracks = roomTracks.sort((a, b) => a.index - b.index); // TODO: check .sort method of mongodb
    return orderedTracks;
  };

  addTracks = async (pin: string, tracks: SpotifyApi.TrackObjectFull[]) => {
    await this.waitForCollection();

    const currentTracks = await this.collection
      .find({ pin: pin.toUpperCase() })
      .toArray();

    const inserts = tracks.map(async (track, index) => {
      return this.collection.insertOne({
        pin: pin.toUpperCase(),
        index: currentTracks.length + index,
        artists: track.artists.map((artist) => artist.name).join(", "),
        name: track.name,
        id: track.id,
        image: track.album.images[0]?.url,
        duration_ms: track.duration_ms,
      });
    });

    await Promise.all(inserts);
  };
}
