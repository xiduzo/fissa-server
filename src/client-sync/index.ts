import { logger } from "../utils/logger";
import "dotenv/config";
import { createServer } from "http";
import cache from "node-cache";
import { syncCurrentlyPlaying } from "./processes/sync-currently-playing";
import { clearInactiveRooms, syncActiveRooms } from "./processes/sync-rooms";
import { syncTrackOrder } from "./processes/sync-track-order";
import { cleanupDbClient, initDb } from "../utils/database";
import { updateAccessTokens } from "./processes/update-access-tokens";

const appCache = new cache();
appCache.set("rooms", []);

const httpServer = createServer();

const port = process.env.PORT ?? process.env.NODE_PORT ?? 8000;
httpServer.listen(port, async () => {
  logger.info(`Server running on port ${port}`);

  await initDb();

  logger.info("Starting sync processes");
  // TODO spawn as child processes
  syncActiveRooms(appCache);
  syncCurrentlyPlaying(appCache);
  syncTrackOrder(appCache);
  clearInactiveRooms();
  updateAccessTokens(appCache);
});

const cleanup = async (event) => {
  // SIGINT is sent for example when you Ctrl+C a running process from the command line.
  await cleanupDbClient(); // Close MongodDB Connection when Process ends
  process.exit(); // Exit with default success-code '0'.
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
