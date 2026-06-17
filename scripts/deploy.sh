#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

umask 077

validate_compose_config
"${COMPOSE[@]}" build --pull
bash ./scripts/migrate.sh
"${COMPOSE[@]}" up -d backend frontend
"${COMPOSE[@]}" ps
