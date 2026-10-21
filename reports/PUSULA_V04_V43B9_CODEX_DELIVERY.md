# PUSULA V4.3b.5–V4.3b.9 — DELIVERY_BLOCKED

21.10.2026. Commit, stage veya push yapılmadı. Kullanıcının “Kritik hata veya dosya çakışması varsa commit/push yapmadan dur” koşulu uygulandı: değişmemiş eski migration'ların Git blob'ları ile committed baseline arasında tekrar üretilebilir checksum uyuşmazlığı bulundu.

## Git başlangıcı ve teslim kapsamı

Dal `feat/pusula-v030-neon-cloud`; HEAD, upstream ve gerçek `git ls-remote origin refs/heads/feat/pusula-v030-neon-cloud` aynı: `f56caed5eadb64e76304777f83477f1677c19d19`. Ahead/behind 0/0. Başlangıçta 20 beklenen modified/untracked dosya vardı; staged dosya, merge çakışması veya kapsam dışı kullanıcı değişikliği yoktu. Uzak ref HEAD ile aynı olduğundan o commit'in tree envanteri GitHub'daki mevcut dosyaların kanıtı olarak kullanıldı; fetch gerekmedi.

V4.3b.9'un istenen 13 dosyasına ek olarak aşağıdaki yedi tamamlanmış rapor uzak commit'te yoktur. Hepsi korunarak planlanan teslim kapsamına alındı; henüz stage edilmedi.

- `research/PUSULA_V04_V43B5_RECOVERY_PREFLIGHT.md`
- `docs/validation/V04_V43B5_VERIFICATION.md`
- `research/PUSULA_V04_V43B6_RECOVERY_SAFETY.md`
- `research/PUSULA_V04_V43B7_RECOVERY_CREATION.md`
- `docs/validation/V04_V43B7_RECOVERY_VERIFICATION.md`
- `research/PUSULA_V04_V43B8_NEON_COMPATIBILITY.md`
- `docs/validation/V04_V43B8_VERIFICATION.md`

V4.3b.9 listesi:

- `prisma/migrations/202610210016_goods_receipts/migration.sql`
- `scripts/stock/migrate.ts`
- `scripts/stock/migration-baseline.json`
- `scripts/stock/migration-fixture.ts`
- `scripts/stock/managed-preparation.ts`
- `scripts/stock/managed-baseline.json`
- `scripts/stock/managed-fixture.ts`
- `scripts/stock/managed-fixture-baseline.json`
- `tests/stock-migration-runner.test.ts`
- `tests/stock-managed-preparation.test.ts`
- `research/PUSULA_V04_V43B9_MANAGED_ACL_FIX.md`
- `docs/validation/V04_V43B9_VERIFICATION.md`
- `LAST_REPORT.md`

Bu teslim raporuyla toplam planlanan kapsam 21 dosyadır. Engelden sonra yalnız bu rapor oluşturuldu ve LAST_REPORT başına teslim özeti eklendi; uygulama/runner/SQL değiştirilmedi. Önceki kullanıcı ve rapor değişiklikleri korundu.

## Kritik bütünlük bulgusu

İlk 15 migration'ın çalışma kopyası, mevcut baseline ile 15/15 eşleşir. Git diff'i bu dosyaların değiştirilmediğini gösterir. Buna rağmen 004, 005, 007, 008 ve 012 dosyalarının **mevcut uzak commit'teki LF blob içeriği**, aynı commit'teki `scripts/db/migration-baseline.json` hash'leriyle eşleşmez. Çalışma kopyasında bu beş dosyanın CRLF baytları baseline'a uyar. İçerik farkı yalnız satır sonudur; SQL iş mantığı değişikliği tespit edilmedi.

| Migration | Baseline ve çalışma kopyası SHA-256 | Mevcut Git blob SHA-256 |
| --- | --- | --- |
| 004 auth_mfa | `96a7e660105b3ff8f897e0894d6eb8ceea3ee7152a4747c04cd1cbf449020644` | `eced9930cf54c6253430f3a5b3a77d4e98906ee6978b620769be8af181359abb` |
| 005 authorization | `27bfae7c1ba1622774e57d4fe226893f46089b5c68bef3e8779fe2c7c7ed899a` | `813bb385499c1f39c7a808ca030ac8f9585ddbb4db32bbfa0d7b6f6858b04a98` |
| 007 resource_policy | `b0154ad979dd5a3ba077dbfa65379fee95eb420283b59166c2c52ca0a986bd86` | `014cf289639104b7549448d0a0c752feb153c7be07cc707eaa9cfe55a48cba6d` |
| 008 company_metadata | `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a` | `5aa71bc7fd52a4d06b053623205dbe9f5530959bd46682dd7030722c1f2955ec` |
| 012 cloud_catalog_controls | `ee460b6466adbae8755b64840af36de3eb4d52756947ce6e6153fb2a791e2e2e` | `5179a9075660b49861b9176fc5713e28c6ee59109f083473525a1209a77ced39` |

Committed `.gitattributes`, `prisma/migrations/**/migration.sql text eol=lf` kuralını içerir. Bu nedenle yalnız çalışma ağacının checksum kontrolünü geçirmek, GitHub'dan alınan artifact'ın aynı kontrolü geçeceğini kanıtlamaz.

