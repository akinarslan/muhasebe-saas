# PUSULA v0.3 — Sprint C / Auth, Master Admin ve özel yetkilendirme

16.10.2026 · **C1–C5 kodu ve geliştirme testleri teslim edildi. Gerçek operatör hesabı/MFA ve SMTP kurulumu bekliyor; production kabulü ve v0.3 bütünü tamamlandı denmez.**

## Sonuç

Better Auth **1.7.10**, Prisma **7.10.1**, mevcut Next16/Node24 üzerinde gerçek Neon PostgreSQL'e bağlandı. Aynı Frankfurt development dalı (`br-rough-darkness-ba6ow9zo`) ve `pusula_development` / izole `pusula_sprint_b_test` DB'leri kullanıldı. Production branch/DB'ye migration, seed veya test uygulanmadı. Neon Auth ve ücretli hizmet açılmadı.

Doğrudan development auth bağlantısı ayrıca doğrulandı: **gerçek kullanıcı sayısı 0**, bootstrap henüz kapanmamış. Kullanıcı başlangıçta bootstrap hazır dedi; dosya bulunmadığı bildirilince dosyanın olmadığını belirtti. Gerçek kimlik bilgisi uydurulmadı veya sohbetten alınmadı. Git dışı boş `.env.bootstrap.local` şablonu, güvenli CLI ve [kurulum rehberi](docs/security/MASTER_ADMIN_SETUP.md) hazırdır. İlk gerçek yönetici için kullanıcı bu dosyayı yerelde doldurup `npm run auth:bootstrap` çalıştırmalı ve `/account/security` üzerinden TOTP kurmalıdır.

## İstenen 12 sorunun yanıtı

| Soru                                      | Gerçek durum                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Better Auth gerçek Neon'a bağlandı mı? | Evet. Development auth bağlantısı ve izole test DB'sinde gerçek login/CRUD doğrulandı.                                                                 |
| 2. Giriş çalışıyor mu?                    | Evet. Parola, httpOnly session, çıkış/revoke/expiry/pasif hesap reddi ve MFA ile tekrar giriş testli.                                                  |
| 3. İlk Master nasıl oluşturulur?          | Yalnız operatör CLI + özel yerel dosya; kilitli tek kurulum işareti, idempotence ve audit. Gerçek hesap henüz oluşturulmadı.                           |
| 4. MFA zorunlu mu?                        | Master için evet. Güncel session'da MFA kanıtı gerekir; kritik işlemler ayrıca beş dakikalık parola + TOTP step-up ister.                              |
| 5. Davet çalışıyor mu?                    | Güvenli token/acceptance ve test taşıyıcısı çalışır. Gerçek e-posta teslimatı yok; SMTP/API bağlanmadı.                                                |
| 6. Özel izinler kaydediliyor mu?          | Evet. RoleAssignment/PermissionScope/ALLOW-DENY override, sürüm kontrolü ve audit PostgreSQL'de; browser'da yeniden açma testli.                       |
| 7. Yetkisiz API reddediliyor mu?          | Evet. 401/403, strict payload/origin, session/membership, MFA/step-up ve field projection kontrolleri var.                                             |
| 8. Tenant/şirket izolasyonu?              | Sprint B FORCE RLS korunur; ek faaliyet/owner/action politikaları gerçek non-owner SQL ve HTTP testli.                                                 |
| 9. Audit oluşuyor mu?                     | Evet. Kullanıcı/izin, davet, müşteri, USD fiyat, manuel kur ve MFA olayları; append-only, sır içermeyen özetler.                                       |
| 10. Hâlâ demo olanlar?                    | `/` satış/müşteri/malzeme/taslak/snapshot iş ekranları localStorage demosudur. Otomatik veri import'u yapılmadı.                                       |
| 11. Kaç test geçti?                       | Vitest81/81, eski DB11/11, auth/API41/41, demo browser22/22, auth browser2/2. Ayrıntı aşağıda.                                                         |
| 12. Sprint D'ye ne kaldı?                 | Gerçek işletme ekranlarının repository/CRUD'a geçişi; satış/teklif/kur snapshot şemaları, onaylı/idempotent import ve tüm türetilmiş maliyet DTO'ları. |

