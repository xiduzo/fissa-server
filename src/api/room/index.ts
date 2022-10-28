import { VercelApiHandler } from "@vercel/node";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { DateTime } from "luxon";
import { updateRoom } from "../../client-sync/processes/sync-currently-playing";
import { Room } from "../../lib/interfaces/Room";
import {
  addTracks,
  deleteMyOtherRooms,
  mongoCollection,
} from "../../utils/database";
import { logger } from "../../utils/logger";
import { createPin } from "../../utils/pin";
import { responseAsync } from "../../utils/response";
import {
  addTackToQueue,
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
      const { accessToken, refreshToken, playlistId, createdBy } = request.body;

      if (!accessToken || !refreshToken || !createdBy) {
        await responseAsync(
          response,
          StatusCodes.BAD_REQUEST,
          ReasonPhrases.BAD_REQUEST
        );
        return;
      }

      let pin: string;
      let blockedPins: string[] = [];
      try {
        const rooms = await mongoCollection<Room>("room");
        do {
          pin = createPin(blockedPins);
          const room = await rooms.findOne({ pin });

          if (room) {
            blockedPins.push(pin);
            pin = undefined;
            return;
          }
        } while (pin === undefined);

        await deleteMyOtherRooms(createdBy);

        const room: Room = {
          pin,
          createdBy,
          accessToken,
          refreshToken,
          currentIndex: -1,
          lastPlayedIndex: -1,
          createdAt: DateTime.now().toISO(),
        };
        await rooms.insertOne(room);

        const tracks = playlistId
          ? await getPlaylistTracks(accessToken, playlistId)
          : await getMyTopTracks(accessToken);

        await addTracks(
          accessToken,
          pin,
          tracks.map((track) => track.id)
        );

        await startPlayingTrack(accessToken, tracks[0].uri);

        const nextTrackId = await updateRoom(room);
        await addTackToQueue(accessToken, nextTrackId);

        await responseAsync(response, StatusCodes.OK, pin);
      } catch (error) {
        logger.error(`room POST handler: ${error}`);

        if (error instanceof Error) {
          if (error.message === ReasonPhrases.NOT_FOUND) {
            await responseAsync(
              response,
              StatusCodes.NOT_FOUND,
              ReasonPhrases.NOT_FOUND
            );
            return;
          }
        }

        await responseAsync(
          response,
          error.status ?? StatusCodes.INTERNAL_SERVER_ERROR,
          error.reason ?? ReasonPhrases.INTERNAL_SERVER_ERROR
        );
      }
      break;
  }
};

export default handler;
