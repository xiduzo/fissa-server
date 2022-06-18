import mqtt from 'mqtt';
import {MQTT_CREDENTIALS} from '../lib/constants/credentials';

export const publish = async (
  topic: string,
  message: string | Buffer,
  callback?: mqtt.CloseCallback,
) => {
  const mqttClient = mqtt.connect(
    'mqtt://mqtt.mdd-tardis.net',
    MQTT_CREDENTIALS,
  );

  mqttClient.on('connect', () =>
    mqttClient.publish(topic, message, err => {
      callback(err);
    }),
  );
};