## Kimlik ve Master güvenliği

- Ayrı non-owner **pusula_auth** / **pusula_test_auth** rolleri yalnız auth tablolarına erişir. Business runtime kimlik tablolarını okuyamaz; auth rolü işletme tablolarını okuyamaz. Migration direct owner bağlantısı runtime client'ında kullanılmaz. URL/rol adı/TLS/dev hedef guard'ları yanlış owner veya production hedefini reddeder.
- AuthUser, Session, Account, Verification, RateLimit, TwoFactor, Bootstrap, SecurityEvent, Invitation; Membership, Role, RoleAssignment, Permission, RolePermission, UserPermissionOverride, PermissionScope, AuditEvent ve tenant'a özel immutable manuel kur kayıtları eklendi. Toplam **9 sürümlü migration** iki DB'de uygulanmış durumdadır; önceki başarılı migration'lar değiştirilmedi.
- Parola Better Auth hash'i; cookie httpOnly/SameSite=Lax, production Secure, sekiz saat session, cookie cache kapalı. Her korumalı istekte güncel session/user/membership/izin okunur. JSON'dan bearer session token'ı çıkarılır. DB kesintisi503; demo fallback yoktur.
- Public signup yok; server signup da yalnız private provisioning context'inde çalışır. E-posta/IP rate limit, HMAC hesap kovası, origin ve step-up hız sınırı vardır. Parola reset15 dakika/tek kullanım/eski session revoke; davet24 saat/hash token/atomik tek kullanım. Sonuç mesajları hesap varlığını ifşa etmez.
- TOTP QR yerelde çizilir. Secret ve recovery kodları Better Auth ile şifrelenir; recovery yalnız ilk üretimde görünür ve tek kullanımlıdır. Trusted-device, public MFA disable/recovery yeniden gösterme yolları kapalıdır. Kritik step-up TOTP ister; kayıp cihaz için tam operatör kurtarma akışı henüz otomatik değildir.
- Kendi erişimini değiştirme ve aktörün kapsam/DENY sınırlarını aşan grant reddedilir. Son aktif Master transaction advisory lock + güncel count ile korunur; **iki eşzamanlı demotion** testinde yalnız biri tamamlanır. Tenant Master platform çapında bütün firmalara erişen süper kullanıcı değildir.

## Yetki, API ve arayüz

Karar sırası: eşleşen kapsamda **DENY > kullanıcı ALLOW > rol ALLOW > default deny**. OWN/ACTIVITY/LEGAL_ENTITY/TENANT desteklenir. Departman/tutar/onay alanları modelde geleceğe ayrılmıştır; bu sürümün formunda etkin değildir. Client userId/role/tenantId otorite değildir; membership başlığı yalnız oturum sahibinin üyeliklerinden seçebilir. Transaction-local scope kullanılır, pooled context sızmaz.

`/login`, `/app`, `/account/security`, `/admin/users`, davet ve parola reset ekranları eklendi. Master kullanıcı listesi; arama, rol/durum/faaliyet/son giriş; altı sekmeli sağ drawer; üç durumlu izin matrisi, etkili izinler, değişiklik önizlemesi, audit ve session sonlandırma içerir. Lacivert/turkuaz kimlik, ortak tokenlar, Lucide, Radix/shadcn Button ve kısa/reduced-motion uyumlu geçişler korunur. Mobilde tablo kendi alanında yatay kayar.

`/api/cloud` sınırlı kullanıcı/davet, müşteri GET/POST, malzeme GET/USD PATCH, manuel kur ve context sözleşmelerini sunar; tüm satış/stok/finans API'leri erkenden açılmadı. USD yetkisi yoksa nested variant JSON'unda **usdCost bulunmaz**; history/snapshot/derived maliyet kaynağı eklenmez. USD değişikliğinde Decimal fiyat geçmişi ve güvenli audit aynı transaction'dadır.

