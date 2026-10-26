// Preparation only. No connection, credential loading or apply CLI.
export const closerTarget = {
  project: "icy-queen-44442204", branch: "br-rough-darkness-ba6ow9zo",
  host: "ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech", port: 5432,
  database: "pusula_development", actor: "neondb_owner", roleOid: 98304,
  closedFingerprint: "dda2e9cc48b9544eee527bbaedcb234ccfc9bd5e249b2bce79a3dd217a99455f",
};
export type CloserSqlContext = { database: string; actor: string; roleOid: number };
export type CloserProviderProof={observedAt:string;project:string;branch:string;host:string;database:string;actor:string;version:number;tlsVerified:boolean;httpStatuses:number[];closedFingerprint:string};
// A shape/binding gate, not a signature verifier. Only trusted READ ONLY collectors
// may supply this evidence; arbitrary client JSON is not provider authentication.
export function assertCloserProviderProof(p:CloserProviderProof,now=Date.now()){
 const age=now-Date.parse(p.observedAt);
 if(!Number.isFinite(age)||age<0||age>60000||p.project!==closerTarget.project||p.branch!==closerTarget.branch||p.host!==closerTarget.host||p.database!==closerTarget.database||p.actor!==closerTarget.actor||p.version!==180006||!p.tlsVerified||p.httpStatuses.length!==3||p.httpStatuses.some(s=>s!==200)||p.closedFingerprint!==closerTarget.closedFingerprint)throw Error('CLOSER_PROVIDER_PROOF_BLOCKED');
}
const names = /^[a-z_][a-z_0-9]*$/;
export function closerSql(c: CloserSqlContext) {
  if (!names.test(c.database) || !names.test(c.actor) || !Number.isSafeInteger(c.roleOid) || c.roleOid < 1) throw Error("CLOSER_CONTEXT");
  const guard = `IF current_database() <> '${c.database}' OR session_user <> 'pusula_closer'
 OR current_user <> 'pusula_close_authority'
 OR current_setting('server_version_num') <> '180006'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE oid=${c.roleOid} AND rolname='pusula_backup'
   AND rolbypassrls AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolinherit)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=${c.roleOid})
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='pusula_closer'))
 OR pg_catalog.pg_has_role(current_user,'pg_signal_backend','USAGE')
 THEN RAISE EXCEPTION 'CLOSER_FIXED_IDENTITY_REJECTED' USING ERRCODE='42501'; END IF;`;
  const disable = `BEGIN
 ${guard}
 ALTER ROLE pusula_backup NOLOGIN PASSWORD NULL CONNECTION LIMIT 0;
END`;
  const terminate = `DECLARE b record; n integer := 0;
BEGIN
 ${guard}
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE oid=${c.roleOid} AND (rolcanlogin OR rolconnlimit<>0))
 THEN RAISE EXCEPTION 'CLOSER_LOGIN_NOT_CLOSED' USING ERRCODE='42501'; END IF;
 FOR b IN SELECT pid,backend_start FROM pg_catalog.pg_stat_activity WHERE usesysid=${c.roleOid}
 LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid=b.pid AND usesysid=${c.roleOid} AND backend_start=b.backend_start) THEN
   IF NOT pg_catalog.pg_terminate_backend(b.pid,2000) THEN RAISE EXCEPTION 'CLOSER_TERMINATION_UNCONFIRMED'; END IF;
   n := n+1;
  END IF;
 END LOOP;
 RETURN n;
END`;
  const sql = `-- PREPARATION ONLY. Requires separate provider/TLS attestation and approval.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SELECT pg_advisory_xact_lock(2142044);
DO $pre$ BEGIN
 IF current_database()<>'${c.database}' OR current_user<>'${c.actor}' OR session_user<>'${c.actor}'
 OR current_setting('server_version_num')<>'180006'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=${c.roleOid} AND rolname='pusula_backup' AND NOT rolcanlogin AND rolconnlimit=0 AND rolbypassrls AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolinherit)
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('pusula_close_authority','pusula_closer'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='close_gate')
 OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usesysid=${c.roleOid})
 THEN RAISE EXCEPTION 'CLOSER_INSTALL_PREFLIGHT_REJECTED' USING ERRCODE='42501'; END IF;
END $pre$;
CREATE ROLE pusula_close_authority NOLOGIN PASSWORD NULL NOSUPERUSER NOCREATEDB CREATEROLE INHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0;
CREATE ROLE pusula_closer LOGIN PASSWORD NULL NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 2 VALID UNTIL '1970-01-01 00:00:00+00';
GRANT pusula_backup TO pusula_close_authority WITH ADMIN TRUE, INHERIT TRUE, SET FALSE;
-- Temporary SET edge uses installer as grantor; bootstrap creator ADMIN edge remains.
GRANT pusula_close_authority TO ${c.actor} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY ${c.actor};
CREATE SCHEMA close_gate AUTHORIZATION ${c.actor};
REVOKE ALL ON SCHEMA close_gate FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA close_gate TO pusula_close_authority;
GRANT USAGE ON SCHEMA close_gate TO pusula_closer;
GRANT CONNECT ON DATABASE ${c.database} TO pusula_closer;
SET ROLE pusula_close_authority;
CREATE FUNCTION close_gate.disable_backup_login() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp AS $fn$${disable}$fn$;
CREATE FUNCTION close_gate.terminate_backup_sessions() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp AS $fn$${terminate}$fn$;
REVOKE ALL ON FUNCTION close_gate.disable_backup_login(),close_gate.terminate_backup_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_gate.disable_backup_login(),close_gate.terminate_backup_sessions() TO pusula_closer;
RESET ROLE;
REVOKE CREATE ON SCHEMA close_gate FROM pusula_close_authority;
REVOKE pusula_close_authority FROM ${c.actor} GRANTED BY ${c.actor};
-- STOP: capture on this connection; separate offline validator must PASS.
-- No COMMIT in this artifact. Default terminal action is ROLLBACK.
`;
  return { sql, bodies: { disable_backup_login: disable, terminate_backup_sessions: terminate } };
}
