# K3 — gerçek izole yerel doğrulama

22 Ekim 2026. **K3_LOCAL_PASS; bulut/pilot BLOCKED.** [Uygulama ve sınırlar](../../research/PUSULA_ACCOUNTING_K3_REPORT.md).

## Çalıştırılan komutlar

| Komut | Gerçek sonuç |
| --- | --- |
| `npm.cmd test` | PASS:39 dosyada444 test; Türkçe giriş ve tracked-sale için14 yeni test |
| `npx.cmd tsc --noEmit` | PASS, exit0 |
| `npm.cmd run lint` | PASS, exit0 |
| `npm.cmd run build` | PASS, exit0; Prisma generate + Next production build |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS:9 Git LF/tarihsel checksum kontrolü |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --k3-browser` | PASS: K3 16 + K1/K2 ve tüm eski suite'ler; masaüstü/mobil 2 UI testi |
| `git diff --check` ve korunan dosya hash'leri | PASS |

Nihai fixture: **`v42-177760ab-f691-467c-a700-cde81ec00234`**. `status=PASS`, `serverStopped=true`, `failureCode=null`; PostgreSQL18.6 sunucusu kapatıldı. Masaüstü ve mobil testler **2/2 PASS (44,5s)**. Gerçek sonuçlar: K3 16, K1 20, K2 15, DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36. `neonOperations=false`, `r2Operations=false`.

Log'lar `.data/k3/{fixture-final-browser,vitest,tsc,lint,build,git-lf-artifact}.log` altında yereldir. Fixture/Auth/MFA verileri veya build çıktıları teslim dosyası değildir. Süreçler sandbox'ın spawn kısıtı nedeniyle onaylı yerel test çalıştırmasıyla başlatıldı; uzak DB/provider komutu yoktur.

## PostgreSQL18.6 — K3'ün16 kontrolü

1. Ayrı CASH/BANK/POS açılışları:0 /10000 /0 TRY.
2. Gerçek12000TRY satış →5000nakit →7000kalan;7000EFT →0kalan. Para hesapları ayrı güncellenir.
3. Aynı intent ve farklı request key aynı operation ID'sini verir; yeni intent ile aynı terminal referansı409; SUCCEEDED/NOT_COMMITTED sonuç sorguları.
4. Kart1000 → yalnız POS1000. Settlement1000brüt/20komisyon/980net: üç posting, POS0 ve banka+980. Kaynak satış kalanı settlement ile ikinci kez azalmaz.
5. Onaylı8000supplier borç belgesi →3000ödeme →5000kalan. Rastgele/PO benzeri muhasebeleşmemiş kaynak ödeme oluşturmaz.
6. Aktif settlement varken kart tahsilatı, aktif allocation varken satış ters kaydı409. Settlement, kart tahsilatı ve ödeme terslenince ilgili allocation ve fon bakiyeleri düzelir; kaynaklar silinmez.
7. Aynı12000satışa eşzamanlı iki8000tahsilattan biri200, diğeri409; kalan4000.
8. Fazla ödeme ve yetersiz kasa/banka bakiyesi409; journal/posting/allocation/movement/operation/audit sayıları değişmez.
9. Allocation INSERT yetkisi yerel fixture executor'ından geçici kaldırılarak geç hata enjekte edilir. Bütün finans transaction'ı rollback olur; yetki finally'de geri verilir. Ayrı, önceden oluşturulan intent/audit kaydı finans rollback'i diye silinmez.
10. Terminal onaysız CARD, yasak kart/CVV alanları, yanlış party/account, activity/company/tenant/kullanıcı reddi.
11. Gerçek non-master login, gerçek TOTP kaydı/doğrulaması ve password+TOTP step-up. Önce MFA'sız POST403; yalnız atanmış kasa görünür, banka/ödeme yetkisi yoktur. Cash DENY ile okuma ve replay reddedilir. LE collect izni kaldırılıp yalnız OWN ALLOW verildiğinde başka aktörün satışına tahsilat409; finans sayıları değişmez.
12. Runtime doğrudan finans DML reddi, PUBLIC command EXECUTE kapalı, MASTER collect DENY403.
13. Onaylı borcun kalan8000tutarına tam/peşin ödeme →0kalan. Kesinleşmemiş intent kapatılır, geç POST reddedilir; kesinleşmiş intent kapatılamaz.
14. Bugünkü banka bakiyesi11000'den fazla olsa da yalnız10000olan geçmiş tarihe11000ödeme409. Gelecek girişle geçmiş negatif kapatılamaz.
15. Gerçek katalog ölçümü: **55 tablo /41 FORCE RLS**. Executor NOLOGIN/NOSUPERUSER/NOBYPASSRLS. Yeni/korunan dört definer girişinin sahibi executor; runtime eski implementation helper'larını çalıştıramaz ve beş yeni tabloya INSERT/UPDATE/DELETE yapamaz.
16. Güncel step-up olmadan POST403; eksik fixture ile finance GET503; başarılı migration geçmişi16.

Normal personel yetkisi fixture'da gerçek Role/Scope/Membership/AccountAccess kayıtlarıyla atanır; production rol şablonları genişletilmedi. MFA pozitifleri DB timestamp sahtelemesiyle elde edilmedi.

K1'in değişmemiş20 ve K2'nin değişmemiş15 kontrolü aynı yeni şema üzerinde yeniden çalıştırılır. Tam regresyon ayrıca DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 içerir. Mevcut yerel Prisma016 runner pre/post ACL/history, lock/rollback ve drift testleri de yeniden çalışır; gerçek Neon'a016 uygulanmaz.

## Gerçek tarayıcı kanıtı

Playwright `k3.spec.ts`, mevcut Chrome masaüstü ve mobil projelerinde gerçek localhost uygulaması + aynı izole PG fixture'ına bağlanır. Ayrı sentetik tenant/kullanıcılar, gerçek MFA ve step-up kullanılır. Kurulum, satış, açılış ve borç belgesi API ile seed edilir; UI'de:

- 12.000 TL satıştan 5.000 nakit ve 7.000 EFT alınır; 7.000 → 0 belge kalanı görülür.
- 8.000 TL tedarikçi borcuna 3.000 banka ödemesi yapılır; 5.000 kalan görülür.
- Cari ekstre ve ayrı kasa/banka/POS bakiyeleri okunur.
- API'de oluşturulan terminal onaylı kart tahsilatı POS'ta görünür; UI'den 1000/20/980 settlement yapılır, banka 14.980 ve POS 0 doğrulanır.

Screenshot/video/trace kapalıdır. Ağ kopması sonrası kör POST yapılmaması unit mock ile; gerçek sonuç sorgulama/kapatma/geç POST reddi SQL/API testiyle doğrulanır. Ağ kesintisi gerçek provider üzerinde denenmedi.

## Başarısız geliştirme denemeleri

- `v42-87187642-8d4f-45e7-8c8b-b6e6557baf51`: harness K3 test kaynağı tamamlanmadan başladı; K3 child için ERR_MODULE_NOT_FOUND. Önceki suite'ler geçti, sunucu kapatıldı; K3 kabulü sayılmadı.
- `v42-acbc4abe-36f9-4594-871e-2e0eb6f66547`: ilk iki K3 kontrolü geçti, rollback sayımı yeni intent'in ayrı audit'ini yanlışlıkla finans hareketi saydı. Sayım yalnız bağımsız intent audit'ini hariç tutacak şekilde düzeltildi; audit silinmedi.
- `v42-96a011d2-e365-428a-ab9b-7440d64aeca3`:11 K3 kontrolü geçti, MASTER DENY testi niyeti DENY sonrasında oluşturmaya çalıştığı için hedef tahsilat isteğine erişemedi. Niyet DENY öncesinde hazırlanıp esas POST403 yeniden doğrulandı.
- İlk ESLint çalışmasında sync effect setState ve render-helper/ref analiz hataları vardı. Async dış kaynak güncellemesi ve ayrı tablo bileşeniyle düzeltildi; lint/build yeniden geçti.
- `v42-8f1d7679-051b-4bcf-acd9-3dd3eba3b583`:16 K3 ve tüm API/SQL regresyonları, ayrıca mobil UI geçti; desktop TOTP kurulumunda beş saniyelik DOM beklemesi doldu. Test HTTP doğrulama yanıtını açıkça beklemiyordu. Yanıtın200olması ve ardından20saniyelik DOM kontrolü birlikte zorunlu yapıldı; finans assertion'ları gevşetilmedi. Sunucu kapatıldı.

Tüm bu fixture sunucuları kapatıldı. Ara başarılı13/14/16kontrollü çalışmalar son teslimin yerine sayılmaz. K1/K2 raporlarındaki tarihsel sonuçlar ve eski FIX_REQUIRED kayıtları değiştirilmedi.

## Bütünlük ve gerçek kullanım sınırı

`.data/k3/start-hashes.json` başlangıç snapshot'ıdır. Üç kullanıcı plan dosyası, K1/K2 raporları/SQL'leri/test kaynakları, `.env.local` ve tüm001–016 SQL byte'ları korunur; LAST_REPORT eski içerik son eki aynıdır.016SHA:

`27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`

Managed `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` değişmedi. K3 localSQL canonical migration değildir. Backup allowlist35/21, managed object audit ve bağımsız şifreli backup+gerçek restore eksikliği devam eder. Recovery `br-late-river-baeipun8`, token_roles/ROLE_DELTA_UNRESOLVED değişmedi. Provider rol/ACL uyumu ölçülmedi. Gerçek Neon/R2/restore/snapshot ve Git stage/commit/push yapılmadı; gerçek veri pilotu BLOCKED.
