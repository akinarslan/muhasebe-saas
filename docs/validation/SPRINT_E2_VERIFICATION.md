# Sprint E2 — doğrulama ve açık kabul kapıları

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `c570f7b`.

## Sonuç

Operatör CLI kodu geliştirildi. **E2 kabulü henüz tamamlanmadı:** gerçek PostgreSQL fixture dump/--list koşusu eksik; özel backup kimliği/direct URL, PostgreSQL18 araçları ve gerçek key hazır değil. R2 panel incelemesi hesap sahibi tarafından doğrulandı; bağımsız API denetimi değildir. Gerçek development dump veya R2 PUT/DELETE çalıştırılmadı. Production-ready veya başarılı restore iddiası yok.

| Kontrol | Sonuç |
| --- | --- |
| Build / strict TypeScript | PASS, Next16.4.1 |
| ESLint | PASS,0 hata/uyarı |
| Vitest | **165/165**,19 dosya,11.64s; önceki104 + E2 **61** |
| PostgreSQL/RLS mevcut regresyon | **11/11**, yalnız ayrı sentetik test DB |
| Cloud/DB mevcut regresyon | **11/11**, yalnız ayrı sentetik test DB |
| Auth/API C1–C6.1 | **60/60**, yerel/test taşıyıcısı; gerçek mail yok |
| Demo Playwright | **22/22**, desktop/mobil,1.4 dakika |
| Auth/cloud/D7 Playwright | **4/4**, desktop/mobil,7.6 dakika; toplam browser **26/26** |
| R2 HeadBucket | PASS, resmî SDK ile salt okunur, bucket pusula-backups-development, region auto |
| backup:preflight -- --confirm-r2-security-reviewed | Beklenen BLOCKED/exit1: key, PG18 araçları, source URL/rol eksik; R2 HeadBucket ve operatör/panel beyanı geçti |
| backup:create onaysız | Beklenen exit1 DUMP_OPERATOR_APPROVAL_REQUIRED; dump alınmadı |
| backup:upload onaysız | Beklenen exit1 UPLOAD_OPERATOR_APPROVAL_REQUIRED; R2 yazması yapılmadı |
| NODE_ENV=production preflight | Beklenen exit1 PRODUCTION_FORBIDDEN; DB/R2 işlemi başlamadı |
| Sır taraması | PASS:16 değişen dosya ve23 production client JS dosyasında yapılandırılmış yerel sır eşleşmesi yok |
| Gerçek fixture pg_dump/--list | **ÇALIŞTIRILMADI**, istemci araçları/yerel fixture DB yok |
| Development dump / gerçek R2 upload | **ÇALIŞTIRILMADI**, açık onay bekler |
| E3 scheduler/retention/alarm ve E4 restore | Kapsam dışı, uygulanmadı |

## E2 testlerinin kanıt sınırı

`tests/backup.test.ts` ve `tests/backup-source.test.ts` Node test ortamında **61** testtir. Test key'leri yalnız bellekte rastgele üretildi; gerçek key oluşturulup saklanmadı. Gerçek PG bağlantısı taklit edilir, TOC sentetik metindir, arşiv girdisi sentetik byte fixture'ıdır. R2 yazmaları bellek içi S3 taklidine gider. Bunlar **gerçek PostgreSQL dump/restore veya gerçek R2 upload kanıtı değildir**. Ek test, operatör beyanının bağımsız API gözleminden farklı etiketlendiğini ve bilinen açık public durumunun beyanla geçersiz kılınamadığını doğrular.

Kapsam: direct/production/rol/TLS hedef reddi; PG major kontrolü; BYPASSRLS/owner/admin ve yazma/DDL/sequence yetki reddi; bütün35 tablo ve21 FORCE RLS adı; migration checksum drift/eksik migration; tek REPEATABLE READ READ ONLY snapshot ve bütün tablo sayımları; bozuk/eksik dump TOC; auth ve D6 sealing trigger kapsamı. Şifreleme round-trip plaintext SHA'sı doğrulanır; yanlış key/ID, bozuk/kesik dosya, değiştirilmiş/eksik/karışmış manifest reddedilir. Test, geçerli yeniden-MAC edilmiş manifest ve yeni ciphertext hash'i altında bile GCM tag hatasının reddini doğrular.

