import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { RateSnapshot } from "./pricing-types";
const directory = path.join(process.cwd(), ".data");
const file = path.join(directory, "exchange-rates.json");
interface Store {
  tcmb: RateSnapshot | null;
  manualHistory: RateSnapshot[];
}
let queue: Promise<unknown> = Promise.resolve();
export async function readRateStore(): Promise<Store> {
  try {
    const data = JSON.parse(await readFile(file, "utf8"));
    return { tcmb: data.tcmb ?? null, manualHistory: data.manualHistory ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { tcmb: null, manualHistory: [] };
  }
}
export function writeRateStore(rate: RateSnapshot) {
  const operation = queue
    .catch(() => {})
    .then(async () => {
      const store = await readRateStore();
      if (rate.source === "tcmb") store.tcmb = rate;
      else if (rate.source === "manual") store.manualHistory.push(rate);
      await mkdir(directory, { recursive: true });
      const temp = path.join(directory, `rates-${crypto.randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(store, null, 2), "utf8");
      await rename(temp, file);
    });
  queue = operation;
  return operation;
}
