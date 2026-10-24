# PUSULA M016 — Provider yeniden erişim doğrulaması

23 Ekim 2026 · Güncel GET aralığı: **11:51:13–11:51:14Z / 14:51:13–14:51:14 Türkiye**.
Dal: `feat/pusula-v030-neon-cloud`; HEAD: `edc03121737051d1eb180e621ccd91acfcc92743`.

**Sonuç: PROVIDER_REAUTH_PASS.** Mevcut `NEON_API_KEY` ile üç salt okunur Neon API GET işlemi HTTP200 verdi. Proje, development branch ve endpoint eşleşmesi bağımsız olarak güncel doğrulandı; plan ve endpoint kapasite metadata'sı alındı. **Bu sonuç migration016 uygulama onayı veya M016_READY_FOR_APPROVAL değildir. M016_BLOCKED ve kalan güvenlik/backup kapıları sürer.**

## Erişim ve gerçekten yapılan işlemler

Önce M016 cloud readiness, P0 blocker resolution, M017 readiness ve LAST_REPORT incelendi. İlk denemede anahtar Codex sürecinde ve User/Machine ortamında bulunmadığından GET yapılmadı ve ENVIRONMENT_HANDOFF_REQUIRED kaydedildi. Kullanıcının “hazır” bildirimi sonrasında anahtar Windows **User ortamında** erişilebilir oldu; mevcut Codex Process ortamı henüz devralmamıştı. Yalnız bu isteğin belleğindeki değişkene User ortamından okundu. OAuth credential dosyası, refresh/login veya alternatif hesap kullanılmadı.

Anahtar değeri, hash'i veya Authorization header hiçbir çıktıya, rapora veya dosyaya yazılmadı. Kalıcı ortam değişkeni ekleme/değiştirme yapılmadı. İstek sonunda yerel header/değişken referansları temizlendi. Yalnız `https://console.neon.tech/api/v2` üzerinde GET kullanıldı; TLS doğrulaması kapatılmadı, redirect izlenmedi, otomatik retry yapılmadı. SQL bağlantısı, compute start/restart veya provider mutasyonu yoktur.

| GET yolu (`/api/v2` altında) | UTC zaman | HTTP |
| --- | --- | --- |
| `/projects/icy-queen-44442204` | 2026-10-23T11:51:13.4724388Z | 200 |
| `/projects/icy-queen-44442204/branches/br-rough-darkness-ba6ow9zo` | 2026-10-23T11:51:13.7938439Z | 200 |
| `/projects/icy-queen-44442204/branches/br-rough-darkness-ba6ow9zo/endpoints` | 2026-10-23T11:51:14.1232168Z | 200 |

Connection URI/password uçları, başka proje/branch GET'leri, SQL veya tüketim/billing API çağrısı yapılmadı. Yanıtlardan yalnız seçilmiş provider metadata alanları kaydedildi; owner e-posta/adı gibi kişisel alanlar alınmadı.

## Sabit development kimliği karşılaştırması

Beklenti `src/server/db/target.ts` ve `scripts/stock/managed-contract.json` içindeki önceden sabitlenmiş hedef; yeni yanıttan öğrenilen hedef değil.

| Alan | Güncel provider sonucu | Sabit beklentiyle karşılaştırma |
| --- | --- | --- |
| Proje ID / adı | `icy-queen-44442204` / `pusula-development` | PASS |
| Bölge / PG major | `aws-eu-central-1` / 18 | Metadata doğrulandı; PG18.6 patch bu API ile yeniden ölçülmedi |
| Branch ID / adı | `br-rough-darkness-ba6ow9zo` / `development` | PASS; branch.project_id doğru projeye bağlı |
| Branch durumu | `ready`, pending_state=null | Güncel GET kanıtı |
| Branch özellikleri | parent_id=null, protected=false, default=false | Metadata; güvenlik veya backup kabulü değildir |
| Endpoint ID | `ep-blue-breeze-bavbjb7l` | Önceki sabit host ile uyumlu |
| Direct host | `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech` | PASS; endpoint.project_id ve branch_id bire bir doğru |
| Endpoint türü / durum | `read_write` / `idle`; pending_state=null; disabled=false | PASS; endpoint başlatılmadı |
| Database | Sabit uygulama hedefi `pusula_development` | API branch/endpoint eşlemesi doğrulandı; database varlığı/rol erişimi SQL ile yeniden ölçülmedi |

Endpoint listesinde bu development branch'e bağlı bir endpoint döndü. Hedef değiştirilmedi; production/recovery/test branch'lerine bağlanılmadı.

## Plan ve kapasite: doğrulanan değerler ve sınırlar

| Provider alanı | Güncel değer / değerlendirme |
| --- | --- |
| `owner.subscription_type` | **`free_v3`**; ücretli plan varsayımı yapılmadı |
| `owner.branches_limit` | **10**; mevcut toplam branch sayısı veya boş branch kotası bu sınırlı sorguda ölçülmedi |
| Endpoint min / max compute | **0,25 / 0,25 CU**; mevcut endpoint sabit0,25 CU ile yapılandırılmış |
| Project default min / max compute | **0,25 / 2 CU**; mevcut endpoint'e uygulanmış2 CU kapasite sayılmaz |
| Endpoint suspend timeout | **0 saniye**, API'nin ham yapılandırma değeri; yeni suspend/start denenmedi |
| Project history retention | **21.600 saniye / 6 saat**; bağımsız backup/offsite/restore yerine geçmez |
| Branch logical size limit | **1.073.741.824 byte / 1 GiB**; eşlik eden `branch_logical_size_limit=1024` |
| Development `logical_size` | **55.148.544 byte (~52,59 MiB)**; bu rapor anında belirtilen limitin altında |
| Project `synthetic_storage_size` | **0** döndü; branch logical_size yerine kullanılmadı, “veri yok” sonucu çıkarılmadı |
| Consumption period | **2026-10-16T10:34:55Z → 2026-11-01T00:00:00Z** |
| Project `compute_time_seconds` | **8639**; ham sayaç, CU-hours veya kalan kota olarak dönüştürülmedi |
| Project `data_transfer_bytes` | **63.137.825 byte**; ham sayaç, kalan transfer kotası sayılmaz |

