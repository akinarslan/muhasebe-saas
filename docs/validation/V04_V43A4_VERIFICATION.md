# V4.3a.4 — Gerçek Neon doğrulaması

20.10.2026 · **V4.3a — CLOUD_BASELINE_ACCEPTED**

## Kanıt matrisi

| Kontrol | Kaynak | Sonuç |
|---|---|---|
| MASTER login,ekran,Purchase API200 |Kullanıcı manuel beyanı |PASS—MANUEL |
| Test material152cm,metre link,PO oluşturma,F5 kalıcılığı |Kullanıcı manuel beyanı |PASS—MANUEL |
| Şifre/TOTP,ikinci tıklamada onay,30,40USD korunması |Kullanıcı manuel beyanı |PASS—MANUEL |
| Hedef/TLS/READ ONLY |Direct development allowlist,CA+hostname/client socket doğrulaması |PASS—CODEX SQL |
| Şema/migration |PG18.6,40tablo,26FORCE RLS,15başarılı,çözülmüş008=1,unresolved0 |PASS—CODEX SQL |
| Checksum |İlk14+015baseline/history eşleşmesi |PASS—CODEX SQL |
|015 SHA-256 |181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a |PASS |
| Schema/privilege pinleri |Sekiz post-schema hash eşit;flagsiz runner ALREADY_APPLIED,applied=false |PASS |
| MASTER izinleri |6purchases permission/MASTER6/diğer rol0 |PASS—CODEX SQL |
| Hedef sipariş |Yalnız businessNo=PO-2026-9893,tam1eşleşme,APPROVED,onay metadata mevcut |PASS—CODEX SQL |
| Satır/miktar |1satır,2linear_meter,3.04square_meter,152cm |PASS—CODEX SQL |
| USD toplam |2×15.20=30.40;bağımsız Decimal,snapshot eşit |PASS—CODEX SQL/DECIMAL |
| Temel miktar |2×152/100=3.04m² |PASS—CODEX DECIMAL |
| Supplier/material/link/variant |Composite scope join'leri,beklenen test material adı ve birim bağlantıları true |PASS—CODEX SQL |
| Fiyat kaynağı |USD/MANUAL,offerVersion yok |DOĞRULANDI;teklif sürümü testi değil |
| Constraint/index |unvalidated0,invalid/not-ready0 |PASS |
| Stock/cari/payment etkisi |Onay yolu header+audit;ilgili işlem modeli yok;CloudSale/Line/PaymentPlan0 |MEVCUT KAPSAMLA TUTARLI;harici ledger kanıtı değil |
| Recovery/snapshot |İki branch ready,snapshot metadata aynı,endpoint linkleri korunuyor |PASS—PROVIDER GET |

SQL ölçümü2026-10-20T17:51:36.722Z (İstanbul20:51:36.722);provider17:51:55.972Z. Kullanıcı manuel adımlarının kesin zamanı verilmedi;otomatik SQL zamanı onlara atanmadı. Satır header toplamı ayrı kolon değildir;tek satır snapshot toplamıyla hesaplandı. Approval öncesi aynı tutar kullanıcı gözlemidir;SQL onay sonrası mevcut durumu doğrular.

## MFA değerlendirmesi

Kaynak incelemesi:`purchase-desk.tsx` STEP_UP_REQUIRED/MFA_REQUIRED üzerine dialog açar;başarılı `onVerified` yalnız dialog'u kapatır;approve otomatik yeniden gönderilmez. Dialog metni tekrar onaylamayı ister. Step-up geçerliliği5dakikadır. Bu nedenle ikinci tıklamanın yeni MFA istemeden başarılı olması kodla uyumludur.

İlk gerçek isteğin ilişkilendirilebilir HTTP/status/uygulama hata kaydı mevcut değildir. Kesin kök neden veya bağlantı arızası iddiası yok. Güvenli migration/preflight logları kullanıcı onay isteğinin logu sayılmadı. Parola,TOTP,token,gerçek session payload'ı okunmadı. UX maddesi:doğrulama sonrası yeniden Onayla gerektiğini belirginleştirmek;bu sprintte kod veya otomatik retry eklenmedi.

## Açık kabul kapıları

- Gerçek bulutta iki tenant negatif erişim ve normal kullanıcı explicit DENY/cost redaksiyonu.
- Bütün para birimleri,offer-backed akışlar ve teklif sürümleri.
- Bağımsız R2 şifreli backup/restore;tablo/function/enum ve role/PUBLIC TEMP-CONNECT kapsam engelleri.
- Mal kabul/stock girişi,V4.3b ledger/partial receipt/idempotency/iade tasarımı ve ayrı migration/recovery onayı.

Önceki yerel fixture başarıları [Codex fix raporunda](../../research/PUSULA_V04_V43A_CODEX_FIX_REPORT.md);bu sprintte yeniden çalıştırılmadı ve gerçek bulut negatif testleri yerine geçmez. Kabul yalnız MASTER/USD manuel fiyat temel akışıdır;production-ready veya tüm güvenlik senaryoları tamamlandı anlamına gelmez.

## Kaynaklar ve teslim sınırı

Korunan kaynaklar:`br-broad-river-bavv5pey`,`br-patient-block-bald8u59`,`snap-frosty-sky-bav0qeo6`. Provider branch ID/ad/parent ve endpoint ID/branch/host önceki envanterle aynı;pendingoperation0. Pre015 recovery yeni test PO'yu içermez;V4.3a.4 güncel yedeği sayılmaz.

Yerel ignored kanıt:`.data/acceptance-v43a4/sql.json`,`runner-postflight.log`,`provider-comparison.json`,`metadata.json`. Private provider metadata/CLI logları ve yardımcı kod Git'e eklenmez. Kod/SQL/env veya gerçek veri değiştirilmedi;writeAPI,yeni migration,Auth/MFA değişikliği,R2,restore/finalize,silme,production/test DB değişikliği,commit/push/merge yok.

Dal/HEAD beklenen değerlerde;önceki raporlar korundu. Mimo'ya bu sprintin kesin teslimi:

1. `research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md`
2. `docs/validation/V04_V43A4_VERIFICATION.md`
3. `LAST_REPORT.md`

[Ayrıntılı kabul,manuel adımlar ve V4.3b ön koşulları](../../research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md).
