import mqtt from "mqtt";
import { MQTT_CREDENTIALS } from "../lib/constants/credentials";

const connection = mqtt.connect("mqtt://mqtt.mdd-tardis.net", MQTT_CREDENTIALS);

export const publishAsync = async (
  topic: string,
  message: any
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      connection.publish(topic, JSON.stringify(message), (error) => {
        if (error) {
          console.warn("publishAsync", error);
          reject(error);
        }

        resolve(message);
      });
    } catch (error) {
      console.warn("publishAsync", error);
      reject(error);
    }
  });
};
