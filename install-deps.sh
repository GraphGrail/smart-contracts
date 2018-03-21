#!/usr/bin/env bash
set -e

printf '\n%s\n\n' '==> Installing shared dependencies...'
npm install

printf '\n%s\n\n' '==> Installing test dependencies...'
(cd truffle && npm install)

printf '\n%s\n\n' '==> Installing server dependencies...'
(cd ethereum-bridge/server && npm install)

printf '\n%s\n\n' '==> Installing client dependencies...'
(cd ethereum-bridge/client && npm install)

printf '\n%s\n' '==> Done!'
