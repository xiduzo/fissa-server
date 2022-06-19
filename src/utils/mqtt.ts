import mqtt from 'mqtt';
import {MQTT_CREDENTIALS} from '../lib/constants/credentials';

export const publishAsync = async (
  topic: string,
  message: string | Buffer,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      mqtt
        .connect('mqtt://mqtt.mdd-tardis.net', MQTT_CREDENTIALS)
        .publish(topic, JSON.stringify(message), error =>
          error ? reject(error) : resolve(),
        );
    } catch (error) {
      reject(error);
    }
  });
};
