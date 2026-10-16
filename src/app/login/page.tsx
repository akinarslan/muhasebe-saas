import Link from "next/link";
import { Compass, ArrowUpRight, ShieldCheck } from "lucide-react";
import { CompassScene } from "@/components/compass-scene";
import { AuthForm } from "@/components/auth-form";
export default function Login() {
  return (
    <main className="login-page">
      <section className="login-atmosphere">
        <Link href="/" className="login-brand">
          <Compass size={31} /> pusula<span>BUSINESS OPERATING SYSTEM</span>
        </Link>
        <div className="login-orbit">
          <CompassScene />
        </div>
        <div className="login-pitch">
          <span>İŞLETMENİZİN ROTASI, SİZİN ELİNİZDE.</span>
          <h1>
            Net hesaplar.
            <br />
            <em>Güçlü kararlar.</em>
          </h1>
          <p>
            Satıştan üretime, maliyetten finansal görünürlüğe.
            <br />
            İşletmenizin tüm yönleri aynı pusulada.
          </p>
        </div>
        <div className="login-signals">
          <span>
            <i /> REKLAM & YAZILIM
          </span>
          <span>PUSULA / v0.3</span>
        </div>
      </section>
      <section className="login-form-zone">
        <div className="login-form">
          <span className="badge neutral">GÜVENLİ BULUT GİRİŞİ</span>
          <h2>
            Çalışma alanınıza
            <br />
            hoş geldiniz.
          </h2>
          <p>İşletmenize daha geniş bir açıdan bakın.</p>
          <div className="prototype-notice">
            <ShieldCheck size={18} />
            <span>
              Bulut oturumu sunucuda doğrulanır. Demo çalışma alanı ayrı ve
              yerel verilerle çalışır.
            </span>
          </div>
          <AuthForm />
          <Link className="btn btn-primary login-submit" href="/">
            Demo çalışma alanını aç <ArrowUpRight size={18} />
          </Link>
          <small>
            Demo verileri kullanılır. Finansal işlem veya güvenli oturum
            oluşturulmaz.
          </small>
          <div className="login-trust">
            <span>USD TABANLI MALİYET</span>
            <span>TCMB GÖSTERGE KURU</span>
            <span>AKILLI İŞ AKIŞLARI</span>
          </div>
        </div>
        <footer>
          © {new Date().getFullYear()} Pusula · Güvenli çalışma alanı
        </footer>
      </section>
    </main>
  );
}
