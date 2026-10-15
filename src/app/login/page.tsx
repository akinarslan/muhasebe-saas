import Link from "next/link";
import {
  Compass,
  ArrowUpRight,
  ShieldCheck,
  Mail,
  LockKeyhole,
} from "lucide-react";
import { CompassScene } from "@/components/compass-scene";
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
          <span>PUSULA / v0.2.2</span>
        </div>
      </section>
      <section className="login-form-zone">
        <div className="login-form">
          <span className="badge neutral">DENEYİM ÖNİZLEMESİ</span>
          <h2>
            Çalışma alanınıza
            <br />
            hoş geldiniz.
          </h2>
          <p>İşletmenize daha geniş bir açıdan bakın.</p>
          <div className="prototype-notice">
            <ShieldCheck size={18} />
            <span>
              Bu bir giriş tasarım prototipidir. Gerçek oturum ve yetkiler
              v0.3’te eklenecek; gerçek şifrenizi girmeyin.
            </span>
          </div>
          <label>
            Kurumsal e-posta
            <div className="login-field">
              <Mail size={17} />
              <input
                type="email"
                placeholder="adiniz@firmaniz.com"
                autoComplete="off"
                disabled
              />
            </div>
          </label>
          <label>
            Şifre
            <div className="login-field">
              <LockKeyhole size={17} />
              <input
                type="password"
                placeholder="Gerçek giriş v0.3'te"
                disabled
              />
            </div>
          </label>
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
        <footer>© {new Date().getFullYear()} Pusula · Tasarım prototipi</footer>
      </section>
    </main>
  );
}
