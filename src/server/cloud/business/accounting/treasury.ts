import "server-only";
import type { Tx } from "../catalog";
import { AccessError } from "@/server/authorization/context";
export async function treasuryCommand(tx: Tx, action: string, input: object) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT public.k3_command(${action},${JSON.stringify(input)}::jsonb) id`;
  return { id: rows[0].id };
}
export async function treasuryRead(tx: Tx, view: string, id: string | null) {
  const rows = await tx.$queryRaw<
    { result: unknown }[]
  >`SELECT public.k3_read(${view},${id}::uuid) result`;
  if (rows[0].result === null) throw new AccessError(404, "NOT_FOUND");
  return rows[0].result;
}
