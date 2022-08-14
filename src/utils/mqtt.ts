import mqtt from "mqtt";
import { MQTT_CREDENTIALS } from "../lib/constants/credentials";
import { SortedVotes, sortVotes, Vote } from "../lib/interfaces/Vote";
import { mongoCollectionAsync } from "./database";

export const publishAsync = async (
  topic: string,
  message: any
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      mqtt
        .connect("mqtt://mqtt.mdd-tardis.net", MQTT_CREDENTIALS)
        .publish(topic, JSON.stringify(message), (error) => {
          if (error) {
            console.warn(error);
            reject(error);
            return;
          }

          return resolve(message);
        });
    } catch (error) {
      console.warn(error);
      reject(error);
      return;
    }
  });
};
