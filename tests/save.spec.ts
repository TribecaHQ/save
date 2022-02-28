import { GokiSDK } from "@gokiprotocol/client";
import { assertTXSuccess } from "@saberhq/chai-solana";
import type { Token } from "@saberhq/token-utils";
import { TokenAmount, TokenAugmentedProvider, u64 } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createLocker, TribecaSDK } from "@tribecahq/tribeca-sdk";
import BN from "bn.js";
import { expect } from "chai";
import invariant from "tiny-invariant";

import type { SAVEData } from "../src";
import { DEFAULT_MIN_LOCK_DURATION } from "../src/constants";
import { SAVEWrapper } from "../src/wrappers/save/save";
import { makeSDK } from "./workspace/workspace";

describe("SAVE", () => {
  const { provider } = makeSDK();

  const adminKP = Keypair.generate();
  const adminSDK = new SAVEWrapper(provider.withSigner(adminKP));

  const recipientKP = Keypair.generate();
  const recipientSDK = new SAVEWrapper(provider.withSigner(recipientKP));

  before(async () => {
    await (
      await adminSDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
    ).wait();
    await (
      await recipientSDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
    ).wait();
  });

  let locker: PublicKey;
  let govToken: Token;

  before("set up governance", async () => {
    const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
    govToken = await tokenProvider.createToken();

    const tribecaSDK = TribecaSDK.load({ provider: adminSDK.provider });
    const { createTXs, lockerWrapper } = await createLocker({
      sdk: tribecaSDK,
      gokiSDK: GokiSDK.load({ provider: tribecaSDK.provider }),
      govTokenMint: govToken.mintAccount,
    });
    for (const { tx, title } of createTXs) {
      await assertTXSuccess(tx, title);
    }
    locker = lockerWrapper.locker;
  });

  it("should allow creating a SAVE", async () => {
    const saveMintKP = Keypair.generate();
    const {
      tx: createSaveTX,
      save,
      saveToken,
    } = await adminSDK.createSAVE({
      underlyingToken: govToken,
      locker,
      mintKP: saveMintKP,
    });
    await assertTXSuccess(createSaveTX);

    const saveData = await adminSDK.fetchSAVE(save);
    invariant(saveData);

    expect(saveData.locker).to.eqAddress(locker);
    expect(saveData.minLockDuration).to.bignumber.eq(
      new BN(DEFAULT_MIN_LOCK_DURATION)
    );
    expect(saveData.mint).to.eqAddress(saveMintKP.publicKey);
    expect(saveData.mint).to.eqAddress(saveToken.mintAccount);
  });

  describe("mint and lock tokens", () => {
    let save: PublicKey;
    let saveToken: Token;
    let yiToken: Token;
    let saveData: SAVEData;

    beforeEach("create the SAVE", async () => {
      const saveMintKP = Keypair.generate();
      const { tx: createSaveTX, ...createResult } = await adminSDK.createSAVE({
        underlyingToken: govToken,
        locker,
        mintKP: saveMintKP,
      });
      await assertTXSuccess(createSaveTX);

      save = createResult.save;
      yiToken = createResult.yiToken;
      saveToken = createResult.saveToken;
      const result = await adminSDK.fetchSAVE(save);
      invariant(result);
      saveData = result;
    });

    it("mint and lock from Yi, new escrow", async () => {
      const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: recipientSDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        await recipientSDK.yi.stake({
          yiTokenMint: yiToken.mintAccount,
          amount: new u64(1_000_000),
        })
      );
      await assertTXSuccess(
        await recipientSDK.mintFromYi({
          amount: new u64(1_000_000),
          saveData,
        })
      );

      await assertTXSuccess(
        await recipientSDK.lock({
          amount: new TokenAmount(saveToken, 1_000_000),
          duration: DEFAULT_MIN_LOCK_DURATION + 1_000,
        })
      );
    });

    it("mint and lock from Yi, existing escrow", async () => {
      const rec2KP = Keypair.generate();
      const rec2SDK = new SAVEWrapper(provider.withSigner(rec2KP));
      await (
        await rec2SDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
      ).wait();

      const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: rec2SDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        await rec2SDK.yi.stake({
          yiTokenMint: yiToken.mintAccount,
          amount: new u64(1_000_000),
        })
      );
      await assertTXSuccess(
        await rec2SDK.mintFromYi({
          amount: new u64(1_000_000),
          saveData,
        })
      );

      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: rec2SDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        (
          await rec2SDK.createEscrow({
            locker,
            underlyingMint: govToken.mintAccount,
          })
        ).tx
      );

      await assertTXSuccess(
        await rec2SDK.lock({
          amount: new TokenAmount(saveToken, 1_000_000),
          duration: DEFAULT_MIN_LOCK_DURATION + 1_000,
        })
      );
    });

    it("mint and lock from underlying, new escrow", async () => {
      const rec3KP = Keypair.generate();
      const rec3SDK = new SAVEWrapper(provider.withSigner(rec3KP));
      await (
        await rec3SDK.provider.requestAirdrop(LAMPORTS_PER_SOL * 10)
      ).wait();

      const tokenProvider = new TokenAugmentedProvider(adminSDK.provider);
      await assertTXSuccess(
        await tokenProvider.mintTo({
          amount: new TokenAmount(govToken, 1_000_000),
          to: rec3SDK.provider.walletKey,
        })
      );
      await assertTXSuccess(
        await rec3SDK.mintFromUnderlying({
          amount: new u64(1_000_000),
          saveData,
        })
      );

      await assertTXSuccess(
        await rec3SDK.lock({
          amount: new TokenAmount(saveToken, 1_000_000),
          duration: DEFAULT_MIN_LOCK_DURATION + 1_000,
        })
      );
    });
  });
});
