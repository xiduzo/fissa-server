import { logger } from "../utils/logger";
import "dotenv/config";
import { createServer } from "http";
import cache from "node-cache";
import { syncCurrentlyPlaying } from "./processes/sync-currently-playing";
import { syncRooms } from "./processes/sync-rooms";
import { syncPlaylistOrder } from "./processes/sync-votes";

const appCache = new cache();
appCache.set("rooms", []);

const httpServer = createServer();

const port = process.env.PORT ?? process.env.NODE_PORT ?? 8000;

httpServer.listen(port, async () => {
  logger.info(`Server running on port ${port}`);

  // TODO spawn as child processes
  syncRooms(appCache);
  syncCurrentlyPlaying(appCache);
  syncPlaylistOrder(appCache);
});
