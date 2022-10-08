import mqtt from "mqtt";
import { MQTT_CREDENTIALS } from "../lib/constants/credentials";
import { logger } from "./logger";

const connection = mqtt.connect("mqtt://mqtt.mdd-tardis.net", MQTT_CREDENTIALS);

export const publish = async <T>(
  topic: string,
  message?: T extends Promise<unknown> ? never : T // Make sure T can never be a promise
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      connection.publish(topic, JSON.stringify(message ?? ""), (error) => {
        if (error) {
          logger.warn("publishAsync", error);
          reject(error);
        }

        resolve(message);
      });
    } catch (error) {
      logger.error(
        `${publish.name}(${topic}): ${JSON.stringify(
          message
        )} -> ${JSON.stringify(error)}`
      );
      reject(error);
    }
  });
};
