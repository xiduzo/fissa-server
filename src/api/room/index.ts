import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { Room } from "../../lib/interfaces/Room";
import { addTracks, mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
import { createPin } from "../../utils/pin";
import {
  createPlaylist,
  getMe,
  getMyTopTracks,
  getPlaylistTracks,
  startPlaylistFromTrack,
} from "../../utils/spotify";

const handler: VercelApiHandler = async (request, response) => {
  switch (request.method) {
    case "GET":
      response.json({
        app: "room",
      });
      break;
    case "POST":
      const { accessToken, playlistId } = request.body;

      let newPin: string;
      let blockedPins: string[] = [];

      try {
        const rooms = await mongoCollection<Room>("room");
        do {
          newPin = createPin(blockedPins);
          const room = await rooms.findOne({ pin: newPin });

          if (room) {
            blockedPins.push(newPin);
            newPin = undefined;
            return;
          }
        } while (newPin === undefined);

        const me = await getMe(accessToken);
        const room: Room = {
          pin: newPin,
          createdBy: me.id,
          accessToken,
          currentIndex: -1,
        };
        const roomPromise = rooms.insertOne(room);

        const tracks = playlistId
          ? await getPlaylistTracks(accessToken, playlistId)
          : await getMyTopTracks(accessToken);

        const trackUriToStartPlaying = tracks[0].uri;
        await addTracks(
          tracks,
          newPin,
          tracks.map((track) => track.id)
        );

        await startPlaylistFromTrack(accessToken, trackUriToStartPlaying);

        await roomPromise;
        response.status(StatusCodes.OK).json(newPin);
      } catch (error) {
        logger.error(`room GET handler: ${error}`);
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json(ReasonPhrases.INTERNAL_SERVER_ERROR);
      }
      break;
  }
};

export default handler;
