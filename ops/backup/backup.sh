#!/usr/bin/env bash
# Nightly backup of the production database, one subcommand per workflow step (see docs/backups.md):
#   prepare | dump | restore-check | encrypt | upload | verify-upload | retention | summary | cleanup
# and the weekly check: verify-stored.
#
# This repository and its workflow logs are public. Nothing here prints a URI, key, collection name
# or document count: tool output goes to private files in $BACKUP_WORK and failures are reduced to
# one fixed sentence (cli.js classify-error). Never add `set -x`.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cli() { node "$here/cli.js" "$@"; }

db="${BACKUP_DB:-nabad_production}"
work="${BACKUP_WORK:-${RUNNER_TEMP:-/tmp}/nabad-backup}"
out="$work/out"
public_key="${BACKUP_PUBLIC_KEY_FILE:-$here/backup-public-key.txt}"
restore_uri="${RESTORE_URI:-mongodb://127.0.0.1:27017}"
required_collections="${BACKUP_REQUIRED_COLLECTIONS:-users}"
daily_keep=7
weekly_keep=4

# Runs a tool with its output in a private log. On failure prints only the classified reason.
private() { # step log command...
  local step="$1" log="$2"
  shift 2
  if ! "$@" >"$log" 2>&1; then
    echo "::error::$step failed: $(cli classify-error "$log")"
    return 1
  fi
}

load_names() {
  [ -f "$work/names.env" ] || { echo "::error::run 'prepare' first"; return 1; }
  # shellcheck source=/dev/null
  . "$work/names.env"
}

b2() {
  local endpoint_env
  endpoint_env="$(cli endpoint)"
  local url region
  url="$(sed -n 's/^B2_ENDPOINT_URL=//p' <<<"$endpoint_env")"
  region="$(sed -n 's/^AWS_DEFAULT_REGION=//p' <<<"$endpoint_env")"
  AWS_ACCESS_KEY_ID="$B2_KEY_ID" AWS_SECRET_ACCESS_KEY="$B2_APPLICATION_KEY" AWS_DEFAULT_REGION="$region" \
    AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    AWS_PAGER="" aws --endpoint-url "$url" "$@"
}

# The restore check runs mongorestore --drop, so it must only ever point at a throwaway server.
assert_throwaway_restore() {
  case "$restore_uri" in
    mongodb+srv:* | *mongodb.net*)
      echo "::error::RESTORE_URI must be a throwaway MongoDB, never Atlas"
      return 1
      ;;
  esac
}

# Writes mongosh-stats.js output (STATS_* in the environment) to a private file; errors go to the caller's log.
stats_to() { mongosh --nodb --quiet "$here/mongosh-stats.js" >"$1"; }

sha256_of() { sha256sum "$1" | cut -d' ' -f1; }
size_of() { stat -c %s "$1"; }

cmd_prepare() {
  rm -rf "$work"
  mkdir -p "$out"
  chmod 700 "$work" "$out"
  # BACKUP_NOW lets a local rehearsal backdate a run; the workflow never sets it.
  cli names ${BACKUP_NOW:+--now "$BACKUP_NOW"} >"$work/names.env"
  load_names
  echo "Backup $STAMP started (Sunday copy: $IS_SUNDAY)."
}

cmd_dump() {
  load_names
  : "${BACKUP_MONGODB_URI:?BACKUP_MONGODB_URI is not set}"
  # The URI goes in a private config file, so it never appears in the process list.
  (umask 077 && printf 'uri: "%s"\n' "$BACKUP_MONGODB_URI" >"$work/mongodump.yaml")
  private "mongodump" "$work/dump.log" \
    mongodump --config="$work/mongodump.yaml" --db="$db" --archive="$work/dump.archive.gz" --gzip
  STATS_URI="$BACKUP_MONGODB_URI" STATS_DB="$db" STATS_COUNTS=false \
    private "reading production indexes" "$work/source-stats.log" stats_to "$work/source.json"
  echo "Dump finished: $(size_of "$work/dump.archive.gz") bytes (compressed, not yet encrypted)."
}

