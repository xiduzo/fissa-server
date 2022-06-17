import randomize from 'randomatic';

const noNoWords = [
  'anal',
  'anus',
  'arse',
  'butt',
  'clit',
  'cock',
  'crap',
  'cunt',
  'dick',
  'dumb',
  'dyke',
  'fuck',
  'gook',
  'hell',
  'homo',
  'jerk',
  'jugs',
  'kike',
  'piss',
  'scum',
  'shag',
  'shit',
  'slag',
  'slut',
  'spic',
  'suck',
  'tits',
  'turd',
  'twat',
  'wank',
];

const generatePin = (): string => randomize('A', 4);

export const createPin = (blockedPins: string[] = []): string => {
  let pin: string;
  let generateNewPin = false;

  do {
    try {
      pin = generatePin();

      if (noNoWords.includes(pin)) {
        generateNewPin = true;
        return;
      }

      const isBlocked = blockedPins.includes(pin);

      if (isBlocked) {
        generateNewPin = true;
        return;
      }
    } catch (error) {
      generateNewPin = false;
    }
  } while (generateNewPin);

  return pin;
};
