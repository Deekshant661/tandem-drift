/** Simulation runs at a fixed 60 Hz on the server. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

/** Server broadcasts a snapshot every N sim ticks (60/3 = 20 Hz). */
export const SNAPSHOT_EVERY_TICKS = 3;

/** Clients send input at 30 Hz. */
export const INPUT_SEND_HZ = 30;

/** Clients render this far in the past to interpolate between snapshots (ms). */
export const INTERPOLATION_DELAY_MS = 100;

/** World bounds of the arena (meters). The arena is a walled rectangle. */
export const ARENA_WIDTH = 120;
export const ARENA_HEIGHT = 80;

export const ROOM_CODE_LENGTH = 6;
