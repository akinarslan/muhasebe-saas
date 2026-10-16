import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { activeSession } from "@/server/auth/core";
import { SecurityForm } from "@/components/security-form";
export const dynamic="force-dynamic";
export default async function SecurityPage(){
 const session=await activeSession(await headers()).catch(()=>null);if(!session)redirect("/login");
 return <main className="login-form-zone"><div className="login-form"><span className="badge neutral">HESAP GÜVENLİĞİ</span><h1>İki adımlı doğrulama</h1><SecurityForm enabled={!!session.user.twoFactorEnabled}/></div></main>;
}
