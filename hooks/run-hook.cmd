#!/usr/bin/env bash
# Cross-platform hook runner for model-trainer plugin

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="$1"

if [ -z "$HOOK_NAME" ]; then
  echo '{"error": "No hook name provided"}' >&2
  exit 1
fi

HOOK_SCRIPT="${SCRIPT_DIR}/${HOOK_NAME}"

if [ ! -f "$HOOK_SCRIPT" ]; then
  echo "{\"error\": \"Hook script not found: ${HOOK_NAME}\"}" >&2
  exit 1
fi

exec bash "$HOOK_SCRIPT"
