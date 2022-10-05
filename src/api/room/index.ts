import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";
import { Room } from "../../lib/interfaces/Room";
import { addTracks, mongoCollection } from "../../utils/database";
import { logger } from "../../utils/logger";
import { createPin } from "../../utils/pin";
import {
  addTackToQueue,
  getMe,
  getMyTopTracks,
  getPlaylistTracks,
  startPlayingTrack,
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
          createdAt: DateTime.now().toISO(),
        };
        await rooms.insertOne(room);

        const tracks = playlistId
          ? await getPlaylistTracks(accessToken, playlistId)
          : await getMyTopTracks(accessToken);

        logger.info(`${newPin}: adding ${tracks.length} tracks to room`);
        await addTracks(
          accessToken,
          newPin,
          tracks.map((track) => track.id)
        );

        await startPlayingTrack(accessToken, tracks[0].uri);

        const nextTrackId = await updateRoom(room);
        if (nextTrackId) {
          await addTackToQueue(accessToken, nextTrackId);
        }

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
