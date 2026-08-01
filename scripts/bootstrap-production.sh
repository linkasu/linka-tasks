#!/usr/bin/env bash
set -euo pipefail

readonly YC_PROFILE=default
readonly CLOUD_NAME=aacidov-main
readonly FOLDER_NAME=linka-tasks-prod
readonly DNS_FOLDER_NAME=nko-linka
readonly DNS_ZONE=nkolinka.ru.
readonly APP_DOMAIN=tasks.nkolinka.ru
readonly STATE_FILE=infra/.env.production.local
readonly RESOURCE_NAME=linka-tasks

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$1" >&2
    exit 1
  fi
}

yc_json() {
  yc "$@" --profile "$YC_PROFILE" --format json
}

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

ensure_folder_binding() {
  local role=$1
  local service_account_id=$2
  yc resource-manager folder add-access-binding \
    --id "$FOLDER_ID" \
    --role "$role" \
    --service-account-id "$service_account_id" \
    --profile "$YC_PROFILE" >/dev/null
}

ensure_dns_record() {
  local name=$1
  local type=$2
  local value=$3
  local records existing
  records=$(yc_json dns zone list-records --id "$DNS_ZONE_ID" --folder-id "$DNS_FOLDER_ID")
  existing=$(jq -r --arg name "$name" --arg type "$type" \
    '.record_sets[] | select(.name == $name and .type == $type) | .data[]' <<<"$records")
  if [[ -n $existing ]]; then
    if grep -Fqx -- "$value" <<<"$existing"; then
      return
    fi
    if [[ $type == TXT ]]; then
      yc dns zone add-records \
        --id "$DNS_ZONE_ID" \
        --record "$name 60 $type $value" \
        --folder-id "$DNS_FOLDER_ID" \
        --profile "$YC_PROFILE" >/dev/null
      return
    fi
    printf 'DNS %s %s already exists with another value; refusing to replace it.\n' "$name" "$type" >&2
    exit 1
  fi
  yc dns zone add-records \
    --id "$DNS_ZONE_ID" \
    --record "$name 60 $type $value" \
    --folder-id "$DNS_FOLDER_ID" \
    --profile "$YC_PROFILE" >/dev/null
}

for command in yc jq openssl grep mktemp; do
  require_command "$command"
done

mkdir -p infra/.state
umask 077

if [[ -f $STATE_FILE ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE"
fi
FEDERATION_ID=${FEDERATION_ID:-}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-}
YC_FEDERATION_AUDIENCE=${YC_FEDERATION_AUDIENCE:-}
LOCKBOX_VERSION_ID=${LOCKBOX_VERSION_ID:-}
API_GATEWAY_ID=${API_GATEWAY_ID:-}
API_GATEWAY_DOMAIN=${API_GATEWAY_DOMAIN:-}
CERTIFICATE_ID=${CERTIFICATE_ID:-}
JOB_FUNCTION_ID=${JOB_FUNCTION_ID:-}
OUTBOX_TRIGGER_ID=${OUTBOX_TRIGGER_ID:-}
RECURRENCES_TRIGGER_ID=${RECURRENCES_TRIGGER_ID:-}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-}

