# PUSULA v0.3 — Sprint E2 / şifreli yedekleme motoru

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Kod geliştirildi; E2 kabulü ve production kabulü açık.**

Web uygulamasından ayrı preflight/create/upload/verify/list CLI eklendi. Direct development/özel rol guard'ı, salt okunur export snapshot,35 tablo/21 FORCE RLS adı ve migration checksum denetimi, custom dump TOC kontrolü, akışla AES-256-GCM, authenticated manifest, conditional R2 PUT ve tam readback doğrulaması bulunur.4 GiB sınırı, özel ACL'li scratch, paralel iş kilidi ve gerçek işlemler için ayrı açık onay bayrakları vardır. Gerçek key üretilmedi; rol/grant/migration ve UI değiştirilmedi.

Son Vitest **165/165** (E2 **61**), build/TypeScript ve lint PASS. PostgreSQL/RLS **11/11**, Cloud/DB **11/11**, Auth/API **60/60**, demo Playwright **22/22**, auth/cloud/D7 **4/4** geçti; toplam browser **26/26**. R2 HeadBucket resmî SDK ile yeniden geçti. Preflight eksik kurulumu beklenen exit1 ile engeller. Son upload stream cleanup değişimi sonrası61 E2 testi ve TypeScript tekrar geçti.

**Gerçek PostgreSQL fixture dump/--list testi yapılamadı:** araçlar ve ayrı yerel fixture DB yok. Mevcut61 E2 testi sentetik byte/TOC, taklit PG bağlantısı ve bellek içi S3 kullanır; gerçek yedek/restore kanıtı değildir. Gerçek development dump, R2 PUT/DELETE, scheduler ve restore çalıştırılmadı. Production, gerçek Master/MFA, env ve localStorage korunur.

Eksikler: PostgreSQL18 araçları; provider tarafından desteklenen, yazma/DDL yetkisi olmayan ayrı BYPASSRLS backup rolü (`pusula_backup` mevcut değil); direct URL; onaylı key/KEY_ID/offline kurtarma kopyaları. Mevcut owner BYPASSRLS yanında CREATEDB/CREATEROLE taşıdığı için backup rolü olarak kabul edilmez. E3/E4 ayrı kalır.

Hesap sahibi panelden r2.dev Disabled, bağlı custom domain yok, Object Read & Write token yalnız doğru bucket bilgilerini doğruladı. Bu operatör beyanı olarak kaydedildi; bağımsız yönetim API denetimi değildir. Onay bayraklı salt okunur preflight bu incelemeyi kabul eder, kalan key/tool/source eksiklerini engeller. Kullanıcı gerçek dump/upload öncesi ayrı onay şartını korudu.

[Doğrulama](docs/validation/SPRINT_E2_VERIFICATION.md) · [Yetki denetimi ve ayrı gerçek işlem onay listesi](research/PUSULA_V030_SPRINT_E2_AUDIT.md) · [CLI/format/kurulum](docs/operations/BACKUP_ENGINE.md).

Kod teslimi `7081845`, `b50a1f2`, `22f14a1` mevcut feature dalına normal push ile gönderildi. Kod push'u sonrası upstream farkı0/0.16 teslim dosyası ve23 production client JS dosyasında yapılandırılmış yerel sır taraması PASS. Bu doğrulama raporu ayrı dokümantasyon commit'iyle aynı dala gönderilir. Main'e merge/force-push/hard reset uygulanmadı.

---

# Önceki teslim: PUSULA v0.3 — Sprint D7 / UI ve bildirim düzeltmeleri

> **18.10.2026 / Güncel durum: Sprint E, E1 kurulum kapısında.** Başlangıç `00cf549`; D7 rapor commit'i de teslim edilmiş. Fetch sonrası upstream0/0 ve çalışma ağacı temizdi. Neon development/test salt okunur doğrulandı: PostgreSQL18.6, her birinde35 tablo/21 FORCE RLS; auth ve işletme aynı development DB'sinde ayrı rollerle.
>
> R2 erişim/kimliği, özel backup bağlantısı ve ayrı boş onaylı restore hedefi yok; pg_dump/pg_restore PATH'te bulunmadı. Hesaptaki bucket'lar doğrulanamadı. Talimat gereği E2–E5'e geçilmedi; dump/şifreleme/upload/restore/scheduler/alarm testi yok. Production, gerçek veriler, Master/MFA, env ve localStorage değiştirilmedi. Yalnız belgeler ve env örneği güncellendi; tam regresyon tekrar çalıştırılmadı. Aşağıdaki D7 sonuçları önceki teslimdir.
>
> [E1 denetim/maliyet](research/PUSULA_V030_SPRINT_E_AUDIT.md) · [Gerekli kurulum](docs/operations/R2_BACKUP_SETUP.md) · [Restore](docs/operations/DISASTER_RECOVERY.md) · [Retention](docs/operations/BACKUP_RETENTION.md).

17.10.2026 · `feat/pusula-v030-neon-cloud` · Önceki D7 development teslimi. v0.3 production kabulü bu teslimde kapsam dışıdır.

## Sonuç

