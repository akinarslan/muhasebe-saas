export type ReceiptOutcome = { state: "SUCCEEDED" | "NOT_COMMITTED" };
export class ReceiptRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const unknownReceiptOutcome =
  "İşlem sonucu doğrulanamadı; kayıt durumunu kontrol edin.";
// A read may resolve a lost response; it never sends another mutation.
export async function reconcileReceiptAction(
  error: unknown,
  read: () => Promise<ReceiptOutcome>,
): Promise<"SUCCEEDED" | "NOT_COMMITTED" | "UNKNOWN" | "SERVER_ERROR"> {
  if (error instanceof ReceiptRequestError && error.status < 500)
    return "SERVER_ERROR";
  try {
    const outcome = await read();
    return outcome.state === "SUCCEEDED" || outcome.state === "NOT_COMMITTED"
      ? outcome.state
      : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
