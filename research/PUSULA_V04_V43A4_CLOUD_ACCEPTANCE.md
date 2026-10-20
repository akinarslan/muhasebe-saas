# PUSULA v0.4 — V4.3a.4 gerçek bulut kabulü

20.10.2026 · **V4.3a — CLOUD_BASELINE_ACCEPTED**

Kullanıcının gerçek `/app` manuel kabulü ile Codex'in development üzerinde yaptığı sınırlı READ ONLY SQL/Decimal/provider kontrolleri tutarlıdır. Kabul MASTER + USD manuel fiyatlı tek siparişin temel oluşturma/kalıcılık/onay akışı içindir. Production-ready, tüm güvenlik senaryoları, bütün para birimleri veya mal kabul kabulü değildir.

## 1. Kimlik ve güvenli kapsam

Dal `feat/pusula-v030-neon-cloud`, HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`. Önceki sprintlerden LAST_REPORT ve altı yeni raporun commit edilmemiş değişiklikleri korundu. AGENTS.md ve önceki migration/fix kanıtları incelendi. Kod,SQL,env ve gerçek veri değiştirilmedi;commit/push/merge yok.

SQL yalnız allowlist'teki development direct endpoint `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`,project `icy-queen-44442204`,branch `br-rough-darkness-ba6ow9zo`,DB `pusula_development` üzerinde çalıştı. CA+hostname doğrulaması,encrypted/authorized client TLS ve `REPEATABLE READ READ ONLY` transaction kullanıldı;sonunda ROLLBACK/connection close. Tüm sipariş veya Auth/session tabloları dökülmedi;hedef yalnız businessNo=`PO-2026-9893` oldu. Eşleşme tam1;belirsiz birden fazla tenant eşleşmesi yok. Sadece test satırının gerekli fiyat/miktar ve ilişkisel boolean alanları okundu;ID,approver kimliği,tedarikçi kişisel bilgileri,parola,TOTP,token,session payload'ı veya diğer mali satırlar raporlanmadı.

## 2. Kullanıcı manuel kabulü — otomatik test değildir

Aşağıdakiler bu görevde kullanıcının verdiği gerçek Neon `/app` test beyanıdır;Codex tarayıcı otomasyonu veya bağımsız HTTP kaydı olarak sunulmaz:

1. MASTER hesabıyla giriş yapıldı;Satın Alma Siparişleri ekranı açıldı;Purchase API HTTP200 görüldü.
2. `PUSULA TEST — Rulo Vinil` malzemesi ve152cm varyant oluşturuldu;mevcut test tedarikçisine metre biriminde bağlandı.
3. `PO-2026-9893` oluşturuldu;2metre×15,20USD/metre=30,40USD görüldü;F5 sonrası kayıt korundu.
4. Şifre/TOTP step-up tamamlandı;ilk denemede sipariş onaylanmadı;ikinci Onayla tıklamasında yeni MFA istenmeden onaylandı.
5. Onay sonrası toplam30,40USD kaldı.

Bu yazma işlemlerini **kullanıcı** gerçekleştirdi;Codex bu sprintte oluşturma/düzenleme/onay/iptal isteği göndermedi. Önceki V4.3a.3 raporundaki PO0 ve ekran kabulü eksikliği o sprintin tarihsel durumudur;bu yeni manuel kanıt ve güncel SQL sonucu o kaydı silmeden kabulü ilerletir.

## 3. Codex gerçek SQL ve bağımsız Decimal kanıtı

Ölçüm `2026-10-20T17:51:36.722Z` /20:51:36.722 İstanbul.

| Kontrol | Sonuç |
|---|---|
| PG / DB |18.6 (653b019) / pusula_development |
| Migration state |ALREADY_APPLIED;15 başarılı;çözülmüş008=1;unresolved0 |
| Şema |40tablo/26FORCE RLS;sekiz post-schema fingerprint eşleşti |
| Checksum |İlk14 ve015 dosya/baseline/başarılı history uyumlu |
|015 SHA-256 |`181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`|
| Satın alma izinleri |6permission/MASTER6;diğer role assignment0 |
| Constraint/index |unvalidated0;invalid/not-ready0 |
| Hedef sipariş |PO-2026-9893,APPROVED;approval stamp ve approver mevcut (kimlik okunup raporlanmadı) |
| Satır sayısı |1 |
| Alış miktarı / birimi |2 /linear_meter |
| Temel miktar / birimi |3,04 /square_meter |
| Genişlik |152cm |
| Fiyat kaynağı |MANUAL,USD;offerVersion bağlı değil |
| Birim fiyat |15,20USD/alış-metresi |
| Satır/sipariş toplamı |30,40USD |
| İlişkiler |Supplier,link,variant,material mevcut;tenant/entity composite join'leri ve supplier/variant/unit eşleşmeleri true |
| Test material adı eşleşmesi |`PUSULA TEST — Rulo Vinil` true |

Bağımsız `decimal.js` hesabı servis fiyatlama fonksiyonu çağrılmadan yapıldı:

- USD toplam: `Decimal(2) × Decimal(15.20) = 30.40`;DB snapshot lineTotalUsd ile eşit.
- Temel miktar: `Decimal(2) × (Decimal(152) / 100) = 3.04 m²`;orderedBaseQty ile eşit.

Alış birimi fiyatı temel m² miktarıyla çarpılmadı. Tek satır toplamı sipariş toplamıdır;header'da ayrı bir toplam kolonu yoktur. SQL snapshot30,40USD'yi doğrular;onaydan önce de aynı toplamın görüldüğü kullanıcı manuel kanıtıdır. Snapshot'ın tüm JSON'u görüntülenmedi;yalnız ilgili anahtarlar seçildi.

Flagsiz mevcut güvenli runner ayrıca `ALREADY_APPLIED,applied=false` döndürdü;post-schema ve mevcut privilege pinleri/yeni Supplier-PO grant ve PUBLIC kontrolleri geçti. Yeni migration uygulanmadı.

## 4. Stok/cari/ödeme sınırı

Güvenli toplu SQL:CloudSale0,CloudSaleLine0,CloudPaymentPlan0. Exact40tabloluk katalog ve pinli migration şemasında stok hareketi,mal kabul,cari borç/ledger veya ödeme işlem tablosu bulunmuyor;isim taramasında yalnız mevcut `CloudPaymentPlan` eşleşti. Bu tablo ödeme gerçekleşmesi veya cari borç ledger'ı değildir.

Kaynak kod incelemesinde `purchases.ts` approve yolu yalnız PO header'ını APPROVED/approval metadata/version ile güncelliyor ve audit olayı yazıyor;stock/receipt/debt/payment oluşturma servisi çağırmıyor. Bu kapsam + mevcut toplu sayımlar,incelenen development modelinde PO onayının stok girişi,cari borç veya ödeme gerçekleştirmediğiyle tutarlıdır. Harici muhasebe/ödeme sistemleri sorgulanmadı;yalnız tablo adı taraması evrensel yan etki ispatı sayılmadı. `MaterialVariant.inStock` gibi katalog bayrağı stok ledger'ı değildir;mal kabul testi yapılmış sayılmaz.

## 5. MFA / ilk onay denemesi

Kullanıcı gözlemi geçerli step-up oturumuyla uyumludur. Kanıtlanan kod akışı:

- `purchase-desk.tsx` içindeki `act` STEP_UP_REQUIRED/MFA_REQUIRED alınca doğrulama dialog'unu açar.
- Dialog metni doğrulamadan sonra onayı yeniden denemeyi açıkça ister.
- `StepUpVerification` başarılı parola/TOTP doğrulamasından sonra `onVerified` çağırır;PO dialog'u bu callback'te yalnız `setStepUp(false)` yapar. Bekleyen approve isteğini otomatik yeniden göndermiyor.
- `security-state.ts` step-up süresini5dakika olarak tanımlar;aynı session'da geçerli step-up ile ikinci approve yeni MFA istemeyebilir.

Bu,doğrulama tamamlanınca ilk business işleminin kendiliğinden devam etmemesini ve ikinci tıklamayı açıklayan **kod temelli değerlendirmedir**. İlk gerçek approve isteğinin status/hata kodu veya ilişkilendirilebilir uygulama network/server logu bu görevde mevcut değil. Erişilen güvenli migration/preflight kanıtları o kullanıcı isteğini temsil etmez. İlk olayın kesin hata nedeni,bağlantı kopması veya sunucu arızası olarak yazılmadı. AuthSecurityEvent/AuthSession/MFA payload'ları incelenmedi;token çıkarılıp yeniden kullanılmadı.

UX takip maddesi:doğrulama sonrası “Kimlik doğrulandı;Siparişi onaylamak için Onayla'ya yeniden basın” bildirimini belirginleştirmek;istersen ayrıca açık kullanıcı eylemiyle devam düğmesi tasarlamak. Sessiz otomatik approve retry'si eklenmemeli;version,idempotency ve tekrar tıklama etkisi ayrıca incelenmeli. Bu sprintte kod değiştirilmedi.

## 6. Provider koruma kanıtı

GET metadata `2026-10-20T17:51:55.972Z` /20:51:55.972 İstanbul:

| Korunan kaynak | Kimlik | Durum |
|---|---|---|
| Güncel pre015 recovery |br-broad-river-bavv5pey /pusula-v43a-pre-migration-015 |ready,parent development,LSN0/3638E80 |
| Eski restore preview |br-patient-block-bald8u59 /pusula-v42-restore-verification |ready |
| Eski snapshot |snap-frosty-sky-bav0qeo6 |ID/ad/source/time/full_size önceki metadata ile aynı |

Önceki V4.3a.3 provider envanteriyle branch ID/ad/parent ve endpoint ID/branch/host eşleşti;development/production bağlantıları da aynı;pending operation yok;plan free_v3. İki branch'i veya snapshot'ı açıp restore yapmadık. Pre015 recovery bu yeni sipariş ve sonradan oluşturulan malzemeyi **içermez**;güncel V4.3a.4 yedeği değildir. Yeni kurtarma noktası/snapshot oluşturulmadı. Snapshot veya branch silme,restore/finalize,R2,ücretli plan değişikliği yok.

## 7. Ayrı kanıt kümeleri ve açık testler

| Kapsam | Kanıt / durum |
|---|---|
| Yerel fixture geçmişi |Codex fix raporunda355Vitest,PG18fixture DB/RLS/Auth/Cloud/Supplier/Purchases ve browser2/2;bu sprintte yeniden koşulmadı |
| Gerçek Neon teknik |Bu sprint hedefli READ ONLY SQL/Decimal ve provider GET;PASS |
| Gerçek Neon kullanıcı |MASTER/USD manuel fiyatlı PO oluşturma,F5,step-up ve onay;KULLANICI MANUEL PASS |
| Gerçek bulut iki tenant negatif erişim |AÇIK;yerel test bulut kanıtı yerine geçmez |
| Normal kullanıcının explicit DENY |AÇIK;MASTER kabulü bunu ispatlamaz |
| Tüm para birimleri / teklif sürümleri |AÇIK;bu siparişUSD/MANUAL,offer-backed değil |
| Bağımsız R2 şifreli yedek/restore |BLOCKED/AÇIK;35/21eski allowlist,40/26kapsam ve role/PUBLIC TEMP/CONNECT audit engelleri kapanmadı |
| Mal kabul / stok girişi |YAPILMADI;V4.3b kapsamı |

## 8. V4.3b ön koşulları ve teslim

V4.3b öncesi mal kabul/stock ledger kapsamı,onaylı PO'dan kısmi/tam teslim,unit/base conversion,tekrar gönderim/idempotency,iptal/iade ve transaction sınırları tasarlanmalı;PO onayı stok kabulü sayılmamalı. Yeni migration ayrı inceleme/onay,recovery ve güncel backup kapsam/restore kapılarını gerektirir. Canlı iki-tenant ve normal DENY/cost redaksiyonu,offer/currency matrisi için ayrı izinli test verisi ve kabul planı gerekir. Mevcut gerçek kayıtlar bu amaçla kendiliğinden değiştirilmez. MFA geri dönüş UX maddesi ayrı geliştirme olarak izlenir.

Mimo'ya bu sprint kesin dosya listesi:

1. `research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md`
2. `docs/validation/V04_V43A4_VERIFICATION.md`
3. `LAST_REPORT.md`

Önceki raporlar korunur. Gitignored `.data/acceptance-v43a4/` içindeki sınırlı SQL kanıtı,provider yanıtları ve yardımcı kod teslim edilmez. Gerçek veri/kod/SQL/env değişikliği,write API,yeni migration,Auth/MFA değişikliği,production/test DB yazısı,R2,commit/push/merge yapılmadı. Salt okunur bağlantılar compute'u uyandırabilir;standart CLI auth-cache yenilemesi DB sırlarını değiştirmez.