Bulut müşteri ve kullanıcı araması ortak `SearchField` ile tek dış çerçeve, solda Lucide ikon ve erişilebilir dış focus göstergesine kavuştu. Mobilde etiket bölünmesi ve dar input düzeni giderildi. Demo müşteri/ürün/üst aramada iç focus gölgesi kaldırılırken dış focus korundu; mevcut filtreler değişmedi.

Bildirilen çift border bu başlangıç sürümünde yeniden üretilemedi. Önceki gerçek ölçüm input border 0 / dış border 1 px gösteriyordu; focus göstergesi ise yoktu. Sorunun kesin tek nedeni diye çift border iddiası yapılmaz. Somut nedenler, müşteri aramasının ikon yerine inline metin kullanması ve parçalı `.cloud-search` CSS'inin input focus'unu dış karşılığı olmadan bastırmasıdır. Son durumda iç border/outline/shadow yok, dış border 1 px ve focus halkası tek kapsayıcıdadır.

Yeniden davet gönderirken önceki başarı bildiriminin görünür kalması düzeltildi. Bekleyen davet hatasına **Mevcut daveti yönet** bağlantısı eklendi; bilgiler korunur ve otomatik e-posta gönderilmez. Başarılı oluşturma drawer kapatma/liste yenileme, başarısızlıkta form koruma ve taşıyıcı kabulü/teslim ayrımı korunur. Mevcut TOTP/step-up UX doğru bulunduğu için auth mantığı değiştirilmedi.

## Doğrulama

Başlangıç Vitest 104/104; değişiklik öncesi arama görsel koşusu 2/2 geçti. Son doğrulama sonuçları aşağıdadır.

[Önce/sonra görseller ve ölçümler](docs/design/screenshots/d7/) · [Ayrıntılı kanıt](docs/validation/SPRINT_D7_UI.md) · [Akışlar](docs/design/UX_FLOWS.md).

## Korunan kapsam

Neon development iş kayıtları, gerçek Master/MFA, env dosyaları ve demo localStorage değiştirilmedi/temizlenmedi. Testler yalnız ayrı test DB ve hayalî hesapları kullanır. Production'a SQL/migration uygulanmadı, gerçek Resend gönderimi veya ücretli servis açılmadı. RLS, özel izinler, finansal Decimal motoru, USD/TCMB, tarihsel snapshot ve satış/müşteri işlevleri korunur. Sprint E ve önceki domain/operasyon sınırları [Sprint D raporunda](docs/history/PUSULA_V030_SPRINT_D_REPORT.md) sürer.

Değişen uygulama dosyaları: `src/components/ui/search-field.tsx`, `cloud-desk.tsx`, `user-administration.tsx`, `src/app/globals.css`, `premium.css`. Testler: mevcut `tests/auth-e2e/auth.spec.ts` ve yeni `d7.spec.ts`. Paket, migration veya ortam ayarı değişmedi.

## Git

Başlangıç `150861b`; fetch sonrası mevcut feature remote ile 0/0 aynıydı. Main `98caf4d` üzerinde korunur. Teslim aynı feature dalına normal commit/push ile yapılır; main merge, force-push ve hard reset kullanılmaz.

| Son kontrol | Sonuç |
| --- | --- |
| Build / TypeScript | Başarılı |
| Lint | 0 hata / 0 uyarı |
| Vitest | **104/104**, 17 dosya, 13.23 s |
| PostgreSQL/RLS | **11/11** |
| Cloud/DB | **11/11** |
| Auth/API | **60/60** |
| Auth + cloud + D7 Playwright | **4/4**, desktop/mobil, 6.8 dakika |
| Client secret taraması | 24 production dosyasında Resend anahtarı yok |

Normal/focus/dolu müşteri araması masaüstü ve mobilde PNG olarak alınıp incelendi; tek dış focus, ikon/metin hizası, filtreleme ve sayfa taşmaması doğrulandı. Beklenen negatif HTTP kayıtları dışında beklenmeyen browser konsol hatası yoktu. İlk browser koşusundaki test sıralama/locator hatası düzeltilip tam koşu tekrarlandı; başarısız deneme başarı sayılmadı. Önceden bilinen Next development stream, pg deprecation ve NO_COLOR uyarıları devam eder. Gerçek Safari/Firefox veya ekran okuyucu sertifikasyonu yapılmadı.

Demo Playwright: **22/22**, desktop/mobil, **1.7 dakika**; müşteri/satış taslakları, numeric giriş, maliyet, snapshot, responsive, klavye ve reduced-motion korundu. Son toplam browser sonucu 26/26'dır (22 demo + 4 auth/cloud/D7).

D7 uygulama/test/görsel teslimi **`549d4bd`**, GitHub `feat/pusula-v030-neon-cloud` dalına başarıyla push edildi. Push sonrası yerel/uzak farkı **0/0**, çalışma ağacı temizdi. 27 staged dosyanın yapılandırılmış yerel sırlara karşı taraması PASS verdi. Bu gerçekleşmiş push kaydı ayrı dokümantasyon commit'iyle aynı dala gönderilir; main değiştirilmedi.
