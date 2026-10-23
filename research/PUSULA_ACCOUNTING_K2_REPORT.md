# PUSULA — K2 satış → cari alacak

22 Ekim 2026 · `feat/pusula-v030-neon-cloud` · HEAD `fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9` (commit yapılmadı).

**K2_LOCAL_PASS — yalnız izole PostgreSQL18.6 kabulü. Bulut dağıtımı ve gerçek verili pilot BLOCKED.** K1 raporu, doğrulaması ve kullanıcıya ait üç bekleyen plan dosyası değiştirilmedi. K1 kaynakları sıfırlanmadı; K1'in 20 kontrolü genişletilmiş şemada yeniden geçti.

## Mevcut satış motoruna bağlantı

Yeni müşteri, fiyat veya satış motoru yazılmadı. `documentRequest` içindeki mevcut `CloudSale`/satır/plan oluşturma transaction'ına `postSale` eklendi. Hesaplama, TCMB/manual rate seçimi, maliyet, USD/TRY tutarları ve immutable snapshot üretimi aynı kaldı. Finans komutu **DB'deki yeni satış ve satır tutarlarını** okur; istemciden finans tutarı kabul etmez.

Satış başına tek journal: müşteri cari hesabına brüt borç, REVENUE karşı hesabına net alacak ve VAT karşı hesabına KDV alacak yazılır. TRY journal'ında net/KDV/brüt ayrı alanlarda tutulur; brüt = net + KDV zorunludur. Satır toplamları satış header'ıyla karşılaştırılır. Eksik cari hesap mevcut Customer'a bağlanarak aynı transaction'da kontrollü oluşturulur. K1'in exact activity kuralına uymayan party scope'u açık hata/rollback üretir; müşteri kartı otomatik taşınmaz.

Herhangi bir finans hatası satış header'ı, satırları, hesapları, journal/posting ve audit'i birlikte rollback eder. Deferred `CloudSale` constraint trigger, journal bulunmayan **yeni normal satışın** commit'ini DB seviyesinde de reddeder. K1'in iki satırlı journal kontrolü, açılış için iki; satış ve satışın ters kaydı için üç satır olarak genişletildi. Denge ve scope zorunluluğu korundu.

K2 TRY finans kesitidir. Yeni USD-denomine satış bu entegrasyonda hata ve tam rollback üretir; USD maliyet/net USD ve mevcut döviz snapshot alanları korunur. Doğrulanmamış bir FX dönüşümü eklenmedi. Çoklu para birimi cari desteği bu paket değildir.

## Tekillik ve eski satışlar

Mevcut satış request UUID + payload hash replay mekanizması korunur. Journal ayrıca unique `saleId`, `SALE:{saleId}` kaynak anahtarı ve tenant/company business source tekilliğine sahiptir. Advisory lock ile eşzamanlı posting tekilleştirilir.

`saleCreate.sourceRef` isteğe bağlı, trim edilmiş 1–200 karakter iş referansıdır. Aynı referans farklı request key ile tekrar kullanılamaz. Referans yoksa **request key hariç normalize edilmiş istek içeriğinin SHA-256 hash'i** iş kaynağıdır. Böylece yalnız request key değiştirilen aynı satış reddedilir. Gerçekte aynı gün aynı müşteri/tutar/satırlarla ikinci ayrı satış varsa ayrı ve kalıcı `sourceRef` verilmelidir. Bu hash anlamsal benzerlik veya dış sistem fatura tekilliği iddiası değildir; farklı iş içeriği/ref ayrı satış sayılır.

Eski satışlara toplu/backfill işlemi yoktur. Posting komutu yalnız aynı DB transaction'ında oluşturulmuş normal satışa izin verir; eski committed satışa sonradan posting reddedilir. Var olan request'in replay'i eksik journal oluşturmaz.

Mevcut tarihsel import yolu ayrı tutuldu: `rateSnapshot.historical=true`, scope'u eşleşen `CloudImportRecord`, CONFIRMED batch ve `imports.confirm` yetkisi birlikte varsa tarihsel kayıt journal zorunluluğundan muaftır. Bu kayıtlar **LEGACY_UNPOSTED** kalır; K2 posting komutu bunları da reddeder. İstisna yeni normal satışlara uygulanmaz. Mevcut tarihsel satış import testi yeniden geçti; import veya müşteri motoru yeniden yazılmadı.

## API, iptal ve güvenlik

