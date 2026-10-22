# PUSULA V4.3b.11 doğrulama — FIX_REQUIRED

22.10.2026. [Sözleşme, kritik ACL bulgusu ve kesin dosya listesi](../../research/PUSULA_V04_V43B11_MANAGED_RUNNER.md).

**Test altyapısı geçti; sabit migration adayı güvenli postflight'ı geçmedi.** Bu ayrım nedeniyle MANAGED_RUNNER_LOCAL_READY verilmedi. Başarılı testlerde kusurlu adayın reddi açıkça bekleniyor.

## Bu görevde yeni çalıştırılan kontroller

| Kontrol | Gerçek sonuç |
| --- | --- |
| Başlangıç dalı/HEAD/yerel upstream | feat/pusula-v030-neon-cloud; d65ea89d915805dbf6b6e5afd111beb727cf7ef5; ahead/behind0/0 |
| Başlangıç kullanıcı değişiklikleri | LAST_REPORT ve iki V4.3b.10 raporu vardı; korundu |
| Yeni managed contract unit negatifleri | 22 yeni test; aşağıdaki tam Vitest'e dahil |
| Nihai Vitest | 35 dosya / 417/417 PASS; native exit0 |
| Nihai TypeScript | npx.cmd tsc --noEmit; native exit0 |
| Nihai ESLint | npm.cmd run lint; native exit0; uyarı yok |
| Nihai build | npm.cmd run build; native exit0; mevcut geniş .data tracing uyarısı sürüyor |
| Gerçek non-superuser PG18.6 | 14 mevcut managed + 14 yeni contract + 9 Git LF artifact kontrolü PASS |
| Aynı managed cluster regresyonları | AuthC2 9 / Supplier16 / Purchase28 / Stock36 PASS |
| Sabit adayın doğrudan postflight'ı | REJECTED: STOCK_MANAGED_POST_DRIFT_security; dört PUBLIC EXECUTE var, üç beklenen doğrudan runtime grant'i yok |
| Test-only düzeltilmiş ACL'nin gerçek katalog deltası | PASS; fixture admin test kurulumu, üretim çözümü veya yeni pin değil |
| Rol/SET/schema CREATE/creator/runtime DML/PUBLIC/ek schema/non-MASTER negatifleri | Gerçek fixture DDL/DML ile her bozuk durum ölçülüp reddedildi; test enjeksiyonları açıkça kaldırıldı |
| Grantor-only drift / eksik grantor kapsamı | Reddedildi; geçmiş null grantor alanı boş ACL sayılmadı |
| Test-only ACL düzeltmesinin kaldırılması | Özgün aday snapshot'ına sıralamadan bağımsız exact eşitlik PASS |
| Ayrı normal Prisma/Git LF history fixture | Stock runner20/20; gerçek deploy/ALREADY_APPLIED/lock/rollback/drift PASS |
| Normal fixture regresyonları | DB11 / Auth62 / Cloud11 / Supplier16 / Purchase28 / Stock36 PASS |
| Gerçek migration geçmişi kabulü | Yerel fixture'da exact failed008 checksum'lu sentetik resolved kayıt korunur; unknown/unresolved/duplicate/yanlış rollback reddedilir |
| Offline CLI | AUDIT_ONLY / NEEDS_EVIDENCE / applied=false / postFingerprint=null; canlı ölçüm sayılmaz |
| Yanlış target/rol/DB/TLS/SHA | Unit ve mevcut ortak byte/TLS kapılarıyla reddedildi; bağlantı açılmadı |
| Eksik post kabulü / --apply | STOCK_MANAGED_POST_NOT_ENROLLED / STOCK_MANAGED_APPLY_DISABLED; daima kapalı |
| Cloud/provider/R2 işlemleri | Bu sprintte hiç yok |

Nihai managed fixture: `v42-b16d07b5-3871-46a6-8d86-7b248782065e`, PASS, serverStopped=true.

Normal fixture: `v42-7dba18a1-7287-406b-a0a8-0ec19bc479b3`, PASS, serverStopped=true.

Her iki cluster'ın postmaster.pid dosyası yok. Tüm sonuçlar yeni UUID/127.0.0.1/SCRAM/PostgreSQL18.6 ortamlarına aittir. LocalIdentity DB/actor/host/port/data-directory/UUID/PG-version kapısı geçilmeden negatif test mutasyonları çalışmaz. Gerçek Neon veya recovery/production/test bulut DB'ye bağlantı yoktur.

## Tekrarlanabilir komutlar

```text
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --managed-profile --checksum-git-artifact --supplier-only
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --git-migration-bytes
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
node --conditions=react-server --import tsx scripts/stock/managed-runner.ts --audit-snapshot <historical-pre-snapshot.json>
```

Son komuttaki snapshot, `managed-contract.json` içindeki `pre` alanının ayrı JSON dosyasıdır; tüm contract dosyası değildir. Bu görevde `.data/v43b11/historical-pre.json` kullanıldı. CLI yalnız dosya okur; environment yüklemez, bağlanmaz, provider çağırmaz veya SQL uygulamaz. Yeni canlı pre almak bu komutun yeteneği değildir. TLS planı saf `prepareManagedAudit` fonksiyonuyla sınanır.

