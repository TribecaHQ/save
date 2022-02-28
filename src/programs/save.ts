import type { Program } from "@project-serum/anchor";
import type { AnchorTypes } from "@saberhq/anchor-contrib";

import type { SaveTokenIDLType } from "../idls/save_token";

export * from "../idls/save_token";

export type SAVETypes = AnchorTypes<
  SaveTokenIDLType,
  {
    save: SAVEData;
  }
>;

type Accounts = SAVETypes["Accounts"];

export type SAVEData = Accounts["save"];

export type SAVEProgram = Program<SaveTokenIDLType>;
