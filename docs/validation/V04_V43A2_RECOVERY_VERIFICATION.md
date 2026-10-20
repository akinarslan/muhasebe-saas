# V4.3a.2 — Recovery verification

20.10.2026 · **RECOVERY_BRANCH_PASS**

## Gerçek sonuç

- Branch: `pusula-v43a-pre-migration-015` / `br-broad-river-bavv5pey`.
- Parent: development `br-rough-darkness-ba6ow9zo`; capture LSN `0/3638E80`; parent timestamp `2026-10-20T12:47:55Z`; create `12:48:30Z`.
- Endpoint: `ep-wispy-frog-ba755foo`; min/max0.25CU; son gözlem active; branch ready.
- Gerçek SQL: yeni direct host üzerinde CA+hostname doğrulamalı TLS; encrypted/authorized true; READ ONLY transaction; PG18.6.
-38 tablo/24 FORCE RLS;14 başarılı migration; resolved008=1; unresolved=0;015 pending.
- Supplier1/SupplierMaterial0/SupplierOfferVersion0;AuthUser2/Membership2;MASTER membership1;Supplier izinleri8/MASTER eşleştirmesi8.
- Tenant1/LegalEntity1/Activity0;entity/activity/membership orphan0;validate edilmemiş constraint0;invalid/not-ready index0.

## Fingerprint kanıtı

Sekiz schema fingerprint baseline ve kaynak önce/son ile aynı:

| Kapsam | SHA-256 |
|---|---|
| tables |`e7fe806f27ce3cdb410fe7beaeff964adab585c577dd0958bf84ccf7b56bef44`|
| columns |`74128aab1acad38c1cbabd217b186d4fe3066d3278a5a02ab5ad71ff776c6313`|
| constraints |`6afa9a5849a5617aba1b9f315e3833157f5b6c581699614249977c3dac4b74b3`|
| indexes |`ba7353ce2d6df33135b74c9926cd85acb072edb00980f33cde966469e3a7136c`|
| policies |`df28f363390f5b472709f75ed001ad528a502e6b45a7d95dfdc187a05d4d1425`|
| triggers |`b0da18282e95eb93ec702965ed1ae823c2c3709d8ed353b1aab417b4c56d919b`|
| functions |`b7723611dfebe04c69404462b9390cd60d3a593bdf678e2735e5ae7c711bc6c2`|
| types |`d891fe9cc3ffd8303e957a2c4ca3173f607ffa7223e3374caa023d34cb30ba9c`|

Ek source/recovery eşitlik fingerprint'leri:

| Kapsam | SHA-256 |
|---|---|
| tüm public tablo owner/ACL (Supplier dahil) |`151630230294e1c4915d1c18642aa18d6d5317fbc5b1c2d0002402afdee4cb85`|
| public function owner/ACL |`158798753569705a41030ed6fb553de9c4345b605fe57b93d1950bea62a4dbe9`|
| roller: ad/login/super/createdb/createrole/bypassrls |`e8236bd6c768a64c19ced8ffa1007c3a2eb3cf181d1682f11233d6e971f6814c`|

ACL hash'leri source eşitlik kanıtıdır; tüm etkin role inheritance/default ACL davranışlarının bağımsız güvenlik sertifikası değildir. Önceki runner'ın Supplier ACL dışlama sınırı bu karşılaştırmada tüm public tabloların ACL'lerinin alınmasıyla daraltıldı. Gerçek kullanıcı yetki/yazı ve MFA login testleri yapılmadı.

## Önce/sonra karşılaştırma

`.data/recovery-v43a2/comparison.json` içindeki11 kontrolün tamamı true: eski branch kimlikleri, eski endpoint ID/host/type/CU/timeout, snapshot metadata, yalnız bir yeni branch, recovery ready, pending operation yok, tüm38 tablo toplamlarının kaynak önce/recovery/son eşitliği, fingerprint eşitliği, son kaynak/recovery izin-ilişki aggregate eşitliği ve SQL kabul koşulları.

Kaynak referansı12:48:11.979 UTC;recovery12:48:37.399 UTC;son kaynak12:48:53.284 UTC. Provider parent timestamp kaynaktaki ana referanstan16.979s öncedir; create zamanıyla capture aynı değildir. Kaynak durdurulmadı; eşit toplamlar aradaki aynı toplamlı güncellemeleri dışlamaz. Full satır hash'i/sır okunmadı; Activity0 olduğundan dolu activity davranış testi yoktur. FK/schema doğrulaması ve orphan sayımları geçti.

Client TLS yetkilendirmesi başarılı; backend `pg_stat_ssl=false` proxy sonrası backend bacağına aittir. Bu gözlem saklanmadı veya TLS'i devre dışı bırakmak için kullanılmadı. Yeni host için açık kimlik/hostname kontrolüyle ayrı audit bağlantısı kuruldu; normal migration runner hedef allowlist'i veya `.env.local` değiştirilmedi.

## Kaynak koruması / kapasite

Development `br-rough-darkness-ba6ow9zo`,production `br-autumn-union-baaldt81`,preview `br-patient-block-bald8u59` ve snapshot `snap-frosty-sky-bav0qeo6` metadata bağlantıları korundu. Yalnız kaynak READ ONLY referansları ve yeni branch READ ONLY SQL yapıldı. Production/test/preview SQL veya restore yok; Auth/login trafiği bağlanmadı.

Free API teyidi:branch4/10,snapshot1/1 korunuyor;storage limit alanı1GiB,development54,730,752byte;gecikmeli compute6,576CU-saniye≈1.827CU-hour. Kullanıcı Console kota teyidiyle tek yeni branch'e açık izin verdi. Toplam storage/kalan API'den hâlâ çıkarılamaz; kullanım Console'da izlenmeli. Yeni endpoint max0.25CU;aktif süre ve kaynak referans bağlantıları compute tüketir;kesin sprint maliyeti gecikmeli sayaçtan hesaplanamadı. [Neon plan limitleri](https://neon.com/pricing).

## Kanıt ve teslim

Gitignored `.data/recovery-v43a2/`: `before.json`,`create.json`,`create-intent.json`,`created.json`,`after.json`,`source-before.json`,`recovery.json`,`source-after.json`,`comparison.json`; yardımcı kod salt okunur SQL ve tek authorized create içindir. API create yanıtı başarıyla kaydedildi; non-idempotent retry yapılmadı. [Resmî create API ve retry uyarısı](https://api-docs.neon.tech/reference/createprojectbranch).

15 migration checksum'ı yeniden baseline ile eşleşti;015 beklenen SHA-256 `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`. Yalnız dokümantasyon teslimi; uygulama test suite'i yeniden çalıştırılmadı. Migration015,bağımsız backup/restore/cutover,uygulama/MFA login kabulü yapılmadı.015 için ayrı açık kullanıcı onayı ve güncel preflight/RPO değerlendirmesi gereklidir.

Mimo'ya bu sprintin kesin dosyaları:

1. `research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md`
2. `docs/validation/V04_V43A2_RECOVERY_VERIFICATION.md`
3. `LAST_REPORT.md`

[Kaynak kimlikleri, zaman farkları, tüketim ve kalan kapılar](../../research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md). Önceki V4.3a.1 raporları korundu. Commit/push/merge yok.
