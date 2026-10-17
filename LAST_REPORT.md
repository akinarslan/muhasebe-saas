# PUSULA v0.3 — Sprint D / Gerçek bulut kayıtları

17.10.2026 · `feat/pusula-v030-neon-cloud` · Development teslimi. **v0.3 production kabulü ve Sprint E tamamlanmış değildir.**

## Sonuç

`/app` gerçek Neon PostgreSQL çalışma alanıdır: müşteri, malzeme/varyant/USD fiyat geçmişi, ürün, gider, teklif revizyonu, satış/satır/TRY vade planı ve kontrollü import sunucu servislerine bağlandı. `/` dashboard/satış/müşteri/maliyet modülleri ayrı localStorage demosu olarak korunur. Gerçek kullanıcı verisi bu geliştirme sırasında otomatik taşınmadı; eski taslaklar ve tarayıcı anahtarları silinmedi.

Neon development dalı `br-rough-darkness-ba6ow9zo`; uygulama `pusula_development`, otomatik testler `pusula_sprint_b_test`. Production'a SQL/test/migration uygulanmadı. Ücretli hizmet, Neon Auth veya bağımsız yeni servis açılmadı. Better Auth + TOTP, Master/override, son Master ve session revoke korundu. Gerçek Resend mesajı gönderilmedi.

## Kalıcılık ve fiyat güvenliği

- Müşterinin segment, il/ilçe, vergi/iletişim/adres/not/vade ve aktifliği kalıcıdır. Arama, düzenleme, detay ve arşiv UI'si vardır. `activityId=null` şirket geneli müşteri birden fazla faaliyette kullanılabilir. Aynı CustomerDrawer müşteri ve satış/teklif ekranlarında sunucu modelini kullanır; demo çağrıları çalışmaya devam eder.
- Katalog kategori/marka/tedarikçi referansı/SKU, birim, rulo/plaka ölçüsü, KDV, pay, aktiflik ve USD maliyeti taşır. Fiyat değişimi + immutable önceki/yeni USD history + aktör/audit atomiktir. Metadata optimistic version, fiyat priceVersion ile korunur. Mevcut birimi değiştirip eski USD fiyatını farklı birime uygulamak engellenir; yeni malzeme gerekir.
- Sunucu mevcut Decimal motoruyla DB malzeme ve gider tutarlarını okur; istemci toplamı, gider USD override'ı veya kur değeri otorite değildir. Eksik fiyatla kesin belge oluşturulmaz. 135×200 + dört kenarda2 cm için137 reddi,152 tüketim3.1008 m² doğrulandı. Birden fazla malzeme/gider ve margin/markup/manual fiyat/KDV korunur.
- Teklif revizyonu ayrı immutable satırdır. Satış, ilişkisel satırlar, plan ve audit tek transaction'dadır. Idempotency key/hash/advisory lock aynı isteği tekrar kaydetmez; farklı içerik409 olur. Eski satışın satır/plan kümesine sonradan INSERT de trigger ile engellenir. Ödeme planı **tahsilat/kasa/stok hareketi değildir**.
- Snapshot ürün/sürüm, malzeme/varyant/fiyat sürümü, USD birim, gerçek tüketim/fire, gider, USD/TRY, kur kaynak/yayın/çekilme, marj/markup/iskonto/KDV ve tutarları kopyalar. Katalog veya kur değişikliği geçmiş belgeyi yeniden fiyatlamaz. TCMB yeni belge için sunucudan alınır; hata veya yedi günden eski yayın sessizce kaydedilmez. Yetkili kullanıcı UI'dan gerekçeli, step-up kontrollü manuel kur oluşturup açıkça seçebilir. TCMB gerçek zamanlı piyasa kuru değildir.
- FORCE RLS + composite tenant/şirket/faaliyet FK + session/membership/action/owner/explicit DENY zinciri vardır. CostView yoksa USD katalog/gider fiyatı, belge toplam maliyeti ve nested snapshot/kar/marj gönderilmez. Karma malzeme costScopes ayrıca denetlenir. Maliyet gizliyken manuel satış fiyatı gerekir; maliyet sunucuda hesaplanır. SQL/URL/parola/token ham hataları kullanıcıya veya loga verilmez.

