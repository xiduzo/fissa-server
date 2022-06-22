import { StatusCodes } from "http-status-codes";
import cache from "node-cache";
import { publishAsync } from "../../utils/mqtt";
import {
  getMyCurrentPlaybackStateAsync,
  poorMansCurrentIndexAsync,
} from "../../utils/spotify";

type State = {
  id: string;
  progress_ms: number;
  is_playing: boolean;
  currentIndex: number;
};

type PinWithToken = {
  pin: string;
  accessToken: string;
  playlistId: string;
};

// TODO: move this to cache
const states = new Map<string, State>();

export const syncCurrentlyPlaying = (appCache: cache) => {
  setInterval(async () => {
    const pins = appCache.get<PinWithToken[]>("pins");
    pins?.forEach(async (item) => {
      const { pin, accessToken, playlistId } = item;
      try {
        if (!accessToken) {
          // Somehow we have an active room without an access token
          return;
        }

        const myCurrentPlayingTrack = await getMyCurrentPlaybackStateAsync(
          accessToken
        );

        if (!myCurrentPlayingTrack) return;

        // TODO: check if current playlist is room playlist?

        const {
          is_playing,
          progress_ms,
          item: { id },
        } = myCurrentPlayingTrack;

        const previousState = states.get(pin);

        const state = {
          id,
          progress_ms: previousState?.progress_ms ?? progress_ms,
          is_playing,
          currentIndex: 0,
        };
        states.set(pin, state);

        const publish = async (pin: string) => {
          state.progress_ms = progress_ms;
          const currentIndex = await poorMansCurrentIndexAsync(
            accessToken,
            playlistId,
            myCurrentPlayingTrack
          );
          // TODO: if current index = -1, we are not in the playlist anymore
          // Start the playlist from the start?
          // Creator of the playlist should stop party from room?
          // TODO: update current index in DB?
          state.currentIndex = currentIndex;
          await publishAsync(`fissa/room/${pin}/tracks/active`, state);
        };

        if (!previousState) {
          return await publish(pin);
        }

        if (state.id !== previousState.id) {
          return await publish(pin);
        }
        if (state.is_playing !== previousState.is_playing) {
          return await publish(pin);
        }

        const diff = Math.abs(progress_ms - previousState.progress_ms);

        if (diff > 30_000) {
          return publish(pin);
        }
      } catch (error) {
        const { statusCode, message } = error;
        switch (statusCode) {
          case StatusCodes.UNAUTHORIZED:
            console.warn(message);
            break;
          default:
            console.warn(message);
            break;
        }
      }
    });

    // Try and not overload the spotify requests limit
  }, 2_000);
};
