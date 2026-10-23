type Scope = { legalEntityId: string; activityId: string | null };
export const salePendingKey = (s: Scope) =>
  `pusula.sale.pending:${s.legalEntityId}:${s.activityId ?? ""}`;
async function call(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/cloud/workspace/${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await r.json();
  if (!r.ok) throw Error(value.error ?? "SALE_REJECTED");
  return value;
}
export async function saleOutcome(scope: Scope, id: string, close = false) {
  return close
    ? call("finance/cancel-intent", "POST", { ...scope, intentId: id })
    : call(
        `finance/outcome/${id}?company=${scope.legalEntityId}${scope.activityId ? `&activity=${scope.activityId}` : ""}`,
      );
}
// Store only the opaque server reference. Never persist financial payloads/balances.
export async function submitTrackedSale<T extends { idempotencyKey: string }>(
  scope: Scope,
  body: T,
  onPending: (id: string) => void,
) {
  const key = salePendingKey(scope),
    pending = sessionStorage.getItem(key);
  if (pending) {
    onPending(pending);
    throw Error("Önce bekleyen satışın sonucunu referansla sorgulayın.");
  }
  const intent = await call("finance/intents", "POST", {
    ...scope,
    kind: "SALE",
    clientKey: body.idempotencyKey,
  });
  sessionStorage.setItem(key, intent.id);
  onPending(intent.id);
  const result = await call("sales", "POST", {
    ...body,
    sourceRef: `intent:${intent.id}`,
  });
  sessionStorage.removeItem(key);
  onPending("");
  return result;
}
