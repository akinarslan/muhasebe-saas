import { expect, it } from "vitest";
import {
  invitationState,
  stepUpExpiresAt,
  STEP_UP_MS,
} from "../src/lib/auth/security-state";
it("step-up expires exactly at five minutes and rejects future timestamps", () => {
  const now = 1_000_000;
  expect(stepUpExpiresAt(new Date(now - STEP_UP_MS + 1), now)?.getTime()).toBe(
    now + 1,
  );
  expect(stepUpExpiresAt(new Date(now - STEP_UP_MS), now)).toBeNull();
  expect(stepUpExpiresAt(new Date(now + 1), now)).toBeNull();
  expect(stepUpExpiresAt(null, now)).toBeNull();
});
it("keeps invitation lifecycle distinct from email acceptance", () => {
  const record = {
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(2000),
  };
  expect(invitationState(undefined, 1000)).toBe("NONE");
  expect(invitationState(record, 1000)).toBe("PENDING");
  expect(invitationState(record, 2000)).toBe("EXPIRED");
  expect(invitationState({ ...record, revokedAt: new Date(900) }, 1000)).toBe(
    "CANCELLED",
  );
  expect(invitationState({ ...record, acceptedAt: new Date(900) }, 3000)).toBe(
    "ACCEPTED",
  );
});
