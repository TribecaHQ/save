//! Instruction handler for [save_token::lock].

use crate::*;
use anchor_spl::token::{self, Burn, Mint, TokenAccount};
use locked_voter::{Escrow, Locker};
use num_traits::ToPrimitive;
use yi::YiToken;

/// Lock accounts.
#[derive(Accounts)]
pub struct LockedVoterLock<'info> {
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,

    /// [Escrow].
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,

    /// Token account held by the [Escrow].
    #[account(mut)]
    pub escrow_tokens: Box<Account<'info, TokenAccount>>,
}

/// Lock accounts.
#[derive(Accounts)]
pub struct YiUnstake<'info> {
    /// The [YiToken] to unstake tokens from.
    pub yi_token: AccountLoader<'info, YiToken>,

    /// [YiToken::mint]. [Mint] of the [YiToken].
    #[account(mut)]
    pub yi_mint: Box<Account<'info, Mint>>,

    /// [YiToken::underlying_tokens].
    #[account(mut)]
    pub yi_underlying_tokens: Box<Account<'info, TokenAccount>>,
}

/// Accounts for [save_token::lock].
#[derive(Accounts)]
pub struct Lock<'info> {
    /// [SAVE] account.
    pub save: AccountLoader<'info, Save>,

    /// [token::Mint] of the [SAVE].
    /// This account is `mut` because tokens are burned.
    #[account(mut)]
    pub save_mint: Account<'info, Mint>,

    /// [SAVE::yi_tokens]. [YiToken]s to be burned.
    #[account(mut)]
    pub save_yi_tokens: Account<'info, TokenAccount>,

    /// The [TokenAccount] holding the [Self::user_authority]'s
    /// [SAVE] tokens.
    #[account(mut)]
    pub user_save_tokens: Account<'info, TokenAccount>,

    /// The [TokenAccount] receiving the underlying tokens.
    #[account(mut)]
    pub user_underlying_tokens: Box<Account<'info, TokenAccount>>,

    pub lock: LockedVoterLock<'info>,
    pub yi: YiUnstake<'info>,

    /// User redeeming the SAVE tokens.
    pub user_authority: Signer<'info>,

    /// [System] program.
    pub system_program: Program<'info, System>,
    /// [yi] program.
    pub yi_token_program: Program<'info, yi::program::Yi>,
    /// SPL [token] program.
    pub locked_voter_program: Program<'info, locked_voter::program::LockedVoter>,
    /// SPL [token] program.
    pub token_program: Program<'info, token::Token>,
}

impl<'info> Lock<'info> {
    fn burn_save_tokens(&self, amount: u64) -> Result<()> {
        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                Burn {
                    mint: self.save_mint.to_account_info(),
                    to: self.user_save_tokens.to_account_info(),
                    authority: self.user_authority.to_account_info(),
                },
            ),
            amount,
        )
    }

    fn ve_lock(&self, amount: u64, duration: u64) -> Result<()> {
        locked_voter::cpi::lock(
            CpiContext::new(
                self.locked_voter_program.to_account_info(),
                locked_voter::cpi::accounts::Lock {
                    locker: self.lock.locker.to_account_info(),
                    escrow: self.lock.escrow.to_account_info(),
                    escrow_tokens: self.lock.escrow_tokens.to_account_info(),
                    escrow_owner: self.user_authority.to_account_info(),
                    source_tokens: self.user_underlying_tokens.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                },
            ),
            amount,
            unwrap_int!(duration.to_i64()),
        )
    }

    fn yi_unstake(&self, amount: u64) -> Result<()> {
        let save = self.save.load()?;
        let signer_seeds: &[&[&[u8]]] = save_seeds!(save);
        yi::cpi::unstake(
            CpiContext::new_with_signer(
                self.yi_token_program.to_account_info(),
                yi::cpi::accounts::Unstake {
                    yi_token: self.yi.yi_token.to_account_info(),
                    yi_mint: self.yi.yi_mint.to_account_info(),
                    source_yi_tokens: self.save_yi_tokens.to_account_info(),
                    source_authority: self.save.to_account_info(),
                    yi_underlying_tokens: self.yi.yi_underlying_tokens.to_account_info(),
                    destination_underlying_tokens: self.user_underlying_tokens.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )
    }
}

pub fn handler(ctx: Context<Lock>, amount: u64, duration: u64) -> Result<()> {
    let save = ctx.accounts.save.load()?;
    invariant!(save.min_lock_duration <= duration, DurationExceeded);
    ctx.accounts.burn_save_tokens(amount)?;

    let start_underlying = ctx.accounts.user_underlying_tokens.amount;
    ctx.accounts.yi_unstake(amount)?;
    ctx.accounts.user_underlying_tokens.reload()?;
    let end_underlying = ctx.accounts.user_underlying_tokens.amount;

    let lock_amount = unwrap_int!(end_underlying.checked_sub(start_underlying));
    ctx.accounts.ve_lock(lock_amount, duration)?;
    Ok(())
}

impl<'info> Validate<'info> for LockedVoterLock<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker, self.escrow.locker);
        assert_keys_eq!(self.escrow_tokens, self.escrow.tokens);
        Ok(())
    }
}

impl<'info> Validate<'info> for YiUnstake<'info> {
    fn validate(&self) -> Result<()> {
        let yi_token = self.yi_token.load()?;
        assert_keys_eq!(yi_token.mint, self.yi_mint);
        assert_keys_eq!(yi_token.underlying_tokens, self.yi_underlying_tokens);
        Ok(())
    }
}

impl<'info> Validate<'info> for Lock<'info> {
    fn validate(&self) -> Result<()> {
        self.lock.validate()?;
        self.yi.validate()?;

        let save = self.save.load()?;
        assert_keys_eq!(self.save_mint, save.mint);
        assert_keys_eq!(self.save_yi_tokens, save.yi_tokens);

        assert_keys_eq!(self.user_save_tokens.owner, self.user_authority);
        assert_keys_eq!(self.user_save_tokens.mint, save.mint);

        assert_keys_eq!(self.user_underlying_tokens.owner, self.user_authority);
        assert_keys_eq!(self.user_underlying_tokens.mint, save.underlying_mint);

        assert_keys_eq!(self.lock.locker, save.locker, LockerMismatch);
        assert_keys_eq!(self.lock.escrow.owner, self.user_authority);

        assert_keys_eq!(self.yi.yi_token, save.yi);
        assert_keys_eq!(self.yi.yi_mint, save.yi_mint);
        Ok(())
    }
}