Eski `POST /api/exchange-rate` ortak anahtar yolu güvenlik nedeniyle **403 ile kapalıdır**. TCMB GET ve demo hesapları korunur, demo manuel seçenek kapalıdır. Gerçek manuel kur session + `exchange.manual` + step-up ile tenant tablosuna kaydedilir; global demo cache'i değiştirmez. Eski token testleri yeni kapanma sözleşmesine güncellendi; yetkili kur yeni Neon suite'inde doğrulanır.

## Doğrulama

| Kontrol                    | Sonuç                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Son build                  | Başarılı; strict TypeScript, Next16.4.1                                              |
| Son lint                   | 0 hata, 0 uyarı                                                                      |
| Son Vitest                 | **81/81**,12 dosya;10 yeni policy testi                                              |
| Mevcut gerçek DB suite     | **11/11**                                                                            |
| Son sıralı `auth:test`     | **41/41**: C1 7, C2 7, C3 8, C4 11, C5 8                                             |
| İlk TOTP enrollment kapısı | İlk C2 koşusunda9/9; tekrar MFA fixture'ı enrollment'ı yeniden yapmaz                |
| Demo Playwright            | **22/22**, desktop/mobile,1.3 dakika                                                 |
| Son auth Playwright        | **2/2**, desktop/mobile,1.4 dakika; iki uzun gerçek uçtan uca akış                   |
| Browser JS hata kontrolü   | **0**; mobil document yatay taşma yok                                                |
| Görsel kontrol             | İki auth kullanıcı ekranı üretildi, incelendi, hayalî fixture PNG'leri kaydedildi    |
| Runtime npm audit          | **0**                                                                                |
| Tam npm audit              | Dev-only braces/fast-glob/micromatch/Next ESLint zincirinde **5 high**               |
| Staged secret taraması     | C5'te **57 dosya PASS**; gerçek yerel URL/parola/secret değerleriyle karşılaştırıldı |

Auth testleri: signup bypass, parola/cookie/session iptal/expiry, pasif hesap, rol ayrımı, bootstrap, gerçek TOTP/recovery/step-up, davet/reset tek kullanım ve expiry, hesap enumeration/rate-limit, self elevation, anında override revoke, last-master concurrency, çapraz tenant/şirket/faaliyet, sahte payload/başlık, maliyet alan projeksiyonu, yetkisiz fiyat/kur, Decimal/history/audit, cross-origin ve DB kesintisinde fail-closed.

Browser auth testleri her seferinde yeni hayalî kullanıcılarla **ayrı test tenant'larında** çalışır;3100 portu ve `.next-auth-e2e` çıktısı kullanılır. Auth trace/video kapalıdır; parola, QR veya recovery görüntüsü paylaşılmaz. Development verileri test DB'sine taşınmadı.

Başarısız denemeler başarı sayılmadı: C3 kilidinin Prisma void dönüş tipi, metadata SQL UTF-8 BOM'u, QR Base32 test dönüşümü, soğuk metadata yenileme süresi, stale UI state ve mobil toast'ın düğmeyi örtmesi düzeltildi. Last-master fixture'ı diğer browser yöneticilerinden etkilenmeyecek şekilde izole edildi. Generated auth build çıktısının lint'e girmesi ignore kapsamıyla giderildi; kaynak lint kuralları kapatılmadı. [Tam kapı kaydı](docs/security/AUTH_TEST_MATRIX.md).

Ham Prisma teşhis çıktısı otomatik inceleme tarafından sır riski nedeniyle reddedildi; yalnız sabit hata kodlarıyla güvenli teşhis ve çözüm tamamlandı. Başarılı migration reset edilmedi; production veya kullanıcı verisi silinmedi.

## Açık sınırlar / operasyonel kurulum

