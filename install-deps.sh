#!/bin/sh
set -e

echo
echo "==> Installing shared dependencies..."
echo
npm install

echo
echo "==> Installing test dependencies..."
echo
(cd truffle && npm install)

echo
echo "==> Installing server dependencies..."
echo
(cd ethereum-bridge/server && npm install)

echo
echo "==> Installing client dependencies..."
echo
(cd ethereum-bridge/client && npm install)

echo
echo "==> Done!"
