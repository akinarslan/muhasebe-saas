# K2 — satış/cari gerçek yerel doğrulama

22 Ekim 2026 · **K2_LOCAL_PASS**. Bulut ve gerçek verili pilot **BLOCKED**. [Kapsam/kurallar](../../research/PUSULA_ACCOUNTING_K2_REPORT.md).

## Bu görevde gerçekten çalıştırılanlar

| Komut | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS — 37 dosyada 430 test; 2 yeni business-source testi |
| `npx.cmd tsc --noEmit` | PASS — exit 0 |
| `npm.cmd run lint` | PASS — exit 0 |
| `npm.cmd run build` | PASS — exit 0, Prisma generate + Next production build |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS — 9 Git LF/tarihsel checksum kontrolü |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture` | PASS — yeni izole PG18.6, aşağıdaki tüm suite'ler |
| `git diff --check` ve korunan dosya hash karşılaştırması | PASS |

Nihai fixture: **`v42-78a53dd5-588e-4db8-831b-9688ffdcc312`**. `status=PASS`, `serverStopped=true`, `failureCode=null`. Loopback/SCRAM/UUID marker, PG180006 ve gerçek process/data-directory kimliği mevcut harness tarafından doğrulandı. `neonOperations=false`, `r2Operations=false`.

Gerçek suite sonuçları: DB11, Auth62, **K1 20**, müşteri/satış/Cloud11, **K2 15**, Supplier16, Purchase28, Stock36. Mevcut yerel Prisma016 apply, pre/post ACL/history, rollback, lock ve drift testleri de aynı harness'te yeniden geçti. Bunlar yalnız izole yerel fixture işlemleridir. K1 raporunun tarihsel sonuçları yeni testin yerine kullanılmadı.

Ham yerel kanıtlar `.data/k2/{fixture-final,vitest,tsc,lint,build,git-lf-artifact}.log`; fixture dizinindeki `verification.json` ve suite log'larıdır. Hassas fixture/Auth verileri Git teslimine eklenmez.

## K2'nin 15 kontrolü

1. Yeni gerçek Customer, material/variant/product ve mevcut manuel kur API'si ile satış. 100×200cm ×5 = 10m²; 152cm rulo ve 2cm payla malzeme maliyeti USD31.008, manuel net USD100 ve mevcut USDTRY40 snapshot → **net TRY4000.00 + KDV800.00 = brüt4800.00**. Eksik Customer cari hesabı aynı transaction'da oluşturulur. Journal'ın üç satırı: CUSTOMER borç4800, REVENUE alacak4000, VAT alacak800.
2. `finance/sales/{saleId}` ile cari/journal bağlantısı, vade ve ekstrede4800.00 bakiye; maliyet snapshot ifşası yok.
3. Aynı isteğin eşzamanlı replay'i aynı satış ID'si; yalnız request key değiştirilince409 ve tüm tablo sayıları aynı.
4. Ayrı gerçek satış `sourceRef` ile ayrılır; aynı sourceRef değişen request key/notes ile tekrar kullanılamaz.
5. Fixture executor'ından posting INSERT geçici kaldırılarak **geç finans hatası** enjekte edilir; satış/satır/journal/posting/hesap/audit sayıları birebir önceki gibidir. Yetki finally bloğunda yerel olarak geri verilir.
6. Journal olmadan bare yeni satış COMMIT'i deferred constraint ile reddedilir; satış kalmaz.
7. Önceki müşteri/satış suite'inin gerçekten onayladığı tarihsel import LEGACY_UNPOSTED kalır; doğrudan posting/backfill reddedilir.
8. Yanlış tenant ve kimlikle finance RLS boş; doğrudan posting reddi; oturumsuz API401 ve yabancı entity404.
9. MASTER için finance.accounts, finance.approve ve sales.create explicit DENY ayrı ayrı satış oluşturmayı403 ile reddeder; yarım kayıt yok. Finance.accounts DENY finans bağlantısı okumasını da engeller.
10. `sales.cancel` DENY, satışa bağlı finans ters kaydını reddeder.
11. Yetkili ters kayıt üç posting'i tersler; kaynak satışın maliyet/net USD/rate snapshot'ı değişmez. İkinci ayrı satışın alacağı açık kalır. İptal endpoint'i404 ve journal silme reddi.
12. Runtime doğrudan finans DML, PUBLIC function EXECUTE ve executor SET üyeliği kapalıdır.
13. USD-denomine yeni satış, doğrulanmış çoklu para birimi kabulü olmadan409 + tam rollback.
14. Eksik fixture marker ile yeni satış bulut kapısı503; fallback veya cari kayıtsız yeni satış yok.
15. Güncel MFA step-up olmadan satış403; başarılı migration geçmişi hâlâ16.

K1'in değiştirilmemiş 20 test kaynağı açılış/ekstre, Decimal, iki taraflı denge, source/replay, rollback/audit, immutable, yetki/RLS ve kapalı bulut kapısını yeni K2 hazırlığıyla tekrar doğruladı. Supplier/Purchase/Stock suite'leri önceki satış/teklif snapshot'larının değişmediğini de kontrol etti.

## Geliştirme sırasında görülen ve düzeltilen hatalar

İlk fixture `v42-7e5c3253-7cb3-4d7d-b31f-9d74daff8918`: yeni bare-sale constraint mevcut tarihsel importu durdurdu. Onaylı tarihsel import için işaret + kayıt + CONFIRMED batch + yetki denetimli istisna eklendi; yeni normal satış kontrolü kaldırılmadı.

Ara fixture'lar `v42-1d87ee51-f968-4d5e-8fa1-1448ef3fe88b` ve `v42-206cfbef-53ed-47a8-b059-6fc0c7c5ca83`: K2/K1 işlevleri geçerken Supplier/Purchase testlerinin eski47 tablo beklentisi yeni50 tabloyu reddetti. Yalnız accounting fixture beklentisi düzeltildi; backup35/21 allowlist kabulü genişletilmedi. Tüm bu fixture sunucuları kapatıldı. Nihai tam PASS yukarıdaki ayrı fixture'dır; ara başarısız sonuçlar gizlenmedi.

## Korunan sınırlar

Başlangıç hash snapshot'ı `.data/k2/start-hashes.json` ile üç kullanıcı plan dosyası, K1 rapor/doğrulama/SQL/test kaynağı, `.env.local` ve 001–016 migration SQL byte'ları aynıdır. `LAST_REPORT.md` K2 öncesi tüm içeriğini aynen korur. Migration016 SHA-256:

`27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`

Managed `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` ve tarihsel checksum kuralları değişmedi. K1/K2 hazırlıkları canonical migration değildir; ikinci geçmiş, resolve veya otomatik bulut deploy yoktur. Yerel profilin 47/33 kontrolü accounting öncesi stock baseline'dır; accounting sonrası50 tablo, backup kapsamının güncellendiği anlamına gelmez.

Gerçek Neon SQL/DDL/DML, R2, backup/restore, recovery/branch/snapshot veya Git stage/commit/push yapılmadı. Provider davranışı henüz kanıtlanmadı. `ROLE_DELTA_UNRESOLVED`, managed post kabulü ve bağımsız şifreli backup + gerçek restore engelleri sürer. Tahsilat/ödeme/kasa/banka/POS/allocation K3 kapsamındadır ve burada geliştirilmedi.
