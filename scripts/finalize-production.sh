#!/usr/bin/env bash
set -euo pipefail

readonly STATE_FILE=infra/.env.production.local
readonly APP_ORIGIN=https://tasks.nkolinka.ru
readonly TIMER_CRON='0 * * * ? *'
apply_proxy=false
rotate_secrets=false
confirmed_environment=''
confirmed_host=''
legacy_host=${LEGACY_SSH_HOST:-}
legacy_compose_dir=${LEGACY_COMPOSE_DIR:-}
proxy_env_file=''

usage() {
  cat >&2 <<'USAGE'
Usage: finalize-production.sh [options]

Options:
  --legacy-host USER@circleatickers.ru
  --legacy-compose-dir /absolute/compose/path
  --apply-proxy
  --proxy-env-file /absolute/path/to/proxy.env.local
  --confirm-environment production
  --confirm-host circleatickers.ru
  --rotate-secrets
USAGE
}

while (( $# > 0 )); do
  case $1 in
    --legacy-host)
      legacy_host=${2:?Missing value for --legacy-host}
      shift 2
      ;;
    --legacy-compose-dir)
      legacy_compose_dir=${2:?Missing value for --legacy-compose-dir}
      shift 2
      ;;
    --apply-proxy)
      apply_proxy=true
      shift
      ;;
    --proxy-env-file)
      proxy_env_file=${2:?Missing value for --proxy-env-file}
      shift 2
      ;;
    --confirm-environment)
      confirmed_environment=${2:?Missing value for --confirm-environment}
      shift 2
      ;;
    --confirm-host)
      confirmed_host=${2:?Missing value for --confirm-host}
      shift 2
      ;;
    --rotate-secrets)
      rotate_secrets=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

for command in yc jq openssl ssh scp curl mktemp gh shasum; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f $STATE_FILE ]]; then
  printf 'Run ./scripts/bootstrap-production.sh first.\n' >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

: "${FOLDER_ID:?Missing FOLDER_ID in state}"
: "${CONTAINER_ID:?Missing CONTAINER_ID in state}"
: "${RUNTIME_SA_ID:?Missing RUNTIME_SA_ID in state}"
: "${GATEWAY_SA_ID:?Missing GATEWAY_SA_ID in state}"
: "${LOCKBOX_SECRET_ID:?Missing LOCKBOX_SECRET_ID in state}"
: "${JOB_FUNCTION_ID:?Missing JOB_FUNCTION_ID in state; rerun bootstrap}"
: "${OBJECT_STORAGE_ACCESS_KEY_ID:?Missing Object Storage access key in state}"
: "${OBJECT_STORAGE_SECRET_ACCESS_KEY:?Missing Object Storage secret key in state}"

FEDERATION_ID=${FEDERATION_ID:-}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-}
YC_FEDERATION_AUDIENCE=${YC_FEDERATION_AUDIENCE:-}
LOCKBOX_VERSION_ID=${LOCKBOX_VERSION_ID:-}
OUTBOX_TRIGGER_ID=${OUTBOX_TRIGGER_ID:-}
RECURRENCES_TRIGGER_ID=${RECURRENCES_TRIGGER_ID:-}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-}

save_state() {
  local temporary
  temporary=$(mktemp "${STATE_FILE}.XXXXXX")
  chmod 600 "$temporary"
  declare -p \
    CLOUD_ID FOLDER_ID DNS_FOLDER_ID DNS_ZONE_ID YDB_ID YDB_ENDPOINT YDB_DATABASE \
    REGISTRY_ID BUCKET_NAME RUNTIME_SA_ID DEPLOY_SA_ID GATEWAY_SA_ID CONTAINER_ID \
    LOCKBOX_SECRET_ID OBJECT_STORAGE_ACCESS_KEY_ID OBJECT_STORAGE_SECRET_ACCESS_KEY \
    API_GATEWAY_ID API_GATEWAY_DOMAIN CERTIFICATE_ID FEDERATION_ID GITHUB_REPOSITORY \
    YC_FEDERATION_AUDIENCE LOCKBOX_VERSION_ID JOB_FUNCTION_ID OUTBOX_TRIGGER_ID \
    RECURRENCES_TRIGGER_ID TELEGRAM_BOT_USERNAME >"$temporary"
  mv "$temporary" "$STATE_FILE"
}