## Kontrollü aktarım ve açık sınırı

Önizleme kaynak kayıt/tür/durum ve sayımları gösterir. c1…/p1…/seed/legacy-demo kaynakları varsayılan dışlanır. Onay imports.confirm + güncel session step-up + ilgili modül create/costEdit izinlerini tekrar denetler. Batch/hash/record kaynak eşlemesi, conflict, tek transaction ve sayı/tutar mutabakatı vardır. Aynı batch tekrarında önceki sonuç döner; değişik kaynak içerik conflict'i sessizce ezilmez. Eski USD history tarihleri ve legacy aktör bilgileri immutable olaylarda, gerçek import aktörü audit'te ayrıdır.

**Her eski finansal arşiv otomatik çevrilmez.** Tarayıcı önizlemesi müşteri/malzeme/customProducts'ı normalize eder. Müşterisiz maliyet teklifleri, demo ürün ID'li satışlar ve eski finansal şema kaynakları inceleme gerektirir; müşteri/ürün ilişkileri ve tarihsel katalog/kurla hazırlanmış normalize dosya olmadan onay engellenir. Normalize satış/teklif dosyasında bütün USD/TRY toplamları eski katalogla yeniden hesaplanıp eşleştirilir; bugünkü katalogla geçmiş değiştirilmez. Otomatik finansal eşleme sihirbazı ve eski gider/tedarikçi şablonu aktarımı yoktur. Ham referans export'u ve bütün localStorage metinleri korunur. [Format, sınırlar ve kullanım](docs/migration/LOCAL_TO_NEON.md).

Bulut bağlantı hatası formu kapatmaz, yanlış başarı göstermez ve demo kayıtlarına geçmez. Müşteri/şirket değişiminde kalem, ölçü, not, plan ve kur taslağı açık onay gerektirir; vazgeçme girdileri korur. Bulut açık form taslağı yalnız bellektedir; yenilemede kalıcı taslak sözü yoktur. Kaydedilmiş belgeler farklı oturumdan Neon'dan yüklenir. Demo satış taslağının localStorage kalıcılığı değişmedi.

## Doğrulama

| Kontrol | Gerçek sonuç |
| --- | --- |
| TypeScript / build | Başarılı, Next16.4.1 + Prisma7.10.1 |
| Lint | 0 hata / 0 uyarı |
| Vitest | **104/104**,17 dosya; önceki99 korunur |
| PostgreSQL/RLS/Decimal | **11/11** Sprint B |
| Auth/API | **60/60**, C1–C6.1 tam komut koşusu |
| Yeni cloud/DB | **11/11** D senaryosu; tarihsel USD history/mutabakat, cost DENY, child sealing dahil |
| Auth + cloud Playwright | **2/2**, desktop Chrome/mobil Chromium,6.6 dakika |
| Demo Playwright son izole koşu | **22/22**, port3100/yalnız test DB,1.4 dakika |
| Migration | Üç additive ileri migration test/development'ta başarılı; tekrar deploy idempotent |
| Client secret taraması |24 production artifact'ında yapılandırılmış Resend anahtarı yok |

Browser müşteri/malzeme/ürün/maliyet/teklif/satış oluşturdu; simüle503'te müşteri girdilerini korudu; logout/login, yenileme ve **ayrı cookie deposuyla bağımsız login** aynı kayıtları gördü. Her projede pageerror0/beklenmeyen konsol hatası0; beş beklenen negatif HTTP hatası vardır. Masaüstü/mobil PNG'ler üretildi ve incelendi; sayfa yatay taşması yoktur, tabloda yerel scroll vardır. Gerçek Safari/Firefox/ekran okuyucu sertifikasyonu iddia edilmez. Görseller yalnız hayalî fixture'lardır; QR/recovery/secret görüntüsü yoktur.

