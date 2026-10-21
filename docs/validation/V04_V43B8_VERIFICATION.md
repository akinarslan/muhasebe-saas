# PUSULA V4.3b.8 ? Do?rulama

21.10.2026 ? **NEON_COMPATIBILITY_BLOCKED**. [Ayr?nt?l? rapor](../../research/PUSULA_V04_V43B8_NEON_COMPATIBILITY.md).

| Kontrol | Durum | Kan?t |
| --- | --- | --- |
| Git dal?/HEAD | PASS | feat/pusula-v030-neon-cloud / f56caed5eadb64e76304777f83477f1677c19d19 |
| 001?015 / 016 dosya b?t?nl??? | PASS | 15/15 checksum; 016 80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18 |
| G?ncel provider GET | NEEDS_EVIDENCE | ?lk TLS/fetch yan?t? yok; sistem CA ile GET 401, mutation yok |
| SQL hedef s?n?r? | PASS | Yaln?z development host / pusula_development / neondb_owner; recovery/test/production ba?lant?s? yok |
| TLS / read only / kapan?? | PASS | CA+hostname, encrypted/authorized; default RO on, RR READ ONLY, ROLLBACK, connectionClosed true |
| SQL g?zlem zaman? | PASS | 2026-10-21T19:49:17.398Z; T?rkiye 22:49:17 |
| PG / tablo / FORCE RLS | PASS | 18.6 / 40 / 26 |
| ?ema / migration ge?mi?i | PASS | Sekiz hash e?it, 15 ba?ar?, unresolved 0; bilinen resolved 008 korundu |
| 016 / executor / yeni nesne ?ak??mas? | PASS | Pending / yok / yok |
| Source V4.3b.7 ile kapsanan hash/digest | PASS | ?ema, migration history, business, rol ve full pusula table ACL e?it |
| Actor kimli?i ve mevcut grant yetkileri | PASS | neondb_owner; CREATEROLE/CREATE ve ?l??len grant option haklar? var |
| Actor ger?ek superuser m?? | PASS | false; BYPASSRLS ve CREATEROLE true, managed profil |
| Yeni executor'a SET / ownership devri | BLOCKED | createrole_self_grant bo?; SQL'de SET membership yolu yok; DDL denenmedi |
| Devir sonras? fonksiyon GRANT/REVOKE/trigger | NEEDS_EVIDENCE | Ayn? managed sahiplik zincirine ba?l? |
| Runtime/auth yetki s?n?r? | PASS | Ayr? non-super/non-bypass roller, public CREATE yok; executor ?yeli?i verilmez |
| Yedi yeni tablo RLS/FK/immutable | PASS_WITH_LIMITATIONS | Statik SQL incelemesi; ger?ek Neon postflight de?il |
| SECURITY DEFINER / PUBLIC EXECUTE | PASS_WITH_LIMITATIONS | Executor-owned d?rt fonksiyon; PUBLIC revoke ayn? transaction; pg_temp a??k sonda de?il, public nesneler qualified |
| Maliyet redaksiyonu | PASS_WITH_LIMITATIONS | API'de receipts.costView + materials.costView; runtime SQL s?tun gizlili?i de?ildir |
| MASTER + dokuz izin / explicit DENY | PASS_WITH_LIMITATIONS | ?ak??ma yok, kaynak mant???nda DENY ?ncelikli; kullan?c? assignment i?erikleri okunmad? |
| Transaction geri al?nabilirli?i | PASS_WITH_LIMITATIONS | SQL BEGIN/COMMIT, 3/30/60s; Prisma history ve commit sonras? rollback garantisi yok |
| Mevcut oturumlar / locks | PASS_WITH_LIMITATIONS | G?zlemde bo?; apply ?ncesi bak?m ve yeniden kontrol gerekli |
| Yerel runner'? buluta kullanmak | BLOCKED | Local-only guard, farkl? ACL pin, resolved 008 history uyumsuzlu?u |
| Recovery veri/?ema kap?s? | PASS_WITH_LIMITATIONS | Tarihsel capture ve kapsanan digest; yeni SQL/restore yok |
| token_roles | NEEDS_EVIDENCE | ROLE_DELTA_UNRESOLVED korunur; source apply i?in do?rudan isim/SQL ba??ml?l??? yok |
| R2 / backup allowlist | BLOCKED | Ba??ms?z operasyonel backup yok; 35/21, yeni 47/33 restore kabul? yok |
| Migration/rol/ACL/provider de?i?ikli?i | PASS | Yap?lmad? |
| Test/build / Git commit-push-merge | PASS | Yap?lmad? |

A: **BLOCKED**. B: **PASS_WITH_LIMITATIONS**, yaln?z kapsanan pre-016 veri/?ema kan?t?; tam restore/rol b?t?nl??? kap?s? de?il. C: **PASS_WITH_LIMITATIONS**, yaln?z engelleri ??zmek i?in ayr? cloud runner haz?rl???na ge?ilebilir. Uygulama onay? verilmedi.

Kan?t: `.data/recovery-v43b8/development.json`, `summary.json`, `provider.json`, `preservation-before.json`, `preservation-after.json`. Gizli env/credential ??kt?lanmad?; .data teslim d???d?r. ?lk provider ba?lant? ve HTTP 401 ba?ar?s?zl?klar? raporda a??k tutuldu. ?nceki V4.3b.5?7 rapor ve kan?tlar? korundu.
