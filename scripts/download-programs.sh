#!/usr/bin/env sh

cd $(dirname $0)/..

mkdir -p artifacts/deploy/

curl -L https://github.com/CrateProtocol/yi/releases/download/v0.3.0/yi.so >artifacts/deploy/yi.so
curl -L https://github.com/TribecaHQ/tribeca/releases/download/v0.5.2/govern.so >artifacts/deploy/govern.so
curl -L https://github.com/TribecaHQ/tribeca/releases/download/v0.5.2/locked_voter.so >artifacts/deploy/locked_voter.so
curl -L https://github.com/GokiProtocol/goki/releases/download/v0.7.0/smart_wallet.so >artifacts/deploy/smart_wallet.so
