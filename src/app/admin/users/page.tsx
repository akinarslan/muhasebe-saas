import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  contextFor,
  authorize,
  AccessError,
} from "@/server/authorization/context";
import { UserAdministration } from "@/components/user-administration";
export const dynamic = "force-dynamic";
export default async function UsersPage() {
  try {
    const c = await contextFor(await headers());
    authorize(c, "users.view", { tenantId: c.tenantId });
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.status === 401) redirect("/login");
      if (error.reason === "MFA_REQUIRED") redirect("/account/security");
      return (
        <main className="login-form-zone">
          <div role="alert">Bu sayfaya erişim yetkiniz yok.</div>
        </main>
      );
    }
    return (
      <main className="login-form-zone">
        <div role="alert">Bulut hizmetine erişilemiyor. İşlem yapılmadı.</div>
      </main>
    );
  }
  return <UserAdministration />;
}
