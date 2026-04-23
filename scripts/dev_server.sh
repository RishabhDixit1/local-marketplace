#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_PATH="$ROOT_DIR/.next-dev/dev/lock"
ROOT_DIR_WIN="$(cygpath -w "$ROOT_DIR" 2>/dev/null || printf '%s' "$ROOT_DIR")"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

ensure_node_available() {
  if command_exists node; then
    return
  fi

  local candidate
  for candidate in "/c/Program Files/nodejs" "/c/Program Files (x86)/nodejs"; do
    if [[ -x "$candidate/node.exe" ]]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done

  if ! command_exists node; then
    printf 'Node.js is not available in PATH. Install Node LTS and reopen the terminal.\n' >&2
    exit 1
  fi
}

resolve_supported_ca_node_option() {
  if node --help 2>/dev/null | grep -q -- "--use-system-ca"; then
    printf '%s' "--use-system-ca"
    return
  fi

  if node --help 2>/dev/null | grep -q -- "--use-openssl-ca"; then
    printf '%s' "--use-openssl-ca"
  fi
}

enable_supported_ca_for_local_node() {
  local current_options="${NODE_OPTIONS:-}"
  local ca_option

  ca_option="$(resolve_supported_ca_node_option)"
  if [[ -z "$ca_option" ]]; then
    return
  fi

  if [[ " ${current_options} " == *" ${ca_option} "* ]]; then
    return
  fi

  if [[ -n "$current_options" ]]; then
    export NODE_OPTIONS="${ca_option} ${current_options}"
  else
    export NODE_OPTIONS="${ca_option}"
  fi
}

find_repo_next_pids() {
  local pid cwd_line cwd

  if command_exists pgrep; then
    pid_source() {
      pgrep -f 'next-server|next dev' || true
    }
  elif command_exists lsof; then
    pid_source() {
      lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true
    }
  elif command_exists powershell.exe; then
    pid_source() {
      CODEX_ROOT_DIR_WIN="$ROOT_DIR_WIN" powershell.exe -NoProfile -Command '
        $root = [string]$env:CODEX_ROOT_DIR_WIN
        $listeners = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty OwningProcess -Unique

        foreach ($processId in $listeners) {
          $proc = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $processId) -ErrorAction SilentlyContinue
          if (-not $proc) { continue }

          $cmd = [string]$proc.CommandLine
          if ($cmd -like "*$root*" -or $cmd -like "*next\\dist\\server\\lib\\start-server.js*") {
            Write-Output $processId
          }
        }
      ' | tr -d '\r'
    }
  else
    pid_source() {
      return 0
    }
  fi

  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue

    if [[ "$pid" =~ ^[0-9]+$ ]] || ! command_exists lsof; then
      printf '%s\n' "$pid"
      continue
    fi

    cwd_line="$(lsof -a -d cwd -p "$pid" -Fn 2>/dev/null | awk '/^n/ { print; exit }')"
    cwd="${cwd_line#n}"

    if [[ "$cwd" == "$ROOT_DIR" ]]; then
      printf '%s\n' "$pid"
    fi
  done < <(pid_source)
}

stop_pid() {
  local pid="$1"

  if command_exists powershell.exe; then
    powershell.exe -NoProfile -Command "Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1 || true
    return
  fi

  kill "$pid" 2>/dev/null || true
}

force_stop_pid() {
  local pid="$1"

  if command_exists powershell.exe; then
    powershell.exe -NoProfile -Command "Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue" >/dev/null 2>&1 || true
    return
  fi

  kill -9 "$pid" 2>/dev/null || true
}

pid_is_alive() {
  local pid="$1"

  if command_exists powershell.exe; then
    powershell.exe -NoProfile -Command "if (Get-Process -Id $pid -ErrorAction SilentlyContinue) { exit 0 } exit 1" >/dev/null 2>&1
    return $?
  fi

  kill -0 "$pid" 2>/dev/null
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
  for pid in "${pids[@]}"; do
    stop_pid "$pid"
  done

  for _ in {1..20}; do
    local alive=()

    for pid in "${pids[@]}"; do
      if pid_is_alive "$pid"; then
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
  for pid in "${pids[@]}"; do
    force_stop_pid "$pid"
  done
}

stop_repo_next_processes

if [[ -e "$LOCK_PATH" ]]; then
  if command_exists lsof && lsof "$LOCK_PATH" >/dev/null 2>&1; then
    printf 'Cannot start dev server because %s is still held by another process.\n' "$LOCK_PATH" >&2
    exit 1
  fi

  rm -f "$LOCK_PATH"
fi

cd "$ROOT_DIR"
ensure_node_available
enable_supported_ca_for_local_node
exec ./node_modules/.bin/next dev --webpack --port 3000
