#!/bin/sh
set -eu

HOME_DIR="${HOME:-/root}"
CODEX_HOME_DIR="${CODEX_HOME:-${HOME_DIR}/.codex}"

decode_base64_to_file() {
  encoded_value="${1:-}"
  output_path="${2:-}"

  if command -v base64 >/dev/null 2>&1; then
    if printf '%s' "$encoded_value" | base64 --decode > "$output_path" 2>/dev/null; then
      return 0
    fi

    if printf '%s' "$encoded_value" | base64 -d > "$output_path" 2>/dev/null; then
      return 0
    fi

    if printf '%s' "$encoded_value" | base64 -D > "$output_path" 2>/dev/null; then
      return 0
    fi
  fi

  if command -v openssl >/dev/null 2>&1; then
    if printf '%s' "$encoded_value" | openssl base64 -d -A > "$output_path" 2>/dev/null; then
      return 0
    fi
  fi

  echo "Unable to decode base64 payload: no compatible decoder is available." >&2
  return 1
}

extract_git_host() {
  repo_url="${1:-}"

  case "$repo_url" in
    git@*:* )
      printf '%s\n' "${repo_url#git@}" | cut -d: -f1
      ;;
    ssh://*@*/* )
      printf '%s\n' "${repo_url#ssh://}" | cut -d@ -f2 | cut -d/ -f1
      ;;
    ssh://*/* | https://*/* | http://*/* )
      printf '%s\n' "${repo_url#*://}" | cut -d/ -f1 | cut -d: -f1
      ;;
    * )
      printf '%s\n' ""
      ;;
  esac
}

configure_ssh() {
  private_key_b64="${DOCUMENT_STORE_SSH_PRIVATE_KEY_BASE64:-}"

  if [ -z "$private_key_b64" ]; then
    return 0
  fi

  ssh_dir="${HOME_DIR}/.ssh"
  key_path="${ssh_dir}/id_ed25519"
  known_hosts_path="${ssh_dir}/known_hosts"
  git_host="$(extract_git_host "${DOCUMENT_STORE_GIT_URL:-}")"

  mkdir -p "$ssh_dir"
  chmod 700 "$ssh_dir"
  decode_base64_to_file "$private_key_b64" "$key_path"
  chmod 600 "$key_path"
  touch "$known_hosts_path"
  chmod 600 "$known_hosts_path"

  if [ -n "$git_host" ] && command -v ssh-keyscan >/dev/null 2>&1; then
    ssh-keyscan -H "$git_host" >> "$known_hosts_path" 2>/dev/null || true
  fi

  cat > "${ssh_dir}/config" <<EOF
Host *
  IdentitiesOnly yes
  IdentityFile ${key_path}
  UserKnownHostsFile ${known_hosts_path}
  StrictHostKeyChecking accept-new
EOF
  chmod 600 "${ssh_dir}/config"
  export GIT_SSH_COMMAND="ssh -F ${ssh_dir}/config"
}

configure_codex_auth() {
  mkdir -p "$CODEX_HOME_DIR"

  if [ -n "${CODEX_AUTH_JSON_BASE64:-}" ]; then
    decode_base64_to_file "${CODEX_AUTH_JSON_BASE64}" "${CODEX_HOME_DIR}/auth.json"
    chmod 600 "${CODEX_HOME_DIR}/auth.json"
    return 0
  fi

  if [ -n "${OPENAI_API_KEY:-}" ]; then
    printf '%s' "${OPENAI_API_KEY}" | codex login --with-api-key >/dev/null
  fi
}

sync_document_store_repo() {
  if [ "${PROMPT_RUNNER_EXECUTION_MODE:-worktree}" != "container" ]; then
    return 0
  fi

  repo_url="${DOCUMENT_STORE_GIT_URL:-}"
  repo_branch="${DOCUMENT_STORE_GIT_BRANCH:-main}"
  repo_dir="${DOCUMENT_STORE_DIR:-/app/obsidian-repository}"
  author_name="${DOCUMENT_STORE_GIT_AUTHOR_NAME:-Schizm Bot}"
  author_email="${DOCUMENT_STORE_GIT_AUTHOR_EMAIL:-schizm-bot@smysnk.com}"

  if [ -z "$repo_url" ]; then
    echo "DOCUMENT_STORE_GIT_URL is required when PROMPT_RUNNER_EXECUTION_MODE=container" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$repo_dir")"

  if [ -d "${repo_dir}/.git" ]; then
    git -C "$repo_dir" remote set-url origin "$repo_url"
    git -C "$repo_dir" fetch origin "$repo_branch"
    git -C "$repo_dir" checkout -B "$repo_branch" "origin/$repo_branch"
    git -C "$repo_dir" reset --hard "origin/$repo_branch"
    git -C "$repo_dir" clean -fd
  else
    rm -rf "$repo_dir"
    git clone --branch "$repo_branch" --single-branch "$repo_url" "$repo_dir"
  fi

  git -C "$repo_dir" config user.name "$author_name"
  git -C "$repo_dir" config user.email "$author_email"
}