CLOUD_ID=${CLOUD_ID:-$(yc_json resource-manager cloud list | jq -r --arg name "$CLOUD_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $CLOUD_ID ]]; then
  printf 'Cloud not found: %s\n' "$CLOUD_NAME" >&2
  exit 1
fi

FOLDER_ID=${FOLDER_ID:-$(yc_json resource-manager folder list --cloud-id "$CLOUD_ID" | jq -r --arg name "$FOLDER_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $FOLDER_ID ]]; then
  FOLDER_ID=$(yc_json resource-manager folder create \
    --name "$FOLDER_NAME" \
    --description 'Production resources for Linka Tasks' \
    --cloud-id "$CLOUD_ID" | jq -r '.id')
fi

DNS_FOLDER_ID=${DNS_FOLDER_ID:-$(yc_json resource-manager folder list --cloud-id "$CLOUD_ID" | jq -r --arg name "$DNS_FOLDER_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $DNS_FOLDER_ID ]]; then
  printf 'Existing DNS folder not found: %s\n' "$DNS_FOLDER_NAME" >&2
  exit 1
fi

DNS_ZONE_ID=${DNS_ZONE_ID:-$(yc_json dns zone list --folder-id "$DNS_FOLDER_ID" | jq -r --arg zone "$DNS_ZONE" '.[] | select(.zone == $zone) | .id' | head -n 1)}
if [[ -z $DNS_ZONE_ID ]]; then
  printf 'Existing DNS zone not found in %s: %s\n' "$DNS_FOLDER_NAME" "$DNS_ZONE" >&2
  exit 1
fi

RUNTIME_SA_ID=${RUNTIME_SA_ID:-$(yc_json iam service-account list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME-runtime" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $RUNTIME_SA_ID ]]; then
  RUNTIME_SA_ID=$(yc_json iam service-account create --name "$RESOURCE_NAME-runtime" --folder-id "$FOLDER_ID" | jq -r '.id')
fi

DEPLOY_SA_ID=${DEPLOY_SA_ID:-$(yc_json iam service-account list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME-deploy" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $DEPLOY_SA_ID ]]; then
  DEPLOY_SA_ID=$(yc_json iam service-account create --name "$RESOURCE_NAME-deploy" --folder-id "$FOLDER_ID" | jq -r '.id')
fi

GATEWAY_SA_ID=${GATEWAY_SA_ID:-$(yc_json iam service-account list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME-gateway" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $GATEWAY_SA_ID ]]; then
  GATEWAY_SA_ID=$(yc_json iam service-account create --name "$RESOURCE_NAME-gateway" --folder-id "$FOLDER_ID" | jq -r '.id')
fi

YDB_ID=${YDB_ID:-$(yc_json ydb database list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $YDB_ID ]]; then
  YDB_ID=$(yc_json ydb database create \
    --name "$RESOURCE_NAME" \
    --serverless \
    --sls-storage-size 10GB \
    --deletion-protection \
    --folder-id "$FOLDER_ID" | jq -r '.id')
fi
ydb_json=$(yc_json ydb database get --id "$YDB_ID" --folder-id "$FOLDER_ID")
ydb_full_endpoint=$(jq -r '.endpoint' <<<"$ydb_json")
YDB_ENDPOINT=${YDB_ENDPOINT:-${ydb_full_endpoint%%/\?database=*}}
YDB_DATABASE=${YDB_DATABASE:-${ydb_full_endpoint#*database=}}
if [[ $YDB_DATABASE == "$ydb_full_endpoint" ]]; then
  YDB_DATABASE=$(jq -r '.database_path // empty' <<<"$ydb_json")
fi

REGISTRY_ID=${REGISTRY_ID:-$(yc_json container registry list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $REGISTRY_ID ]]; then
  REGISTRY_ID=$(yc_json container registry create --name "$RESOURCE_NAME" --folder-id "$FOLDER_ID" | jq -r '.id')
fi

BUCKET_NAME=${BUCKET_NAME:-linka-tasks-prod-${FOLDER_ID: -8}}
if ! yc storage bucket get --name "$BUCKET_NAME" --folder-id "$FOLDER_ID" --profile "$YC_PROFILE" >/dev/null 2>&1; then
  yc storage bucket create \
    --name "$BUCKET_NAME" \
    --default-storage-class standard \
    --max-size 10737418240 \
    --acl private \
    --folder-id "$FOLDER_ID" \
    --profile "$YC_PROFILE" >/dev/null
fi
yc storage bucket update \
  --name "$BUCKET_NAME" \
  --acl private \
  --cors 'allowed-methods=[method-get,method-put,method-head],allowed-origins=[https://tasks.nkolinka.ru],allowed-headers=[*],expose-headers=[ETag]' \
  --folder-id "$FOLDER_ID" \
  --profile "$YC_PROFILE" >/dev/null

CONTAINER_ID=${CONTAINER_ID:-$(yc_json serverless container list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $CONTAINER_ID ]]; then
  CONTAINER_ID=$(yc_json serverless container create --name "$RESOURCE_NAME" --folder-id "$FOLDER_ID" | jq -r '.id')
fi

JOB_FUNCTION_ID=${JOB_FUNCTION_ID:-$(yc_json serverless function list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME-jobs" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $JOB_FUNCTION_ID ]]; then
  JOB_FUNCTION_ID=$(yc_json serverless function create \
    --name "$RESOURCE_NAME-jobs" \
    --description 'Timer-to-HTTP bridge; version is created after Lockbox finalization' \
    --folder-id "$FOLDER_ID" | jq -r '.id')
fi

LOCKBOX_SECRET_ID=${LOCKBOX_SECRET_ID:-$(yc_json lockbox secret list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME-runtime" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $LOCKBOX_SECRET_ID ]]; then
  LOCKBOX_SECRET_ID=$(yc_json lockbox secret create \
    --name "$RESOURCE_NAME-runtime" \
    --description 'Created empty; BotFather token is added only by finalization' \
    --deletion-protection \
    --folder-id "$FOLDER_ID" | jq -r '.id')
fi

OBJECT_STORAGE_ACCESS_KEY_ID=${OBJECT_STORAGE_ACCESS_KEY_ID:-}
OBJECT_STORAGE_SECRET_ACCESS_KEY=${OBJECT_STORAGE_SECRET_ACCESS_KEY:-}
if [[ -z $OBJECT_STORAGE_ACCESS_KEY_ID || -z $OBJECT_STORAGE_SECRET_ACCESS_KEY ]]; then
  existing_keys=$(yc_json iam access-key list --service-account-id "$RUNTIME_SA_ID" --folder-id "$FOLDER_ID" | jq -r '[.[] | select(.description == "linka-tasks object storage")] | length')
  if (( existing_keys > 0 )); then
    printf 'An Object Storage key exists but its secret is absent from %s. Refusing to create another key.\n' "$STATE_FILE" >&2
    exit 1
  fi
  access_key_json=$(yc_json iam access-key create \
    --service-account-id "$RUNTIME_SA_ID" \
    --description 'linka-tasks object storage' \
    --folder-id "$FOLDER_ID")
  OBJECT_STORAGE_ACCESS_KEY_ID=$(jq -r '.access_key.key_id' <<<"$access_key_json")
  OBJECT_STORAGE_SECRET_ACCESS_KEY=$(jq -r '.secret' <<<"$access_key_json")
fi
save_state

yc ydb database add-access-binding --id "$YDB_ID" --role ydb.editor --service-account-id "$RUNTIME_SA_ID" --profile "$YC_PROFILE" >/dev/null
ensure_folder_binding storage.editor "$RUNTIME_SA_ID"
yc lockbox secret add-access-binding --id "$LOCKBOX_SECRET_ID" --role lockbox.payloadViewer --service-account-id "$RUNTIME_SA_ID" --profile "$YC_PROFILE" >/dev/null
yc lockbox secret add-access-binding --id "$LOCKBOX_SECRET_ID" --role lockbox.viewer --service-account-id "$DEPLOY_SA_ID" --profile "$YC_PROFILE" >/dev/null
yc container registry add-access-binding --id "$REGISTRY_ID" --role container-registry.images.pusher --service-account-id "$DEPLOY_SA_ID" --profile "$YC_PROFILE" >/dev/null
yc serverless container add-access-binding --id "$CONTAINER_ID" --role serverless-containers.editor --service-account-id "$DEPLOY_SA_ID" --profile "$YC_PROFILE" >/dev/null
yc serverless container add-access-binding --id "$CONTAINER_ID" --role serverless-containers.containerInvoker --service-account-id "$GATEWAY_SA_ID" --profile "$YC_PROFILE" >/dev/null
yc serverless function add-access-binding --id "$JOB_FUNCTION_ID" --role functions.functionInvoker --service-account-id "$GATEWAY_SA_ID" --profile "$YC_PROFILE" >/dev/null
yc iam service-account add-access-binding --id "$RUNTIME_SA_ID" --role iam.serviceAccounts.user --service-account-id "$DEPLOY_SA_ID" --profile "$YC_PROFILE" >/dev/null

gateway_spec=infra/.state/api-gateway.yaml
./scripts/render-api-gateway.sh "$CONTAINER_ID" "$GATEWAY_SA_ID" "$gateway_spec"
API_GATEWAY_ID=${API_GATEWAY_ID:-$(yc_json serverless api-gateway list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $API_GATEWAY_ID ]]; then
  API_GATEWAY_ID=$(yc_json serverless api-gateway create \
    --name "$RESOURCE_NAME" \
    --spec "$gateway_spec" \
    --execution-timeout 60s \
    --folder-id "$FOLDER_ID" | jq -r '.id')
else
  yc serverless api-gateway update --id "$API_GATEWAY_ID" --spec "$gateway_spec" --execution-timeout 60s --folder-id "$FOLDER_ID" --profile "$YC_PROFILE" >/dev/null
fi
gateway_json=$(yc_json serverless api-gateway get --id "$API_GATEWAY_ID" --folder-id "$FOLDER_ID")
API_GATEWAY_DOMAIN=${API_GATEWAY_DOMAIN:-$(jq -r '.domain' <<<"$gateway_json")}
API_GATEWAY_DOMAIN=${API_GATEWAY_DOMAIN%.}
yc serverless api-gateway add-access-binding --id "$API_GATEWAY_ID" --role api-gateway.websocketWriter --service-account-id "$RUNTIME_SA_ID" --profile "$YC_PROFILE" >/dev/null

CERTIFICATE_ID=${CERTIFICATE_ID:-$(yc_json certificate-manager certificate list --folder-id "$FOLDER_ID" | jq -r --arg name "$RESOURCE_NAME" '.[] | select(.name == $name) | .id' | head -n 1)}
if [[ -z $CERTIFICATE_ID ]]; then
  CERTIFICATE_ID=$(yc_json certificate-manager certificate request \
    --name "$RESOURCE_NAME" \
    --domains "$APP_DOMAIN" \
    --challenge dns \
    --deletion-protection \
    --folder-id "$FOLDER_ID" | jq -r '.id')
fi

certificate_json=''
for _ in {1..30}; do
  certificate_json=$(yc_json certificate-manager certificate get --id "$CERTIFICATE_ID" --full --folder-id "$FOLDER_ID")
  if jq -e '.status == "ISSUED" or (.challenges | length > 0)' >/dev/null <<<"$certificate_json"; then
    break
  fi
  sleep 2
done

ensure_dns_record "$APP_DOMAIN." CNAME "$API_GATEWAY_DOMAIN."

certificate_status=$(jq -r '.status' <<<"$certificate_json")
if [[ $certificate_status != ISSUED ]]; then
  challenge=$(jq -c '[.challenges[] | select(.type == "DNS") | .dns_challenge] | sort_by(.type != "CNAME") | first // empty' <<<"$certificate_json")
  challenge_name=$(jq -r '.name // empty' <<<"$challenge")
  challenge_type=$(jq -r '.type // empty' <<<"$challenge")
  challenge_value=$(jq -r '.value // empty' <<<"$challenge")
  if [[ -z $challenge_name || -z $challenge_type || -z $challenge_value ]]; then
    printf 'Certificate Manager did not return a usable DNS challenge. Rerun this script.\n' >&2
    save_state
    exit 3
  fi
  if [[ $challenge_type == TXT ]]; then
    challenge_value="\"$challenge_value\""
  fi
  ensure_dns_record "$challenge_name" "$challenge_type" "$challenge_value"
  for _ in {1..60}; do
    [[ $certificate_status == ISSUED ]] && break
    sleep 10
    certificate_json=$(yc_json certificate-manager certificate get --id "$CERTIFICATE_ID" --full --folder-id "$FOLDER_ID")
    certificate_status=$(jq -r '.status' <<<"$certificate_json")
  done
fi
if [[ $certificate_status != ISSUED ]]; then
  printf 'Certificate status is %s. Rerun this script after DNS validation completes.\n' "$certificate_status" >&2
  save_state
  exit 3
fi

gateway_json=$(yc_json serverless api-gateway get --id "$API_GATEWAY_ID" --folder-id "$FOLDER_ID")
if ! jq -e --arg domain "$APP_DOMAIN" '.. | objects | select(.domain? == $domain)' >/dev/null <<<"$gateway_json"; then
  yc serverless api-gateway add-domain \
    --id "$API_GATEWAY_ID" \
    --domain "$APP_DOMAIN" \
    --certificate-id "$CERTIFICATE_ID" \
    --folder-id "$FOLDER_ID" \
    --profile "$YC_PROFILE" >/dev/null
fi

save_state

printf '\nBootstrap complete. Lockbox contains no BotFather token.\n'
printf 'After creating the GitHub repository, run: ./scripts/configure-github-oidc.sh OWNER/REPOSITORY\n'
printf 'After the first successful main deployment, the exact next command is:\n'
printf './scripts/finalize-production.sh\n'
