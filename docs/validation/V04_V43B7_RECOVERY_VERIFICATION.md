# PUSULA V4.3b.7 — RECOVERY_BRANCH_PARTIAL (güncellenmiş onay)

21.10.2026 18:54 Türkiye saati. [Ayrıntılı rapor](../../research/PUSULA_V04_V43B7_RECOVERY_CREATION.md).

| Kontrol | Gerçek sonuç |
| --- | --- |
| Proje/org/source/endpoint kimliği | PASS; sabit development parent ve Free plan GET ile doğrulandı |
| İsim/kota/operasyon ön kontrolü | PASS; isim boş, 4/10, pending 0 |
| Tüketim ölçümü | HTTP 403; Console kullanıcı kanıtı ve güncellenmiş açık onayla devam edildi |
| Yerel writer taraması | Proje eşleşmesi yok; tüm harici yazıcılar dışlanamaz |
| Source SQL writer metadatası | Başka development oturumu, prepared xact, subscription, slot yok |
| Source referansı | 15:51:53.529Z, RR READ ONLY; yeni referans oluşturuldu |
| Branch oluşturma | HTTP 201, tek POST: br-late-river-baeipun8 |
| Parent/capture | br-rough-darkness-ba6ow9zo; 15:51:53Z, LSN 0/38201C8 |
| Endpoint oluşturma | HTTP 201, tek POST: ep-aged-flower-bauhc0to; doğru recovery bağı |
| Compute/auto-suspend | GET min=max 0.25 CU, suspend_timeout_seconds 0 = Free varsayılanı 5 dakika; fiili suspend gözlemi yapılmadı |
| TLS / READ ONLY | Kaynak ve recovery CA/hostname/encrypted/authorized PASS; default RO on ve RR READ ONLY; bağlantılar kapandı |
| PG / tablo / RLS | İki tarafta 18.6 / 40 / 26 |
| Migration geçmişi | Eşit; 15 başarı, 008 bilinen resolved rollback, unresolved 0 |
| 015 checksum | Eşit: 181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a |
| 016 ve stock executor | Yok/pending; apply yapılmadı |
| Şema fingerprint | 8/8 eşit |
| Membership/default/legacy ACL | 3/3 eşit |
| Genişletilmiş pusula table ACL | Tüm public tablolar, pusula% rollerinin beş DML yetkisi: eşit; kapsam tam obje ACL dump'ı değildir |
| Tam rol fingerprint | FAIL: recovery'de ek token_roles; kaynak rol özellikleri eşit; ek rol provenance doğrulanmadı |
| İzinli yedi business count/digest | 7/7 eşit; source-before/source-after/recovery |
| PO-2026-9893 | APPROVED, 1 satır, 2m→3.04m², factor1.52, 30.40USD; eşit |
| Supplier/material/variant ilişkileri | Tenant/legalEntity dahil join 1/1, eşit |
| Kaynak capture sonrası kontrol | Business/schema/privileges değişmedi; tüm DB için RPO=0 iddiası yok |
| Korunan eski kaynaklar | 4 eski branch, 4 eski endpoint, snapshot mevcut; mutation yok |
| Nihai provider | 5/10 branch, 5 endpoint, 1 snapshot; ready; 118 operasyonda pending/failed 0 |
| Auth/MFA/session içerikleri | Okunmadı; full clone içinde bulunabilir, içerik eşitliği ölçülmedi |
| Yasak işlemler | Migration/restore/R2/production-test SQL/env değişikliği/Git mutation yapılmadı |
| Test/build | Çalıştırılmadı |

İlk recovery denetimi PRIVILEGE_DRIFT ile exit1; başarısız kayıt korundu. Tamamlayıcı READ ONLY tanılama kalan karşılaştırmaları tamamladı. Farkı gidermek için DDL/GRANT, normalization, silme veya yeniden oluşturma yapılmadı. Tam rol eşitliği sağlanmadığından PARTIAL; branch korunur.

Kanıt: .data/recovery-v43b7/approved/comparison.json ve diğer sanitized yerel kayıtlar. Gerçek artımlı tüketim/kalan kota ölçülemedi; API 403 saklanmadı. Önceki BLOCKED koşusu aşağıda tarihsel olarak korunur.

---

## Önceki koşu — güncellenmiş onay öncesi

# PUSULA V4.3b.7 doğrulama — RECOVERY_BRANCH_BLOCKED

21.10.2026 18:40 Türkiye saati. [Karar ve envanter raporu](../../research/PUSULA_V04_V43B7_RECOVERY_CREATION.md).

| Kontrol | Durum | Kanıt / sınır |
| --- | --- | --- |
| Git hedefi | PASS | feat/pusula-v030-neon-cloud, f56caed5eadb64e76304777f83477f1677c19d19; salt okunur Git kontrolü |
| Proje/source/endpoint | PASS | Güncel GET 200, sabit ID ve hostname eşleşti |
| Önerilen isim | PASS | Envanterde yok; üzerine yazılmadı |
| Branch/snapshot envanteri | PASS | 4 branch, 4 endpoint, 1 snapshot; korunan ID'ler mevcut |
| Provider operasyonları | PASS | Cursor ile son boş sayfaya kadar 112 kayıt; pending 0 / failed 0 |
| Free plan / branch slotu | PASS | Org free, project free_v3, 4/10 |
| Storage/compute kapasitesi | BLOCKED | Tüketim GET 403; kesin kalan kota ve endpoint kapasite kanıtı tamamlanmadı |
| Güncel yerel/DB yazıcı denetimi | NOT RUN | Kapasite kapısında duruldu |
| Güncel source READ ONLY kontrolü | NOT RUN | PG 18.6 / 40 / 26 / 15 / 015 / 016 pending yeniden SQL ile doğrulanmadı |
| Güncel sipariş kontrolü | NOT RUN | APPROVED / 30,40 USD bilgisi yalnız önceki V4.3b.6 kanıtıdır |
| Yeni source referansı | NOT RUN | Önceki snapshot referansı bu koşuya mal edilmedi |
| Recovery oluşturma | NOT ATTEMPTED | POST gönderilmedi; yeni ID/capture LSN yok |
| Yeni endpoint ve auto-suspend | NOT ATTEMPTED | Endpoint oluşturulmadı |
| Recovery TLS READ ONLY SQL | NOT RUN | Recovery branch yok |
| Şema / rol / ACL / business digest karşılaştırması | NOT RUN | Yeni source/recovery karşılaştırması yok |
| Supplier / material / variant ilişki kontrolü | NOT RUN | Yeni recovery olmadığı için doğrulanmadı |
| Mevcut kaynak koruması | PASS | Mutation yok; GET envanterinde mevcut |
| Migration 016 apply / restore / finalize | NOT RUN | Yasaklar korundu |
| Git commit/push/merge, test/build | NOT RUN | Yapılmadı |

Provider trace: `.data/recovery-v43b7/provider.json`, `.data/recovery-v43b7/capacity-resume.json`. Bu dosyalar token içermez; .data Git'e eklenmedi.

Önceki kullanıcı Console kanıtı API tarafından ölçülmüş kalan kota değildir. V4.3b.7'nin kapasite belirsizliğinde durma şartı nedeniyle sonuç BLOCKED; branch oluşturulmadığı için PARTIAL değildir.
