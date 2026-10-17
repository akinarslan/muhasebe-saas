import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import { StepUpVerification } from "../src/components/step-up-verification";
import { AuthForm } from "../src/components/auth-form";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const response = (data: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(data), { status }));
it("server-confirmed step-up hides secrets, persists on remount, expires and fails closed", async () => {
  vi.useFakeTimers();
  let verified = false;
  const start = Date.now();
  const fetcher = vi.fn((url: string) =>
    url.endsWith("/status")
      ? response({
          verified,
          expiresAt: verified ? new Date(start + 300000).toISOString() : null,
          serverTime: Date.now(),
        })
      : ((verified = true), response({ verified: true })),
  );
  vi.stubGlobal("fetch", fetcher);
  const mounted = render(<StepUpVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.change(screen.getByLabelText("Şifre"), {
    target: { value: "synthetic-password" },
  });
  fireEvent.change(screen.getByLabelText("TOTP kodu"), {
    target: { value: "123456" },
  });
  await act(async () => {
    fireEvent.submit(
      screen.getByRole("button", { name: "Yeniden doğrula" }).closest("form")!,
    );
  });
  expect(screen.queryByLabelText("Şifre")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Kimliğiniz başarıyla doğrulandı" }),
  ).toBeTruthy();
  mounted.unmount();
  render(<StepUpVerification />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByLabelText("Şifre")).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300001);
  });
  expect(screen.getByLabelText("Şifre")).toBeTruthy();
  fetcher.mockImplementation(() => Promise.reject(new Error("network")));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(screen.getByRole("alert").textContent).toContain(
    "Oturum doğrulanamadı",
  );
  fetcher.mockImplementation(() =>
    response({ verified: false, expiresAt: null, serverTime: Date.now() }),
  );
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(screen.queryByRole("alert")).toBeNull();
});
it("a successful POST without server confirmation cannot show verified state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      response(
        url.endsWith("/status")
          ? { verified: false, expiresAt: null, serverTime: Date.now() }
          : { verified: true },
      ),
    ),
  );
  render(<StepUpVerification />);
  await screen.findByLabelText("Şifre");
  await act(async () => {
    fireEvent.submit(
      screen.getByRole("button", { name: "Yeniden doğrula" }).closest("form")!,
    );
  });
  expect(
    screen.queryByRole("heading", { name: "Kimliğiniz başarıyla doğrulandı" }),
  ).toBeNull();
  expect(screen.getByLabelText("Şifre")).toBeTruthy();
});
it("TOTP phase separates read-only account, focuses empty six digits and supports account switch", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      response(
        url.endsWith("/sign-in/email")
          ? { twoFactorRedirect: true }
          : { success: true },
      ),
    ),
  );
  render(<AuthForm />);
  await user.type(
    screen.getByLabelText("Kurumsal e-posta"),
    "fixture@example.invalid",
  );
  await user.type(screen.getByLabelText("Şifre"), "synthetic-password");
  await user.click(screen.getByRole("button", { name: "Giriş yap" }));
  const code = screen.getByLabelText("TOTP doğrulama kodu") as HTMLInputElement;
  expect(document.activeElement).toBe(code);
  expect(code.value).toBe("");
  expect(code.maxLength).toBe(6);
  expect(
    (screen.getByLabelText("Hesap e-postası") as HTMLInputElement).readOnly,
  ).toBe(true);
  expect(screen.queryByLabelText("Şifre")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Doğrula ve devam et" }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", { name: "Kurtarma kodu kullan" }),
  );
  expect(document.activeElement).toBe(screen.getByLabelText("Kurtarma kodu"));
  await user.click(screen.getByRole("button", { name: "Hesap değiştir" }));
  expect(screen.getByLabelText("Kurumsal e-posta")).toBeTruthy();
  expect(screen.queryByLabelText("TOTP doğrulama kodu")).toBeNull();
});
