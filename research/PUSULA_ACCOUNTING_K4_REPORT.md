# PUSULA — K4 işletme giderleri ve günlük finans paneli

23 Ekim 2026 · `feat/pusula-v030-neon-cloud`.

**K4_LOCAL_PASS — yalnız izole PostgreSQL 18.6 kabulü. Bulut/pilot BLOCKED.** 460 Vitest, 227 adlandırılmış API/SQL kontrolü, masaüstü/mobil 2 tarayıcı testi, TypeScript, ESLint ve production build geçti. Fixture `v42-c553c928-daa1-479f-82d1-f0124806b9ab`, `serverStopped=true`.

## Uygulama

`CloudExpenseType` değiştirilmedi ve gider belgesi olarak kullanılmadı. Ayrı, immutable `FinanceExpense` belgesi; tarih/vade, açıklama, belge referansı, isteğe bağlı mevcut Supplier bağlantısı, net/KDV ve ödeme şekli taşır. Sekiz kategori uygulama sözleşmesi ve DB CHECK ile aynı kapalı sözlüğe bağlıdır: kira, elektrik, personel, nakliye, makine bakım, mürekkep/sarf, montaj ve diğer işletme giderleri. Kategoriye göre otomatik vergi veya bordro hesabı yapılmaz.

- Peşin gider: EXPENSE net borç + INPUT_VAT borç + CASH/BANK brüt alacak; belge, journal, üç posting, operation, fon çıkışı ve audit aynı transaction'dadır. Tedarikçi zorunlu değildir.
- Vadeli gider: aynı gider/KDV borçları karşılığında mevcut tedarikçi cari hesabına brüt alacak. Tedarikçi ve vade zorunludur. Yeni party motoru yoktur. Eksik cari hesap mevcut K1 komutuyla transaction içinde açılır.
- Vadeli gider ödemesi mevcut K3 PAY/allocation motorundan geçer. Kaynak kabulü yalnız DEBT yanında EXPENSE belgesine genişletildi; yeni ödeme, kasa veya POS motoru yazılmadı. Ödeme yeni gider oluşturmaz. Kalan ve ödeme durumu allocation'lardan tarih itibarıyla türetilir.
- Stok alımı, duran varlık yatırımı, üretim maliyet tarifesi ve iş bazlı maliyet tahmini bu gider yoluna taşınmaz. Ekran bu sınıflandırma sınırını açıklar. KDV kullanıcı tarafından belgeye göre ayrılır; indirilebilirlik, bordro/stopaj ve yasal beyanname hesabı bu kesitin kapsamında değildir.
- Düzeltme mevcut K3 append-only reversal yoludur. Aktif ödeme tahsisi varken gider terslenemez; önce bağlı ödemeler terslenir. Belge silinmez. Giderin kaynak dönemi korunur, ters kayıt kendi bookedOn dönemine eksi gider/ödeme olarak yansır.

## Finans özeti

Yeni `GET finance/summary?from=YYYY-MM-DD&through=YYYY-MM-DD` tek PostgreSQL sorgusunda journal/posting ve operation/allocation kayıtlarından hesaplanır. Demo bakiye veya localStorage finans verisi yoktur.

Net/KDV/brüt satış; tahsilat/ödeme; kasa/banka/POS; müşteri alacağı/tedarikçi borcu; vadesi geçmiş kaynaklar; dönem gideri net/KDV/brüt; bitiş tarihinin ayına ait net gider; kasa+banka nakit hareketi ve tahmini iş kârı ayrıdır. Hareket kartları seçilen döneme, bakiye ve borçlar bitiş tarihine aittir. Açılışlar bakiyelere girer; satış/tahsilat/ödeme veya operasyonel nakit hareketi sayılmaz. Cari açılış komutu yalnız CUSTOMER/SUPPLIER kabul eder; para hesabı açılışı K3 fon komutundan geçmek zorundadır.

Satış toplamları yalnız satış journal'ları ve bunların ters posting'lerinden hesaplanır; eski LEGACY_UNPOSTED satışların otomatik backfill'i yoktur. Tedarikçi toplamı açılış, mevcut onaylı borç ve gerçek işletme giderlerini cari ledger üzerinden kapsar. Vadesi geçmiş tutar, pozitif açılış/satış kaynaklarının tarih itibarıyla tahsis edilmemiş kısmıdır; tahsis edilmemiş başka bir alacak dekontu otomatik olarak bu belgelere dağıtılmaz.

Tahmini iş kârı, muhasebeleştirilmiş satışın net TRY tutarı eksi satış snapshot'ındaki costUsd × rateSnapshot.value tutarıdır. Giderler ve POS komisyonları bu tahminden düşülmez; dönem muhasebe kârı diye sunulmaz. JSON tutarları Decimal/string, DB numeric(18,2); UI gösteriminde de para Number'a çevrilmez.

## Ekran ve yetki

