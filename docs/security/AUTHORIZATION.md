# v0.3 Auth ve yetkilendirme sözleşmesi

**Sprint A tasarımıdır; çalışan auth/Master Admin uygulaması henüz yoktur.** [Neon kararı](../architecture/NEON_CLOUD.md), [hedef mimari](../../ARCHITECTURE.md).

Sprint B güncellemesi: tenant/şirket composite FK ve non-owner runtime FORCE RLS gerçek Neon test DB'sinde doğrulandı. CompanyRepository yalnız internal server DAL'dir; bu sonuç kullanıcı kimliği/özel izin matrisi enforcement'ı değildir. O katman Sprint C'de kurulacak; henüz HTTP CRUD endpoint'i açılmadı.

## Kimlik

Managed Neon Auth MFA desteklemediğinden uygulamanın yönettiği Better Auth ve TOTP plugin seçildi. Auth verisi aynı PostgreSQL'de kendi tablolarında tutulacak; SDK'nın kurulu sürüm şeması CLI çıktısıyla migration'a alınacak. Elle özel şifre hashing/oturum sistemi yazılmaz. Cookie httpOnly, production secure, SameSite=Lax; trusted origins sabit allowlist; mutasyonlarda origin/CSRF doğrulaması. Public signup kapalı; davet hash'li, süreli, tek kullanımlık ve doğru e-postaya bağlı. Şifre sıfırlama cevabı hesap varlığını açığa vurmaz; verified mail taşıyıcısı olmadan akış tamamlandı sayılmaz. Şifre/session/TOTP secret/backup code localStorage'a veya loglara girmez.

Master Admin bootstrap CLI/deploy secret ile, public endpoint olmadan; ilk sahip doğrulanmış e-posta hesabına tenant membership olarak atanır. İlk girişte MFA enrollment; TOTP doğrulanmadan yönetici işlemleri engellenir. Hassas işlem için taze reauthentication + ikinci faktör step-up kanıtı sunucuda doğrulanır. Tek başına `twoFactorEnabled` veya client `mfa=true` yetmez. OAuth/passwordless eklenirse credential dışı akışların MFA'yı bypass etmesi ayrıca engellenir. [Better Auth 2FA](https://better-auth.com/docs/plugins/2fa).

Pasifleştirme membership ve gerektiğinde user seviyesinde; session'lar iptal edilir. Her istekte güncel üyelik/izin okunur; eski cookie veya client cache yetkiyi canlı tutmaz. Son aktif Master Admin koruması aynı tenant için transaction + kilitlemeyle uygulanır; iki eşzamanlı silme/demotion testi zorunludur. Platform çapında admin rolü bu sürümde açılmaz. MFA kurtarma kodları kullanıcıda güvenli tutulur; operatörün audit/MFA kontrollü kurtarma prosedürü ayrıca test edilir.

## Tek sunucu policy giriş noktası

1. Session'ı sunucuda doğrula; user aktifliği, membership ve oturum iptalini kontrol et.
2. Seçilen tenant membership'ini sunucuda çöz; URL/body userId/role/tenantId otorite değildir.
3. Kaynağın tenant/legal entity/activity kapsamını doğrula; tenant dışı kaydı okumadan reddet.
4. İzin anahtarı için geçerli scope içindeki explicit deny varsa reddet. Aynı kapsamda allow override, sonra rol allow; yoksa default deny. Kapsam, süre, own-record ve tutar limiti uygulanır.
5. Kritik eylemde step-up ve actor/approver ayrımı; izin yoksa DB mutasyonu olmaz. DTO projection hassas alanları çıkarır; serialization sonrasında string maskeleme yeterli değildir.
6. Yetki/fiyat/kur/user mutasyonuyla AuditEvent aynı transaction'da commit edilir; loga parola/token veya tam müşteri/finans payload'ı yazılmaz.

Gör/Ekle/Düzenle/Onayla/İptal-TersKayıt/DışaAktar modül bazında ayrıdır. Özel aksiyonlar: `materials.cost.view/edit`, `fx.manual_override`, `sales.price.edit`, `sales.discount`, `ar.collect`, `ap.pay`, `cash.balance.view`, `bank.balance.view`, `inventory.adjust`, `users.manage`, `permissions.manage`. Gelecek modüller için izin adının bulunması işlemin implement edildiği anlamına gelmez.

Kişi kendi override/rol/membership/Master Admin durumunu artıramaz. Master Admin yalnız kendi tenant'ında yetki verebilir; bir membership'in kendi erişim alanını aşan grant engellenir. UI: kullanıcı -> rol şablonu -> allow/deny/inherit matrisi -> şirket/faaliyet kapsamı -> etkili izin özeti -> gerekçe/step-up -> atomik kaydet. Şablon kopyalanması özel deny'ları sessizce silemez.

## RLS savunması

Repository parametrelerinde tenant filtresine ek PostgreSQL RLS tasarlanır. Runtime rolü owner/superuser/BYPASSRLS olamaz. Tenant tablolarında ENABLE + uygun FORCE ROW LEVEL SECURITY; `USING` ve `WITH CHECK` hem okuma hem yazmayı sınırlar. Transaction içinde doğrulanmış context için `set_config(..., true)` kullanılır; bütün sorgular aynı transaction client'ından gider. Pooled bağlantıda session-wide SET veya işlem dışına taşan sorgu yasaktır. Scope yoksa politika fail-closed olmalıdır. Auth tabloları için ayrı kontrollü adapter/rol sınırı gerekir; RLS'yi devre dışı bırakan genel HTTP erişimi açılmaz. [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

## Kabul matrisi — tamamlanmadan güvenli sürüm denmez

- Anonymous: sayfa redirect, API401; disabled/revoked session401/403.
- Satışçı: izinli müşteri ekleme; USD maliyeti alanı yanıtta yok; doğrudan edit/export/cost snapshot endpoint'inde403.
- Yeni grant sonraki istekte etkili; revoke mevcut cookie ile hemen reddedilir; deny allow'dan öncelikli.
- Başka tenant ID'si, başka legal entity/activity, farklı resource ID ve batch/import payload'ı reddedilir.
- Non-master self-escalation ve master'ın self-grant isteği reddedilir; son master eşzamanlı kaldırma engellenir.
- MFA'sız/expired step-up ile sensitive değişiklik reddedilir; audit kaydı sır sızdırmaz.
- İzin projection'ı müşteri satış detayı, dashboard kârı, CSV, teklif ve snapshot içindeki türetilmiş USD verisini de kapsar; yalnız malzeme listesi yeterli değildir.

Mevcut manuel kur endpoint'i paylaşılan sunucu token'ı kullanır; bulut modunda bu yolun RBAC bypass'ı olarak açık kalmasına izin verilmeyecek. Demo modundaki mevcut davranış testleri ayrı korunur.
