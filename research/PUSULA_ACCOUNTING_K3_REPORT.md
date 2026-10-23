# PUSULA — K3 tahsilat, ödeme, kasa, banka ve POS

22 Ekim 2026 · `feat/pusula-v030-neon-cloud` · HEAD `fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9`.

**K3_LOCAL_PASS. Bulut dağıtımı ve gerçek verili pilot BLOCKED.** K1/K2 journal/posting ve satış motorları genişletildi; müşteri, fiyat veya satış motoru yeniden yazılmadı. K1/K2 raporları, hazırlık SQL'leri, kabul test kaynakları ve üç kullanıcı plan dosyası korundu.

## Çalışan akış

- Satış journal'ına bağlı nakit, banka/EFT ve manuel terminal onaylı kart tahsilatı. Kısmi/tam tahsilat, belge kalanı ve cari genel bakiye ayrıdır. Kaynak tutardan fazla tahsis reddedilir; entity düzeyindeki transaction advisory lock eşzamanlı tahsilatların aynı kalanı aşmasını engeller.
- Supplier cari hesabına bağlı **onaylı brüt borç belgesi**: belge referansı, tarih/vade, tutar, onaylayan aktör ve audit. Oluşturma finance.approve + finance.payables + MFA ister. PO onayı borç değildir. Peşin/tam veya kısmi ödeme bu açık belgeye tahsis edilir; belgesiz avans oluşturulmaz. Bu dar belge yasal fatura, kalem/KDV veya mal kabul motoru değildir. Açılış bakiyesinde zaten kapsanan eski borçlar yeniden belgeye alınmadan önce kesim/mutabakat gerektirir; otomatik aktarım yoktur.
- Her scope'ta TRY CASH, BANK ve POS hesabı; ayrı açılış, bakiye ve tarihli hareketler. K3 bu aşamada her türden tek hesap destekler. Kasa/banka/POS için eksi bakiye yasaktır: yalnız son toplam değil, tarih sırasındaki tüm ara bakiyeler kontrol edilir. Gelecek tarihli giriş geçmiş tarihli ödemeyi finanse edemez.
- Kart tahsilatı sadece POS bekleyeni artırır. Settlement kaynak kart tahsilatına ayrıca tahsis edilir: POS brüt alacak; banka net borç; komisyon borç. Banka/terminal/settlement referansları zorunludur; ekonomik referans tekrarı yeni intent/request ile de ikinci hareket oluşturmaz. Kart numarası/CVV alanı yoktur; strict sözleşme bu alanları reddeder.
- Düzeltme append-only ters journal/posting, ters allocation ve ters fon hareketi üretir. Settlement varken kart tahsilatı; tahsis varken satış/borç belgesi terslenemez. Önce bağımlı hareketler terslenir. Ters kayıt sonucu da eksi bakiye kontrolüne tabidir. K1/K2'nin satış cancel yetkisi ve immutable kaynakları korunur.

## Defter ve işlem güvenliği

Yeni hazırlık `scripts/accounting/k3-local-schema.sql`, yalnız mevcut 001–016 → K1 → K2 sonrasında aynı izole PostgreSQL18.6 harness'inde uygulanır. Canonical migration veya ikinci migration geçmişi oluşturulmadı; başarılı `_prisma_migrations` sayısı16 kalır.

K1/K2'nin üç finance tablosuna `FinanceIntent`, `FinanceAccountAccess`, `FinanceOperation`, `FinanceAllocation`, `FinanceFundMovement` eklendi. Operation, allocation ve para hareketleri immutable; journal/posting ile tek transaction'dadır. Deferred kontroller dengeyi, satır sayısını, scope'u, tahsis ve fon hareketlerinin posting'lerle eşleşmesini zorunlu kılar. Intent yalnız güvenli kapatma yönünde güncellenebilir; finans kaydı silinmez. AccountAccess yetkili grant/revoke metadatasıdır; değişiklik audit edilir.

Yeni satış/tahsilat/ödeme taslağı için sunucu kalıcı UUID intent üretir. Aynı client taslak anahtarı aynı intent'i verir. Aynı intent farklı request key ile tekrar gönderilse bile tek ekonomik kayıt kalır; değişen payload reddedilir. Banka/terminal/borç belge referansı ayrıca ekonomik tekillik sağlar. Nakit olayının kimliği sunucunun verdiği makbuz/intent'tir; iki ayrı gerçek nakit işlemi yeni taslak olarak açılır.

`/app` satış akışı artık `sourceRef`'i kullanıcıya yazdırmaz: sunucu intent'inden üretir ve aynı satış süresince korur. İki ayrı gerçek ama aynı içerikli siparişin intent'leri farklıdır; K2 içerik-hash fallback'i bu akışta yanlış engel oluşturmaz. Eski API istemcileri için K2 fallback'i korundu.

Belirsiz POST sonucunda **otomatik tekrar POST yoktur**. UI sessionStorage'da yalnız scope'a bağlı opak intent referansını saklar; tutar, finans kaydı veya bakiye saklamaz. Sonuç `SUCCEEDED / NOT_COMMITTED / CANCELLED` olarak sorgulanır. NOT_COMMITTED, sorgu anında kesinleşmiş kayıt görünmediğini anlatır; kullanıcı yeni bir ekonomik olay açmadan önce eski intent'i güvenle kapatabilir. Kapatma posting ile aynı entity lock'ını alır: kesinleşmiş işlem kapatılamaz, kapatılan intent'in geç gelen POST'u reddedilir. Satışta belirsiz sonuç varsa modal kapanır ve referansla kurtarma kontrollerine erişim sağlanır.

