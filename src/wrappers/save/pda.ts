import { utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import { SAVE_ADDRESSES } from "../..";

/**
 * Finds the address of a SAVE.
 */
export const findSaveAddress = async (
  mint: PublicKey
): Promise<[PublicKey, number]> => {
  return await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode("SAVE"), mint.toBuffer()],
    SAVE_ADDRESSES.SAVE
  );
};
