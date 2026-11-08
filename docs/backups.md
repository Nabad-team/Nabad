# Database backups

MongoDB Atlas's free M0 cluster has no built-in backups, so we take our own. Every night a GitHub Actions workflow dumps the production database, restores the dump into a throwaway MongoDB to prove it's usable, encrypts it and stores it in a private Backblaze B2 bucket in the EU. A second workflow checks the stored backups every week without decrypting them.

- Nightly backup: [.github/workflows/db-backup.yml](../.github/workflows/db-backup.yml)
- Weekly verification: [.github/workflows/db-backup-verify.yml](../.github/workflows/db-backup-verify.yml)
- Scripts, logic and tests: [ops/backup/](../ops/backup) (`node --test "ops/backup/tests/*.test.js"`, run in CI by the "Backup tooling" job)

## What is backed up, and when

| | |
| --- | --- |
| Database | `nabad_production` on the Atlas cluster "Nabad" (Frankfurt, MongoDB 8.0): every collection and its indexes |
| When | Every night at 01:00 UTC. GitHub can start scheduled runs late when it's busy. Anyone with write access can also run it from the Actions tab ("Database Backup", Run workflow) |
| Recovery point (RPO) | 24 hours: at worst we lose the last day of changes |
| Where | Private Backblaze B2 bucket in EU Central (the `B2_BUCKET` secret), under `daily/` and `weekly/` |
| Retention | The newest 7 nightly backups in `daily/`, plus the Sunday backup of the last 4 weeks in `weekly/`. So the oldest backup we hold is about 35 days old |

A nightly run does this, and stops at the first failure:

1. `mongodump --archive --gzip` of `nabad_production`, with a read-only database user (`BACKUP_MONGODB_URI`, `read` on `nabad_production` only).
2. Restores the archive into a throwaway MongoDB 7.0 container on the runner and checks it: the same collections as production, exactly the same document count per collection as the dump, the same indexes as production, and `users` present and not empty.
3. Only if every check passes, encrypts the archive with [age](https://age-encryption.org) to our public key.
4. Uploads three files to `daily/` (and on Sundays to `weekly/` too), downloads the backup again and checks its SHA-256.
5. Deletes backups beyond the retention limits, including every old version B2 keeps of them.
6. Shreds every plaintext file on the runner.

Each backup is three files with the same UTC timestamp:

| File | Contents | Encrypted |
| --- | --- | --- |
| `nabad-20261108T010007Z.archive.gz.age` | The database dump | Yes |
| `nabad-20261108T010007Z.counts.json.age` | Document count per collection, for checking a restore | Yes |
| `nabad-20261108T010007Z.manifest.json` | Timestamp, size and SHA-256 of the encrypted dump, tool versions. No collection names or counts | No |

The repository, its workflow logs and its issues are public, so the workflows only ever print status, sizes, timestamps and SHA-256 checksums. Tool output that could name collections or show counts goes to private files on the runner that are shredded at the end. Never add `set -x` to the scripts, never upload backup files as workflow artifacts, and keep it that way when debugging. Reproduce a problem on your own machine against a local database instead.

## Encryption and the private key

Backups are encrypted with age to the public key in [ops/backup/backup-public-key.txt](../ops/backup/backup-public-key.txt). CI only has the public key, so it can create backups but can never read them.

**Gerges Badran holds the private key, offline.** It isn't in GitHub, Render, Vercel or the B2 bucket. Without it no backup can be restored, so if you're the one who needs to restore, Gerges has to decrypt the file or be there while you do. If the private key is ever lost, every existing backup is unreadable: generate a new key pair, commit the new public key and run the backup workflow straight away.

## Restoring a backup

Restore into a **new** database first, check it, and only then replace production. You need the private key, the B2 credentials, and an Atlas user that can write (the backup user is read-only). The [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools), [mongosh](https://www.mongodb.com/try/download/shell), [age](https://github.com/FiloSottile/age/releases) and the AWS CLI must be installed.

1. **Pick the backup.** List what's there and choose a timestamp (`daily/` for the last week, `weekly/` for older):

   ```bash
   export AWS_ACCESS_KEY_ID=<B2 key id> AWS_SECRET_ACCESS_KEY=<B2 application key>
   export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
   B2=https://s3.eu-central-003.backblazeb2.com   # the B2_ENDPOINT secret
   aws s3 ls s3://<bucket>/daily/ --endpoint-url $B2
   ```

2. **Download it and check it.** The SHA-256 must match `sha256` in the manifest:

   ```bash
   STAMP=20261108T010007Z
   for f in archive.gz.age counts.json.age manifest.json; do
     aws s3 cp s3://<bucket>/daily/nabad-$STAMP.$f . --endpoint-url $B2
   done
   sha256sum nabad-$STAMP.archive.gz.age
   cat nabad-$STAMP.manifest.json
   ```

3. **Decrypt** with the private key. Do this on a trusted machine and delete the plaintext files when you're done:

   ```bash
   age -d -i ~/path/to/nabad-backup-key.txt -o nabad-$STAMP.archive.gz nabad-$STAMP.archive.gz.age
   age -d -i ~/path/to/nabad-backup-key.txt -o nabad-$STAMP.counts.json nabad-$STAMP.counts.json.age
   ```

4. **Restore into a new database**, `nabad_restore`, never straight into `nabad_production`:

   ```bash
   mongorestore --uri "<Atlas URI of a user that can write>" --archive=nabad-$STAMP.archive.gz --gzip \
     --nsInclude='nabad_production.*' --nsFrom='nabad_production.*' --nsTo='nabad_restore.*'
   ```

5. **Verify.** Every count in `nabad-$STAMP.counts.json` must match:

   ```bash
   mongosh "<same URI>" --quiet --eval '
     const r = db.getSiblingDB("nabad_restore");
     r.getCollectionNames().sort().forEach((c) => print(c, r.getCollection(c).countDocuments({})));'
   ```

   Spot-check a few records you know, such as your own account, and check the indexes with `getIndexes()`.

6. **Switch.** The API refuses to start if `MONGO_DB_NAME` isn't `nabad_production` in production, so we copy the verified data back instead of pointing the API at `nabad_restore`:
   1. Suspend the API service on Render so nothing writes during the switch.
   2. Take a fresh dump of the current `nabad_production` with `mongodump` and keep it until the restore is confirmed, in case you need to undo.
   3. Restore the same archive over production: `mongorestore --uri "<URI>" --archive=nabad-$STAMP.archive.gz --gzip --nsInclude='nabad_production.*' --drop`
   4. **Re-apply deletions.** The backup brings back every account and record that existed when it was taken, including accounts deleted since then. Nabad keeps no list of deleted accounts, so compare the two copies: an account that is in the backup but not in the dump you took in step 2 was deleted after the backup. Delete each of those again, together with its data, before you resume the service. If production was lost and there's no fresh dump to compare with, we can't tell which accounts were deleted in that window. Say so in the incident notes and handle deletion requests that come in by email.
   5. Resume the API on Render, check that https://nabad-psi.vercel.app/api/health/ready says ready, and sign in.
   6. Drop `nabad_restore` and delete the decrypted files.

**Versions.** Atlas runs MongoDB 8.0, but the nightly restore check uses MongoDB 7.0 (the version our `docker-compose.yml` uses), because GitHub's runners can't run 8.0. MongoDB calls restoring an 8.0 dump into 7.0 "unsupported" and `mongorestore` warns about it. Our checks pass, and we tested it with collections that use unique, compound, 2dsphere, text, TTL, partial, sparse and collation indexes. Still, the nightly check proves the dump is complete and readable, not that every 8.0 detail survives a 7.0 server. A real restore goes back into Atlas, which is 8.0, so it doesn't have this gap. The monthly drill below restores into MongoDB 8.0 as well, in a local container.

## Monthly decryption drill

A backup we've never decrypted isn't a backup. Once a month, Gerges (or someone sitting with Gerges, since it needs the private key) restores the newest backup on the key holder's own computer, into a throwaway MongoDB 8.0 container. **The drill never touches the production Atlas cluster:** no connection string, no Atlas user, nothing is written there.

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) running, [age](https://github.com/FiloSottile/age/releases) (`winget install FiloSottile.age`) and the private key file. The MongoDB tools come with the container image, so nothing else needs installing. The commands are for PowerShell.

1. **Make a working folder** outside any git repository, so decrypted data can never be committed:

   ```powershell
   $Drill = "$HOME\nabad-drill"
   New-Item -ItemType Directory -Force $Drill | Out-Null
   ```

2. **Download the newest backup.** In the Backblaze web UI, open the bucket (Buckets → Browse Files) and the `daily/` folder. Pick the newest timestamp and download its three files: `nabad-<timestamp>.archive.gz.age`, `nabad-<timestamp>.counts.json.age` and `nabad-<timestamp>.manifest.json`. Move them from your Downloads folder into `$Drill`.

3. **Check the SHA-256** against the manifest. The manifest is plain JSON:

   ```powershell
   $Stamp = "20261108T010007Z"   # the timestamp you downloaded
   $Manifest = Get-Content "$Drill\nabad-$Stamp.manifest.json" -Raw | ConvertFrom-Json
   $Hash = (Get-FileHash "$Drill\nabad-$Stamp.archive.gz.age" -Algorithm SHA256).Hash.ToLower()
   if ($Hash -ne $Manifest.sha256) { throw "SHA-256 does not match the manifest: stop and open an issue" }
   "SHA-256 OK, backup taken $($Manifest.createdAt)"
   ```

   `createdAt` should be from last night.

4. **Decrypt** the backup and its counts file with the private key:

   ```powershell
   age -d -i C:\path\to\nabad-backup-key.txt -o "$Drill\nabad.archive.gz" "$Drill\nabad-$Stamp.archive.gz.age"
   age -d -i C:\path\to\nabad-backup-key.txt -o "$Drill\counts.json" "$Drill\nabad-$Stamp.counts.json.age"
   ```

5. **Start a throwaway MongoDB 8.0** (the same pinned image as our local rehearsal). It publishes no ports, so nothing outside the container can reach it, and `$Drill` is mounted read-only:

   ```powershell
   docker run -d --name nabad-drill -v "${Drill}:/drill:ro" mongo:8.0.32@sha256:d0d926f94df099bff534b7ee5b5986458131a22489dfff8664509af0c1e2ca9c
   do { Start-Sleep 2; $Ready = docker exec nabad-drill mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok" 2>$null } until ($Ready -eq "1")
   ```

6. **Restore** the archive into the container:

   ```powershell
   docker exec nabad-drill mongorestore --archive=/drill/nabad.archive.gz --gzip --nsInclude="nabad_production.*" --nsFrom="nabad_production.*" --nsTo="nabad_restore.*" --stopOnError
   ```

   It must end with `0 document(s) failed to restore`. If an index can't be built, mongorestore stops with an error.

7. **Run the sanity checks** that the nightly workflow runs: the same collections as the counts file, exactly the same number of documents in each, indexes restored, and `users` present and not empty. This writes a small check script into `$Drill` and runs it in the container:

   ```powershell
   @'
   const expected = JSON.parse(require("fs").readFileSync("/drill/counts.json", "utf8")).collections;
   const r = db.getSiblingDB("nabad_restore");
   const restored = r.getCollectionNames().filter((c) => !c.startsWith("system.")).sort();
   const problems = [];
   if (JSON.stringify(restored) !== JSON.stringify(Object.keys(expected).sort())) problems.push("the collection list differs from the counts file");
   for (const c of Object.keys(expected).sort()) {
     const n = r.getCollection(c).countDocuments({});
     const indexes = r.getCollection(c).getIndexes().map((i) => i.name);
     print(`${c}: ${n} documents (counts file: ${expected[c]}), indexes: ${indexes.join(", ")}`);
     if (n !== expected[c]) problems.push(`${c}: document count differs`);
   }
   if (!(r.getCollection("users").countDocuments({}) > 0)) problems.push("users is missing or empty");
   print(problems.length ? "DRILL FAILED:\n- " + problems.join("\n- ") : "DRILL PASSED");
   '@ | Set-Content "$Drill\check.js" -Encoding ascii
   docker exec nabad-drill mongosh --quiet /drill/check.js
   ```

   It must print `DRILL PASSED`. Look over the index names too: every collection should have the indexes its model defines, not just `_id_`. This output names collections and shows counts, so keep it on your screen. Never paste it into an issue, chat or sprint notes.

8. **Clean up.** Remove the container together with its data volume, then delete the folder with every decrypted and downloaded file:

   ```powershell
   docker rm -f -v nabad-drill
   Remove-Item -Recurse -Force $Drill
   ```

9. **Write it down.** Note the date, the backup timestamp and "passed" in the sprint notes. If anything failed, open an issue saying which step failed (no data, counts or collection names) and fix it before the next drill.

## When a backup-failure issue opens

If either workflow fails, it opens an issue labelled `backup-failure` with a link to the run and the step that failed, or comments on the open one. The next successful run closes it. While it's open, we may have no fresh backup.

1. Open the run link and look at the failed step's error. It's one sentence on purpose. Common causes:
   - **Dump: "could not reach the database"**: Atlas network access no longer allows GitHub's runners (see below), or Atlas is down.
   - **Dump: "authentication failed"**: the backup user or the `BACKUP_MONGODB_URI` secret changed.
   - **Restore check failed**: the dump and the restored copy differ, or `users` was empty. Treat this as serious: nothing was uploaded that night. Check production is healthy before anything else.
   - **Upload, verify or retention**: B2 credentials, bucket or endpoint changed, or the B2 key lost a capability (it needs to list, read, write and delete files).
   - **Weekly verification**: the newest backup is older than 26 hours (nightly runs stopped), its checksum doesn't match its manifest, it shrank below half of the previous backup, or retention left too many files. A big drop in size can mean lost data in production, so check that first.
2. Fix the cause, then run "Database Backup" by hand from the Actions tab. When it succeeds, the issue closes itself. If it was the verification, run "Database Backup Verification" afterwards.
3. Never paste data, counts, collection names, connection strings or keys into the issue. It's public.

## Things that silently stop backups

- **GitHub disables scheduled workflows in public repositories after 60 days without repository activity.** If nobody pushes for two months, the nightly backup simply stops (and so does the weekly check, so no issue opens). If the project goes quiet, re-enable the workflows from the Actions tab, or push a commit at least every 60 days.
- **Atlas network access.** GitHub's runners connect from changing IP addresses, so Atlas currently allows `0.0.0.0/0` (the database password still protects it). If we restrict network access, backups fail until GitHub's runner addresses (or a fixed-IP runner) are allowed.
- **Scheduled workflows only run from `main`.** Changes to the workflows on a branch don't take effect until they're merged.

## Deleted accounts and privacy

Deleting an account removes it from the database straight away, but encrypted copies stay in backups until those backups expire, up to about 35 days. The [privacy policy](../frontend/pages/privacy.js) says so. Restoring an old backup brings deleted accounts back, so step 6.4 of the restore is not optional.

## Changing versions or the key

- Tool versions and checksums live in [ops/backup/versions.env](../ops/backup/versions.env); the restore-check image is also pinned in the backup workflow and a test makes sure the two match. We use exact versions released at least two weeks before we pin them, and every download is checked against its SHA-256.
- To rotate the key: Gerges generates a new pair with `age-keygen`, commits the new public key and keeps the old private key until the last backup made with it has expired (35 days).
