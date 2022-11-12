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
      .sort({ index: 1 })
      .toArray();

    return roomTracks;
  };

  updateTrack = async (pin: string, trackId: string, track: Partial<Track>) => {
    await this.waitForCollection();

    await this.collection.updateOne(
      { pin: pin.toUpperCase(), id: trackId },
      { $set: track }
    );
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
