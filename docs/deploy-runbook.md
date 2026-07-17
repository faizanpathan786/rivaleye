# RivalEye Deploy Runbook

How the production deploy works, how to roll back, how to read logs, and the
rules migrations must follow. Topology: a single GCE VM, PM2, no containers.

---

## 1. Layout on the VM

Everything lives under a base dir, default `/home/<user>/rivaleye` (override
with `RIVALEYE_BASE`):

```
rivaleye/
  releases/
    <sha>/            ← one full checkout per deployed commit
    <sha>/            ← previous release, kept for instant rollback
    ...
  shared/
    .env              ← secrets — provisioned ONCE, survives every release
    logs/             ← PM2 logs — survive every release
    deploy.lock       ← flock file guarding concurrent deploys
  current  → releases/<sha>   ← symlink; the live release
```

- Each release is a clean `git archive` of one commit — no `.git`, no shared
  state except the symlinked `.env` and `logs/`.
- PM2's `cwd` for every app is the literal `current` symlink path, never a
  concrete release dir. Deploys move the symlink; PM2 reload re-execs each app
  against the new target. That is what makes releases atomic.

---

## 2. The deploy flow (automated)

Triggered by Cloud Build (`cloudbuild.yaml`) on push:

1. **Archive** — Cloud Build `git archive`s the exact triggering commit
   (`$COMMIT_SHA`) into a tarball. The deploy is pinned to that commit, not to
   whatever HEAD happens to be by the time the VM runs.
2. **Upload** — the tarball and `scripts/vm-bootstrap.sh` (from the same commit)
   are scp'd to `~/rivaleye-deploy-staging/` on the VM over IAP.
3. **Bootstrap** (`vm-bootstrap.sh`) — extracts the tarball into
   `releases/<sha>`, symlinks `shared/.env` and `shared/logs` into it, then
   execs that release's own `deploy.sh`.
4. **deploy.sh** (the vetted per-release script):
   1. Acquires the flock (`shared/deploy.lock`) — overlapping deploys serialize.
   2. `pnpm install --frozen-lockfile` in the new release.
   3. **Gate:** `turbo type-check` then `turbo build` — against the NEW release,
      out-of-line. If either fails, it aborts **without flipping**: the old
      release stays live and unvetted code is never `current`.
   4. Runs `pnpm db:migrate` once (after build, before the flip).
   5. **Flip:** points `current` at the new release and `pm2 reload`s. The old
      release served every request up to this instant — no outage window.
   6. **Health gate:** polls `http://localhost:4000/health` for up to 60s.
      - Healthy (HTTP 200 + `"ok":true`) → prune old releases, done.
      - Unhealthy → flip `current` back to the previous release, reload, verify
        the previous release is healthy, and exit non-zero.

A "stalled" queue is reported with HTTP 200 and is **not** treated as a deploy
failure (a busy worker looks the same as a dead one over a 60s window). Only a
non-200 (e.g. 503 with the DB down) or a missing `"ok":true` fails the gate.

---

## 3. One-time cutover (first switch to this layout)

The old layout ran PM2 apps with `cwd=/home/<user>/rivaleye-v3`. PM2 does **not**
change `cwd`/`script`/`args` on `startOrReload` for apps that already exist, so
the first switch to the `current`-symlink cwd must be done once, manually, on
the VM:

```sh
# 0. Provision the shared .env (once), reusing the old repo's .env:
mkdir -p ~/rivaleye/shared/logs
cp ~/rivaleye-v3/.env ~/rivaleye/shared/.env

# 1. Trigger a normal deploy (push, or gcloud builds submit --substitutions=COMMIT_SHA=<sha>).
#    This creates releases/<sha> and flips `current`, but the pm2 reload will
#    keep the OLD cwd for the pre-existing apps.

# 2. Then, once, force pm2 to pick up the new cwd/args/pinned versions:
pm2 delete all
pm2 start ~/rivaleye/current/ecosystem.config.cjs
pm2 save
```

After this, every subsequent deploy is a plain reload — `cwd` stays the fixed
`current` symlink forever, only its target moves.

---

## 4. Manual rollback

Fastest path — flip the symlink to the previous release and reload:

```sh
# Roll back to the newest release that isn't current:
bash ~/rivaleye/current/scripts/rollback.sh

# Or to a specific commit:
bash ~/rivaleye/current/scripts/rollback.sh <sha>
```

The script flips `current`, runs `pm2 startOrReload ... && pm2 save`, then
health-checks the target and reports. Available releases:

```sh
ls -1dt ~/rivaleye/releases/*/ | sed 's#/*$##;s#.*/##'
```

Manual equivalent (if the script is unavailable):

```sh
ln -sfn ~/rivaleye/releases/<sha> ~/rivaleye/current
pm2 startOrReload ~/rivaleye/current/ecosystem.config.cjs --update-env
pm2 save
```

deploy.sh already auto-rolls-back on a failed health gate; manual rollback is
for problems discovered later (bad behaviour that still returns 200).

---

## 5. Reading logs

PM2 logs live in `shared/logs/` (reached via `current/logs`):

```sh
pm2 status                          # process table
pm2 logs                            # tail all apps
pm2 logs rivaleye-api               # one app
pm2 logs rivaleye-api --err         # errors only
tail -f ~/rivaleye/shared/logs/rivaleye-api-err.log
```

Apps: `rivaleye-api` (:4000), `rivaleye-web` (:4004), `rivaleye-landing`
(:3000), `rivaleye-scrape`, `rivaleye-synth`. Rotation is handled by
`pm2-logrotate` (50M max, 14 files, compressed).

Deploy logs live in Cloud Build history (GCP console / `gcloud builds log`).

---

## 6. Migration rules (READ before shipping a schema change)

Migrations run **once per deploy, after build, before the flip**, forward-only.
During the flip + reload window the **old release is still running against the
already-migrated DB**. Therefore:

- **Every migration must be backward-compatible with the currently-live
  release.** Additive changes (new nullable column, new table, new index) are
  safe. Destructive changes (drop/rename column, narrow a type, add a NOT NULL
  without a default) will break the still-running old code during the flip and
  break rollback afterward.
- **Two-phase rule for destructive changes** — split across two deploys:
  1. **Expand:** add the new shape; make the code write to both old and new and
     read from whichever exists. Deploy. Backfill data.
  2. **Contract:** once no running release depends on the old shape, a later
     deploy drops it.
  Never expand and contract in the same deploy.
- Rollback only recovers *code*, not schema. A rollback after a destructive
  migration will land old code on a migrated DB — another reason destructive
  changes must be two-phased.

---

## 7. Database backup / restore

The DB is **Supabase managed Postgres**; the backup/restore procedure is owned
outside this repo (Supabase automated backups / PITR). This runbook only covers
code deploys.

**Before any destructive migration**, take a manual snapshot first — either a
Supabase dashboard backup or a `pg_dump` of the affected tables:

```sh
pg_dump "$CONNECTION_STRING" -Fc -f rivaleye-pre-migration-$(date +%F).dump
# restore: pg_restore -d "$CONNECTION_STRING" --clean rivaleye-....dump
```

Coordinate with whoever owns the Supabase project before restoring — a restore
is a data-loss event for anything written after the snapshot.

---

## 8. Problem → fix map (why this design)

| # | Old problem | Fix |
|---|---|---|
| 1 | In-place build wiped live static dist mid-serve | Build the new release out-of-line; flip the `current` symlink only after build succeeds |
| 2 | No health gate / no rollback | Poll `/health` post-reload; auto-flip back to the previous release on failure |
| 3 | Failed deploy left unvetted code on disk that PM2/reboot would boot | `current` only ever points at a release that passed type-check + build; a failed gate never flips |
| 4 | `pnpm install` not frozen | `pnpm install --frozen-lockfile` |
| 5 | Frontends via unpinned `npx -y serve`/`http-server` | Pinned `serve@14.2.4` / `http-server@14.1.1` in the npx calls |
| 6 | Two deploys could interleave `git reset --hard` | `flock` on `shared/deploy.lock` around the whole deploy |
| 7 | Deploy raced HEAD, not the triggering commit | `git archive $COMMIT_SHA` → extract that exact SHA into `releases/<sha>` |