cmd_restore_check() {
  load_names
  assert_throwaway_restore
  private "mongorestore" "$work/restore.log" \
    mongorestore --uri="$restore_uri" --archive="$work/dump.archive.gz" --gzip \
    --nsInclude="$db.*" --drop --stopOnError
  STATS_URI="$restore_uri" STATS_DB="$db" STATS_COUNTS=true \
    private "reading the restored copy" "$work/restored-stats.log" stats_to "$work/restored.json"
  cli check --database "$db" --dump-log "$work/dump.log" --restore-log "$work/restore.log" \
    --source "$work/source.json" --restored "$work/restored.json" --required "$required_collections" \
    --created-at "$CREATED_AT" --counts-out "$work/counts.json"
}

cmd_encrypt() {
  load_names
  [ -f "$work/counts.json" ] || { echo "::error::sanity checks have not passed; refusing to encrypt"; return 1; }
  grep -Eq '^age1[02-9ac-hj-np-z]{58}$' "$public_key" || { echo "::error::the backup public key is not a valid age recipient"; return 1; }
  age --encrypt --recipients-file "$public_key" --output "$out/$ARCHIVE_NAME" "$work/dump.archive.gz"
  age --encrypt --recipients-file "$public_key" --output "$out/$COUNTS_NAME" "$work/counts.json"
  cli manifest --created-at "$CREATED_AT" --size "$(size_of "$out/$ARCHIVE_NAME")" --sha256 "$(sha256_of "$out/$ARCHIVE_NAME")" \
    --mongodump "$(mongodump --version | sed -n 's/^mongodump version: //p')" \
    --age "$(age --version)" \
    --restore-mongo "$(node -p 'require(process.argv[1]).serverVersion' "$work/restored.json")" \
    --out "$out/$MANIFEST_NAME"
  echo "Encrypted: $ARCHIVE_NAME, $(size_of "$out/$ARCHIVE_NAME") bytes, SHA-256 $(sha256_of "$out/$ARCHIVE_NAME")"
}

folders() { # daily, plus weekly on Sundays
  echo daily
  if [ "$IS_SUNDAY" = true ]; then echo weekly; fi
}

cmd_upload() {
  load_names
  : "${B2_BUCKET:?B2_BUCKET is not set}"
  local folder file
  for folder in $(folders); do
    # The manifest goes last: a backup counts as complete only when all three files are there.
    for file in "$ARCHIVE_NAME" "$COUNTS_NAME" "$MANIFEST_NAME"; do
      b2 s3 cp --only-show-errors --no-progress "$out/$file" "s3://$B2_BUCKET/$folder/$file"
    done
    echo "Uploaded $STAMP to $folder/."
  done
}

cmd_verify_upload() {
  load_names
  local folder expected
  expected="$(node -p 'require(process.argv[1]).sha256' "$out/$MANIFEST_NAME")"
  for folder in $(folders); do
    rm -f "$work/downloaded.age"
    b2 s3 cp --only-show-errors --no-progress "s3://$B2_BUCKET/$folder/$ARCHIVE_NAME" "$work/downloaded.age"
    if [ "$(sha256_of "$work/downloaded.age")" != "$expected" ]; then
      echo "::error::the uploaded backup in $folder/ does not match its SHA-256"
      return 1
    fi
    echo "Downloaded $folder/$ARCHIVE_NAME again: SHA-256 matches ($expected)."
  done
}

list_versions() { # folder output-file
  b2 s3api list-object-versions --bucket "$B2_BUCKET" --prefix "$1/" --output json >"$2"
  # An empty folder returns nothing at all.
  [ -s "$2" ] || echo '{}' >"$2"
}

