import { buildCoderMap } from "@saberhq/anchor-contrib";
import { PublicKey } from "@solana/web3.js";

import type { SAVEProgram, SAVETypes } from "./programs";
import { SaveTokenIDL } from "./programs";

/**
 * SAVE program types.
 */
export interface SAVEPrograms {
  SAVE: SAVEProgram;
}

/**
 * SAVE addresses.
 */
export const SAVE_ADDRESSES = {
  SAVE: new PublicKey("SAVEd9pHcncknnMWdP8RSbhDUhw3nrzwmZ6F6RAUiio"),
};

/**
 * Program IDLs.
 */
export const SAVE_IDLS = {
  SAVE: SaveTokenIDL,
};

/**
 * Coders.
 */
export const SAVE_CODERS = buildCoderMap<{
  SAVE: SAVETypes;
}>(SAVE_IDLS, SAVE_ADDRESSES);

/**
 * Default minimum lock duration (1 year).
 */
export const DEFAULT_MIN_LOCK_DURATION = 365 * 24 * 60 * 60;
