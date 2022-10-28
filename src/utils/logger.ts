import winston from "winston";
import SentryTransport from "winston-sentry-log";

import "winston-mongodb";

const { combine, timestamp, printf, json, prettyPrint } = winston.format;
const { MongoDB, Console } = winston.transports;

// Define log format
const logFormat = printf(
  ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`
);

// /*
//  * Log Level
//  * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
//  */
const logger = winston.createLogger({
  format: combine(timestamp(), prettyPrint()),
  level: "debug",
});

logger.add(
  new Console({
    format: combine(
      timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      logFormat
    ),
  })
);
const DAY = 1000 * 60 * 60 * 24;

logger.add(
  new SentryTransport({
    config: {
      dsn: process.env.SENTRY_DNS,
    },
    level: "error",
  })
);

logger.add(
  new MongoDB({
    db: process.env.MONGODB_URI,
    dbName: "fissa",
    level: "info",
    leaveConnectionOpen: true,
    expireAfterSeconds: DAY * 14,
  })
);

// DO NOT USE LOGGER INSIDE OF THIS METHOD
// AS IT WILL CAUSE AN INFINITE LOOP
const getPendingCallbacks = () =>
  logger.transports.reduce(
    // @ts-ignore-next-line
    (acc, transport) => acc + transport._writableState.pendingcb,
    0
  );

// DO NOT USE LOGGER INSIDE OF THIS METHOD
// AS IT WILL CAUSE AN INFINITE LOOP
const waitForLogs = async (time: number): Promise<void> => {
  const count = getPendingCallbacks();
  if (count > 0) {
    console.log(`waiting for ${count} logs to be processed`);
    await new Promise((resolve) => setTimeout(resolve, time));
  }
};

// DO NOT USE LOGGER INSIDE OF THIS METHOD
// AS IT WILL CAUSE AN INFINITE LOOP
const waitForLogSinks = async (): Promise<void> => {
  try {
    await waitForLogs(100);
    await waitForLogs(500);
    await waitForLogs(1000);
    await waitForLogs(5000);
    console.log("done processing logs");
    return Promise.resolve();
  } catch (error) {
    console.error(`${waitForLogSinks.name}: ${JSON.stringify(error)}`);
    return Promise.resolve();
  }
};

export { logger, waitForLogSinks };
