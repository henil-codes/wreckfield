/** Fixed list: no free text, ever. Index is what gets stored and sent. */
export const EPITAPHS = [
  'skill issue',
  'worth it',
  'the beacon removed',
  'for science',
  'tell my mom',
  'I regret nothing',
  'gravity is a lie',
  'calculated',
  'it was lag',
  'hold my fuel',
  'trust the process',
  'stay a while',
  'you are welcome',
  'one more try',
  'aimed there on purpose',
  'here lies my pride',
  'use me',
  'blame the moon',
  'next time',
  'no regrets, some debris',
] as const;

export type Epitaph = (typeof EPITAPHS)[number];
export function epitaphAt(index: number): Epitaph {
  return EPITAPHS[index] ?? EPITAPHS[0];
}