- Mevcut `POST /api/cloud/workspace/sales` yeni normal satış ile cari alacağı birlikte üretir. Bu yol artık finans hazırlığı nedeniyle **fixture-only** ve fail-closed'dur; gerçek bulutta eski finans kayıtsız yeni satış davranışına fallback yapılmaz. `ACCOUNTING_CLOUD_REVIEW_REQUIRED` kapısı korunur. Mevcut satış/teklif GET ve teklif oluşturma motoru değişmedi.
- `GET /api/cloud/workspace/finance/sales/{saleId}?company=…&activity=…&through=YYYY-MM-DD` → POSTED/REVERSED/LEGACY_UNPOSTED, journal/cari bağlantısı, net/KDV/brüt ve ilgili cari hesabın tarih itibarıyla ekstresi/bakiyesi. Hesap bakiyesi tüm cari hareketlerini kapsar; tek satışın tahsis edilmiş kalan borcu değildir. Maliyet veya FX snapshot'ı bu yanıta eklenmez.
- Cari sistem karşı hesapları hesap listesi ve party ekstresinden gizlenir. RLS hem satış hem finans kaynaklarında uygulanır; seçili activity ve gerçek kaydın finans yetkisi de denetlenir.
- Satış oluşturma mevcut `sales.create` yanında `finance.accounts`, `finance.approve` ve güncel MFA step-up ister. İzin şablonları genişletilmedi. Finans bağlantısı okuması ayrıca `sales.view` ister. MASTER dahil explicit DENY geçerlidir.
- Mevcut satışlar zaten immutable ve normal iptal endpoint'i yoktur. `POST sales/{id}/cancel` bu pakette de 404 verir. Finans düzeltmesi K1'in gerekçeli ters kayıt API'sidir: satışın **üç satırı da** borç/alacak değiştirilerek terslenir, kaynak satış ve snapshot'lar korunur. Satışa bağlı ters kayıt ayrıca `sales.cancel` ister; DENY ile API ve DB komutu reddedilir. Bu temel, satışa yeni bir silme/durum güncelleme motoru eklemez.
- Runtime'a finans DML veya executor SET üyeliği verilmedi. Yeni SECURITY DEFINER function'ın PUBLIC EXECUTE'u kapalı; yalnız fixture runtime EXECUTE var. K1 RLS/FORCE RLS, append-only, idempotency, MFA ve audit yapısı korunur. Hatalar SQL/bind/tutar payload'ını döndürmez.

## Yerel şema ve açık engeller

`scripts/accounting/local-schema.sql` K1 dosyası byte-identical korundu. Yeni `k2-local-schema.sql`, mevcut 001–016 ve K1 hazırlığı sonrasında yalnız doğrulanmış yerel PG18.6 fixture'da çalışır; canonical migration dizinine eklenmedi ve `_prisma_migrations` kaydı üretmez. Mevcut harness'in normal tam profili artık K1+K2 hazırlığını ve iki accounting suite'ini içerir. `--accounting-profile` eski K1-only kabul profilini korur. Tedarikçi/satın alma regresyonlarındaki şema sayı beklentisi yalnız accounting fixture'da 50 tabloya uyarlandı; backup allowlist hâlâ 35/21 ve kapsam kapısı kapalıdır.

Migration016 SHA-256 değişmedi: `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`. İlk 15, checksum kayıtları ve Git LF kuralları korundu. Güvenli cloud 016/gelecek017 dağıtımı hâlâ BLOCKED; `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` değişmedi. Provider rol/ACL davranışı yerel kanıtla kabul edilmedi.

Bağımsız şifreli backup + gerçek restore kabulü, managed object audit ve recovery `br-late-river-baeipun8 / token_roles / ROLE_DELTA_UNRESOLVED` engelleri sürer. Yeni backup motoru, Neon/R2/restore/snapshot işlemi, `.env.local` değişikliği veya Git stage/commit/push yoktur. Tahsilat, ödeme, kasa, banka, POS ve allocation **K3'e bırakıldı**.

## K2'nin kesin dosya listesi (15)

1. `src/lib/cloud/contracts.ts`
2. `src/lib/cloud/sale-source.ts`
3. `src/server/cloud/business/documents.ts`
4. `src/server/cloud/business/accounting/accounts.ts`
5. `src/server/cloud/business/accounting/ledger.ts`
6. `src/server/cloud/business/accounting/sales.ts`
7. `scripts/accounting/k2-local-schema.sql`
8. `scripts/accounting/verify-k2.ts`
9. `scripts/stock/verify-local.ts`
10. `scripts/suppliers/verify.ts`
11. `scripts/purchases/verify.ts`
12. `tests/accounting-sale-source.test.ts`
13. `research/PUSULA_ACCOUNTING_K2_REPORT.md`
14. `docs/validation/PUSULA_ACCOUNTING_K2_VERIFICATION.md`
15. `LAST_REPORT.md` — K1 ve önceki içerik korunarak yalnız K2 özeti başa eklendi.

Başlangıçta bekleyen diğer K1 ve kullanıcı dosyaları teslim ağacında korunur; yukarıdaki liste yalnız K2 değişiklikleridir. [Gerçek test kanıtı](../docs/validation/PUSULA_ACCOUNTING_K2_VERIFICATION.md).
