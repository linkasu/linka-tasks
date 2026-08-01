#!/usr/bin/env bash
set -euo pipefail

: "${YC_FOLDER_ID:?YC_FOLDER_ID is required}"
: "${YC_CONTAINER_ID:?YC_CONTAINER_ID is required}"
: "${YC_RUNTIME_SA_ID:?YC_RUNTIME_SA_ID is required}"
: "${YC_LOCKBOX_SECRET_ID:?YC_LOCKBOX_SECRET_ID is required}"
: "${YDB_ENDPOINT:?YDB_ENDPOINT is required}"
: "${YDB_DATABASE:?YDB_DATABASE is required}"
: "${OBJECT_STORAGE_BUCKET:?OBJECT_STORAGE_BUCKET is required}"
: "${API_GATEWAY_ID:?API_GATEWAY_ID is required}"

if (( $# != 1 )); then
  printf 'Usage: %s IMAGE_URI\n' "$0" >&2
  exit 2
fi

image_uri=$1
yc_args=(--profile default --folder-id "$YC_FOLDER_ID")
if [[ -n ${YC_IAM_TOKEN:-} ]]; then
  export YC_TOKEN=$YC_IAM_TOKEN
fi

deploy_args=(
  serverless container revision deploy
  --container-id "$YC_CONTAINER_ID"
  --image "$image_uri"
  --service-account-id "$YC_RUNTIME_SA_ID"
  --memory 512MB
  --cores 1
  --core-fraction 100
  --execution-timeout 60s
  --concurrency 16
  --runtime http
  --min-instances 0
  --zone-instances-limit 1
  --environment "NODE_ENV=production,NITRO_HOST=0.0.0.0,PORT=8080,NUXT_YDB_ENDPOINT=$YDB_ENDPOINT,NUXT_YDB_DATABASE=$YDB_DATABASE,NUXT_OBJECT_STORAGE_BUCKET=$OBJECT_STORAGE_BUCKET,NUXT_API_GATEWAY_ID=$API_GATEWAY_ID,NUXT_TELEGRAM_BOT_USERNAME=${TELEGRAM_BOT_USERNAME:-},NUXT_PUBLIC_WEBSOCKET_URL=wss://tasks.nkolinka.ru/api/realtime"
)

secret_json=$(yc lockbox secret get --id "$YC_LOCKBOX_SECRET_ID" "${yc_args[@]}" --format json)
version_id=${LOCKBOX_VERSION_ID_OVERRIDE:-$(jq -r '.current_version.id // empty' <<<"$secret_json")}

if [[ -n $version_id ]]; then
  for binding in \
    telegram-bot-token:NUXT_TELEGRAM_BOT_TOKEN \
    telegram-webhook-secret:NUXT_TELEGRAM_WEBHOOK_SECRET \
    telegram-proxy-secret:NUXT_TELEGRAM_PROXY_SECRET \
    session-secret:NUXT_SESSION_SECRET \
    internal-job-secret:NUXT_INTERNAL_JOB_SECRET \
    object-storage-access-key-id:NUXT_OBJECT_STORAGE_ACCESS_KEY_ID \
    object-storage-secret-access-key:NUXT_OBJECT_STORAGE_SECRET_ACCESS_KEY; do
    key=${binding%%:*}
    environment_variable=${binding#*:}
    deploy_args+=(--secret "id=$YC_LOCKBOX_SECRET_ID,version-id=$version_id,key=$key,environment-variable=$environment_variable")
  done
else
  printf 'Lockbox has no version; deploying without Telegram and storage credentials.\n' >&2
fi

yc "${deploy_args[@]}" "${yc_args[@]}"
