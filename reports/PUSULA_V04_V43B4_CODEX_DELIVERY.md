# PUSULA V4.3b.4 — Codex GitHub teslimi

21.10.2026 · **DELIVERY_PREPARED — kontroller geçti, commit/push bekleniyor.**

Bu görev için kullanıcı, yalnız `feat/pusula-v030-neon-cloud` dalında commit ve normal push yetkisi verdi. Önceki hazırlık belgelerindeki “Mimo teslim edecek / Codex commit yapmadı” ifadeleri hazırlık aşamasının tarihsel kaydıdır; bu yeni teslim yetkisini anlatmaz.

## Başlangıç ve Git teslimi

| Kontrol | Doğrulanan değer |
|---|---|
| Dal |`feat/pusula-v030-neon-cloud` |
| Başlangıç HEAD/upstream |`cd4ffcfeb576cef64b553c875e59617716ed1383` |
| Gerçek uzak ref |`git ls-remote origin refs/heads/feat/pusula-v030-neon-cloud` aynı SHA |
| Başlangıç ahead/behind |0/0 |
| Başlangıç değişiklikleri |Beklenen9dosya; staged dosya ve çakışma yok; kapsam dışı kullanıcı değişikliği yok |
| Kod commit mesajı |`chore(v0.4): prepare isolated V4.3b.4 migration 016 runner` |
| Kod commit SHA |Commit oluşturulunca kaydedilecek |
| Normal push sonucu |Henüz çalıştırılmadı |
| Push sonrası HEAD/upstream/ahead/behind/tree |Push sonrası kaydedilecek |

Gerçek kod commit SHA'sı ve başarılı push gözlemi, ilk push sonrasında bu rapora ve LAST_REPORT.md dosyasına yazılarak yalnız aynı feature dalında bir takip dokümantasyon commit'iyle kaydedilecektir. Bir dosya kendi commit SHA'sını içeremez; son dokümantasyon commit'inin nihai SHA'sı push sonrası kullanıcıya ayrıca bildirilecektir.

## Bu teslim görevinde gerçekten çalıştırılan testler

| Komut | Sonuç | Yerel kanıt |
|---|---|---|
| `npm.cmd test` |PASS;32dosya,379/379;native exit0 |`.data/v43b4-delivery/test.log` |
| `npx.cmd tsc --noEmit` |PASS;native exit0 |`typescript.log` |
| `npm.cmd run lint` |PASS;0error/0warning;native exit0 |`lint.log` |
| `npm.cmd run build` |PASS;native exit0 |`build.log` |

Build'de mevcut `src/lib/rate-store.ts` kaynaklı geniş `.data` tracing pattern uyarısı vardır; derleme hatası değildir. TypeScript/ESLint/Vitest/build uygulama ve kaynak kontrolleridir; bu görevde PostgreSQL bağlantısı veya migration apply yapılmadı.

Runner20/20 ve Stock36/36, önceki V4.3b.4 hazırlık sprintinin gerçek izole PostgreSQL18.6 kanıtlarıdır. **Bu GitHub teslim görevinde yeniden çalıştırılmadılar.** Önceki DB/RLS/Auth/Supplier/Purchase regresyonları da yeni koşu gibi sunulmaz. Ayrıntılar [önceki doğrulama belgesindedir](../docs/validation/V04_V43B4_VERIFICATION.md).

## Bütünlük ve hassas bilgi denetimi

- İlk15migration SHA değerleri mevcut baseline ile15/15eşit;Git diff yoktur.
- Migration016SQL değişmedi. SHA-256: `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`.
- Eski `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` koruması aynı dosyada korunur;eski runner ve baseline/backup kodları değiştirilmez.
- Yeni runner yalnız UUIDmarker ile doğrulanmış loopbackfixture,fixture_admin,port/database/data_directory vePG18.6 kabul eder. Bulut yolu env/bağlantıdan önce kapanır;remoteoverride yoktur. Onaysız yerelapply ve eksik/bozukACLpinleri reddedilir.
- Stage kapsamı yalnız aşağıdaki10dosyadır. `.env`,`.env.local`,`.data`,fixture/sır/build/generated/test artifact'ları alınmaz.
- Hassas bilgi taraması privatekey,credentialURL,GitHub/AWS token,JWT ve açık secretliteral kalıplarını kapsar. İşaretlenen iki satır mevcut verify-local.ts içindeki `${adminPassword}` ve `${password}` değişkenli sabit loopback URL şablonlarıdır;gerçek sır değildir. Yalnız bu iki incelenmiş şablon dar istisna olarak ayrılır. Sırlar veya eşleşen değerler tarama loguna basılmaz.
- Commit öncesi staged dosya listesi,hassas bilgi taraması ve `git diff --cached --check` doğrulanacaktır. Bu statik tarama bütün olası sır türleri için mutlak garanti değildir.

## Teslim edilen kesin10dosya

```text
LAST_REPORT.md
research/PUSULA_V04_V43B4_CLOUD_READINESS.md
docs/validation/V04_V43B4_VERIFICATION.md
scripts/stock/migrate.ts
scripts/stock/runner-baseline.json
scripts/stock/runner-fixture.ts
scripts/stock/migration-fixture.ts
scripts/stock/verify-local.ts
tests/stock-migration-runner.test.ts
reports/PUSULA_V04_V43B4_CODEX_DELIVERY.md
```

## Korunan sınırlar ve açık engeller

Bu görev yalnız GitHub kod teslimidir. Gerçek Neon development/test/production bağlantısı veya veri/rol/ACL değişikliği,016apply,recoverybranch/snapshot oluşturma/silme,restore/finalize,R2dump/upload,.env.local değişikliği veya gerçek Auth/MFA okuma/yazma yapılmadı. `main`,başka dal,force-push ve hardreset kullanılmadı.

Güncel pre-016recovery,kota/parentID/TLS/managedACL vecaptureRPO teyidi,gerçek development apply için ayrı açık onay gerektirir. Eski pre-015recovery güncel015/POverisini kapsayan bir pre-016noktası değildir. Bağımsız R2backup/restore engeli ve35/21backupallowlist korunur;47/33şema kabulü için güvenlik kontrolleri yalnız sayıya uydurularak gevşetilmedi. [Hazırlık ve kurtarma planı](../research/PUSULA_V04_V43B4_CLOUD_READINESS.md).
