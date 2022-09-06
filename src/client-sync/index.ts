import "dotenv/config";
import { createServer } from "http";
import cache from "node-cache";
import { syncCurrentlyPlaying } from "./processes/sync-currently-playing";
import { syncRooms } from "./processes/sync-rooms";
import { syncPlaylistOrder, syncVotes } from "./processes/sync-votes";

const appCache = new cache({
  stdTTL: 60,
});

const httpServer = createServer();

// TODO spawn as child processes
syncRooms(appCache);
syncCurrentlyPlaying(appCache);
syncVotes(appCache);
syncPlaylistOrder(appCache);

const port = process.env.PORT ?? process.env.NODE_PORT ?? 8000;

httpServer.listen(port, async () => {
  console.log("Server running", httpServer.address());
});
