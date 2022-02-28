//! Instruction handler for [save_token::mint_from_yi].

use crate::*;
use anchor_spl::token::{self, TokenAccount};

/// Accounts for [save_token::mint_from_yi].
#[derive(Accounts)]
pub struct MintFromYi<'info> {
    /// Common accounts for minting.
    pub common: MintToCommon<'info>,

    /// [TokenAccount] holding the source Yi tokens.
    #[account(mut)]
    pub source_yi_tokens: Account<'info, TokenAccount>,
    /// Authority of the [Self::source_yi_tokens].
    pub source_authority: Signer<'info>,
}

impl<'info> MintFromYi<'info> {
    fn transfer_yi(&self, amount: u64) -> Result<()> {
        token::transfer(
            CpiContext::new(
                self.common.token_program.to_account_info(),
                token::Transfer {
                    from: self.source_yi_tokens.to_account_info(),
                    to: self.common.save_yi_tokens.to_account_info(),
                    authority: self.source_authority.to_account_info(),
                },
            ),
            amount,
        )
    }

    fn mint_to(&self, amount: u64) -> Result<()> {
        self.transfer_yi(amount)?;
        self.common.mint_save(amount)?;
        Ok(())
    }
}

pub fn handler(ctx: Context<MintFromYi>, amount: u64) -> Result<()> {
    ctx.accounts.mint_to(amount)
}

impl<'info> Validate<'info> for MintFromYi<'info> {
    fn validate(&self) -> Result<()> {
        self.common.validate()?;

        let save = self.common.save.load()?;
        assert_keys_eq!(self.source_authority, self.source_yi_tokens.owner);
        assert_keys_eq!(save.yi_mint, self.source_yi_tokens.mint);
        Ok(())
    }
}
