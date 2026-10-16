import "server-only";
import { activeSession, identity } from "./core";
export async function requireMfa(
  headers: Headers,
  stepUp = false,
  source = identity(),
) {
  const session = await activeSession(headers, source);
  if (!session) throw new Error("UNAUTHENTICATED");
  const [user, stored] = await Promise.all([
    source.db.authUser.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
    source.db.authSession.findUnique({
      where: { id: session.session.id },
      select: { mfaVerifiedAt: true, stepUpAt: true },
    }),
  ]);
  if (!user?.twoFactorEnabled || !stored?.mfaVerifiedAt)
    throw new Error("MFA_REQUIRED");
  if (
    stepUp &&
    (!stored.stepUpAt || Date.now() - stored.stepUpAt.getTime() > 300000)
  )
    throw new Error("STEP_UP_REQUIRED");
  return session;
}
