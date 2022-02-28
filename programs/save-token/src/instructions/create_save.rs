//! Instruction handler for [save_token::create_save].

use crate::*;
use anchor_spl::token::{Mint, TokenAccount};
use locked_voter::Locker;
use yi::YiToken;

/// Accounts for [save_token::create_save].
#[derive(Accounts)]
pub struct CreateSAVE<'info> {
    /// [token::Mint] of the [SAVE].
    pub save_mint: Account<'info, Mint>,
    /// [SAVE] account.
    #[account(
        init,
        seeds = [
            b"SAVE".as_ref(),
            save_mint.key().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub save: AccountLoader<'info, Save>,
    /// Yi token backed by the underlying token to lock up. [SAVE::yi].
    pub yi: AccountLoader<'info, YiToken>,
    /// Mint of the [YiToken]. [SAVE::yi_mint].
    pub yi_mint: Account<'info, Mint>,
    /// [TokenAccount] holding Yi tokens. [SAVE::yi_tokens].
    pub yi_tokens: Account<'info, TokenAccount>,
    /// [Locker]. [SAVE::locker].
    pub locker: Account<'info, Locker>,

    /// Payer for the [SAVE] account creation.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [System] program.
    pub system_program: Program<'info, System>,
}

impl<'info> CreateSAVE<'info> {
    fn init_save(&mut self, bump: u8, min_lock_duration: u64) -> Result<()> {
        let save = &mut self.save.load_init()?;
        save.mint = self.save_mint.key();
        save.min_lock_duration = min_lock_duration;
        save.bump = bump;

        let yi = self.yi.load()?;
        save.underlying_mint = yi.underlying_token_mint;
        save.yi_mint = yi.mint;
        save.yi = self.yi.key();
        save.yi_tokens = self.yi_tokens.key();
        save.locker = self.locker.key();
        Ok(())
    }
}

pub fn handler(ctx: Context<CreateSAVE>, min_lock_duration: u64) -> Result<()> {
    ctx.accounts
        .init_save(unwrap_bump!(ctx, "save"), min_lock_duration)
}

impl<'info> Validate<'info> for CreateSAVE<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.save_mint.mint_authority.unwrap(), self.save);
        assert_keys_eq!(self.save_mint.freeze_authority.unwrap(), self.save);
        invariant!(self.save_mint.supply == 0);

        let yi = self.yi.load()?;
        invariant!(yi.stake_fee_millibps == 0);
        invariant!(yi.unstake_fee_millibps == 0);

        assert_keys_eq!(yi.mint, self.yi_mint);
        invariant!(self.yi_mint.supply == 0);
        invariant!(self.save_mint.decimals == self.yi_mint.decimals);

        assert_keys_eq!(self.yi_tokens.owner, self.save);
        assert_keys_eq!(self.yi_tokens.mint, self.yi_mint);
        assert_is_zero_token_account!(self.yi_tokens);
        Ok(())
    }
}
