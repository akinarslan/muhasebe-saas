# PUSULA K1–K6 GitHub teslimi

23 Ekim 2026 · ZY Reklam iç kullanım hedefi: 29 Ekim 2026.

Durum: **DELIVERY_PASS** —62 dosyalık muhasebe paketi yetkili feature dalına normal push ile teslim edildi. Aşağıdaki sonuçlar gerçek ölçümdür; canlı dağıtım kabulü değildir.

## Yetki ve kapsam

Yalnız `origin/feat/pusula-v030-neon-cloud` üzerinde normal commit/push yetkisi kullanılır. Başlangıç HEAD ve gerçek `git ls-remote` sonucu aynı: `fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9`. Upstream `origin/feat/pusula-v030-neon-cloud`; origin `https://github.com/akinarslan/muhasebe-saas.git`. Uzak dal başlangıçta ilerlememiştir.

Kesin kapsam [K6 raporunun](../research/PUSULA_K6_RELEASE_READINESS.md) 61 dosyası + yalnız bu teslim raporu = **62 dosya: 11 değişmiş tracked + 51 yeni**. K6 listesindeki kaynak içerikleri başlangıç hash'leriyle korunur. Explicit path listesi kullanılır; `git add .` kullanılmaz. `.data`, env, fixture credential/key/dump/backup, generated ve test/build çıktıları kapsam dışıdır. Kullanıcı planları, K1–K5 raporları ve LAST_REPORT geçmişi korunur. Kaynak paketi ile Git teslim sonucunu kaydeden rapor güncellemesi ayrı normal commit'lerle teslim edilebilir; yeni dosya kapsamı değişmez.

## Bu teslimde gerçekten çalıştırılan doğrulamalar

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS, native exit0; 41 dosya /462 test |
| `npx.cmd tsc --noEmit` | PASS, native exit0 |
| `npm.cmd run lint` | PASS, native exit0 |
| `npm.cmd run build` | PASS, native exit0; Prisma generate + Next16.4.1 production build |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS, native exit0; 9 kontrol, Git LF artifact/tarihsel checksum ve resolved008 kabulü |
| Çalışma ağacı kapsam eşitliği | PASS, K6 listesindeki61 dosya; beklenmeyen değişiklik yok |
| İlk16 canonical SQL | PASS, index=HEAD blob kimlikleri korunmuş; beş tarihsel çalışma ağacı/LF çifti artifact kontrolünden geçti |
| 017 aday ve dört kaynak manifest hash'i | PASS, aday yalnız inceleme dizininde; canonical017 yok |

İlk Vitest denemesi sandbox `spawn EPERM` nedeniyle başlamadı (exit1); aynı komut süreç izniyle yeniden çalıştırıldı ve yukarıdaki462 test geçti. Checksum kontrolü yerel Git alt süreci; build Prisma/Next alt süreçleri için süreç izniyle çalıştırıldı. İlk uzak ref sorgusu sandbox proxy erişiminde başarısız oldu; ağ izniyle gerçek ref doğrulandı. Bunlar saklanmış başlangıç başarısızlıklarıdır, test başarısı gibi sayılmadı.

Build `.env.local` dosyasını okudu; dosya düzenlenmedi ve teslim kapsamına alınmadı. Build yalnız generate/build işlemlerini çalıştırdı; migration apply veya deploy yok. Build sırasında repository dışındaki üst dizin package-lock dosyasının yok sayıldığı uyarısı vardı; build exit0. Test ortamı performans önerisi doğruluk hatası değildir.

K5 PostgreSQL fixture,56 tablo şifreli restore ve tarayıcı kabulü **tarihsel kanıttır**: `docs/validation/PUSULA_ACCOUNTING_K5_VERIFICATION.md`. Bu teslimde PostgreSQL fixture/restore/tarayıcı testi yeniden çalıştırılmadı.

## Stage ve bütünlük kapısı

Stage denetimi PASS:62 dosya eşitliği, ilk61 kaynak bütünlüğü, index/Git filtreleri ve beş SQL artifact byte kimliği,16 migration index=HEAD, aday/manifest kaynak hash ve secret/private-key/token desen taraması geçti (0 bulgu). `git -c core.whitespace=cr-at-eol diff --cached --check` native exit0. Denetim62 dosya eşitliğini, staged içeriğin Git metin filtreleriyle, beş korunan SQL artifact byte'ının doğrudan çalışma ağacıyla ve ilk61 çalışma dosyasının başlangıç hash'leriyle eşleşmesini, secret/private-key/token/credential desenlerini, migration16 ve aday/kaynak manifest hash'lerini kapsar. Literal parola adayları manuel incelendi: iki sonuç da `Synthetic-` + rastgele UUID test üretimidir, sabit credential değildir. Token deseni taraması bilinen private-key/AWS/GitHub/Slack/JWT ve parola içeren uzak PostgreSQL URL desenlerini kapsar; tüm geçmiş için bağımsız secret sertifikası değildir.

