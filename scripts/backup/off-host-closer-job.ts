// Close-only transport. Never activates a credential or reads application rows.
import { Client } from "pg";
import { readFile,writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { closerTarget as target } from "./off-host-closer-package";
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const faults=new WeakMap<Client,{failed:boolean}>();
export type CloserScope={ operation:string; deadline:string; approvedCommit:string; workflowSha256:string; catalogSha256:string; project:string; branch:string; host:string; database:string; actor:string; roleOid:number; userApprovedCloseOnly:boolean };
export function validateCloserScope(input:unknown,commit:string,workflow:string,now=Date.now()):asserts input is CloserScope{
 const s=input as Partial<CloserScope>|null;
 if(!s||s.userApprovedCloseOnly!==true||typeof s.operation!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s.operation)||typeof s.approvedCommit!=='string'||!/^[a-f0-9]{40}$/.test(s.approvedCommit)||s.approvedCommit!==commit||s.workflowSha256!==digest(workflow)||typeof s.catalogSha256!=='string'||!/^[a-f0-9]{64}$/.test(s.catalogSha256)||s.project!==target.project||s.branch!==target.branch||s.host!==target.host||s.database!==target.database||s.actor!=='pusula_closer'||s.roleOid!==98304||typeof s.deadline!=='string'||!Number.isFinite(Date.parse(s.deadline))||Date.parse(s.deadline)-now<30000||Date.parse(s.deadline)-now>600000)throw Error('CLOSER_SCOPE_BLOCKED');
}
export function validateCloserExecution(env:Record<string,string|undefined>,mode:string|undefined){
 if(mode!=='--approved-close-only'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REPOSITORY!=='akinarslan/muhasebe-saas'||env.GITHUB_ACTOR!=='akinarslan'||env.GITHUB_REF!=='refs/heads/main'||env.RUNNER_ENVIRONMENT!=='github-hosted'||env.RUNNER_OS!=='Linux')throw Error('CLOSER_EXECUTION_BLOCKED');
}
export async function closeCatalog(db:Client){
 const q=async(s:string)=>(await db.query(s)).rows;
 // Password material, business rows and migration rows deliberately absent.
 return digest(JSON.stringify({
 roles:await q("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,CASE WHEN rolname='pusula_backup' THEN NULL ELSE rolcanlogin END login,CASE WHEN rolname='pusula_backup' THEN NULL ELSE rolconnlimit END lim,rolconfig FROM pg_roles ORDER BY 1"),
 members:await q("SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2,3"),
 functions:await q("SELECT pronamespace,proname,pronargs,proargtypes::text,prorettype,prokind,provolatile,proparallel,proleakproof,proisstrict,proowner,prosecdef,prosrc,probin,proconfig,proacl::text FROM pg_proc WHERE pronamespace IN('close_gate'::regnamespace,'public'::regnamespace) ORDER BY pronamespace,proname,oid"),
 schemas:await q("SELECT nspname,nspowner,nspacl::text FROM pg_namespace WHERE nspname IN('public','close_gate') ORDER BY 1"),
 tables:await q("SELECT relname,relowner,relacl::text,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY 1"),
 columns:await q("SELECT attrelid,attnum,attacl::text FROM pg_attribute WHERE attrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) AND attacl IS NOT NULL ORDER BY 1,2"),
 defaults:await q("SELECT defaclrole,defaclnamespace,defaclobjtype,defaclacl::text FROM pg_default_acl ORDER BY 1,2,3"),
 databases:await q("SELECT datname,datdba,datacl::text FROM pg_database ORDER BY 1"),
 }));
}
export type CloseTransport={query:(sql:string)=>Promise<{rows:Record<string,unknown>[]}>};
export async function closeInOrder(writer:CloseTransport,independent:CloseTransport,roleOid=98304){
 if(!Number.isSafeInteger(roleOid)||roleOid<1)throw Error('CLOSER_PROOF_OID');
 // Each writer query is a standalone autocommit; caller must provide a fresh connection.
 await writer.query('SELECT close_gate.disable_backup_login()');
 const closed=await independent.query(`SELECT rolcanlogin,rolconnlimit FROM pg_roles WHERE oid=${roleOid} AND rolname='pusula_backup'`);
 if(closed.rows.length!==1||closed.rows[0].rolcanlogin!==false||closed.rows[0].rolconnlimit!==0)throw Error('CLOSER_DISABLE_NOT_PROVEN');
 await writer.query('SELECT close_gate.terminate_backup_sessions()');
 const zero=await independent.query(`SELECT count(*)::int n FROM pg_stat_activity WHERE usesysid=${roleOid}`);
 if(zero.rows[0]?.n!==0)throw Error('CLOSER_SESSION_ZERO_NOT_PROVEN');
}
export function validateCloserDsn(dsn:unknown){
 try{
 const u=new URL(typeof dsn==='string'?dsn:'');
 if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==target.host||u.port!=='5432'||u.pathname!=='/pusula_development'||decodeURIComponent(u.username)!=='pusula_closer'||!u.password||u.search||u.hash)throw Error('CLOSER_DSN_SCOPE');
 decodeURIComponent(u.password);return u;
 }catch{throw Error('CLOSER_DSN_SCOPE');}
}
async function connect(dsn:string){
 const u=validateCloserDsn(dsn);
 const db=new Client({host:target.host,port:5432,database:target.database,user:'pusula_closer',password:decodeURIComponent(u.password),ssl:{rejectUnauthorized:true,servername:target.host,minVersion:'TLSv1.2'},connectionTimeoutMillis:5000,statement_timeout:10000});
 const state={failed:false};faults.set(db,state);db.on('error',()=>{state.failed=true;});db.on('notice',()=>{state.failed=true;});await db.connect();
 const meta=(await db.query("SELECT current_user actor,session_user session_actor,current_database() db,current_setting('server_version_num') v,ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()")).rows[0];
 if(meta?.actor!=='pusula_closer'||meta.session_actor!==meta.actor||meta.db!==target.database||meta.v!=='180006'||meta.ssl!==true){await db.end();throw Error('CLOSER_TLS_IDENTITY');}return db;
}
async function main(){
 // No default execution. Only an independently approved manual workflow can opt in.
 validateCloserExecution(process.env,process.argv[2]);
 const s:CloserScope=JSON.parse(process.env.PUSULA_CLOSE_SCOPE??'null');
 const workflow=await readFile('docs/operations/off-host-closer/closer-workflow.yml.example','utf8');
 validateCloserScope(s,process.env.GITHUB_SHA??'',workflow);
 if(await readFile('.github/workflows/pusula-close-only.yml','utf8')!==workflow)throw Error('CLOSER_RUNNING_WORKFLOW_DRIFT');
 const dsn=process.env.PUSULA_CLOSE_ONLY_DSN;if(!dsn)throw Error('CLOSER_SECRET_MISSING');
 const db=await connect(dsn);let proof:Client|undefined;let active=false;let failed=false;
 const receipt:Record<string,unknown>={operation:s.operation,runId:process.env.GITHUB_RUN_ID,attempt:1,approvedCommit:s.approvedCommit,workflowSha256:s.workflowSha256,deadline:s.deadline,result:'BLOCKED'};
 try{
 if(await closeCatalog(db)!==s.catalogSha256)throw Error('CLOSER_ARM_DRIFT');
 const closed=(await db.query("SELECT oid,rolcanlogin,rolconnlimit FROM pg_roles WHERE oid=98304 AND rolname='pusula_backup'")).rows[0];
 if(!closed||closed.rolcanlogin||closed.rolconnlimit!==0)throw Error('CLOSER_ARM_NOT_CLOSED');
 const lock=parseInt(digest(s.operation).slice(0,7),16)+1000000000;
 await db.query('SELECT pg_advisory_lock($1)',[lock]);
 const arm=(await db.query('SELECT pg_backend_pid() pid,backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid()')).rows[0];
 // Receipt alone is not authorization: activator must independently verify run + DB lock.
 console.log(JSON.stringify({type:'ARM',...receipt,...arm,lock,observedAt:new Date().toISOString()}));active=true;
 const end=performance.now()+Date.parse(s.deadline)-Date.now();
 const requestClose=()=>{failed=true;};process.once('SIGINT',requestClose);process.once('SIGTERM',requestClose);
 while(!failed&&performance.now()<end)await new Promise(r=>setTimeout(r,Math.min(500,Math.max(1,end-performance.now()))));
 proof=await connect(dsn);
 // Proof queries run as independent READ ONLY autocommit transactions.
 await proof.query('SET default_transaction_read_only=on');
 if(await closeCatalog(db)!==s.catalogSha256)throw Error('CLOSER_CLOSE_DRIFT');
 await closeInOrder(db,proof);
 if(await closeCatalog(proof)!==s.catalogSha256)throw Error('CLOSER_POST_DRIFT');
 receipt.result=failed?'BLOCKED':'CLOSE_METADATA_PASS';receipt.closedAt=new Date().toISOString();
 receipt.passwordNullProof='REQUIRES_SEPARATE_PRIVILEGED_READ_ONLY_VERIFIER';
 }finally{
 await Promise.allSettled([db.end(),proof?.end()]);
 if(faults.get(db)?.failed||(proof&&faults.get(proof)?.failed))receipt.result='BLOCKED';
 receipt.armed=active;await writeFile('closer-receipt.json',JSON.stringify(receipt,null,2));
 }
 if(receipt.result!=='CLOSE_METADATA_PASS')throw Error('CLOSER_RECEIPT_BLOCKED');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('GITHUB_CLOSER_BLOCKED');process.exitCode=1;});
