import { resolve } from "node:path";
export function fixtureFile(name: string) {
  const id = process.env.PUSULA_LOCAL_FIXTURE;
  if (!/^[a-z0-9-]+\.(enc|json)$/.test(name))
    throw new Error("Fixture filename rejected");
  if (
    id &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)
  )
    throw new Error("Fixture id rejected");
  return resolve(id ? `.data/fixtures/v42-${id}` : ".data", name);
}
