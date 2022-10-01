import { logger } from "../utils/logger";
import "dotenv/config";
import { createServer } from "http";
import cache from "node-cache";
import { syncCurrentlyPlaying } from "./processes/sync-currently-playing";
import { clearInactiveRooms, syncActiveRooms } from "./processes/sync-rooms";

const appCache = new cache();
appCache.set("rooms", []);

const httpServer = createServer();

const port = process.env.PORT ?? process.env.NODE_PORT ?? 8000;

httpServer.listen(port, async () => {
  logger.info(`Server running on port ${port}`);

  // TODO spawn as child processes
  syncActiveRooms(appCache);
  syncCurrentlyPlaying(appCache);
  clearInactiveRooms();
});
