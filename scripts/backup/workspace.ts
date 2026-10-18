import {
  mkdir,
  mkdtemp,
  realpath,
  lstat,
  chmod,
  rm,
  open,
} from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { requireCheck } from "./core";
import { runTool } from "./postgres";

export async function privateRoot() {
  const cwd = await realpath(process.cwd());
  const data = join(cwd, ".data");
  await mkdir(data, { recursive: true, mode: 0o700 });
  requireCheck(
    !(await lstat(data)).isSymbolicLink() && (await realpath(data)) === data,
    "UNSAFE_WORKSPACE",
  );
  const root = join(data, "backups");
  await mkdir(root, { recursive: true, mode: 0o700 });
  requireCheck(
    !(await lstat(root)).isSymbolicLink() && (await realpath(root)) === root,
    "UNSAFE_WORKSPACE",
  );
  await restrict(root);
  return root;
}
export async function restrict(dir: string) {
  if (process.platform === "win32") {
    const identity = await runTool("whoami", ["/user", "/fo", "csv", "/nh"]);
    const sid = identity.match(/S-1-5-[0-9-]+/)?.[0];
    requireCheck(sid, "PRIVATE_ACL_FAILED");
    await runTool("icacls", [dir, "/reset"]);
    await runTool("icacls", [
      dir,
      "/inheritance:r",
      "/grant:r",
      `*${sid}:(OI)(CI)F`,
      "*S-1-5-18:(OI)(CI)F",
    ]);
  } else await chmod(dir, 0o700);
}
export async function scratch(root: string) {
  const dir = await mkdtemp(join(root, "tmp-"));
  await restrict(dir);
  return dir;
}
export async function removeScratch(root: string, dir: string) {
  const rel = relative(await realpath(root), await realpath(dir));
  requireCheck(
    !isAbsolute(rel) &&
      !rel.startsWith("..") &&
      /^tmp-[^/\\]+$/.test(rel) &&
      !(await lstat(dir)).isSymbolicLink(),
    "UNSAFE_CLEANUP_TARGET",
  );
  await rm(dir, { recursive: true });
}
export async function lock(root: string) {
  const path = join(root, "operation.lock");
  const handle = await open(path, "wx", 0o600);
  return async () => {
    await handle.close();
    await rm(path);
  };
}
