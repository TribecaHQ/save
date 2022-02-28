# save-token ✌️

[![Crates.io](https://img.shields.io/crates/v/save-token)](https://crates.io/crates/save-token)
[![Docs.rs](https://img.shields.io/docsrs/save-token)](https://docs.rs/save-token)
[![License](https://img.shields.io/crates/l/save-token)](https://github.com/TribecaHQ/save/blob/master/LICENSE)
[![Build Status](https://img.shields.io/github/workflow/status/TribecaHQ/save/E2E/master)](https://github.com/TribecaHQ/save/actions/workflows/programs-e2e.yml?query=branch%3Amaster)
[![Contributors](https://img.shields.io/github/contributors/TribecaHQ/save)](https://github.com/TribecaHQ/save/graphs/contributors)
[![NPM](https://img.shields.io/npm/v/@tribecahq/save)](https://www.npmjs.com/package/@tribecahq/save)

<p align="center">
    <img src="https://raw.githubusercontent.com/TribecaHQ/save/master/images/banner.png" />
</p>

SAVE Token: A Simple Agreement for Vote-Escrowed Tokens

## About

The Simple Agreement for Vote-Escrowed Tokens, **SAVE**, is a derivative which enforces that tokens must be locked for a specific period of time.

As they are not directly convertible to the underlying token, SAVEs are a powerful primitive for issuing grants for DAO participants that do not restrict transferability of tokens.

We're in active development. For the latest updates, please join our community:

- Twitter: <https://twitter.com/TribecaDAO>

## Architecture

SAVE tokens consist of three tokens:

- The underlying token, which is the token intended to be staked into the DAO.
- The [Yi token](https://github.com/CrateProtocol/yi), which backs the SAVE token. This token is usually backed 1:1 by the underlying token; however, one can increase the conversion rate of the SAVE tokens by increasing the Yi's conversion rate.
- The SAVE token, which is the primary token issued by this protocol.

## Note

- **SAVE is in active development, so all APIs are subject to change.**
- **This code is unaudited. Use at your own risk.**

## Addresses

Program addresses are the same on devnet, testnet, and mainnet-beta.

- SAVE: [`SAVEd9pHcncknnMWdP8RSbhDUhw3nrzwmZ6F6RAUiio`](https://explorer.solana.com/address/SAVEd9pHcncknnMWdP8RSbhDUhw3nrzwmZ6F6RAUiio)

## Contribution

Thank you for your interest in contributing to Tribeca Protocol! All contributions are welcome no matter how big or small. This includes
(but is not limited to) filing issues, adding documentation, fixing bugs, creating examples, and implementing features.

When contributing, please make sure your code adheres to some basic coding guidlines:

- Code must be formatted with the configured formatters (e.g. `rustfmt` and `prettier`).
- Comment lines should be no longer than 80 characters and written with proper grammar and punctuation.
- Commit messages should be prefixed with the package(s) they modify. Changes affecting multiple packages should list all packages. In rare cases, changes may omit the package name prefix.

## License

Tribeca Protocol is licensed under the GNU Affero General Public License v3.0.
