# Sprint C doğrulama kaydı

## C1 — 16.10.2026

Better Auth 1.7.10, ayrı auth SQL rolü, development/test migration ve gerçek cookie oturumları kuruldu. Public signup ve server-side provisioning dışındaki hesap oluşturma reddedilir. Auth rolü işletme tablolarını okuyamaz; runtime grants değişmedi.

Kapı: gerçek Neon auth 7/7; mevcut DB 11/11; Vitest 71/71; TypeScript ve lint başarılı. C1 yalnız temel oturumdur; MFA/yetki yönetimi sonraki kapılardadır. Production kullanılmadı.
