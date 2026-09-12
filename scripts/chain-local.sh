#!/usr/bin/env bash
# Start local dev chains for MonQuest (anvil + solana-test-validator).
# Tracks PIDs in .chain-pids (cleaned up by chain-stop.sh).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT/.chain-pids"
: > "$PID_FILE"

start_anvil() {
  if command -v anvil >/dev/null 2>&1; then
    if curl -sf -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
      http://127.0.0.1:8545 >/dev/null 2>&1; then
      echo "anvil already running on :8545"
    else
      anvil --port 8545 --chain-id 31337 > "$ROOT/.anvil.log" 2>&1 &
      echo $! >> "$PID_FILE"
      echo "anvil started on :8545 (log: .anvil.log)"
    fi
  else
    echo "⚠ anvil not found — install Foundry (foundry.paradigm.xyz) or set EVM_RPC_URL."
  fi
}

start_solana() {
  if command -v solana-test-validator >/dev/null 2>&1; then
    if curl -sf -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":[]}' \
      http://127.0.0.1:8899 >/dev/null 2>&1; then
      echo "solana-test-validator already running on :8899"
    else
      solana-test-validator --quiet --limit-ledger-size 5000000 > "$ROOT/.solana-validator.log" 2>&1 &
      echo $! >> "$PID_FILE"
      echo "solana-test-validator started on :8899 (log: .solana-validator.log)"
    fi
  else
    echo "⚠ solana-test-validator not found — install the Solana CLI (solana.com) or set SOLANA_RPC_URL."
  fi
}

start_anvil
start_solana

# Wait for health on whatever we attempted to start.
for i in $(seq 1 30); do
  evm_ok=$(curl -sf -X POST -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
    http://127.0.0.1:8545 >/dev/null 2>&1 && echo y || echo n)
  sol_ok=$(curl -sf -X POST -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"getHealth","params":[]}' \
    http://127.0.0.1:8899 >/dev/null 2>&1 && echo y || echo n)
  [ "$evm_ok" = "y" ] && [ "$sol_ok" = "y" ] && break
  sleep 1
done

echo ""
echo "Local chains ready:"
echo "  EVM     http://127.0.0.1:8545   (chainId 31337, default anvil account has 10000 ETH)"
echo "  Solana  http://127.0.0.1:8899   (pre-funded validator accounts)"
echo ""
echo "Run: npm run demo -- --local"