Repo `core.autocrlf=true`. İlk index denetimi beş mevcut migration tarihsel LF/CRLF çiftini ham byte eşitliğiyle sınarken durdu; index/HEAD değişmemiş olduğu ve mevcut reviewed çiftlerle eşleştiği doğrulandı. Bu denetim hatası migration değişikliği değildir. Aday/kaynak artifact byte kimliğini korumak için yalnız dört kaynak SQL ve017 adayının stage komutunda `-c core.autocrlf=false` kullanılır; diğer57 dosyada normal Git metin filtresi kullanılır; kalıcı Git ayarı ve `.gitattributes` değiştirilmez. İlk16 SQL için mevcut `eol=lf` kuralı korunur. Index hash doğrulaması beş SQL artifact byte kimliğini ve diğer dosyaların Git filtreli içerik eşitliğini ayrıca ölçer. CRLF korunan SQL için `git -c core.whitespace=cr-at-eol diff --cached --check` kullanılır; bu yalnız CR karakterini geçerli satır sonu sayar, trailing space kontrolünü kapatmaz. İlk filtresiz62-dosya staging denemesi CRLF uyarısı üretti; normal dosyalar yeniden filtreli stage edildi, çalışma dosyaları değiştirilmedi.

016 SHA-256: `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`.

017 SHA-256: `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa`.

017 konumu: `scripts/accounting/migration-candidate/017-finance.sql`. Manifest dört kaynak hash'i korunur. 017 canonical Prisma dizinine taşınmaz.

## Push sonucu

| Ölçüm | Gerçek sonuç |
| --- | --- |
| Kaynak teslim commit'i | `3a32ab18680bf5a1f2129dae9910f971918663f4` |
| Commit mesajı | `feat(accounting): deliver K1-K6 internal MVP local acceptance` |
| Normal push | `git push origin HEAD:refs/heads/feat/pusula-v030-neon-cloud` |
| Push native exit code | `0` |
| Push sonrası gerçek uzak ref | `3a32ab18680bf5a1f2129dae9910f971918663f4 refs/heads/feat/pusula-v030-neon-cloud` |
| Ahead/behind | `0 / 0` |
| `git status --porcelain=v1` | Boş; çalışma ağacı temiz |

Bu gözlem kaynak teslim commit'inin push'undan hemen sonra alındı. Sonrasında yalnız bu raporun sonucu kaydeden bölümü normal bir dokümantasyon commit'iyle teslim edilir; ilk61 dosya değiştirilmez, toplam benzersiz dosya kapsamı62 kalır. Raporun kendi commit SHA'sı dosyanın içine self-reference olarak yazılamaz; son rapor commit SHA'sı ve son gerçek remote/ahead-behind/porcelain/native-exit doğrulaması nihai yanıtta ayrıca verilir. Önceki push başarı kanıtı rapor takip commit'inin henüz ölçülmemiş push'uyla karıştırılmaz.

## Açık kalan canlı engeller

- Migration016 gerçek Neon pre/provider ACL/bağımsız post kabulü BLOCKED.
- Migration017 non-superuser rol/ownership/ACL yaşam döngüsü, Prisma modeli ve canonical kayıt/managed kabulü BLOCKED.
- Gerçek kaynaktan bağımsız şifreli offsite backup/restore ve key/rol/DB ACL kurtarma kabulü BLOCKED.
- Recovery `token_roles / ROLE_DELTA_UNRESOLVED` korunur; tam recovery sertifikası değildir.
- Gerçek işletme/personel/açılış mutabakatı ve go-live kabulü BLOCKED.

`ACCOUNTING_CLOUD_REVIEW_REQUIRED`, `STOCK_MANAGED_APPLY_DISABLED`, `applyEnabled=false` ve `postFingerprint=null` korunur. Neon SQL, migration apply, R2 upload, restore, branch/snapshot yaratma, recovery/production değişikliği, main merge, rebase, force-push veya hard reset yapılmaz. **GO_LIVE_PASS verilmez.**