**Gerçek tekrar üretim:** `.data/v43b9-delivery/git-artifact/` altında ilk 15 migration `git show HEAD:<path>` baytlarıyla, 016 ve gerekli baseline'lar mevcut adaydan kopyalandı. Asıl `scripts/stock/migrate.ts` modülünün `stockFiles()` fonksiyonu bu izole dizinde çalıştırıldı. Sonuç `STOCK_LEGACY_CHECKSUM_REJECTED`. Client oluşturulmadı; SQL veya migration apply yapılmadı. Bu bir yeni PostgreSQL fixture koşusu değildir. Git branch/worktree/checkout oluşturulmadı, ilk 15 kaynak dosyaya yazılmadı.

Uyuşmazlık teslim adayından önceki uzak commit'te de vardır; V4.3b.9 SQL değişikliğinin ürettiği yeni bir fark olarak sunulmuyor. Ancak teslim edilen runner'ın Git artifact'ı üzerinden kullanımı fail-closed duracağı için bu görevde kritik teslim engeli kabul edildi. İlk 15 SQL'i veya eski checksum baseline'ını izinsiz normalize ederek geçirme, checksum kontrolünü gevşetme veya history düzeltme yapılmadı. Ayrı bir düzeltme çalışması gerçek uygulanmış checksum'ları, Git bayt sözleşmesini ve yeniden üretilebilir checkout davranışını birlikte ele almalıdır.

## Geçen bütünlük kontrolleri

- 016 eski SHA: `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`.
- 016 yeni SHA: `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272`; SQL, stock runner ve managed baseline ile eşit.
- Stock migration baseline'ın tamamı önceki gerçek fixture'daki ölçüm artifact'ıyla eşit. Yeni function hash `985bc3b9cf0cb7fdd3930786d8fbad6c60d6e2732d057e19cf3536f981c9b227`; diğer yedi kategori değişmedi. Bu kontrol eski ölçüm dosyasını okur; yeni DB ölçümü değildir.
- Eski DB runner, migration-safety, eski DB baseline, backup postgres/policy ve normal fixture ACL pinleri Git içeriği açısından değişmedi.
- Eski cloud guard ve loopback/UUID fixture kapısı korunur. Managed CLI koşulsuz kapalı; managed profile `applyEnabled=false`, `post=null`. Tarihsel Neon pre hash'i yerel fixture pininden ayrıdır.
- SQL'de geçici oluşturucu rolün transaction sonunda DROP ve executor SET üyeliğinin REVOKE adımları var. Postflight rol/üyelik/schema CREATE kalıntısını reddeder. Önceki non-superuser fixture kayıtları kalıntı bulunmadığını ve sunucu kapanışını gösterir; bu teslimde canlı DB sorgusuyla tekrar kontrol edilmedi.
- `token_roles` hâlâ ROLE_DELTA_UNRESOLVED. Neon provider 401, güncel managed preflight, gerçek resolved 008 checksum'u, managed rol-grantor davranışı ve postflight enrollment açık denetim konularıdır.
- Bağımsız R2 backup/restore operasyonel kabulü yok; 35/21 allowlist ve recovery kontrolleri gevşetilmedi. Gerçek restore/cutover veya bulut apply yetkisi çıkarılmaz.

## Bu teslim görevinde gerçekten çalıştırılan testler

| Komut | Sonuç | Yerel kanıt |
| --- | --- | --- |
| `npm.cmd test` | 33 dosya / 389 test PASS, native exit 0 | `.data/v43b9-delivery/test.log` |
| `npx.cmd tsc --noEmit` | PASS, native exit 0 | `typescript.log` |
| `npm.cmd run lint` | PASS, native exit 0 | `lint.log` |
| `npm.cmd run build` | PASS, native exit 0; mevcut geniş .data tracing uyarısı | `build.log` |

Bu testler mevcut çalışma ağacında çalıştı; eski migration'ların Git artifact checksum engelini gidermiş sayılmaz. Önceki runner 20/20, managed 12/12 ve PostgreSQL iş/RLS regresyonları **bu teslimde yeniden çalıştırılmadı**. Yeni fixture sonucu olarak sunulmuyor.

## Hassas bilgi taraması ve koruma

Planlanan 20 başlangıç dosyasında private key, GitHub PAT, AWS access key, JWT ve Neon API key desenleri bulunmadı. URL ve credential kullanımları ayrıca incelendi: testlerde sentetik literal değerler veya fixture'da RAM içinde üretilen parolalar bulunur; gerçek `.env.local`, bağlantı parolası, token veya ham Auth/MFA/session içeriği teslim listesinde yoktur. Provider kimlikleri/hostlar ve sınırlı önceki iş doğrulama sonuçları operasyonel rapor metadatasıdır. Bu raporun eklenmesiyle tüm 21 dosya yeniden tarandı.

`git ls-files -- .data .env.local .next src/generated` boş döndü. `.data` logları, fixture credentials, build/generated artifact'ları stage edilmedi. Koruma manifest'i, izin verilen LAST_REPORT teslim özeti dışında önceki dosyaların bu görevde değişmediğini doğrular. Gerçek Neon/API/DB, R2, provider branch/endpoint/snapshot, restore veya env mutation yoktur.

## Nihai teslim durumu

**DELIVERY_BLOCKED.** Yeni commit SHA yok; push denenmedi. HEAD/upstream/gerçek uzak ref `f56caed5eadb64e76304777f83477f1677c19d19`, ahead/behind 0/0 olarak kaldı. Çalışma ağacı teslim edilmemiş beklenen dosyaları ve bu raporu içerir; temiz değildir. Index boş bırakıldı. Main merge, force-push ve hard reset yapılmadı.

Checksum/satır sonu bütünlük sorunu ayrı ve açık kapsamla çözümlenmeden bu teslim PASS sayılmaz.