İlk denemelerde nested create parent FK alanı, scope helper fazla alanı ve opsiyonel boş uzunluk girdisi hata verdi; düzeltildi. Browser combobox bulucusu role/name kullanacak şekilde değiştirildi. Başarısız koşular başarı sayılmadı. Vitest sandbox EPERM'i izinli koşuyla giderildi; kurallar/TLS kapatılmadı. Önceki Next development redirect-stream, pg deprecation ve NO_COLOR uyarıları sürer; sıfır sunucu log hatası iddiası yoktur. [Ayrıntılı kanıt](docs/validation/SPRINT_D_VERIFICATION.md), [denetim](research/PUSULA_V030_SPRINT_D_AUDIT.md), [görseller](docs/design/screenshots/).

## Ortam ve migration koruması

`.env.local`, bootstrap, token, `.neon`, `.data`, generated client ve test çıktıları Git dışıdır. Env dosyaları değiştirilmedi. Runtime ve auth rolleri ayrı sınırlı non-owner rollerdir; migration yalnız allowlist direct bağlantıyı kullanır. Development gerçek kullanıcı/iş kayıtlarında CRUD testi yapılmadı. İlk iki DDL'den önce hash yardımcı betiği ESM import hatası verdiği için onlar için öncesi/sonrası hash kanıtı iddia edilmez. Sonraki read-only snapshot ve üçüncü guard migration'ının öncesi/sonrası AuthUser/Membership/Customer/Material/Variant/PriceHistory hash'leri aynıydı. Gerçek Master hesabı/faktörü/parolası testlere alınmadı.

Sprint E: bağımsız şifreli yedek, scheduler, anahtar/retention, boş güvenli hedefe restore ve felaket kurtarma; sale-child guard'ının restore sırası/atomikliği. Production HTTPS/domain/operasyon kabulü, MFA recovery/rotation ve önceki dev-toolchain advisory değerlendirmesi ayrıca kapanmalıdır. C6'nın canlı Resend403 sonucu yeni anahtar/izinli alıcı doğrulanmadan başarı sayılmaz; D bunu tekrar denemedi. v0.4 stok/tedarikçi, v0.5 üretim/fire ve v0.6 cari/kasa erkenden açılmadı.

## Git teslimi

Başlangıç e41d81d; mevcut feature dalı temiz ve remote ile aynıydı. Uzak main'in güncel plan kararları okundu; makine/tedarikçi/fire/reçete kararları ROADMAP/ARCHITECTURE'da korunarak alındı. Eski main uygulamasıyla geliştirme kodu değiştirilmedi. Son fetch'te feature uzak geçmişiyle çakışma yoktu; main98caf4d plan sürümü korundu.

| Aşama | Commit |
| --- | --- |
| D1 denetim / upstream plan |7864359 |
| D2 müşteri / katalog / şema |b896d36 |
| D3 sunucu teklif / satış |245fd76 |
| D4 import / tarihsel mutabakat |9c48aa9 |
| D5 bulut UI / güvenlik |ec6526b |
| D6 son koruma / test / belgeler | Bu raporla ayrı commit |

D6 commit/push sonucu son teslim mesajında verilir. Main birleştirilmez; force-push, hard reset veya veri temizliği yapılmadı. Önceki [C6.1 raporu](docs/history/PUSULA_V030_SPRINT_C61_REPORT.md) arşivlendi. Yerel komutlar: `npm run build`, `npm run lint`, `npm test`, `npm run db:test`, `npm run auth:test`, `npm run cloud:test`, `npm run test:e2e`, `npm run test:e2e:auth`. Mimari [NEON_CLOUD](docs/architecture/NEON_CLOUD.md), izinler [AUTHORIZATION](docs/security/AUTHORIZATION.md).
