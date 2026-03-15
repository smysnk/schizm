#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/fleet-defaults.sh
source "${script_dir}/lib/fleet-defaults.sh"

usage() {
  cat <<USAGE
Usage:
  apply-fleet-env-secret.sh [options]

Options:
  --env-file <path>          Path to env file (default: .env.fleet)
  --namespace <name>         Kubernetes namespace (default: fleet/fleet.yaml defaultNamespace)
  --secret-name <name>       Kubernetes secret name (default: fleet/fleet.yaml existingSecret)
  --kubeconfig <path>        Optional KUBECONFIG path
  --create-namespace         Create namespace if it does not exist
  --dry-run                  Render secret YAML and print to stdout only
  --codex-auth-file <path>   Path to Codex auth.json to encode into CODEX_AUTH_JSON_BASE64
  --ssh-key-file <path>      Path to SSH private key to encode into DOCUMENT_STORE_SSH_PRIVATE_KEY_BASE64
  --help                     Show this help
USAGE
}

base64_no_wrap() {
  base64 | tr -d '\n'
}

ENV_FILE="${REPO_ROOT}/.env.fleet"
NAMESPACE="$(fleet_default_namespace)"
SECRET_NAME="$(runtime_secret_name)"
KUBECONFIG_PATH=""
CREATE_NAMESPACE="false"
DRY_RUN="false"
CODEX_AUTH_FILE="${CODEX_AUTH_JSON_PATH:-${CODEX_HOME:-$HOME/.codex}/auth.json}"
SSH_KEY_FILE="${DOCUMENT_STORE_SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --secret-name)
      SECRET_NAME="${2:-}"
      shift 2
      ;;
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --create-namespace)
      CREATE_NAMESPACE="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --codex-auth-file)
      CODEX_AUTH_FILE="${2:-}"
      shift 2
      ;;
    --ssh-key-file)
      SSH_KEY_FILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required" >&2
  exit 1
fi

if [[ -n "$KUBECONFIG_PATH" ]]; then
  export KUBECONFIG="$KUBECONFIG_PATH"
fi

TMP_ENV="$(mktemp)"
TMP_ENV_FILTERED=""
trap 'rm -f "$TMP_ENV" "${TMP_ENV_FILTERED:-}"' EXIT

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#${line%%[![:space:]]*}}"
  line="${line%${line##*[![:space:]]}}"

  if [[ -z "$line" || "$line" == \#* ]]; then
    continue
  fi

  if [[ "$line" == export\ * ]]; then
    line="${line#export }"
  fi

  if [[ "$line" != *=* ]]; then
    echo "Error: invalid line in $ENV_FILE: $line" >&2
    exit 1
  fi

  echo "$line" >> "$TMP_ENV"
done < "$ENV_FILE"

if [[ -f "$CODEX_AUTH_FILE" ]]; then
  CODEX_AUTH_ENCODED="$(base64_no_wrap < "$CODEX_AUTH_FILE")"
  TMP_ENV_FILTERED="$(mktemp)"
  grep -v '^CODEX_AUTH_JSON_BASE64=' "$TMP_ENV" > "$TMP_ENV_FILTERED" || true
  mv "$TMP_ENV_FILTERED" "$TMP_ENV"
  TMP_ENV_FILTERED=""
  printf 'CODEX_AUTH_JSON_BASE64=%s\n' "$CODEX_AUTH_ENCODED" >> "$TMP_ENV"
  echo "Injected CODEX_AUTH_JSON_BASE64 from $CODEX_AUTH_FILE"
fi

if [[ -f "$SSH_KEY_FILE" ]]; then
  SSH_KEY_ENCODED="$(base64_no_wrap < "$SSH_KEY_FILE")"
  TMP_ENV_FILTERED="$(mktemp)"
  grep -v '^DOCUMENT_STORE_SSH_PRIVATE_KEY_BASE64=' "$TMP_ENV" > "$TMP_ENV_FILTERED" || true
  mv "$TMP_ENV_FILTERED" "$TMP_ENV"
  TMP_ENV_FILTERED=""
  printf 'DOCUMENT_STORE_SSH_PRIVATE_KEY_BASE64=%s\n' "$SSH_KEY_ENCODED" >> "$TMP_ENV"
  echo "Injected DOCUMENT_STORE_SSH_PRIVATE_KEY_BASE64 from $SSH_KEY_FILE"
fi

if [[ ! -s "$TMP_ENV" ]]; then
  echo "Error: no key/value entries found in $ENV_FILE" >&2
  exit 1
fi

if [[ "$CREATE_NAMESPACE" == "true" ]]; then
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
    --from-env-file="$TMP_ENV" \
    --dry-run=client -o yaml
  exit 0
fi

kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
  --from-env-file="$TMP_ENV" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applied secret '$SECRET_NAME' in namespace '$NAMESPACE' from '$ENV_FILE'"
