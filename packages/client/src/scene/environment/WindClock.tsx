import { useFrame } from '@react-three/fiber';
import { windTime } from './handInstancing.js';

/** One write per frame feeds every swaying foliage material by reference — see handInstancing.ts. */
export function WindClock(): null {
  useFrame(({ clock }) => {
    windTime.value = clock.elapsedTime;
  });
  return null;
}
