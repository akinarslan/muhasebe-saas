# PUSULA v0.4 — V4.2d.1 env-loader düzeltmesi ve gerçek preflight

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur.

## Sonuç: PREFLIGHT_PASS — migration uygulanmadı

Env-loader TypeError giderildi; gerçek modül/CLI ve sentetik PostgreSQL kabulünden sonra yalnız onaylı `pusula_development` direct hedefinde guarded preflight çalıştırıldı. Exit0, **PREFLIGHT_PASS, applied=false**. PostgreSQL18.6,35 tablo,21 FORCE RLS,13 başarılı migration ve014 pending doğrulandı. İncelenen schema/privilege pinleri eşleşti. Gerçek migration için ayrıca açık kullanıcı onayı gerekir; bu sonuç restore veya production kabulü değildir.

Başlangıçta önceki V42D raporu untracked ve LAST_REPORT değişikti; ikisi korundu. Uygulama commit'i/dal değiştirilmedi. Codex stage/commit/push/fetch/merge yapmadı.

## Gerçek hata nedeni

Kurulu **Next.js16.4.1 / @next/env16.4.1** incelendi. `@next/env` CommonJS entry'si `dist/index.js`, `__esModule=true` ve named `loadEnvConfig` export'u içerir; **default export içermez**. Root package'ın CommonJS/tsx `.ts` çalışma yolunda `import nextEnv from '@next/env'` bu nedenle doğru API nesnesini sağlamıyordu. Gerçek-env dalındaki `nextEnv.loadEnvConfig(...)` TypeError ile, bağlantı kurulmadan duruyordu.

Native ESM `.mts` denemesinde CommonJS paketinin namespace'i default nesne olarak görülebildiğinden, o kipteki bir denemenin geçmesi runner'ın gerçek `.ts`/CLI yolunun doğru olduğunu kanıtlamıyordu. Ayrıca eski fixture modu loader'ı atlıyordu; önceki yerel testler bu açığı yakalamadı. Bu kapsam eksikliği giderildi.

