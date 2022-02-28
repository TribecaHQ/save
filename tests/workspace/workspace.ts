import * as anchor from "@project-serum/anchor";
import { makeSaberProvider } from "@saberhq/anchor-contrib";
import { chaiSolana } from "@saberhq/chai-solana";
import chai from "chai";

import type { SAVEPrograms } from "../../src";
import { SAVEWrapper } from "../../src";

chai.use(chaiSolana);

export type Workspace = SAVEPrograms;

export const makeSDK = (): SAVEWrapper => {
  const anchorProvider = anchor.Provider.env();
  anchor.setProvider(anchorProvider);
  const provider = makeSaberProvider(anchorProvider);
  return new SAVEWrapper(provider);
};
