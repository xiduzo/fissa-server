import { Store } from "./_Store";
import { Room } from "../lib/interfaces/Room";
import { Track } from "../lib/interfaces/Track";
import { getTracks } from "../utils/spotify";

export class TrackStore extends Store<Track> {
  constructor() {
    super("track");
  }

  /**
   * @returns sorted room tracks based on their index
   */
  getTracks = async (pin: string) => {
    const roomTracks = await this.collection.find({ pin }).toArray();
    const orderedTracks = roomTracks.sort((a, b) => a.index - b.index);
    return orderedTracks;
  };

  addTracks = async (room: Room, trackIds: string[]) => {
    const { accessToken, pin } = room;
    const currentTracks = await this.collection.find({ pin }).toArray();
    const spotifyTracks = await getTracks(accessToken, trackIds);

    const roomTrackIds = currentTracks.map((track) => track.id);
    const tracksToAdd = trackIds.filter(
      (trackId) => !roomTrackIds.includes(trackId)
    );

    const inserts = tracksToAdd.map(async (trackId, index) => {
      const track = spotifyTracks.find((track) => track.id === trackId);

      if (!track) return;

      return this.collection.insertOne({
        pin,
        index: roomTrackIds.length + index,
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
