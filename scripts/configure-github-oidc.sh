#!/usr/bin/env bash
set -euo pipefail

readonly STATE_FILE=infra/.env.production.local
readonly FEDERATION_NAME=linka-tasks-github

if (( $# != 1 )) || [[ $1 != */* ]]; then
  printf 'Usage: %s OWNER/REPOSITORY\n' "$0" >&2
  exit 2
fi

github_repository=$1
github_owner=${github_repository%%/*}
github_repo=${github_repository#*/}
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

for command in yc jq gh mktemp; do
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
LOCKBOX_VERSION_ID=${LOCKBOX_VERSION_ID:-}
JOB_FUNCTION_ID=${JOB_FUNCTION_ID:-}
OUTBOX_TRIGGER_ID=${OUTBOX_TRIGGER_ID:-}
RECURRENCES_TRIGGER_ID=${RECURRENCES_TRIGGER_ID:-}
TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-}

: "${FOLDER_ID:?Missing FOLDER_ID in state}"
: "${DEPLOY_SA_ID:?Missing DEPLOY_SA_ID in state}"

audience=https://github.com/$github_owner
github_owner_id=$(gh api "orgs/$github_owner" --jq '.id')
github_repository_id=$(gh api "repos/$github_repository" --jq '.id')
subject="repo:${github_owner}@${github_owner_id}/${github_repo}@${github_repository_id}:environment:production"

federations=$(yc iam workload-identity oidc federation list --folder-id "$FOLDER_ID" --profile default --format json)
FEDERATION_ID=$(jq -r --arg name "$FEDERATION_NAME" '.[] | select(.name == $name) | .id' <<<"$federations" | head -n 1)
if [[ -z $FEDERATION_ID ]]; then
  FEDERATION_ID=$(yc iam workload-identity oidc federation create \
    --name "$FEDERATION_NAME" \
    --issuer https://token.actions.githubusercontent.com \
    --jwks-url https://token.actions.githubusercontent.com/.well-known/jwks \
    --audiences "$audience" \
    --folder-id "$FOLDER_ID" \
    --profile default \
    --format json | jq -r '.id')
fi

credentials=$(yc iam workload-identity federated-credential list \
  --service-account-id "$DEPLOY_SA_ID" \
  --folder-id "$FOLDER_ID" \
  --profile default \
  --format json)
if ! jq -e --arg federation "$FEDERATION_ID" --arg subject "$subject" \
  '.[] | select(.federation_id == $federation and .external_subject_id == $subject)' >/dev/null <<<"$credentials"; then
  yc iam workload-identity federated-credential create \
    --service-account-id "$DEPLOY_SA_ID" \
    --federation-id "$FEDERATION_ID" \
    --external-subject-id "$subject" \
    --folder-id "$FOLDER_ID" \
    --profile default >/dev/null
fi

gh api --method PUT "repos/$github_repository/environments/production" >/dev/null

set_variable() {
  gh variable set "$1" --repo "$github_repository" --body "$2"
}

set_variable YC_CLOUD_ID "$CLOUD_ID"
set_variable YC_FOLDER_ID "$FOLDER_ID"
set_variable YC_REGISTRY_ID "$REGISTRY_ID"
set_variable YC_CONTAINER_ID "$CONTAINER_ID"
set_variable YC_RUNTIME_SA_ID "$RUNTIME_SA_ID"
set_variable YC_DEPLOY_SA_ID "$DEPLOY_SA_ID"
set_variable YC_LOCKBOX_SECRET_ID "$LOCKBOX_SECRET_ID"
set_variable YC_FEDERATION_AUDIENCE "$audience"
set_variable YDB_ENDPOINT "$YDB_ENDPOINT"
set_variable YDB_DATABASE "$YDB_DATABASE"
set_variable OBJECT_STORAGE_BUCKET "$BUCKET_NAME"
set_variable API_GATEWAY_ID "$API_GATEWAY_ID"
if [[ -n $TELEGRAM_BOT_USERNAME ]]; then
  set_variable TELEGRAM_BOT_USERNAME "$TELEGRAM_BOT_USERNAME"
fi

GITHUB_REPOSITORY=$github_repository
YC_FEDERATION_AUDIENCE=$audience
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

printf 'GitHub environment production and OIDC subject configured: %s\n' "$subject"
printf 'Push main to build in GitHub Actions and publish only to YCR.\n'
