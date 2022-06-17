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

  do {
    const _pin = generatePin();

    if (noNoWords.includes(_pin)) return;

    const isBlocked = blockedPins.includes(_pin);

    if (isBlocked) return;

    pin = _pin;
  } while (pin === undefined);

  return pin;
};
