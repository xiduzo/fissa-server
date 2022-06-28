import mqtt from "mqtt";
import { MQTT_CREDENTIALS } from "../lib/constants/credentials";
import { Vote } from "../lib/interfaces/Vote";
import { mongoCollectionAsync } from "./database";

export const publishAsync = async (
  topic: string,
  message: any
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      mqtt
        .connect("mqtt://mqtt.mdd-tardis.net", MQTT_CREDENTIALS)
        .publish(topic, JSON.stringify(message), (error) =>
          error ? reject(error) : resolve()
        );
    } catch (error) {
      reject(error);
    }
  });
};

export const updateVotes = async (pin: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      const collection = await mongoCollectionAsync("votes");
      const allVotes = await collection.find<Vote>({ pin }).toArray();

      await publishAsync(`fissa/room/${pin}/votes`, allVotes);
      resolve(allVotes);
    } catch (error) {
      reject(error);
    }
  });
};
