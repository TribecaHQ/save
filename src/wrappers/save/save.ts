import { YI_ADDRESSES, YiSDK } from "@crateprotocol/yi";
import { newProgram } from "@saberhq/anchor-contrib";
import type { AugmentedProvider, Provider } from "@saberhq/solana-contrib";
import {
  SolanaAugmentedProvider,
  TransactionEnvelope,
} from "@saberhq/solana-contrib";
import type { TokenAmount } from "@saberhq/token-utils";
import {
  createInitMintInstructions,
  getATAAddress,
  getOrCreateATA,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@saberhq/token-utils";
import type { PublicKey, Signer } from "@solana/web3.js";
import { Keypair, SystemProgram } from "@solana/web3.js";
import type { EscrowData } from "@tribecahq/tribeca-sdk";
import {
  findEscrowAddress,
  TRIBECA_ADDRESSES,
  TRIBECA_CODERS,
  TribecaSDK,
} from "@tribecahq/tribeca-sdk";

import type { SAVEData, SAVEProgram } from "../..";
import {
  DEFAULT_MIN_LOCK_DURATION,
  SAVE_ADDRESSES,
  SAVE_CODERS,
  SaveTokenIDL,
} from "../..";
import { findSaveAddress } from "./pda";

/**
 * Handles interacting with the SAVE program.
 */
export class SAVEWrapper {
  readonly provider: AugmentedProvider;
  readonly yi: YiSDK;
  readonly program: SAVEProgram;

  /**
   * Constructor for a {@link SAVEWrapper}.
   * @param sdk
   */
  constructor(simpleProvider: Provider) {
    this.provider = new SolanaAugmentedProvider(simpleProvider);
    this.program = newProgram(SaveTokenIDL, SAVE_ADDRESSES.SAVE, this.provider);
    this.yi = YiSDK.load({ provider: this.provider });
  }

  /**
   * Creates a new instance of the SDK with the given signer.
   */
  withSigner(signer: Signer): SAVEWrapper {
    return new SAVEWrapper(this.provider.withSigner(signer));
  }

  /**
   * Fetches a SAVE.
   * @param key
   * @returns
   */
  async fetchSAVE(key: PublicKey): Promise<SAVEData | null> {
    return await this.program.account.save.fetchNullable(key);
  }

  /**
   * Creates a SAVE.
   * @returns
   */
  async createSAVE({
    underlyingToken,
    locker,
    minLockDuration = DEFAULT_MIN_LOCK_DURATION,
    mintKP = Keypair.generate(),
    payer = this.provider.wallet.publicKey,
    yiMintKP = Keypair.generate(),
  }: {
    underlyingToken: Token;
    locker: PublicKey;
    minLockDuration?: number;
    mintKP?: Signer;
    /**
     * Payer of the initial tokens.
     */
    payer?: PublicKey;
    yiMintKP?: Signer;
  }): Promise<{
    save: PublicKey;
    saveToken: Token;
    yiToken: Token;
    tx: TransactionEnvelope;
  }> {
    const {
      tx: createYiTX,
      yiToken,
      mint: yiMint,
    } = await this.yi.createYiToken({
      underlyingToken,
      mintKP: yiMintKP,
      payer,
    });
    const [save] = await findSaveAddress(mintKP.publicKey);
    const initMintTX = await createInitMintInstructions({
      provider: this.provider,
      mintKP,
      decimals: underlyingToken.decimals,
      mintAuthority: save,
      freezeAuthority: save,
    });
    const yiTokensATA = await getOrCreateATA({
      provider: this.provider,
      mint: yiMint,
      owner: save,
    });
    const saveTX = this.provider.newTX([
      yiTokensATA.instruction,
      this.program.instruction.createSave(new u64(minLockDuration), {
        accounts: {
          saveMint: mintKP.publicKey,
          save,
          yi: yiToken,
          yiMint,
          yiTokens: yiTokensATA.address,
          locker,
          payer,
          systemProgram: SystemProgram.programId,
        },
      }),
    ]);
    return {
      save,
      saveToken: Token.fromMint(mintKP.publicKey, underlyingToken.decimals, {
        ...underlyingToken.info,
        name: `SAVE of ${underlyingToken.info.name}`,
      }),
      yiToken: Token.fromMint(yiMintKP.publicKey, underlyingToken.decimals, {
        ...underlyingToken.info,
        name: `Yi of SAVE of ${underlyingToken.info.name}`,
      }),
      tx: TransactionEnvelope.combineAll(createYiTX, initMintTX, saveTX),
    };
  }

  async createEscrow({
    locker,
    underlyingMint,
    userAuthority = this.provider.wallet.publicKey,
    payer = this.provider.wallet.publicKey,
  }: {
    locker: PublicKey;
    underlyingMint: PublicKey;
    /**
     * User.
     */
    userAuthority?: PublicKey;
    payer?: PublicKey;
  }) {
    const tribecaSDK = TribecaSDK.load({
      provider: this.provider,
    });
    const [escrow, bump] = await findEscrowAddress(locker, userAuthority);
    const { instruction: createATA, address: escrowTokensAddress } =
      await getOrCreateATA({
        provider: this.provider,
        mint: underlyingMint,
        owner: escrow,
        payer,
      });
    const newEscrowIX = tribecaSDK.programs.LockedVoter.instruction.newEscrow(
      bump,
      {
        accounts: {
          locker,
          escrow,
          escrowOwner: userAuthority,
          payer,
          systemProgram: SystemProgram.programId,
        },
      }
    );
    return {
      escrowTokensAddress,
      tx: this.provider.newTX([createATA, newEscrowIX]),
    };
  }

  /**
   * Locks SAVE tokens to convert into veTokens.
   * @returns
   */
  async lock({
    amount,
    duration,
    userAuthority = this.provider.wallet.publicKey,
    payer,
  }: {
    /**
     * Amount of SAVE tokens to redeem.
     */
    amount: TokenAmount;
    duration: number;
    /**
     * User.
     */
    userAuthority?: PublicKey;
    payer?: PublicKey;
  }) {
    const [save] = await findSaveAddress(amount.token.mintAccount);
    const saveData = await this.program.account.save.fetch(save);
    const lockerRaw = await this.provider.getAccountInfo(saveData.locker);
    if (!lockerRaw) {
      throw new Error(`locker not found at key ${saveData.locker.toString()}`);
    }
    const lockerData = TRIBECA_CODERS.LockedVoter.accountParsers.locker(
      lockerRaw.accountInfo.data
    );
    const [escrow] = await findEscrowAddress(saveData.locker, userAuthority);
    const escrowRaw = await this.provider.getAccountInfo(escrow);
    if (!escrowRaw) {
      const { tx: createEscrowTX, escrowTokensAddress } =
        await this.createEscrow({
          locker: saveData.locker,
          underlyingMint: saveData.underlyingMint,
          userAuthority,
          payer,
        });
      const lockTX = await this.lockWithData({
        amount,
        duration,
        saveData,
        escrowData: { tokens: escrowTokensAddress },
        userAuthority,
      });
      return createEscrowTX.combine(lockTX);
    } else {
      const escrowData = TRIBECA_CODERS.LockedVoter.accountParsers.escrow(
        escrowRaw.accountInfo.data
      );
      return await this.lockWithData({
        amount,
        duration,
        saveData,
        escrowData,
        userAuthority,
        whitelistEnabled: lockerData.params.whitelistEnabled,
      });
    }
  }

  /**
   * Mints SAVE tokens from underlying tokens.
   * @returns
   */
  async mintFromUnderlying({
    amount,
    yiUnderlyingTokens,
    sourceUnderlyingTokens,
    to,
    saveData: {
      yiTokens: saveYiTokens,
      yiMint,
      yi,
      underlyingMint,
      mint: saveMint,
    },
    sourceAuthority = this.provider.walletKey,
  }: {
    /**
     * Amount of underlying tokens to mint SAVE tokens from.
     */
    amount: u64;
    /**
     * Token account to send tokens to. Defaults to the `sourceAuthority`'s ATA.
     */
    to?: PublicKey;
    /**
     * Yi's underlying tokens. Defaults to the ATA of the Yi.
     */
    yiUnderlyingTokens?: PublicKey;
    /**
     * Token account holding underlying tokens. Defaults to the `sourceAuthority`'s ATA.
     */
    sourceUnderlyingTokens?: PublicKey;
    /**
     * SAVE data.
     */
    saveData: Pick<
      SAVEData,
      "yiTokens" | "locker" | "yi" | "yiMint" | "underlyingMint" | "mint"
    >;
    /**
     * User.
     */
    sourceAuthority?: PublicKey;
  }) {
    const [save] = await findSaveAddress(saveMint);
    const toATA = await getOrCreateATA({
      provider: this.provider,
      mint: saveMint,
      owner: sourceAuthority,
    });
    return this.provider.newTX([
      !to ? toATA.instruction : null,
      SAVE_CODERS.SAVE.encodeIX(
        "mintFromUnderlying",
        {
          underlyingAmount: amount,
        },
        {
          common: {
            save,
            saveMint,
            saveYiTokens,
            to: to ?? toATA.address,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          yi,
          yiMint,
          yiUnderlyingTokens:
            yiUnderlyingTokens ??
            (await getATAAddress({
              mint: underlyingMint,
              owner: yi,
            })),
          sourceUnderlyingTokens:
            sourceUnderlyingTokens ??
            (await getATAAddress({
              mint: underlyingMint,
              owner: sourceAuthority,
            })),
          sourceAuthority,
          yiProgram: YI_ADDRESSES.Yi,
        }
      ),
    ]);
  }

  /**
   * Mints SAVE tokens from Yi tokens.
   * @returns
   */
  async mintFromYi({
    amount,
    to,
    sourceYiTokens,
    saveData: { yiTokens: saveYiTokens, yiMint, mint: saveMint },
    sourceAuthority = this.provider.walletKey,
  }: {
    /**
     * Amount of Yi tokens to mint SAVE tokens from.
     */
    amount: u64;
    /**
     * Token account to send tokens to. Defaults to the `userAuthority`'s ATA.
     */
    to?: PublicKey;
    /**
     * Token account holding Yi tokens. Defaults to the `sourceAuthority`'s ATA.
     */
    sourceYiTokens?: PublicKey;
    /**
     * SAVE data.
     */
    saveData: Pick<SAVEData, "yiTokens" | "yiMint" | "mint">;
    /**
     * User.
     */
    sourceAuthority?: PublicKey;
  }) {
    const [save] = await findSaveAddress(saveMint);
    const toATA = await getOrCreateATA({
      provider: this.provider,
      mint: saveMint,
      owner: sourceAuthority,
    });
    return this.provider.newTX([
      !to ? toATA.instruction : null,
      SAVE_CODERS.SAVE.encodeIX(
        "mintFromYi",
        {
          yiAmount: amount,
        },
        {
          common: {
            save,
            saveMint,
            saveYiTokens,
            to: to ?? toATA.address,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          sourceYiTokens:
            sourceYiTokens ??
            (await getATAAddress({
              mint: yiMint,
              owner: sourceAuthority,
            })),
          sourceAuthority,
        }
      ),
    ]);
  }

  /**
   * Locks tokens with the given SAVE data.
   * @returns
   */
  async lockWithData({
    amount,
    duration,
    saveData: {
      yiTokens: saveYiTokens,
      locker,
      yi: yiToken,
      yiMint,
      underlyingMint,
    },
    whitelistEnabled = false,
    escrowData: { tokens: escrowTokens },
    userAuthority = this.provider.wallet.publicKey,
  }: {
    /**
     * Amount of SAVE tokens to redeem.
     */
    amount: TokenAmount;
    duration: number;
    saveData: Pick<
      SAVEData,
      "yiTokens" | "locker" | "yi" | "yiMint" | "underlyingMint"
    >;
    /**
     * If the whitelist is enabled on the locker, this should be set to `true`.
     */
    whitelistEnabled?: boolean;
    escrowData: Pick<EscrowData, "tokens">;
    /**
     * User.
     */
    userAuthority?: PublicKey;
  }): Promise<TransactionEnvelope> {
    const [escrow] = await findEscrowAddress(locker, userAuthority);
    const [save] = await findSaveAddress(amount.token.mintAccount);
    const userSAVEATA = await getATAAddress({
      mint: amount.token.mintAccount,
      owner: userAuthority,
    });
    const userUnderlyingATA = await getOrCreateATA({
      provider: this.provider,
      mint: underlyingMint,
      owner: userAuthority,
    });
    const lockIX = SAVE_CODERS.SAVE.encodeIX(
      "lock",
      {
        amount: amount.toU64(),
        duration: new u64(duration),
      },
      {
        save,
        saveMint: amount.token.mintAccount,
        saveYiTokens,
        userSaveTokens: userSAVEATA,
        userUnderlyingTokens: userUnderlyingATA.address,
        lock: {
          locker,
          escrow,
          escrowTokens,
        },
        yi: {
          yiToken,
          yiMint,
          yiUnderlyingTokens: await getATAAddress({
            owner: yiToken,
            mint: underlyingMint,
          }),
        },
        userAuthority,
        systemProgram: SystemProgram.programId,
        yiTokenProgram: YI_ADDRESSES.Yi,
        lockedVoterProgram: TRIBECA_ADDRESSES.LockedVoter,
        tokenProgram: TOKEN_PROGRAM_ID,
      }
    );
    if (whitelistEnabled) {
      lockIX.keys.push(
        ...[
          {
            pubkey: SAVE_ADDRESSES.SAVE,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ]
      );
    }
    return this.provider.newTX([userUnderlyingATA.instruction, lockIX]);
  }
}
