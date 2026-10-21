# PUSULA V4.3b.9a doğrulama — CHECKSUM_FIX_PASS

[Byte analizi, çözüm ve kesin 29 dosyalık teslim listesi](../../research/PUSULA_V04_V43B9A_CHECKSUM_FIX.md).

## Kanıt ve kabul matrisi

| Kontrol | Gerçek sonuç |
| --- | --- |
| Çalışma ağacı / HEAD blob / baseline | 004/005/007/008/012 için SHA-256 üçlü karşılaştırma tamamlandı |
| Gerçek development history | Önceden alınmış ham READ ONLY kayıtlar kullanıldı; yeni canlı SQL yok |
| Başarılı DB checksum'ları | Beş dosyada baseline ve çalışma ağacıyla eşit |
| Byte farkı | Her dosyada yalnız EOF LF önünde bir CR; kalan baytlar birebir eşit |
| Git ayarları | core.autocrlf=true (sistem), core.eol unset; attributes text/eol=lf; index LF, working mixed |
| Uyumluluk kapsamı | Yalnız beş tam migration adı ve sabit iki SHA-256; genel normalleştirme yok |
| Orijinal LF blob | Gerçek stockFiles ve history kontrolleri PASS |
| Orijinal son-CRLF çalışma biçimi | Gerçek güvenlik kodu PASS |
| Tek karakter / SQL komutu değişikliği | Reddedildi |
| BOM / trailing whitespace / gözlemlenmemiş tam CRLF | Reddedildi |
| Bilinmeyen checksum / yanlış ad / eksik migration | Reddedildi |
| Çift başarılı / unresolved history | Reddedildi |
| Gerçek eski resolved 008 | Tam failed checksum 35ca1ae8…ed1fd9 yalnız rollback satırında; satır korunur |
| Failed 008 hash'i başarılı SQL olarak | Reddedildi |
| Yeni artifact verifier | 9/9 PASS |
| Non-superuser gerçek PG18.6 | 14 managed + 9 artifact kontrolü PASS; Windows ve Git LF pre/postflight eşit |
| Git LF ile seeded gerçek PG18.6 history | Normal runner 20/20 PASS; gerçek Prisma deploy/ALREADY_APPLIED/timeout/rollback |
| Full fixture regresyonları | DB11 / Auth62 / Cloud11 / Supplier16 / Purchase28 / Stock36 PASS |
| Managed fixture regresyonları | AuthC2 9 / Supplier16 / Purchase28 / Stock36 PASS |
| Nihai Vitest | 34 dosya, 395/395; native exit 0 |
| Nihai TypeScript | npx.cmd tsc --noEmit; native exit 0 |
| Nihai ESLint | npm.cmd run lint; native exit 0 |
| Nihai production build | npm.cmd run build; native exit 0; mevcut .data tracing uyarısı var |
| İlk 15 SQL / tarihsel baseline | Byte ve içerik değişmedi; history UPDATE/resolve yok |
| 016 SHA | 7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272 — değişmedi |
| Managed ACL / rol çözümü | Korundu; executor üyelik/schema CREATE kalıntısı yok; geçici oluşturucu yok |
| Gerçek cloud apply | Kapalı; post pin null; gerçek Neon'a migration uygulanmadı |
| Git/env/provider/R2 işlemi | Commit/push/merge, env/config, gerçek kaynak veya R2 mutation yok |

Non-superuser fixture: `v42-17777ed9-5540-41fa-ad19-00226e3dc7f4`, PASS, serverStopped=true.

Git LF history ile normal Prisma fixture: `v42-4c90745f-aa31-427d-9305-16e576d2d5f4`, PASS, serverStopped=true.

## Tekrarlanabilir yerel komutlar

```text
node --conditions=react-server --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --managed-profile --checksum-git-artifact --supplier-only
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --git-migration-bytes
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

Fixture komutları yalnız yeni UUID/loopback test cluster'ında SQL çalıştırır. Gerçek Neon URL/env kullanılmaz. Artifact verifier yalnız yerel dosya/Git blob işlemi ve güvenlik fonksiyonu çağrısı yapar; DB bağlantısı açmaz.

## Kanıt sınırları ve başarısız ilk denemeler

Kaynak history: `.data/recovery-v43a1/live-readonly.json`, 2026-10-20T12:09:34.380Z; yeni canlı DB okuması değil. Başarılı checksum'ların daha sonraki toplu eşleşme kanıtı V4.3b.8'den gelir. Bunlar güncel cloud onayı değildir.

Eski başarısız teslim reproducer'ının artık pozitif sonucu reddetmesi; 008'de olmayan ALTER sözcüğünü değiştiren negatif testin aslında dosyayı değiştirmemesi; native cmd ilk çok satırlı çağrısında fixture'ın başlamaması raporda açıklandı. Negatif test gerçek CREATE/ALTER komutunu değiştirecek biçimde düzeltildi; fixture ayrı süreçle çalıştırıldı. Nihai gerçek sonuçlar yukarıda verilmiştir.

Yerel kanıtlar `.data/v43b9a/`: `byte-comparison.json`, `recovery-v43a1-history.json`, `preservation.json`, `artifact-fixed.log`, `checksum-tests-fixed.log`, `managed-fixture.log`, `git-history-fixture.log`, `vitest-final.log`, `typescript-final.log`, `lint-final.log`, `build-final.log`, `results.json`. Bu dosyalar ve fixture credentials teslim dışıdır.

`token_roles` ROLE_DELTA_UNRESOLVED; managed provider/ACL ve bağımsız R2/restore engelleri korunur. GitHub teslimi ve gerçek Neon uygulaması ayrı görevlerdir.
