#!/usr/bin/env bash
set -euo pipefail

if (( $# != 3 )); then
  printf 'Usage: %s CONTAINER_ID GATEWAY_SA_ID OUTPUT\n' "$0" >&2
  exit 2
fi

container_id=$1
gateway_sa_id=$2
output=$3
repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
template=$(<"$repo_root/infra/api-gateway.yaml.tpl")

if [[ ! $container_id =~ ^[a-z0-9]+$ || ! $gateway_sa_id =~ ^[a-z0-9]+$ ]]; then
  printf 'Container and service account IDs contain unexpected characters.\n' >&2
  exit 1
fi

rendered=${template//__CONTAINER_ID__/$container_id}
rendered=${rendered//__GATEWAY_SA_ID__/$gateway_sa_id}
printf '%s\n' "$rendered" >"$output"
