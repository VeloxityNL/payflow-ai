#!/usr/bin/env bash
set -euo pipefail

# PayFlow AI uses a small local instruction model so the public demo does not
# depend on a paid AI API. Override these paths through environment variables
# when your llama.cpp installation lives somewhere else.
LLAMA_SERVER_BIN="${LLAMA_SERVER_BIN:-/opt/llama.cpp/build/bin/llama-server}"
MODEL_PATH="${PAYFLOW_MODEL_PATH:-./models/qwen2.5-0.5b-instruct-q4_0.gguf}"
PORT="${PAYFLOW_MODEL_PORT:-11435}"

if [[ ! -x "$LLAMA_SERVER_BIN" ]]; then
  echo "llama-server was not found at: $LLAMA_SERVER_BIN" >&2
  echo "Install llama.cpp or set LLAMA_SERVER_BIN to your llama-server binary." >&2
  exit 1
fi

if [[ ! -f "$MODEL_PATH" ]]; then
  cat >&2 <<'MSG'
PayFlow model file is missing.

Download the official Qwen2.5 0.5B Instruct GGUF model from:
https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF

Recommended file:
qwen2.5-0.5b-instruct-q4_0.gguf

Then place it at ./models/ or set PAYFLOW_MODEL_PATH.
MSG
  exit 1
fi

exec "$LLAMA_SERVER_BIN" \
  -m "$MODEL_PATH" \
  --host 127.0.0.1 \
  --port "$PORT" \
  -c 1024 \
  -t 4 \
  -tb 4 \
  --parallel 1 \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --alias payflow-qwen-0.5b