cmd_retention() {
  load_names
  local folder keep listing doomed key version count
  for folder in daily weekly; do
    keep=$daily_keep
    [ "$folder" = weekly ] && keep=$weekly_keep
    listing="$work/$folder-versions.json"
    list_versions "$folder" "$listing"
    doomed="$(cli retention --listing "$listing" --keep "$keep" --protect "$STAMP")"
    count=0
    while IFS=$'\t' read -r key version; do
      [ -n "$key" ] || continue
      b2 s3api delete-object --bucket "$B2_BUCKET" --key "$key" --version-id "$version" >/dev/null
      count=$((count + 1))
    done <<<"$doomed"
    echo "$folder/: kept the newest $keep backups, deleted $count old file version(s)."
  done
}

cmd_summary() {
  load_names
  cli summary --manifest "$out/$MANIFEST_NAME" --title "Nightly database backup" --status "Backed up, restore-checked, encrypted and verified" \
    >>"${GITHUB_STEP_SUMMARY:-/dev/stdout}"
}

cmd_cleanup() {
  if [ -d "$work" ]; then
    find "$work" -type f -exec shred --remove --zero {} + 2>/dev/null || true
    rm -rf "$work"
  fi
  # The restored copy only ever lives in the throwaway MongoDB, but drop it anyway.
  if assert_throwaway_restore >/dev/null && command -v mongosh >/dev/null; then
    mongosh --quiet "$restore_uri" --eval "db.getSiblingDB('$db').dropDatabase()" >/dev/null 2>&1 || true
  fi
  echo "Removed plaintext files from the runner."
}

cmd_verify_stored() {
  : "${B2_BUCKET:?B2_BUCKET is not set}"
  rm -rf "$work"
  mkdir -p "$work"
  chmod 700 "$work"
  list_versions daily "$work/daily.json"
  list_versions weekly "$work/weekly.json"
  local plan NEWEST_STAMP PREVIOUS_STAMP args=()
  plan="$(cli verify-plan --listing "$work/daily.json")"
  NEWEST_STAMP="$(sed -n 's/^NEWEST_STAMP=//p' <<<"$plan")"
  PREVIOUS_STAMP="$(sed -n 's/^PREVIOUS_STAMP=//p' <<<"$plan")"
  if [ -n "$NEWEST_STAMP" ]; then
    b2 s3 cp --only-show-errors --no-progress "s3://$B2_BUCKET/daily/nabad-$NEWEST_STAMP.manifest.json" "$work/newest.manifest.json"
    b2 s3 cp --only-show-errors --no-progress "s3://$B2_BUCKET/daily/nabad-$NEWEST_STAMP.archive.gz.age" "$work/newest.age"
    args+=(--newest-manifest "$work/newest.manifest.json" --sha256 "$(sha256_of "$work/newest.age")" --size "$(size_of "$work/newest.age")")
  fi
  if [ -n "$PREVIOUS_STAMP" ]; then
    b2 s3 cp --only-show-errors --no-progress "s3://$B2_BUCKET/daily/nabad-$PREVIOUS_STAMP.manifest.json" "$work/previous.manifest.json"
    args+=(--previous-manifest "$work/previous.manifest.json")
  fi
  cli verify --daily "$work/daily.json" --weekly "$work/weekly.json" "${args[@]}"
  cli summary --manifest "$work/newest.manifest.json" --title "Weekly backup verification" \
    --status "Newest backup fresh, checksum matches, retention correct" --checked-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    >>"${GITHUB_STEP_SUMMARY:-/dev/stdout}"
  rm -rf "$work"
}

case "${1:-}" in
  prepare) cmd_prepare ;;
  dump) cmd_dump ;;
  restore-check) cmd_restore_check ;;
  encrypt) cmd_encrypt ;;
  upload) cmd_upload ;;
  verify-upload) cmd_verify_upload ;;
  retention) cmd_retention ;;
  summary) cmd_summary ;;
  cleanup) cmd_cleanup ;;
  verify-stored) cmd_verify_stored ;;
  *)
    echo "usage: backup.sh prepare|dump|restore-check|encrypt|upload|verify-upload|retention|summary|cleanup|verify-stored" >&2
    exit 2
    ;;
esac
