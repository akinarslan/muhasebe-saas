import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { activeSession } from "@/server/auth/core";
import { SignOut } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function CloudWorkspace() {
  const session = await activeSession(await headers()).catch(() => null);
  if (!session) redirect("/login");
  return <main className="login-form-zone"><div className="login-form">
    <span className="badge neutral">BULUT ÇALIŞMA ALANI</span><h1>Hoş geldiniz, {session.user.name}</h1>
    <p>Gerçek oturumunuz doğrulandı. İşletme modüllerinin bulut verilerine geçişi Sprint D kapsamındadır.</p>
    <Link href="/">Ayrı demo çalışma alanı</Link><SignOut />
  </div></main>;
}
