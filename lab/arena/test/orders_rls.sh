#!/usr/bin/env bash
# orders_rls.sh - checks lab/arena/agent/SETUP-ORDERS.sql on a throwaway local PostgreSQL (16), with a stand-in for
# Supabase's auth schema (auth.uid() reads request.jwt.claim.sub, like PostgREST sets it) and its roles
# (anon, authenticated, service_role with BYPASSRLS). It never touches the live project.
#   bash lab/arena/test/orders_rls.sh        (needs initdb/pg_ctl, e.g. /usr/lib/postgresql/16/bin; runs as user postgres if root)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SQL="$HERE/../agent/SETUP-ORDERS.sql"
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"; chmod 777 "$TMP"; cp "$SQL" "$TMP/setup.sql"; chmod 644 "$TMP/setup.sql"
AS=""; [ "$(id -u)" = 0 ] && AS="runuser -u postgres --"
PORT=55432
cleanup() { $AS "$BIN/pg_ctl" -D "$TMP/db" -m immediate stop >/dev/null 2>&1; rm -rf "$TMP"; }
trap cleanup EXIT
$AS "$BIN/initdb" -D "$TMP/db" -A trust -U postgres >/dev/null || { echo "initdb failed"; exit 1; }
$AS "$BIN/pg_ctl" -D "$TMP/db" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null || { cat "$TMP/log"; exit 1; }
export PGOPTIONS="-c client_min_messages=error"
PSQL() { $AS "$BIN/psql" -h "$TMP" -p $PORT -U postgres -d postgres -X -q -tA "$@"; }

JARON=19689e52-05ad-4809-ad67-0d8600f02216
OTHER=00000000-0000-0000-0000-00000000beef
PSQL -v ON_ERROR_STOP=1 <<'EOF' || { echo "stub failed"; exit 1; }
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;   -- Supabase's default grants
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
EOF
PSQL -v ON_ERROR_STOP=1 -f "$TMP/setup.sql" || { echo "SETUP-ORDERS.sql failed"; exit 1; }
PSQL -v ON_ERROR_STOP=1 -f "$TMP/setup.sql" || { echo "SETUP-ORDERS.sql is not re-runnable"; exit 1; }

pass=0; fail=0
as() { local role=$1 sub=$2; shift 2; PSQL -c "set role $role; set request.jwt.claim.sub = '$sub';" -c "$*" 2>&1; }
ok()   { local name=$1; shift; if out=$(as "$@") && ! grep -qi "error" <<<"$out"; then echo "PASS  $name"; pass=$((pass+1)); else echo "FAIL  $name: $out"; fail=$((fail+1)); fi; }
deny() { local name=$1; shift; if out=$(as "$@") && ! grep -qi "error" <<<"$out"; then echo "FAIL  $name (it was allowed)"; fail=$((fail+1)); else echo "PASS  $name (refused: $(grep -oi 'ERROR: .*' <<<"$out" | head -1 | cut -c1-70))"; pass=$((pass+1)); fi; }
equals() { local name=$1 want=$2; shift 2; local got; got=$(as "$@" | tail -1); if [ "$got" = "$want" ]; then echo "PASS  $name ($got)"; pass=$((pass+1)); else echo "FAIL  $name: want $want, got $got"; fail=$((fail+1)); fi; }

ok    "Jaron inserts an order"                       authenticated $JARON "insert into public.arena_orders (speaker, kind, team, body) values ('human','follow','a','Follow me')"
ok    "Jaron inserts a go-to with a spot"            authenticated $JARON "insert into public.arena_orders (speaker, kind, team, x, z, body) values ('human','goto','a',-8,5,'Go to')"
deny  "a go-to without a spot"                       authenticated $JARON "insert into public.arena_orders (speaker, kind, team) values ('human','goto','a')"
deny  "Jaron cannot write an 'ai' row"               authenticated $JARON "insert into public.arena_orders (speaker, kind, body) values ('ai','status','fake reply')"
deny  "Jaron cannot fill the AI fields"              authenticated $JARON "insert into public.arena_orders (speaker, kind, ai_key) values ('human','hold','ai-x')"
deny  "Jaron cannot write as another user id"        authenticated $JARON "insert into public.arena_orders (user_id, speaker, kind) values ('$OTHER','human','hold')"
deny  "another signed-in user cannot order"          authenticated $OTHER "insert into public.arena_orders (speaker, kind) values ('human','hold')"
deny  "another user cannot order in Jaron's name"    authenticated $OTHER "insert into public.arena_orders (user_id, speaker, kind) values ('$JARON','human','hold')"
deny  "a guest (anon) cannot order"                  anon "" "insert into public.arena_orders (speaker, kind) values ('human','hold')"
ok    "the AI (service role) writes a status"        service_role "" "insert into public.arena_orders (user_id, speaker, kind, body, ai_name, ai_key, reply_to) values ('$JARON','ai','status','Following.','Mate','ai-mate-1',1)"
equals "Jaron reads all 3 rows"                 3    authenticated $JARON "select count(*) from public.arena_orders"
equals "another signed-in user reads nothing"   0    authenticated $OTHER "select count(*) from public.arena_orders"
deny  "a guest (anon) cannot read"                   anon "" "select count(*) from public.arena_orders"
equals "the service role reads Jaron's orders"  2    service_role "" "select count(*) from public.arena_orders where user_id = '$JARON' and speaker = 'human'"
deny  "Jaron cannot edit a row"                     authenticated $JARON "with u as (update public.arena_orders set body = 'x' returning 1) select count(*) > 0 from u"
deny  "Jaron cannot delete a row"                   authenticated $JARON "with d as (delete from public.arena_orders returning 1) select count(*) > 0 from d"
equals "arena_is_owner() for Jaron"             t    authenticated $JARON "select public.arena_is_owner()"
equals "arena_is_owner() for someone else"      f    authenticated $OTHER "select public.arena_is_owner()"
equals "arena_is_owner() for a guest"           f    anon "" "select public.arena_is_owner()"
equals "the table is in the realtime publication" 1  service_role "" "select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'arena_orders'"
echo "$pass passed, $fail failed"
[ $fail = 0 ]
