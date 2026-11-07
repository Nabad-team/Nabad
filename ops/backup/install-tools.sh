#!/usr/bin/env bash
# Installs the pinned MongoDB Database Tools, mongosh and age (versions.env) into $TOOLS_DIR/bin,
# after checking each download's SHA-256. On GitHub Actions the directory is added to PATH.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=versions.env
. "$here/versions.env"

tools_dir="${TOOLS_DIR:-${RUNNER_TEMP:-/tmp}/backup-tools}"
mkdir -p "$tools_dir/bin"
downloads="$(mktemp -d)"
trap 'rm -rf "$downloads"' EXIT

fetch() { # url sha256 file
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --retry 3 -o "$downloads/$3" "$1"
  echo "$2  $downloads/$3" | sha256sum --check --quiet
  echo "Verified $3"
}

fetch "https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2404-x86_64-${MONGODB_TOOLS_VERSION}.tgz" \
  "$MONGODB_TOOLS_SHA256" tools.tgz
fetch "https://downloads.mongodb.com/compass/mongosh-${MONGOSH_VERSION}-linux-x64.tgz" "$MONGOSH_SHA256" mongosh.tgz
fetch "https://github.com/FiloSottile/age/releases/download/${AGE_VERSION}/age-${AGE_VERSION}-linux-amd64.tar.gz" \
  "$AGE_SHA256" age.tgz

for archive in tools mongosh age; do
  mkdir "$downloads/$archive"
  tar -xzf "$downloads/$archive.tgz" -C "$downloads/$archive" --strip-components=1
done
install -m 0755 "$downloads/tools/bin/mongodump" "$downloads/tools/bin/mongorestore" "$tools_dir/bin/"
install -m 0755 "$downloads/mongosh/bin/mongosh" "$tools_dir/bin/"
install -m 0755 "$downloads/age/age" "$tools_dir/bin/"

if [ -n "${GITHUB_PATH:-}" ]; then echo "$tools_dir/bin" >> "$GITHUB_PATH"; fi
"$tools_dir/bin/mongodump" --version | head -n 1
echo "mongosh $("$tools_dir/bin/mongosh" --version)"
echo "age $("$tools_dir/bin/age" --version)"