Yerel birincil kaynaklar: `node_modules/@next/env/package.json`, `dist/index.d.ts` ve `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, “Loading Environment Variables with @next/env” bölümü. Rehberdeki kullanım `import { loadEnvConfig } from '@next/env'` şeklindedir. Export şekli env yüklemeden, yalnız API türleriyle doğrulandı; gerçek değerler gösterilmedi.

## Dar uygulama değişiklikleri

- Yeni `scripts/db/migration-env.ts`, named API'yi kullanır; logger info/error çıktısını bastırır, API/yükleme hatasını yalnız sabit güvenli kodlarla bildirir. Combined/parsed env veya dosya içerikleri döndürülmez/loglanmaz.
- Runner artık fixture dahil **aynı gerçek loadEnvConfig API yolunu** çağırır. Production reddi korunur; URL eksikse bağlantıdan önce `MIGRATION_ENV_MISSING` verir.
- Gerçek çalışma normal proje env dosyalarını okur. Fixture yalnız doğrulanmış UUID root/marker ve symlink olmayan özel `migration-env` dizinini kullanır; oradaki sentetik `.env.test.local` okunur. Gerçek `.env.local` atlanarak başka bir uzak bağlantı yolu oluşturulmadı; fixture da gerçek proje env dosyasını okumaz. Son target/rol/TLS guard'ı yüklenen URL'yi yine doğrular.
- Salt okunur preflight, kendi REPEATABLE READ READ ONLY katalog snapshot'ına belirtilen10 tablonun `count(*)` toplamlarını ekler. Ayrı bypass bağlantısı yoktur; drift/hata halinde sayımlara devam edilmez. Uzak privilege pin kontrolü de read-only kalır. Fixture için remote pin doğrulandı gibi raporlanmaması amacıyla özetin privilegeDrift alanı test kipinde null'dır.
- Mevcut TLS fixture helper'ındaki `use` adlı yerel fonksiyon React Hook lint kuralına takılıyordu. Yalnız `configureCertificate` olarak yeniden adlandırıldı; güvenlik/lint kuralı kapatılmadı, TLS davranışı değiştirilmedi.

Migrate apply bayrakları, approval, role/branch/direct allowlist, CA/hostname kontrolü, timeout, checksum/schema/ACL pinleri ve kısmi uygulama korumaları kaldırılmadı. Snapshot,014 SQL, ilk13 migration, dependency, uygulama/Auth/MFA/RLS kaynakları ve gerçek env dosyası değiştirilmedi.

## Yeni gerçek modül regresyonları

`tests/migration-env.test.ts` **12** yeni ağsız test içerir; module mock'u kullanmaz. Gerçek `@next/env` export sözleşmesi, aynı helper ile hayalî `.env.local` okuma, gerçek CLI entry'sinde eksik env, proje env'ini ödünç almama, malformed URL/yanlış rol/DB/pooler/TLS, production ve gerçek Neon test hedef reddi, sahte fixture marker reddi test edilir. Hayalî secret ve URL-password canary'lerinin stdout/stderr'e düşmediği doğrulanır. Test process'leri gerçek workspace env dosyası yerine yalnız kendilerinin oluşturduğu Git dışı geçici dizinde çalışır; cleanup hedefi o dizinle sınırlandırılır.

Yerel PG fixture'ında aynı loader native API ile sentetik env dosyasındaki benzersiz probe'u gerçekten yükler. Runner'ın flagsiz preflight'ı aynı read-only snapshot'ta10 tablonun ikişer sentetik satırını sayar; ardından timeout/kısmi uygulama ve gerçek014 deploy/no-replay senaryoları sürer. Bu yerel014 uygulaması gerçek Neon değildir.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| TypeScript | **PASS** |
| ESLint | **PASS**,0 hata/uyarı |
| Vitest | **329/329**,27 dosya,20.46s; önceki317 +12 gerçek env/CLI testi |
| Hedefli env+history/target testleri | **32/32**; tam Vitest toplamına dahildir, ayrıca eklenmez |
| Yerel migration/env/reference kabulü | **16/16** |
| DB/RLS | **11/11**, yalnız yeni fixture |
| Auth/API | **62/62** (7+9+8+11+8+6+13), yalnız hayalî kullanıcı/yerel taşıyıcı |
| Cloud/DB | **11/11**, yeni fixture |
| Supplier DB/API | **16/16**, maliyet DENY/revoke/tenant izolasyonu dahil |
| Gerçek Neon flagsiz preflight | **PREFLIGHT_PASS**, exit0, applied=false |
| Build / Playwright | Bu sprint çalıştırılmadı; UI/runtime uygulama modülleri değişmedi |

Son tam yerel fixture: **v42-05b36ccf-7aa7-4d7a-8beb-a99c1f6a5250**,127.0.0.1:55432, PostgreSQL18.6, PID28580, statusPASS/serverStopped=true. Kanıtlar aynı Git dışı dizindeki `verification.json`, `migration-safety.json`, `post-schema.json`, test logları ve özel sentetik env dosyasıdır. Önceki ara tam fixture v42-35a0d5cf-85b9-482f-9be4-343052aa9f68 de15/15+DB/API PASS/serverStopped=true verdi; son16'lı kabul öncekinin üzerine yeni read-only referans kontrolünü ekler.

Yerel DB adı pusula_sprint_b_test olsa da mevcut Neon test DB değildir: yeni UUID cluster, yalnız127.0.0.1, özel port/marker ve SCRAM ile ayrılır. Mevcut PostgreSQL data dizini, Windows servisi ve sistem PATH değiştirilmedi.

İlk TypeScript denemesinde test helper'ın boş varsayılan ProcessEnv argümanı, zorunlu NODE_ENV tipiyle uyuşmadı; Partial ile düzeltildi. İlk tam lint koşusunda TLS helper `use` adı kural hatası verdi; isim düzeltildi. Bu başarısız denemeler PASS sayılmadı. Son TypeScript/lint/tam Vitest ve fixture sonuçları yukarıdadır. Fixture'daki beklenen negatif migration/HTTP hata kayıtları hata enjeksiyonu kanıtıdır; sıfır sunucu log hatası iddiası yoktur. Browser testleri ve ayrı engine TLS/restore tatbikatı bu sprint yeniden çalıştırılmadı.

## Gerçek Neon preflight ve güvenli referans

Çalıştırılan komut; hiçbir apply, Master veya recovery bayrağı kullanılmadı:

```powershell
node --use-system-ca --import tsx scripts/db/migrate.ts
```

Bu, test moduna girmeden aynı düzeltilmiş loader ve runner'dır. Yalnız approved direct development endpoint/DB/owner kabul edildi. Girdi `sslmode=verify-full`, mevcut CA, `rejectUnauthorized=true` ve hedef hostname doğrulaması korundu; runner'ın socket encrypted/authorized kapısı geçti. Bu ölçüm Node preflight TLS'sidir; Prisma migration subprocess'i gerçek Neon için başlatılmadı. TLS protokol sürümü ayrıca loglanmadığından uydurulmadı.

| Canlı kontrol | Sonuç |
| --- | --- |
| Database | pusula_development |
| PostgreSQL |18.6 (653b019) |
| Transaction | REPEATABLE READ READ ONLY; readonly=on; sonunda ROLLBACK/bağlantı kapatma |
| Referans zamanı | **2026-10-19T11:52:12.917Z** =19.10.2026 **14:52:12.917 Europe/Istanbul** |
| Public tablo / ENABLE+FORCE RLS | **35 /21**, incelenmiş exact pin kapsamı eşleşti |
| Başarılı migration | **13**, yerel checksum'larla eşleşti |
| Çözümlenmiş rollback | **1**, geçmiş008 kaydı korunur; unresolved hata yok |
| Pending | **202610190014_supplier_catalog** |
| Schema / privilege drift | Denetlenen katalog ve uzak role/üyelik/default ACL/eski tablo pinlerinde **fark yok** |
| Uygulama | **applied=false** |

014 SHA-256 değiştirilmedi ve manifest ile eşleşir:

`0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`

Git dışı canlı kanıt `.data/v42d1-live-preflight.json` dosyasındadır. Yalnız güvenli özet ve toplamlar içerir; connection string/parola/env içeriği yoktur. “Drift yok” ifadesi mevcut runner'ın incelenmiş fingerprint/guard kapsamıdır; sürekli değişmezlik veya tüm olası veri/yetki yolları için production sertifikası değildir.

### Aynı snapshot'taki toplamlar

| Tablo | Toplam |
| --- | ---: |
| AuthUser |2 |
| Membership |2 |
| Customer |0 |
| Material |0 |
| MaterialVariant |0 |
| MaterialPriceHistory |0 |
| CloudProduct |0 |
| CloudQuote |0 |
| CloudSale |0 |
| CloudSaleLine |0 |

Gerçek ad/e-posta, parola/session/MFA, fiyat, finansal payload veya snapshot JSON okunmadı/gösterilmedi. Bunlar owner kapsamındaki toplam sayımlardır; diğer tabloların boş olduğu veya kayıt içeriğinin eski referansla aynı olduğu anlamına gelmez. Hiçbir gerçek satır değiştirilmedi. Sonraki migration öncesinde bakım/yazma kontrolüyle bu referans yenilenmeli; sayı eşitliği içerik eşitliği yerine kullanılmamalıdır.

## Snapshot ve açık onay sınırları

`pusula-v42-before-supplier-migration` / `snap-frosty-sky-bav0qeo6` için bu sprint **restore/delete/create/list/finalize işlemi yapılmadı**. [Önceki V42D API doğrulaması](PUSULA_V04_V42D_SNAPSHOT_READINESS.md) korunur; burada yeni restore başarısı veya yeni snapshot gözlemi iddia edilmez. Snapshot zamanı11:03:46Z ile bu SQL referansı11:52:12.917Z aynı nokta değildir; içerikleri eşit varsayılmaz. Gerçek `.env.local`, Master Admin/MFA ve üyelikler değiştirilmedi.

Env-loader ve gerçek preflight engeli kalktı; bu durum014'ün otomatik uygulanmasına izin vermez. Yeni branch/snapshot, Neon test veya production DB bağlantısı/değişikliği, gerçek dump/R2 ve restore yoktur. Snapshot'tan gerçek kurtarma kabulü, branch/diğer DB etkisi, bağımsız backup ve production kapıları önceki raporlardaki sınırlarıyla devam eder. Gerçek014 için ayrıca açık kullanıcı onayı ve kabul edilmiş kurtarma/bakım prosedürü gerekir.14 migration/38 tablo/24 FORCE RLS hedefi yalnız yerel fixture'da uygulandı; gerçek Neon **35/21** kaldı.

## Mimo teslim listesi

1. `scripts/db/migrate.ts` — ortak loader, eksik env kodu ve güvenli preflight özeti.
2. `scripts/db/migration-env.ts` — yeni gerçek named-API loader/özel fixture dizini.
3. `scripts/db/migration-safety.ts` — aynı read-only snapshot'ta toplam referansı.
4. `scripts/db/verify-migration-fixture.ts` — gerçek loader ve preflight referans kabulü.
5. `scripts/db/verify-migration-tls.ts` — yalnız lint için yerel fonksiyon adlandırması.
6. `tests/migration-env.test.ts` —12 gerçek modül/CLI testi; modül taklidi yok.
7. `research/PUSULA_V04_V42D1_PREFLIGHT_FIX.md` — bu rapor.
8. `LAST_REPORT.md` — son durum.

Önceki untracked `research/PUSULA_V04_V42D_SNAPSHOT_READINESS.md` değişmeden korunur; bu sprintin yeni değişikliği gibi sayılmaz. LAST_REPORT eski bölümleri silinmeden güncellenir. Codex commit/push yapmadı; Mimo yalnız ilgili dosyaları diff/sır kontrolüyle normal teslim eder ve ayrı gerçekleşmiş `.md` Git raporu hazırlar. `.data`, env, test credentials, generated/build çıktısı Git'e eklenmez.

Son teslim kontrolü:8 ilgili dosyada yapılandırılmış yerel sır/URL-password eşleşmesi taraması PASS; raporun yerel bağlantısı ve canlı kanıt JSON'u doğrulandı.014 checksum değişmedi, whitespace kontrolü PASS, index boş. Bağımsız süreç/port sayımı: fixture postgres0, Prisma schema-engine0,55432 listener0.