## Yetki ve veri gizliliği

Beş yeni tabloda ENABLE/FORCE RLS, tenant/company/exact activity ve oturum kullanıcısı zorunlu. FinanceAccountAccess, normal personelin yalnız atanmış para hesaplarını kullanmasını sağlar. finance.accounts yanında CASH için finance.cash, BANK/POS için finance.bank; işlem için finance.collect/pay; borç belgesi için finance.payables/approve; settlement/ters kayıt için approve gerekir. MASTER dahil explicit DENY geçerlidir. Yetkiler gerçek cari/kaynak sahibi üzerinde de kontrol edilir; OWN izni başka aktörün belgesine taşınmaz.

Normal personel finans yazımı için finance.approve'a otomatik yükseltilmez. Sadece denetlenmiş SECURITY DEFINER komutu yazabilir. Runtime tüm finans tablolarında doğrudan DML'den ve executor SET üyeliğinden mahrumdur. Eski implementation function'larının runtime EXECUTE'u kaldırıldı; K1/K2 girişleri allocation/reversal guard'larından geçer. PUBLIC EXECUTE kapalı, executor NOLOGIN/NOSUPERUSER/NOBYPASSRLS'dir. Replay ve sonuç sorguları güncel hesap/işlem yetkisini tekrar kontrol eder. MFA step-up tüm finans POST'larında korunur; audit özetine tutar veya terminal bilgisi kopyalanmaz.

## API ve `/app`

Mevcut `finance/accounts`, party statement, `finance/sales/{id}` ve `finance/reversals` genişletildi. Satış finans yanıtında artık tek belgenin `outstanding` tutarı da vardır; cari ekstre bakiyesiyle karıştırılmaz.

| Yol (`/api/cloud/workspace/finance/`) | İşlev |
| --- | --- |
| POST `intents`, POST `cancel-intent`, GET `outcome/{intentId}` | Kalıcı taslak kimliği, güvenli kapatma, sonuç sorgusu |
| GET/POST `funds`, POST `fund-opening` | Yetkili para hesapları, bakiye/hareket, açılış |
| POST `access` | Yetkili hesap atama veya kaldırma |
| GET `documents?party=CUSTOMER/SUPPLIER` | Kaynak belge brüt/kalan tutarı |
| POST `debt`, `collect`, `pay`, `settle` | Onaylı borç, tahsilat, ödeme ve POS settlement |

CloudDesk'e **Cari ve Finans** eklendi: müşteri/tedarikçi belgeleri, cari ekstre, satıştan tahsilat, tedarikçi ödemesi, fon bakiyeleri/hareketleri, açılış, borç onayı ve settlement. Mevcut kart adları yetki varsa kullanılır. Türkçe tutar ve `gg.aa.yyyy` girişi Decimal/ISO sözleşmesine doğrulanarak dönüştürülür. Demo/localStorage bakiyesi kullanılmaz. Liste sınırları:200 belge,200 fon hareketi, K1 ekstre1000; fon bakiyesi tüm hareketlerden hesaplanır. Bir işlem bir kaynak belgeye tahsis edilir; toplu çok-belgeli ödeme bu pakette yoktur.

## Açık bulut/pilot engelleri

Gerçek cloud API kapısı hâlâ `ACCOUNTING_CLOUD_REVIEW_REQUIRED`. Migration016 SHA-256 `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`; ilk15 ve tarihsel checksum/LF kuralları değişmedi. `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` korunur. Yerel55 tablo/41 FORCE RLS kabulü provider kabulü değildir; finansın gerçek016 sonrası migration hattı ve managed post kabulü henüz hazır değildir.

Backup motoru değiştirilmedi;35/21 allowlist'i ve managed object audit/bağımsız şifreli backup+gerçek restore engeli sürer. Recovery `br-late-river-baeipun8`, `token_roles / ROLE_DELTA_UNRESOLVED` değişmedi. Gerçek veri pilotu açılamaz. Neon/R2/restore/snapshot işlemi, `.env.local` değişikliği veya Git stage/commit/push yapılmadı.

## K3 dosyaları (18)

1. `src/lib/cloud/treasury-contracts.ts`
2. `src/lib/cloud/tracked-sale.ts`
3. `src/components/finance-desk.tsx`
4. `src/components/cloud-desk.tsx`
5. `src/server/cloud/business/accounting/accounts.ts`
6. `src/server/cloud/business/accounting/sales.ts`
7. `src/server/cloud/business/accounting/treasury.ts`
8. `scripts/accounting/k3-local-schema.sql`
9. `scripts/accounting/verify-k3.ts`
10. `scripts/stock/verify-local.ts`
11. `scripts/suppliers/verify.ts`
12. `scripts/purchases/verify.ts`
13. `tests/accounting-treasury.test.ts`
14. `tests/accounting-tracked-sale.test.ts`
15. `tests/auth-e2e/k3.spec.ts`
16. `research/PUSULA_ACCOUNTING_K3_REPORT.md`
17. `docs/validation/PUSULA_ACCOUNTING_K3_VERIFICATION.md`
18. `LAST_REPORT.md` — önceki içerik aynen korunarak yeni özet.

Supplier/Purchase testlerinde yalnız yeni fixture'ın55 tablo beklentisi eklendi; backup allowlist'i genişletilmedi. Başlangıçta bekleyen diğer K1/K2/kullanıcı dosyaları aynen çalışma ağacındadır. [Test kanıtı](../docs/validation/PUSULA_ACCOUNTING_K3_VERIFICATION.md).
