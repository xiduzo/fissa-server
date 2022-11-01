import mqtt from "mqtt";
import { MQTT_CREDENTIALS } from "../lib/constants/credentials";
import { logger } from "./logger";

const connection = mqtt.connect("mqtt://mqtt.mdd-tardis.net", MQTT_CREDENTIALS);

export const publish = async <T>(
  topic: string,
  message?: T extends Promise<T> ? never : T // Make sure T can never be a promise
): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      connection.publish(topic, JSON.stringify(message ?? ""), (error) => {
        if (error) {
          logger.warn("publishAsync", error);
          reject(error);
        }

        // Double catch if ts fails to check properly
        if (message instanceof Promise) {
          message.then(resolve).catch(reject);
        }

        resolve(message as T);
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
