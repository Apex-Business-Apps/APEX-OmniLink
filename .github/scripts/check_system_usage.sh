#!/usr/bin/env bash
set -euo pipefail

write_output() {
  local key=$1
  local value=$2
  echo "${key}=${value}" >> "${GITHUB_OUTPUT:-/dev/null}"
  return 0
}

normalize_bool() {
  case "${1:-}" in
    true|TRUE|True|1|yes|YES|Yes) echo "true" ;;
    *) echo "false" ;;
  esac
  return 0
}

FORCE_EVAL=$(normalize_bool "${FORCE_EVAL:-false}")
USAGE_LOOKBACK_HOURS=${USAGE_LOOKBACK_HOURS:-24}
USAGE_TABLE=${USAGE_TABLE:-}
SUPABASE_URL=${SUPABASE_URL:-}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}
SANDBOX_HEALTHCHECK_URL=${SANDBOX_HEALTHCHECK_URL:-}

if [ "$FORCE_EVAL" = "true" ]; then
  write_output should_run true
  write_output reason forced
  write_output count -1
  exit 0
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  write_output should_run false
  write_output reason no_secrets
  write_output count 0
  exit 0
fi

iso_since=$(date -u -d "-${USAGE_LOOKBACK_HOURS} hours" +"%Y-%m-%dT%H:%M:%SZ")

read_count_from_headers() {
  local headers_file=$1
  local content_range
  content_range=$(grep -i "^content-range:" "$headers_file" | awk '{print $2}' | tr -d '\r')
  if [ -n "$content_range" ] && [[ "$content_range" == */* ]]; then
    echo "${content_range##*/}"
    return 0
  fi
  return 1
}

response_has_rows() {
  local body_file=$1
  if [ ! -s "$body_file" ]; then
    echo 0
    return 0
  fi
  local body
  body=$(tr -d '[:space:]' < "$body_file")
  if [ "$body" = "[]" ]; then
    echo 0
  else
    echo 1
  fi
}

check_table() {
  local table=$1
  local headers_file
  local body_file
  headers_file=$(mktemp)
  body_file=$(mktemp)

  local status
  status=$(curl -sS -D "$headers_file" -o "$body_file" -w "%{http_code}" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Prefer: count=exact" \
    "$SUPABASE_URL/rest/v1/$table?select=id&limit=1&created_at=gte.$iso_since")

  if [ "$status" = "404" ]; then
    rm -f "$headers_file" "$body_file"
    return 2
  fi

  if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
    rm -f "$headers_file" "$body_file"
    return 3
  fi

  local count
  if count=$(read_count_from_headers "$headers_file"); then
    :
  else
    count=$(response_has_rows "$body_file")
  fi

  rm -f "$headers_file" "$body_file"
  echo "$count"
  return 0
}

healthcheck_fallback() {
  if [ -z "$SANDBOX_HEALTHCHECK_URL" ]; then
    return 1
  fi
  local status
  status=$(curl -sS -o /dev/null -w "%{http_code}" "$SANDBOX_HEALTHCHECK_URL")
  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    write_output should_run true
    write_output reason used
    write_output count -1
    return 0
  fi

  write_output should_run false
  write_output reason healthcheck_failed
  write_output count 0
  return 0
}

if [ -n "$USAGE_TABLE" ]; then
  if count=$(check_table "$USAGE_TABLE"); then
    if [ "$count" -gt 0 ]; then
      write_output should_run true
      write_output reason used
      write_output count "$count"
    else
      write_output should_run false
      write_output reason no_activity
      write_output count 0
    fi
    exit 0
  else
    result=$?
    if [ "$result" -eq 2 ]; then
      if healthcheck_fallback; then
        exit 0
      fi
      write_output should_run false
      write_output reason table_not_found
      write_output count 0
      exit 0
    fi

    write_output should_run false
    write_output reason unreachable
    write_output count 0
    exit 0
  fi
fi

candidate_tables=(agent_runs tool_invocations skill_matches eval_results)
for table in "${candidate_tables[@]}"; do
  if count=$(check_table "$table"); then
    if [ "$count" -gt 0 ]; then
      write_output should_run true
      write_output reason used
      write_output count "$count"
    else
      write_output should_run false
      write_output reason no_activity
      write_output count 0
    fi
    exit 0
  else
    result=$?
    if [ "$result" -eq 2 ]; then
      continue
    fi
    if [ "$result" -eq 3 ]; then
      write_output should_run false
      write_output reason unreachable
      write_output count 0
      exit 0
    fi
  fi
done

if healthcheck_fallback; then
  exit 0
fi

write_output should_run false
write_output reason table_not_found
write_output count 0