**Kapasite metadata doğrulaması PASS; iş yükü/kota yeterliliği kabulü verilmedi.** Güncel plan ve yapılandırılmış limitler görüldü. Planın tüm billing/compute/transfer limitleri, kalan kota, concurrency/performance, branch sayısı ve 29 Ekim iş yükünün yeterliliği bu üç GET ile kanıtlanmış değildir. Bunlar için geçmiş veya genel fiyatlandırma değerleri güncel hesap kotası gibi kullanılmadı. Bu ayrım PROVIDER_REAUTH_PASS kapsamını kimlik ve güncel provider metadata ile sınırlar.

## 494 grantor ve açık M016 koşulları

494 grantor kaydı **yeniden ölçülmedi**. Kaynak zaman damgası **2026-10-23T10:46:07.694Z** olan önceki READ ONLY snapshot; önceki bağımsız inceleme sonucu **494 eşleşme / 0 eksik / 0 beklenmeyen**, `MATCH_REQUIRES_PROVIDER_REVIEW`, `accepted=false`. Sabit alan sıralı karşılaştırma digest'i `23350f83871a1255c064c16b60a5a7ef306f825d6e8c2a6dcf48a9b3da5d3748` korunur. Bu görev yeni SQL, grantor ölçümü veya ACL kabulü değildir.

Eski P0 raporundaki HTTP401, expired OAuth ve ilk ortam aktarımı engeli tarihsel olaylardır. **Mevcut NEON_API_KEY GET yolu için erişim/kimlik engeli kapandı.** Önceki raporlar geriye dönük değiştirilmedi; eski OAuth tabanlı `cloud-preflight.ts` bu görevde yeniden yazılmadı veya çalıştırılmadı.

Aşağıdakiler açık kalır:

- Provider kaynaklı `cloud_admin → neon_superuser` default/grant-option haklarının yetkili kabulü ve provider rol yaşam döngüsü kanıtı.
- Gerçek kaynak için güvenli backup rol/profil; bağımsız şifreleme anahtarı, offsite saklama ve ayrı hedef restore kabulü.
- **`token_roles / ROLE_DELTA_UNRESOLVED`**; tam recovery sertifikası verilmedi.
- İncelenmiş cloud uygulama yolu, bağımsız pre/post/history kabulü ve hedef/checksum bağlı ayrı migration016 kullanıcı onayı.

`applyEnabled=false`, `postFingerprint=null`, eski `pre.grantors=null`, `ACCOUNTING_CLOUD_REVIEW_REQUIRED` ve `STOCK_MANAGED_APPLY_DISABLED` korunur. API erişimi bunları kaldırmaz. Ayrı onaylı gelecekteki sıra016 → bağımsız016 kabulü → ayrıca onaylı017 olarak kalır.

## Test kanıtı ve dosya koruması

Üç gerçek GET HTTP200; çevrimdışı doğrulayıcı HTTP sayısı, project/name, branch bağlantısı, endpoint host/type/bağlantısı, plan alanı, pozitif compute aralığı, branch logical size/limit ve false/null güvenlik kapılarını kontrol etti. Sonuç `PROVIDER_REAUTH_PASS`. Bu kontroller veri veya rol üzerinde işlem yapmaz.

Yerel özel kanıtlar `.data/m016-provider-reauth/provider-current.json` (yalnız seçilmiş metadata), `provider-validation.json`, `preservation.json` ve `preservation-final.json`. İlk anahtarsız kontrol `environment-precheck.json` içinde tarihsel olarak korunur. Credential hiçbirine dahil değildir; `.data` Git teslim kapsamı değildir.

Kod değişmedi; Vitest/TypeScript/lint/build/PG fixture/SQL yeniden çalıştırılmadı. Önceki490 test sonucu yeni koşu gibi sunulmadı. `git diff --check` çalıştırıldı. Bu görevin kaynak/belge kapsamı yalnız **`research/PUSULA_M016_PROVIDER_REAUTH.md` ve `LAST_REPORT.md`**; LAST_REPORT başına yeni sonuç eklenirken eski içerik byte olarak korunur. Önceki M017/M016/P0 kaynakları, raporları, manifest ve001–017 SQL değişmedi:

- 016 SHA-256: `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`.
- 017 SHA-256: `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`.

**29 Ekim etkisi:** Provider erişimi ve sabit development kimliği belirsizliği giderildi. Gerçek backup/restore, provider ACL/rol kabulü ve ayrı migration onayı tamamlanmadan gerçek veriyle kullanım kabulü verilmez. Bu görevde Git stage/commit/push/merge, Neon SQL, migration apply, R2 upload, restore, snapshot veya rol/ACL değişikliği yapılmadı.
