//! Common accounts.

use crate::*;
use anchor_spl::token::{self, Mint, TokenAccount};

/// Common accounts for minting [Save] tokens.
#[derive(Accounts)]
pub struct MintToCommon<'info> {
    /// [Save] account.
    pub save: AccountLoader<'info, Save>,
    /// [token::Mint] of the [SAVE].
    #[account(mut)]
    pub save_mint: Account<'info, Mint>,
    /// [Save::yi_tokens].
    #[account(mut)]
    pub save_yi_tokens: Account<'info, TokenAccount>,

    /// [TokenAccount] receiving the newly minted tokens.
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,

    /// [token] program.
    pub token_program: Program<'info, token::Token>,
}

impl<'info> Validate<'info> for MintToCommon<'info> {
    fn validate(&self) -> Result<()> {
        let save = self.save.load()?;
        assert_keys_eq!(self.save_mint, save.mint);
        assert_keys_eq!(self.save_yi_tokens, save.yi_tokens);

        assert_keys_eq!(self.to.mint, save.mint);
        Ok(())
    }
}

impl<'info> MintToCommon<'info> {
    pub(crate) fn mint_save(&self, amount: u64) -> Result<()> {
        let save = self.save.load()?;
        let signer_seeds: &[&[&[u8]]] = save_seeds!(save);
        token::mint_to(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.save_mint.to_account_info(),
                    to: self.to.to_account_info(),
                    authority: self.save.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            amount,
        )
    }
}
