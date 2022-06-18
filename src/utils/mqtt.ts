import mqtt from 'mqtt';
import {MQTT_CREDENTIALS} from '../lib/constants/credentials';

export const publish = (
  topic: string,
  message: string | Buffer,
  callback?: mqtt.PacketCallback,
) => {
  const mqttClient = mqtt.connect('mqtt.mdd-tardis.net', MQTT_CREDENTIALS);

  mqttClient.on('connect', () => mqttClient.publish(topic, message, callback));
};
