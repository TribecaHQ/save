//! SAVE Token: A Simple Agreement for Vote-Escrowed Tokens
//!
//! # About
//!
//! The Simple Agreement for Vote-Escrowed Tokens, **SAVE**, is a derivative which enforces that tokens must be locked for a specific period of time.
//!
//! As they are not directly convertible to the underlying token, SAVEs are a powerful primitive for issuing grants for DAO participants that do not restrict transferability of tokens.
//!
//! We're in active development. For the latest updates, please join our community:
//!
//! - Twitter: <https://twitter.com/TribecaDAO>
//!
//! # Architecture
//!
//! SAVE tokens consist of three tokens:
//!
//! - The underlying token, which is the token intended to be staked into the DAO.
//! - The [Yi token](https://github.com/CrateProtocol/yi), which backs the SAVE token. This token is usually backed 1:1 by the underlying token; however, one can increase the conversion rate of the SAVE tokens by increasing the Yi's conversion rate.
//! - The SAVE token, which is the primary token issued by this protocol.
//!
//! # Note
//!
//! - **SAVE is in active development, so all APIs are subject to change.**
//! - **This code is unaudited. Use at your own risk.**
//!
//! # Addresses
//!
//! Program addresses are the same on devnet, testnet, and mainnet-beta.
//!
//! - SAVE: [`SAVEd9pHcncknnMWdP8RSbhDUhw3nrzwmZ6F6RAUiio`](https://explorer.solana.com/address/SAVEd9pHcncknnMWdP8RSbhDUhw3nrzwmZ6F6RAUiio)
//!
//! # Contribution
//!
//! Thank you for your interest in contributing to Tribeca Protocol! All contributions are welcome no matter how big or small. This includes
//! (but is not limited to) filing issues, adding documentation, fixing bugs, creating examples, and implementing features.
//!
//! When contributing, please make sure your code adheres to some basic coding guidlines:
//!
//! - Code must be formatted with the configured formatters (e.g. `rustfmt` and `prettier`).
//! - Comment lines should be no longer than 80 characters and written with proper grammar and punctuation.
//! - Commit messages should be prefixed with the package(s) they modify. Changes affecting multiple packages should list all packages. In rare cases, changes may omit the package name prefix.
//!
//! # License
//!
//! Tribeca Protocol is licensed under the GNU Affero General Public License v3.0.
#![deny(rustdoc::all)]
#![allow(rustdoc::missing_doc_code_examples)]
#![deny(clippy::unwrap_used)]

mod macros;

use anchor_lang::prelude::*;
use vipers::prelude::*;

mod common;
mod instructions;
mod state;

pub(crate) use common::*;
use instructions::*;
pub use state::*;

declare_id!("SAVEd9pHcncknnMWdP8RSbhDUhw3nrzwmZ6F6RAUiio");

/// The [save_token] program.
#[program]
pub mod save_token {
    use super::*;

    /// Creates a new [Save].
    #[access_control(ctx.accounts.validate())]
    pub fn create_save(ctx: Context<CreateSAVE>, min_lock_duration: u64) -> Result<()> {
        instructions::create_save::handler(ctx, min_lock_duration)
    }

    /// Locks [Save] tokens for their underlying.
    #[access_control(ctx.accounts.validate())]
    pub fn lock(ctx: Context<Lock>, amount: u64, duration: u64) -> Result<()> {
        instructions::lock::handler(ctx, amount, duration)
    }

    /// Mints [Save] tokens by locking up Yi tokens.
    #[access_control(ctx.accounts.validate())]
    pub fn mint_from_yi(ctx: Context<MintFromYi>, yi_amount: u64) -> Result<()> {
        instructions::mint_from_yi::handler(ctx, yi_amount)
    }

    /// Mints [Save] tokens by locking up underlying tokens.
    #[access_control(ctx.accounts.validate())]
    pub fn mint_from_underlying(
        ctx: Context<MintFromUnderlying>,
        underlying_amount: u64,
    ) -> Result<()> {
        instructions::mint_from_underlying::handler(ctx, underlying_amount)
    }
}

/// Errors.
#[error_code]
pub enum ErrorCode {
    #[msg("SAVE minimum duration not met.")]
    DurationExceeded,
    #[msg("Tokens may only be locked in the SAVE's specified locker.")]
    LockerMismatch,
}
