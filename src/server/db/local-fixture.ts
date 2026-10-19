import { readFileSync, realpathSync, lstatSync } from "node:fs";
import { resolve, join } from "node:path";

// Opt-in local synthetic test target. This never accepts a remote endpoint or production.
// The runner creates a new UUID cluster and marker before starting any application child.
export function localFixtureTarget(url: URL, test: boolean, direct: boolean) {
  const id = process.env.PUSULA_LOCAL_FIXTURE;
  if (!id) return false;
  const reject = () => {
    throw new Error("Local fixture target rejected.");
  };
  if (
    process.env.NODE_ENV === "production" ||
    !test ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)
  )
    return reject();
  const root = resolve(".data/fixtures", `v42-${id}`);
  try {
    if (lstatSync(root).isSymbolicLink() || realpathSync(root) !== root)
      return reject();
    const file = join(root, "target.json");
    if (lstatSync(file).isSymbolicLink()) return reject();
    const marker = JSON.parse(readFileSync(file, "utf8"));
    if (
      marker.id !== id ||
      marker.host !== "127.0.0.1" ||
      marker.database !== "pusula_sprint_b_test" ||
      marker.dataDirectory !== join(root, "data") ||
      !Number.isInteger(marker.port) ||
      marker.port < 1024 ||
      marker.port > 65535
    )
      return reject();
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== marker.host ||
      url.port !== String(marker.port) ||
      url.pathname !== "/pusula_sprint_b_test" ||
      !url.password ||
      url.hash ||
      [...url.searchParams.keys()].some((k) => k !== "sslmode") ||
      url.searchParams.get("sslmode") !== "disable" ||
      !(
        direct ? ["fixture_admin"] : ["pusula_test_runtime", "pusula_test_auth"]
      ).includes(url.username)
    )
      return reject();
  } catch {
    return reject();
  }
  return true;
}
