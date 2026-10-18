# Sprint E / E1 — ön denetim

18.10.2026. **E1 kurulum bekliyor; Sprint E tamamlanmadı.**

## Kanıt

- Başlangıç `00cf549`, `feat/pusula-v030-neon-cloud`; başarılı fetch sonrası upstream 0/0, çalışma ağacı temiz. D7 rapor commit'i zaten teslim edilmiş.
- README, ROADMAP, ARCHITECTURE, LAST_REPORT, NEON_CLOUD, BACKUP_RECOVERY, AUTHORIZATION ve SPRINT_D7_UI incelendi.
- Sırları yazdırmadan bağlantılar karşılaştırıldı: auth ve işletme aynı `pusula_development` DB'sinde ayrı rollerle; test bağlantıları `pusula_sprint_b_test` DB'sinde. Tek DB için transaction-consistent tam dump planlanır.
- Allowlist endpoint ve TLS verify-full kontrolü sonrası iki hedefte yalnız BEGIN READ ONLY, katalog SELECT ve ROLLBACK çalıştı. İkisi de PostgreSQL **18.6**, public şemasında **35 tablo**, **21 RLS / 21 FORCE RLS** tablo. Bu sayım restore veya non-owner RLS testi değildir.
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, BACKUP_ENCRYPTION_KEY, BACKUP_SOURCE_DATABASE_URL, BACKUP_RESTORE_TEST_DATABASE_URL ve CLOUDFLARE_API_TOKEN mevcut süreç/env yüklemesinde yok. Hesap/bucket listesi doğrulanamadı; hesapta bucket olmadığı iddia edilmez.
- pg_dump/pg_restore/wrangler PATH'te bulunmadı; disk genelinde araç araması yapılmadı. Mevcut test DB doludur, boş restore hedefi olamaz.

## Aşama kapısı

Kullanıcının eksik dış servis kurulumu noktasında durma talimatı nedeniyle E2–E5 yürütülmedi. R2 kurulumu, mevcut bucket ayarlarının denetimi, bucket-scope kimlik, PostgreSQL18 araçları ve ayrı onaylanmış boş restore hedefi gerekir. Owner/runtime/auth kimlikleri backup hesabına dönüştürülmedi; grant/migration uygulanmadı. Gerçek mail, ücretli servis veya scheduler açılmadı.

## Maliyet — varsayım, gerçek fatura değil

[R2 resmî fiyatları](https://developers.cloudflare.com/r2/pricing/) 18.10.2026 tarihinde kontrol edildi: Standard 0.015 USD/GB-ay; ücretsiz 10 GB-ay, 1 milyon Class A, 10 milyon Class B. A:4.50 USD/milyon; B:0.36 USD/milyon. Aşım faturalama birimi yukarı yuvarlanır; kota hesaptaki diğer kullanımlarla paylaşılabilir. R2 internet egress ücretsiz; diğer sağlayıcı compute/transfer ücretleri ayrıdır.

Örnek: firma başına sıkıştırılmış/şifreli tam dump0.1 GB, sabit veri boyutu; günlük30 + haftalık12 + aylık36 = en fazla78 kopya. Bir nesnenin çoklu etiketi kopya sayısını azaltır. Yıllık hukuki arşiv ve gerçek büyüme dahil değil.

| Firma | Tek dump | 78 kopya | Aylık R2 depolama |
| --- | --- | --- | --- |
| 1 | 0.1 GB | 7.8 GB | 0 USD |
| 10 | 1 GB | 78 GB | 1.02 USD |
| 100 | 10 GB | 780 GB | 11.55 USD |

Ay boyunca sabit kullanım ve10 GB kotanın boş olduğu varsayıldı. Silme kapalıyken78 kopya sınırı uygulanmaz; her ek günlük dump depolamayı büyütür. PUT/GET, multipart parça ve manifest işlemleri ölçülmeden kesin API maliyeti verilemez; günlük birkaç işlem kota içinde kalabilir, garanti değil.

Scheduler adayı GitHub Actions Linux hosted runner. [Ücretlendirme](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [sınırlar](https://docs.github.com/en/actions/reference/limits), [schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). Private repo kotası plana bağlı; gerçek plan/kalan dakika bilinmiyor. 30 x10 dakika =300 dakika/ay varsayımı; backup compute aynı runner'a dahil. Gerçek süre/plan/harcama onayı olmadan etkinleştirilmez. Schedule default branch'te çalışır ve gecikebilir/atlanabilir; feature dalına cron eklemek çalışan otomasyon değildir. Main merge yasak olduğundan dağıtım kararı ayrıca gerekir. Haricî >26 saat freshness kontrolü planlanmalıdır.

Restore compute/DB, Neon okuma compute'u ve operatör emeği ölçülmedi. Mevcut güvenli offline anahtar deposu ek servis ücreti gerektirmeyebilir; ücretli KMS seçilmedi. R2 gerçek kullanım/fatura erişimi yok.

## Kabul soruları

| No | Yanıt |
| --- | --- |
| 1–2 | Bucket oluşturulmadı; mevcut bucket ve bağlantı doğrulanamadı. |
| 3–6 | Dump, şifreleme, upload, indirme/hash doğrulaması yapılmadı. |
| 7–8 | Restore yapılmadı; scheduler çalışmıyor. |
| 9–10 | Alarm testi yok; retention taslak, otomatik silme kapalı. |
| 11 | Restore sayım/ilişki/RLS/Decimal/snapshot testi yapılmadı. |
| 12 | Master/Auth kayıtlarına müdahale edilmedi; restore güvenliği henüz doğrulanmadı. |
| 13 | Yukarıdaki tahminler varsayımsal; gerçek fatura bilinmiyor. |
| 14 | E2–E5 ve production kabulü bekliyor. |

Yalnız dokümantasyon/env şablonu değişti. Uygulama, paket, migration ve gerçek env değişmedi. Build/lint/unit/DB/Auth/API/Cloud/E2E bu E1 duraklamasında yeniden çalıştırılmadı; D7 sonuçları tarihsel kanıt. Tam regresyon E5'te çalıştırılacak. İlk salt okunur komut PowerShell quoting nedeniyle SQL'e ulaşmadan reddedildi; here-string ile düzeltilen koşu yukarıdaki katalog sonuçlarını verdi.
