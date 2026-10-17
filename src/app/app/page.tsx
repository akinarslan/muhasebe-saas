import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { contextFor, AccessError } from "@/server/authorization/context";
import { CloudDesk } from "@/components/cloud-desk";
import Link from "next/link";
import { SignOut } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function CloudWorkspace() {
  try {
    await contextFor(await headers());
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.status === 401) redirect("/login");
      if (error.reason === "MFA_REQUIRED")
        return (
          <main className="login-form-zone">
            <div className="login-form">
              <h1>Çalışma alanınızı güvenceye alın</h1>
              <p>
                Bulut kayıtlarına erişmek için MFA doğrulamasını tamamlayın.
              </p>
              <Link href="/account/security">Hesap güvenliği ve MFA</Link>
              <SignOut />
            </div>
          </main>
        );
    }
    return (
      <main className="login-form-zone">
        <div role="alert">
          Bulut çalışma alanına erişilemiyor. İşlem yapılmadı.
        </div>
      </main>
    );
  }
  return <CloudDesk />;
}
