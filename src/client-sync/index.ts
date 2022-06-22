import express from "express";
import actuator from "express-actuator";
import SpotifyWebApi from "spotify-web-api-node";
import { createServer } from "http";
import { StatusCodes, ReasonPhrases } from "http-status-codes";
import mqtt from "mqtt";
import {
  MQTT_CREDENTIALS,
  SPOTIFY_CREDENTIALS,
} from "../lib/constants/credentials";

const client = mqtt
  .connect("mqtt://mqtt.mdd-tardis.net", MQTT_CREDENTIALS)
  .on("connect", console.log)
  .on("error", console.error);

export const publishAsync = async (
  topic: string,
  message?: any
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      client.publish(topic, JSON.stringify(message), (error) =>
        error ? reject(error) : resolve()
      );
    } catch (error) {
      reject(error);
    }
  });
};

const app = express();
app.use(actuator());
app.use(express.json());

const httpServer = createServer(app);

type State = {
  id: string;
  progress_percentage: number;
  is_playing: boolean;
  currentIndex: number;
};

// TODO: move this to DB
const activeRooms = new Map<string, string>();
const states = new Map<string, State>();

// Tick
setInterval(async () => {
  const pins = Array.from(activeRooms.keys());
  const promises: Promise<any>[] = [];
  pins.forEach((pin) => {
    const accessToken = activeRooms.get(pin);

    if (!accessToken) {
      // Somehow we have an active room without an access token
      activeRooms.delete(pin);
      return;
    }

    const spotifyApi = new SpotifyWebApi(SPOTIFY_CREDENTIALS);
    spotifyApi.setAccessToken(accessToken);

    const getMyCurrentPlayingTrack = spotifyApi
      .getMyCurrentPlayingTrack()
      .then((response) => {
        if (!response) return;

        // TODO: check if current playlist is room playlist
        // after connected to mongo when we can get playlistId<->pin from room

        const {
          body: {
            is_playing,
            progress_ms,
            item: { id, duration_ms },
          },
        } = response;

        const previousState = states.get(pin);

        const state = {
          id,
          progress_percentage:
            previousState?.progress_percentage ??
            progress_ms / duration_ms ??
            0,
          is_playing,
          currentIndex: 0,
        };
        states.set(pin, state);

        const publish = () => {
          state.progress_percentage = progress_ms / duration_ms;
          const publishAsyncPromise = publishAsync(
            `fissa/room/${pin}/tracks/active`,
            state
          ).catch((error) => {
            console.warn("warn", error.message);
          });

          promises.push(publishAsyncPromise);
        };

        if (!previousState) {
          return publish();
        }

        if (state.id !== previousState.id) {
          // TODO: determine new index
          return publish();
        }
        if (state.is_playing !== previousState.is_playing) {
          return publish();
        }

        const diff = Math.abs(
          progress_ms / duration_ms - previousState.progress_percentage
        );

        if (diff > 0.05) {
          return publish();
        }
      })
      .catch((error) => {
        console.warn("warn", error.message);
      });

    promises.push(getMyCurrentPlayingTrack);
  });

  await Promise.all(promises).catch((error) => {
    console.error(error.message);
  });
  // Try and not overload the spotify requests limit
}, 3_000);

app.post("/api/token", (request, response) => {
  const { pin, accessToken, oldAccessToken } = request.body;

  console.log("received token", { pin, accessToken, oldAccessToken });

  if (!accessToken) {
    response.status(StatusCodes.BAD_REQUEST).json(ReasonPhrases.BAD_REQUEST);
    return;
  }

  if (pin) {
    console.log("Received pin with token", pin, accessToken);
    activeRooms.set(pin, accessToken);
    response.status(StatusCodes.OK).json(ReasonPhrases.OK);
    return;
  }

  if (oldAccessToken) {
    const tokens = Array.from(activeRooms.values());
    const pins = Array.from(activeRooms.keys());

    const index = tokens.findIndex((token) => token === oldAccessToken);

    if (index === -1) {
      response
        .status(StatusCodes.UNPROCESSABLE_ENTITY)
        .json(ReasonPhrases.UNPROCESSABLE_ENTITY);
      return;
    }
    const _pin = pins[index];
    console.log("Updating access token for pin", _pin, accessToken);

    activeRooms.set(_pin, accessToken);
    response.status(StatusCodes.OK).json(ReasonPhrases.OK);
    return;
  }

  response
    .status(StatusCodes.UNPROCESSABLE_ENTITY)
    .json(ReasonPhrases.UNPROCESSABLE_ENTITY);
});

const port = process.env.PORT ?? process.env.NODE_PORT ?? 8000;

httpServer.listen(port, async () => {
  console.log("Server running", httpServer.address());
});