yc_json() {
  yc "$@" --folder-id "$FOLDER_ID" --profile default --format json
}

if [[ -z $legacy_host && -t 0 ]]; then
  IFS= read -r -p "Legacy SSH target [${USER}@circleatickers.ru]: " legacy_host
  legacy_host=${legacy_host:-${USER}@circleatickers.ru}
fi
if [[ -z $legacy_compose_dir && -t 0 ]]; then
  IFS= read -r -p 'Absolute legacy Compose directory: ' legacy_compose_dir
fi
if [[ -z $legacy_host || -z $legacy_compose_dir ]]; then
  printf 'Set LEGACY_SSH_HOST and LEGACY_COMPOSE_DIR, then rerun to perform the required read-only audit.\n' >&2
  exit 1
fi
if [[ ! $legacy_host =~ ^[A-Za-z0-9._-]+@circleatickers\.ru$ ]]; then
  printf 'Legacy SSH target must be an explicit USER@circleatickers.ru value.\n' >&2
  exit 1
fi
if [[ ! $legacy_compose_dir =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  printf 'Legacy Compose directory must be an absolute safe path.\n' >&2
  exit 1
fi

if [[ $apply_proxy == true ]]; then
  if [[ $confirmed_environment != production || $confirmed_host != circleatickers.ru ]]; then
    printf 'Proxy apply requires --confirm-environment production --confirm-host circleatickers.ru.\n' >&2
    exit 1
  fi
  if [[ $proxy_env_file != /* || ! -f $proxy_env_file ]]; then
    printf '%s\n' '--proxy-env-file must point to an existing absolute path.' >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$proxy_env_file"
  : "${LEGACY_PUBLIC_HOST:?Missing LEGACY_PUBLIC_HOST}"
  : "${LEGACY_WEBHOOK_PATH:?Missing LEGACY_WEBHOOK_PATH}"
  : "${PROXY_COMPOSE_SERVICE:?Missing PROXY_COMPOSE_SERVICE}"
  : "${PROXY_REMOTE_CONFIG:?Missing PROXY_REMOTE_CONFIG}"
  : "${PROXY_CONTAINER_CONFIG:?Missing PROXY_CONTAINER_CONFIG}"
  : "${GITHUB_REPOSITORY:?Run configure-github-oidc.sh before finalization}"

  if [[ $LEGACY_PUBLIC_HOST != "$confirmed_host" || ! $LEGACY_WEBHOOK_PATH =~ ^/[A-Za-z0-9_./-]+$ ]]; then
    printf 'Proxy public host/path does not match the explicit confirmation.\n' >&2
    exit 1
  fi
  if [[ ! $PROXY_COMPOSE_SERVICE =~ ^[A-Za-z0-9_.-]+$ || ! $PROXY_REMOTE_CONFIG =~ ^/[A-Za-z0-9._/-]+$ || ! $PROXY_CONTAINER_CONFIG =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    printf 'Proxy service and config paths contain unsafe characters.\n' >&2
    exit 1
  fi
  if [[ ! -f infra/job-trigger/index.js ]]; then
    printf 'Missing timer bridge source: infra/job-trigger/index.js\n' >&2
    exit 1
  fi
  gh auth status >/dev/null
  gh api "repos/$GITHUB_REPOSITORY" >/dev/null
fi

printf 'Read-only Docker Compose audit on %s:%s\n' "$legacy_host" "$legacy_compose_dir"
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -- "$legacy_host" \
  "cd '$legacy_compose_dir' && docker compose config --services && docker compose config --images && docker compose ps"

if [[ $apply_proxy == true ]]; then
  remote_config_dir=${PROXY_REMOTE_CONFIG%/*}
  container_config_dir=${PROXY_CONTAINER_CONFIG%/*}
  [[ -n $remote_config_dir ]] || remote_config_dir=/
  [[ -n $container_config_dir ]] || container_config_dir=/
  ssh -o BatchMode=yes -- "$legacy_host" \
    "cd '$legacy_compose_dir' && test -d '$remote_config_dir' && test -w '$remote_config_dir' && docker compose exec -T '$PROXY_COMPOSE_SERVICE' test -d '$container_config_dir' && docker compose exec -T '$PROXY_COMPOSE_SERVICE' nginx -t"
else
  printf '\nAudit complete; no token was read and no Lockbox, revision, remote file, or Telegram setting was changed.\n'
  printf 'Review infra/legacy-proxy/proxy.env.example, then run with all explicit confirmations:\n'
  printf './scripts/finalize-production.sh --legacy-host %q --legacy-compose-dir %q --apply-proxy --proxy-env-file /ABSOLUTE/PATH/proxy.env.local --confirm-environment production --confirm-host circleatickers.ru\n' "$legacy_host" "$legacy_compose_dir"
  exit 0
fi

revisions=$(yc_json serverless container revision list --container-id "$CONTAINER_ID")
image_uri=$(jq -r 'sort_by(.created_at) | last | .image.image_url // last.image_url // empty' <<<"$revisions")
if [[ -z $image_uri ]]; then
  printf 'No deployed image found. Push main and wait for Deploy production first.\n' >&2
  exit 1
fi

secret_json=$(yc_json lockbox secret get --id "$LOCKBOX_SECRET_ID")
current_version_id=$(jq -r '.current_version.id // empty' <<<"$secret_json")
create_secret_version=false
if [[ -z $current_version_id || $rotate_secrets == true ]]; then
  create_secret_version=true
else
  LOCKBOX_VERSION_ID=$current_version_id
fi

secret_dir=$(mktemp -d)
chmod 700 "$secret_dir"
cleanup() {
  rm -rf "$secret_dir"
}
trap cleanup EXIT

write_secret_file() {
  local name=$1
  local value=$2
  printf '%s' "$value" >"$secret_dir/$name"
  chmod 600 "$secret_dir/$name"
}

lockbox_value() {
  yc lockbox payload get \
    --id "$LOCKBOX_SECRET_ID" \
    --version-id "$LOCKBOX_VERSION_ID" \
    --key "$1" \
    --folder-id "$FOLDER_ID" \
    --profile default
}

if [[ $create_secret_version == true ]]; then
  if [[ -t 0 ]]; then
    IFS= read -r -s -p 'BotFather token: ' bot_token
    printf '\n' >&2
  else
    IFS= read -r bot_token
  fi
  if [[ ! $bot_token =~ ^[0-9]+:[A-Za-z0-9_-]{20,}$ ]]; then
    printf 'The supplied BotFather token has an unexpected format.\n' >&2
    exit 1
  fi

  webhook_secret=$(openssl rand -hex 32)
  proxy_secret=$(openssl rand -hex 32)
  session_secret=$(openssl rand -hex 32)
  internal_job_secret=$(openssl rand -hex 32)

  write_secret_file bot-token "$bot_token"
  write_secret_file webhook-secret "$webhook_secret"
  write_secret_file proxy-secret "$proxy_secret"
  write_secret_file session-secret "$session_secret"
  write_secret_file internal-job-secret "$internal_job_secret"
  write_secret_file storage-key-id "$OBJECT_STORAGE_ACCESS_KEY_ID"
  write_secret_file storage-secret-key "$OBJECT_STORAGE_SECRET_ACCESS_KEY"
else
  bot_token=$(lockbox_value telegram-bot-token)
  webhook_secret=$(lockbox_value telegram-webhook-secret)
  proxy_secret=$(lockbox_value telegram-proxy-secret)
fi

write_secret_file telegram-get-me.conf "url = \"https://api.telegram.org/bot${bot_token}/getMe\"
request = \"POST\"
silent
show-error
fail-with-body
"
telegram_response=$(curl --config "$secret_dir/telegram-get-me.conf")
TELEGRAM_BOT_USERNAME=$(jq -er '.result.username | select(type == "string" and length > 0)' <<<"$telegram_response")
if [[ ! $TELEGRAM_BOT_USERNAME =~ ^[A-Za-z0-9_]{5,32}$ ]]; then
  printf 'Telegram getMe returned an invalid bot username.\n' >&2
  exit 1
fi
gh variable set TELEGRAM_BOT_USERNAME --repo "$GITHUB_REPOSITORY" --body "$TELEGRAM_BOT_USERNAME"
unset telegram_response

if [[ $create_secret_version == true ]]; then
  payload=$(jq -n \
    --rawfile bot "$secret_dir/bot-token" \
    --rawfile webhook "$secret_dir/webhook-secret" \
    --rawfile proxy "$secret_dir/proxy-secret" \
    --rawfile session "$secret_dir/session-secret" \
    --rawfile job "$secret_dir/internal-job-secret" \
    --rawfile storage_id "$secret_dir/storage-key-id" \
    --rawfile storage_secret "$secret_dir/storage-secret-key" \
    '[
      {key:"telegram-bot-token", text_value:$bot},
      {key:"telegram-webhook-secret", text_value:$webhook},
      {key:"telegram-proxy-secret", text_value:$proxy},
      {key:"session-secret", text_value:$session},
      {key:"internal-job-secret", text_value:$job},
      {key:"object-storage-access-key-id", text_value:$storage_id},
      {key:"object-storage-secret-access-key", text_value:$storage_secret}
    ]')
  LOCKBOX_VERSION_ID=$(printf '%s' "$payload" | yc lockbox secret add-version \
    --id "$LOCKBOX_SECRET_ID" \
    --description 'Production runtime secrets' \
    --payload - \
    --folder-id "$FOLDER_ID" \
    --profile default \
    --format json | jq -r '.id')
  unset payload session_secret internal_job_secret
else
  printf 'Reusing current Lockbox version %s; secrets were not rotated.\n' "$LOCKBOX_VERSION_ID"
fi

export YC_FOLDER_ID=$FOLDER_ID
export YC_CONTAINER_ID=$CONTAINER_ID
export YC_RUNTIME_SA_ID=$RUNTIME_SA_ID
export YC_LOCKBOX_SECRET_ID=$LOCKBOX_SECRET_ID
export YDB_ENDPOINT
export YDB_DATABASE
export OBJECT_STORAGE_BUCKET=$BUCKET_NAME
export API_GATEWAY_ID
export LOCKBOX_VERSION_ID_OVERRIDE=$LOCKBOX_VERSION_ID
export TELEGRAM_BOT_USERNAME
./scripts/deploy-production-revision.sh "$image_uri" >/dev/null
printf 'Container revision now uses Lockbox version %s and bot @%s.\n' "$LOCKBOX_VERSION_ID" "$TELEGRAM_BOT_USERNAME"

source_hash_output=$(shasum -a 256 infra/job-trigger/index.js)
source_hash=${source_hash_output%% *}
function_description="lockbox=$LOCKBOX_VERSION_ID source=$source_hash"
function_versions=$(yc_json serverless function version list --function-id "$JOB_FUNCTION_ID")
function_version_id=$(jq -r --arg description "$function_description" 'sort_by(.created_at) | last | select(.description == $description) | .id // empty' <<<"$function_versions")
if [[ -z $function_version_id ]]; then
  function_version_id=$(yc_json serverless function version create \
    --function-id "$JOB_FUNCTION_ID" \
    --runtime nodejs22 \
    --entrypoint index.handler \
    --memory 128MB \
    --execution-timeout 60s \
    --concurrency 1 \
    --service-account-id "$RUNTIME_SA_ID" \
    --source-path infra/job-trigger \
    --description "$function_description" \
    --environment "APP_ORIGIN=$APP_ORIGIN" \
    --secret "id=$LOCKBOX_SECRET_ID,version-id=$LOCKBOX_VERSION_ID,key=internal-job-secret,environment-variable=INTERNAL_JOB_SECRET" | jq -r '.id')
fi

ensure_timer_trigger() {
  local name=$1
  local path=$2
  local id_variable=$3
  local payload triggers trigger_id status
  payload=$(jq -cn --arg path "$path" '{path:$path}')
  triggers=$(yc_json serverless trigger list)
  trigger_id=$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' <<<"$triggers" | head -n 1)
  if [[ -z $trigger_id ]]; then
    trigger_id=$(yc_json serverless trigger create timer \
      --name "$name" \
      --description "POST $path every minute" \
      --cron-expression "$TIMER_CRON" \
      --payload "$payload" \
      --invoke-function-id "$JOB_FUNCTION_ID" \
      --invoke-function-service-account-id "$GATEWAY_SA_ID" \
      --retry-attempts 3 \
      --retry-interval 10s | jq -r '.id')
  else
    yc serverless trigger update timer \
      --id "$trigger_id" \
      --description "POST $path every minute" \
      --new-cron-expression "$TIMER_CRON" \
      --new-payload "$payload" \
      --new-invoke-function-id "$JOB_FUNCTION_ID" \
      --new-invoke-function-service-account-id "$GATEWAY_SA_ID" \
      --new-function-retry-attempts 3 \
      --new-function-retry-interval 10s \
      --folder-id "$FOLDER_ID" \
      --profile default >/dev/null
  fi
  status=$(yc_json serverless trigger get --id "$trigger_id" | jq -r '.status // empty')
  if [[ $status == PAUSED ]]; then
    yc serverless trigger resume --id "$trigger_id" --folder-id "$FOLDER_ID" --profile default >/dev/null
  fi
  printf -v "$id_variable" '%s' "$trigger_id"
}

ensure_timer_trigger linka-tasks-outbox /api/jobs/outbox OUTBOX_TRIGGER_ID
ensure_timer_trigger linka-tasks-recurrences /api/jobs/recurrences RECURRENCES_TRIGGER_ID

proxy_template=$(<infra/legacy-proxy/nginx-location.conf.tpl)
proxy_config=${proxy_template//__WEBHOOK_PATH__/$LEGACY_WEBHOOK_PATH}
proxy_config=${proxy_config//__PROXY_SECRET__/$proxy_secret}
write_secret_file nginx.conf "$proxy_config"
unset proxy_config proxy_secret

remote_temporary=${PROXY_REMOTE_CONFIG}.linka-tasks-tmp
scp -q -- "$secret_dir/nginx.conf" "$legacy_host:$remote_temporary"
ssh -o BatchMode=yes -- "$legacy_host" \
  "cd '$legacy_compose_dir' && install -m 600 '$remote_temporary' '$PROXY_REMOTE_CONFIG' && rm -f '$remote_temporary' && docker compose exec -T '$PROXY_COMPOSE_SERVICE' test -r '$PROXY_CONTAINER_CONFIG' && docker compose exec -T '$PROXY_COMPOSE_SERVICE' nginx -t && docker compose exec -T '$PROXY_COMPOSE_SERVICE' nginx -s reload"

webhook_url=https://$LEGACY_PUBLIC_HOST$LEGACY_WEBHOOK_PATH
write_secret_file telegram-set-webhook.conf "url = \"https://api.telegram.org/bot${bot_token}/setWebhook\"
request = \"POST\"
form-string = \"url=${webhook_url}\"
form-string = \"secret_token=${webhook_secret}\"
form-string = \"drop_pending_updates=false\"
silent
show-error
fail-with-body
"
telegram_response=$(curl --config "$secret_dir/telegram-set-webhook.conf")
if ! jq -e '.ok == true' >/dev/null <<<"$telegram_response"; then
  printf 'Telegram setWebhook failed. Response was intentionally not printed.\n' >&2
  exit 1
fi
unset bot_token webhook_secret telegram_response

save_state
printf 'Legacy proxy was validated and reloaded; Telegram webhook now targets %s.\n' "$webhook_url"
printf 'Timer triggers use function version %s and run every minute.\n' "$function_version_id"
