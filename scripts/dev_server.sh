#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_PATH="$ROOT_DIR/.next-dev/dev/lock"

find_repo_next_pids() {
  local pid cwd_line cwd

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue

    cwd_line="$(lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | awk '/^n/ { print; exit }')"
    cwd="${cwd_line#n}"

    if [[ "$cwd" == "$ROOT_DIR" ]]; then
      printf '%s\n' "$pid"
    fi
  done < <(pgrep -f 'next-server|next dev' || true)
}

stop_repo_next_processes() {
  local pids=()
  local pid

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    pids+=("$pid")
  done < <(find_repo_next_pids)

  if ((${#pids[@]} == 0)); then
    return
  fi

  printf 'Stopping existing Next dev process for this repo: %s\n' "${pids[*]}" >&2
  kill "${pids[@]}" 2>/dev/null || true

  for _ in {1..20}; do
    local alive=()

    for pid in "${pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        alive+=("$pid")
      fi
    done

    if ((${#alive[@]} == 0)); then
      return
    fi

    pids=("${alive[@]}")
    sleep 0.25
  done

  printf 'Force stopping unresponsive Next dev process: %s\n' "${pids[*]}" >&2
  kill -9 "${pids[@]}" 2>/dev/null || true
}

stop_repo_next_processes

if [[ -e "$LOCK_PATH" ]]; then
  if lsof "$LOCK_PATH" >/dev/null 2>&1; then
    printf 'Cannot start dev server because %s is still held by another process.\n' "$LOCK_PATH" >&2
    exit 1
  fi

  rm -f "$LOCK_PATH"
fi

cd "$ROOT_DIR"
exec ./node_modules/.bin/next dev --webpack --port 3000