1. **Gerçek ilk Master hesabı ve kullanıcının TOTP kurulumu henüz yok.** Boş özel şablonu yerelde doldurun; [rehber](docs/security/MASTER_ADMIN_SETUP.md). Test hesapları gerçek operatör hesabı sayılmaz.
2. **Gerçek SMTP/API teslimatı yok.** Development mesajları `.data/auth-mail/*.enc` içinde şifreli test iletileridir. Production'da yerel taşıyıcı kapalıdır. Mail retry/outbox operasyonu ve kayıp TOTP için denetimli operatör recovery ayrıca gerekir.
3. Dev-only5 high advisory için npm registry'de braces'ın yamalı sürümü bulunmadı; Next14 ESLint major downgrade uygulanmadı. Bulgu gizlenmedi; production güvenlik kabulünde giderilmeli veya somut risk kararı verilmelidir.
4. Next dev bazı korunan sayfa yönlendirmelerinde `destination stream errored`, adapter/pg ise `client.query` deprecation kaydı üretti. HTTP/redirect ve browser JS kontrolleri geçti; bu kayıtlar gizlenmedi. Gerçek production server/operasyon kabulü ayrıca yapılmalıdır.
5. Bağımsız şifreli yedek/scheduler/restore Sprint E; gerçek cihaz/Safari ve tam erişilebilirlik sertifikasyonu yapılmadı. Dev PNG'sinde Next göstergesi vardır. Kullanıcı listesi ilk200 üyeyle, audit detayları son50 kayıtla sınırlıdır; kapsamlı pagination gelecekte genişletilmelidir.
6. İşletme UI'si localStorage demosudur; sunucu verisi kesilince buraya sessiz fallback yapılmaz. Satış/teklif snapshot ve onaylı veri import'u Sprint D'ye bırakıldı. v0.4–v0.6 işlem modülleri uygulanmadı.

## Git teslimi

Başlangıç `7a863bf`; dal **feat/pusula-v030-neon-cloud**. Uzak dal fetch/ancestry kontrolünden sonra C1–C5 commit'leri GitHub feature dalına push edildi. Uzak ref **84dd62c4c3c3e5d8d2d7dbc48beae1f609ecd2aa** ile yerel C5 commit'i eşit doğrulandı. Bu son rapor ayrı dokümantasyon commit'iyle aynı dala gönderilir. Main'e merge/force push/hard reset yapılmadı.

| Aşama                      | Commit    |
| -------------------------- | --------- |
| C1 — Auth altyapısı        | `fa06f76` |
| C2 — Bootstrap/MFA         | `d647a9e` |
| C3 — Kullanıcı/izin/kapsam | `c52e9f8` |
| C4 — API/RLS/DTO           | `6ace468` |
| C5 — UI ve son doğrulama   | `84dd62c` |

`.env.local`, `.env.bootstrap.local`, `.data`, `.neon`, generated client, build ve auth test çıktıları Git dışıdır. Sırlar GitHub'a yazılmadı. [Sprint B raporu](docs/history/PUSULA_V030_SPRINT_B_REPORT.md) korunmuştur.

[Neon mimarisi](docs/architecture/NEON_CLOUD.md) · [Auth sözleşmesi](docs/security/AUTHORIZATION.md) · [Denetim](research/PUSULA_V030_AUDIT.md) · [Master kurulumu](docs/security/MASTER_ADMIN_SETUP.md) · [Test matrisi](docs/security/AUTH_TEST_MATRIX.md) · [Desktop](docs/design/screenshots/v030-auth-desktop-users.png) · [Mobil](docs/design/screenshots/v030-auth-mobile-users.png)

Yerel komutlar: `npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npm run db:test`, `npm run auth:test`, `npm run test:e2e`, `npm run test:e2e:auth`. Auth kurulumu: `npm run auth:setup`, `npm run auth:roles`, ardından yalnız operatör alanları doldurulduysa `npm run auth:bootstrap`.