R2 testleri koşullu PUT, conflict412 sonrası aynı nesneyle güvenli retry, boyut/metadata/hash/decrypt ve manifest readback,403, eksik nesne, indirme kesintisi ve bozuk readback'i kapsar. Manifest doğrulama tamamlanmadan commit edilmez. Geçici klasör Windows ACL, sınırlı cleanup, paralel lock, child stderr redaksiyonu, eksik tool ve timeout sonrası child kapanışı test edilir.32 MiB dosya64 KiB chunk'larla işlenir; örnek testte RSS artışının96 MiB altında kalması kontrol edilir. Bu üretim boyutu performans/4 GiB benchmark'ı değildir.

Mevcut DB/API/E2E suite'leri hayalî işletme/auth/snapshot/izin/RLS regresyonunu ayrıca doğrular; backup'tan restore edilmiş kayıtlar üzerinde çalışmaz. DB fixture kayıtları yalnız önceki onaylı sprint test DB'sindedir; development iş kayıtları ve Master/MFA değiştirilmedi.

İki auth browser akışında beklenen HTTP konsol sayısı6'şar, beklenmeyen0; pageerror kontrolleri geçti. Desktop/mobil D7 arama testleri de geçti. Son upload stream cleanup sertleştirmesinden sonra E2 **61/61** ve TypeScript tekrar geçti; diğer uygulama kaynakları değiştirilmedi. Conditional conflict'te file stream kapanışı ayrıca test edildi.

## Beklenen engeller ve deneme kayıtları

İlk npm SDK isteği yerel sertifika zincirinde durdu; sistem CA ile TLS doğrulaması korunarak kuruldu. İlk Vitest sandbox child-process EPERM nedeniyle başlamadı; izinli yerel koşuyla yeniden çalıştı. İlk SDK fixture testinde transitive test import'u ve TypeScript stream tipleri düzeltildi; başarısız denemeler başarılı sayılmadı. Son tam Vitest/build/lint sonuçları yukarıdadır.

Mevcut Next dev redirect/destination-stream, pg deprecation, NO_COLOR ve reduced-motion uyarıları görüldü. Beklenen401/403/409/502/503 negatif senaryoları vardır; sıfır sunucu log hatası iddia edilmez. Gerçek Safari/Firefox/ekran okuyucu sertifikasyonu yapılmadı. npm audit beş high advisory'yi mevcut ESLint/fast-glob/micromatch/braces zincirinde raporlar; yeni AWS SDK advisory'si yoktur. Major downgrade/force fix uygulanmadı.

## Kabul sorularının yanıtı

1. Motor kodu var; gerçek PG fixture kabulü açık.
2. PostgreSQL18 araçları bu ortamda yok; resmî kurulum/PG_BIN yönergesi verildi.
3. Ayrı salt okunur BYPASSRLS login modeli tasarlandı; rol oluşturulmadı. Neon managed yetki uygulanabilirliği provider/operatör onayına bağlı.
4. RLS filtrelenmesini fail-closed engelleyen kontroller test edildi; gerçek backup üzerinde eksiksizlik kanıtı henüz yok.
5. Node/OpenSSL AES-256-GCM; per-archive salt/IV, HKDF alt anahtarlar, HMAC-SHA256 authenticated manifest.
6.32-byte random base64 key + KEY_ID, ayrı offline kurtarma kopyaları; gerçek key üretilmedi/saklanmadı.
7. R2 SDK modülü ve in-memory testleri var; gerçek PUT/readback yapılmadı.
8.61 izole kod testi geçti; gerçek PostgreSQL fixture dump testi yapılmadı.
9. Gerçek development dump alınmadı.
10. Gerçek yedek R2'ye gönderilmedi.
11. Araç, sınırlı backup rolü/direct URL ve key eksik. R2 public/domain/token-scope ayarları hesap sahibinin panel beyanıyla doğrulandı; bağımsız API kontrolü yapılmadı.
12. E3 runner/secret/schedule/izleme; E4 ayrı boş hedef/key kurtarma/rol-grant/Auth-session/RLS/finansal bütünlük tatbikatı gerekir.

[Gerçek işlem öncesi ayrı onay listesi](../../research/PUSULA_V030_SPRINT_E2_AUDIT.md) · [CLI/format](../operations/BACKUP_ENGINE.md).

## Git teslimi

`7081845` motor/testler, `b50a1f2` operatör R2 beyanı ayrımı, `22f14a1` conditional conflict stream temizliği. Üç kod commit'i mevcut feature dalına başarıyla normal push edildi; sonrası upstream0/0. Bu rapor ayrı dokümantasyon commit'ine girer. Main'e commit/merge, force-push veya hard reset yapılmadı. Browser koşusunun yeniden ürettiği tek değişen D7 PNG'si E2 görsel değişikliği olmadığı için önceki teslim sürümüne geri alındı; D7 uygulama/test kaynakları değiştirilmedi.