Gerçek fixture apply doğrudan SQL ile ayrı non-superuser actor'da; normal fixture gerçek Prisma child runner ile çalışır. İkisi birbirinin kanıtı sayılmaz. Unit negatiflerinde sentetik grantor setleri kullanılır; gerçek pozitif delta kabulü ayrıca PostgreSQL kataloglarından alınmıştır. Tarihsel Neon pre ise V4.3b.10 ölçümüdür; bu sprintin canlı ölçümü değildir.

## Başarısız ilk denemeler ve düzeltmeler

1. İlk iki managed deneme yeni katalog collector'da `text || "char"` belirsiz operatör hatasıyla durdu. Default ACL objtype için açık `::text` eklendi. Cluster'lar kapandı; gerçek Neon erişimi yok.
2. Sonraki koşu doğrudan `STOCK_MANAGED_POST_DRIFT_security` verdi. Snapshot farkı dört PUBLIC EXECUTE ve üç eksik runtime grant'ini kanıtladı. Bu beklenen sözleşme gevşetilerek giderilmedi; aday FIX_REQUIRED olarak sınıflandı.
3. Deklaratif schema USAGE grantor beklentisi gerçek standart PG18 katalog kanıtıyla `pg_database_owner` olarak düzeltildi; yanlış actor grantor varsayımı kaldırıldı. Yerel SQL/sabit migration/pin değişmedi.
4. Test-only düzeltme sonrası tüm negatifler geçti; final deepEqual yalnız ACL satır sırası nedeniyle başarısız oldu. Kayıtlar canonical multiset hash eşitliğiyle karşılaştırıldı; kayıt/izin farkları yok sayılmadı.
5. İki fixture aynı anda serbest55432 portunu seçti. Managed başlangıcı bind hatası aldı ve wrapper `FIXTURE_STOP_FAILED/serverStopped=false` bildirdi. PostgreSQL log'u socket açılamadığını ve process'in kapandığını gösteriyor; postmaster.pid yok. Diğer cluster tamamlanıp kapandıktan sonra yeni managed koşusu başarıyla tamamlandı. Bu başarısızlık gizlenmedi; mevcut cluster'lara stop/delete uygulanmadı.
6. İlk offline snapshot dışa aktarımında Python varsayılan encoding'i Türkçe Permission etiketlerini bozdu; CLI ACL drift ile reddetti. UTF-8 açıkça kullanılarak kaynak tarihsel kanıtından doğru etiketler alındı; offline audit exit0. SQL/izin kaynağı değiştirilmedi. Final sözleşmenin pre security içeriği orijinal UTF-8 kanıtıyla karşılaştırıldı.
7. İlk lint yalnız kullanılmayan type import uyarısı verdi; import kaldırıldı. Nihai lint temiz. İlk Vitest416/416 idi; DB kimliği negatif testi eklenince nihai417/417 oldu. Nihai DB kimliğiyle fixture/test/build tekrar çalıştırıldı.

Build'deki `src/lib/rate-store.ts` üzerinden geniş `.data` pattern tracing uyarısı mevcut kapsam dışı uyarıdır; exit0 başarıdan ayrıdır.

## Kanıt dosyaları ve koruma

Yeni loglar `.data/v43b11/`: `vitest-acceptance.log`, `lint-acceptance.log`, `build-acceptance.log`, `managed-acceptance.log`, `normal-fixture.log`, offline audit logları ve önceki başarısız denemeler. TypeScript native exit0 araç kaydında; önceki `typescript.log` da var. Fixture dizinlerinde `verification.json`, `managed-contract-snapshots.json` ve mevcut schema/ACL/lifecycle sonuçları bulunur. Snapshot dosyaları sır veya gerçek Auth/session içermez; yine de `.data` ve fixture credentials teslim dışıdır.

Koruma kontrolü: tüm16SQL, managed-baseline, .env.local ve önceki iki V4.3b.10 raporu başlangıç SHA manifest'iyle aynı. LAST_REPORT başlangıç baytları yeni özetin sonunda aynen durur. Eski raporlar, .gitattributes, managed-preparation ve diğer baseline'lar değişmedi. Git diff --check geçti. Yeni dosyalarda ve değişen kaynaklarda credential/private-key desenleri tarandı; yalnız testlerde synthetic bağlantı şablonu bulunur. Commit/push/merge yapılmadı.

Kesin sprint kapsamı ana rapordaki dokuz dosyadır; önceki iki V4.3b.10 dosyası dahil çalışma ağacında toplam11dosya. `FIX_REQUIRED` statüsü yeni altyapının adayı reddettiğini ve SQL adayının ayrı düzeltme gerektirdiğini ifade eder; eksik provider/post/backup kanıtlarını kapatmaz. `ROLE_DELTA_UNRESOLVED`, post=null ve applyEnabled=false korunur.