Mevcut CloudDesk → Cari ve Finans düzenine `ExpenseDesk` eklenir: peşin/vadeli gider formu, belge/kategori listesi, ödeme durumu/kalan, tarih filtreleri, bugün/bu ay düğmeleri ve finans kartları. Müşteri ve tedarikçi ekstreleri mevcut FinanceDesk üzerinden açılır. Vadeli gider, aynı ekrandaki tedarikçi borçları bölümünden ödenir. Türkçe `2.500,00` ve `gg.aa.yyyy` girişleri mevcut doğrulayıcılardan geçirilir.

Okuma `finance.accounts` + `finance.payables`; yazma ayrıca `finance.approve` + güncel MFA ister. Peşin yazma `finance.pay` ve yetkili CASH/BANK hesabı ister. Tam özet ayrıca `reports.finance`, `finance.approve`, `finance.cash`, `finance.bank`, `sales.view`, `materials.costView` ve kapsam genelinde izin ister; OWN-only kısmi veri tam toplam gibi sunulmaz. Maliyet DENY'ı kâr üzerinden türetme yoluyla aşılamaz. Normal rol şablonlarına izin eklenmedi. Explicit DENY MASTER için de geçerlidir. DENY sonrasında gider outcome ve close, gizlenmiş operation'ı NOT_COMMITTED veya CANCELLED gibi göstermeden reddedilir.

Yeni tabloda ENABLE/FORCE RLS, tenant/company/exact activity, composite FK, immutable trigger ve deferred belge/posting eşleşme kontrolü vardır. Runtime yalnız SELECT/EXECUTE alır; doğrudan finans DML ve executor rol üyeliği yoktur. Definer sahibi mevcut NOLOGIN/NOBYPASSRLS executor; sabit search_path ve kapalı PUBLIC EXECUTE korunur. K3 entity transaction kilidi, geçmiş dahil negatif fon bakiyesi kontrolü, allocation sınırları ve POS settlement aynen kullanılır.

İstek kimliği sunucu EXPENSE intent'idir. Aynı intent yeni request key ile aynı sonucu verir; payload değişikliği reddedilir. Tedarikçi+belge referansı company içinde, tedarikçisiz belgede de referans tekildir; farklı intent ile ikinci kayıt transaction'ı rollback eder. Belirsiz POST sonucu otomatik tekrar gönderilmez; mevcut opak referans/sonuç sorgulama/güvenli kapatma UI'sı kullanılır.

## Yerel zincir ve bulut sınırı

`scripts/accounting/k4-local-schema.sql`, 001–016 + değişmemiş K1/K2/K3 SQL hazırlığının yerel ardılıdır. Yalnız fixture_admin, loopback, beklenen DB adı, PostgreSQL 18.6, 16 başarılı migration ve sabit 016 checksum ile uygulanabilir. `_prisma_migrations` kaydı veya canonical 017 eklenmez. Harness `--k4` ile bu hazırlığı etkinleştirir; eski profiller korunur.

İlk 16 SQL ve checksum'lar değiştirilmedi. 016 SHA-256: `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`. `ACCOUNTING_CLOUD_REVIEW_REQUIRED`, managed `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` kapıları sürer. Yeni şema yerelde 56 tablo/42 FORCE RLS'dir; provider kabulü değildir.

Backup motoru/35 tablo–21 RLS allowlist'i genişletilmedi. Managed object audit, bağımsız şifreli backup + gerçek restore ve recovery `br-late-river-baeipun8 / token_roles / ROLE_DELTA_UNRESOLVED` engelleri devam eder. Gerçek Neon SQL, R2, backup/restore, snapshot, production ve Git commit/push/merge yapılmadı.

[Gerçek doğrulama kanıtı](../docs/validation/PUSULA_ACCOUNTING_K4_VERIFICATION.md).

## K4 dosya kapsamı

- Yeni kaynaklar: `src/lib/cloud/expense-contracts.ts`, `src/server/cloud/business/accounting/expenses.ts`, `src/components/expense-desk.tsx`.
- Mevcut entegrasyon: `treasury-contracts.ts`, `accounting/accounts.ts`, `finance-desk.tsx`.
- Yerel hazırlık ve kabul: `scripts/accounting/k4-local-schema.sql`, `verify-k4.ts`, `scripts/stock/verify-local.ts`; K3/Supplier/Purchase fixture katalog beklentileri.
- Testler: `tests/accounting-expenses.test.ts`, `tests/auth-e2e/k4.spec.ts`.
- Bu rapor, K4 doğrulama belgesi ve yalnız başına özet eklenen `LAST_REPORT.md`.

Başlangıçtaki kullanıcı değişiklikleri korundu. K1/K2 kaynak testleri, K1/K2/K3 SQL ve raporları byte-identical; K3 test kaynağında yalnız K4 fixture için katalog 56/42 beklentisi eklendi. Satış, müşteri, fiyat, stok, satın alma ve POS motorları yeniden yazılmadı.
