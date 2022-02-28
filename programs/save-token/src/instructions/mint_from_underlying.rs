//! Instruction handler for [crate::save_token::mint_to].

use crate::*;
use anchor_spl::token::{Mint, TokenAccount};
use yi::YiToken;

#[derive(Accounts)]
pub struct MintFromUnderlying<'info> {
    /// Common accounts for minting.
    pub common: MintToCommon<'info>,

    /// [SAVE::yi].
    #[account(mut)]
    pub yi: AccountLoader<'info, YiToken>,
    /// [YiToken::mint].
    #[account(mut)]
    pub yi_mint: Account<'info, Mint>,
    /// [YiToken::underlying_tokens].
    #[account(mut)]
    pub yi_underlying_tokens: Box<Account<'info, TokenAccount>>,

    /// Source underlying tokens.
    #[account(mut)]
    pub source_underlying_tokens: Box<Account<'info, TokenAccount>>,
    /// Authority of the [Self::source_underlying_tokens].
    pub source_authority: Signer<'info>,

    /// [yi] program.
    pub yi_program: Program<'info, yi::program::Yi>,
}

impl<'info> MintFromUnderlying<'info> {
    fn stake_yi(&self, amount: u64) -> Result<()> {
        yi::cpi::stake(
            CpiContext::new(
                self.yi_program.to_account_info(),
                yi::cpi::accounts::Stake {
                    yi_token: self.yi.to_account_info(),
                    yi_mint: self.yi_mint.to_account_info(),
                    source_tokens: self.source_underlying_tokens.to_account_info(),
                    source_authority: self.source_authority.to_account_info(),
                    yi_underlying_tokens: self.yi_underlying_tokens.to_account_info(),
                    destination_yi_tokens: self.common.save_yi_tokens.to_account_info(),
                    token_program: self.common.token_program.to_account_info(),
                },
            ),
            amount,
        )
    }

    fn stake_and_mint_to(&mut self, amount: u64) -> Result<()> {
        let prev_amount = self.common.save_yi_tokens.amount;
        self.stake_yi(amount)?;
        self.common.save_yi_tokens.reload()?;
        let next_amount = self.common.save_yi_tokens.amount;
        let yi_minted = unwrap_int!(next_amount.checked_sub(prev_amount));
        self.common.mint_save(yi_minted)?;
        Ok(())
    }
}

pub fn handler(ctx: Context<MintFromUnderlying>, amount: u64) -> Result<()> {
    ctx.accounts.stake_and_mint_to(amount)
}

impl<'info> Validate<'info> for MintFromUnderlying<'info> {
    fn validate(&self) -> Result<()> {
        self.common.validate()?;

        let save = self.common.save.load()?;
        let yi = self.yi.load()?;
        assert_keys_eq!(self.yi, save.yi);
        assert_keys_eq!(self.yi_mint, save.yi_mint);
        assert_keys_eq!(self.yi_mint, yi.mint);
        assert_keys_eq!(self.yi_underlying_tokens, yi.underlying_tokens);

        assert_keys_eq!(self.source_authority, self.source_underlying_tokens.owner);
        assert_keys_eq!(yi.underlying_token_mint, self.source_underlying_tokens.mint);
        assert_keys_eq!(save.underlying_mint, self.source_underlying_tokens.mint);
        Ok(())
    }
}
