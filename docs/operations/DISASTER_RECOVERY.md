# Felaket kurtarma — çalıştırılmamış operatör prosedürü

18.10.2026. **Restore kanıtı yok; Sprint E kabulü açık.** Web UI üzerinden restore veya backup indirme endpoint'i oluşturulmaz.

1. Ayrı boş hedefi açıkça onaylatın. Development, mevcut sprint test DB, production ve pooled/direct alias'ları reddedilmeli. Yalnız farklı DB adı yeterli değil; proje/branch/endpoint/DB fingerprint'i ve rol/izolasyon kontrolü gerekir. Mevcut uygulama guard'ını genişletmeyin; restore operatörüne ayrı guard gerekir.
2. Ayrı hayalî fixture kaynağı: iki tenant, auth üyelik/özel izin, müşteri, USD fiyat geçmişi, teklif revizyonu, satış/satır/vade, audit, immutable kur/maliyet snapshot. Snapshot-consistent sayım/hash kanıtını alın; gerçek Master fixture olamaz.
3. Ayrı read-only R2 kimliğiyle şifreli nesne/manifest indirin. Güvenilir manifest/ciphertext SHA-256 ve authenticated encryption doğrulaması geçmeden dump'ı restore'a vermeyin; key/SQL/içerik loglanmaz.
4. PostgreSQL18 pg_restore yalnız boş allowlist hedefinde; --clean veya mevcut DB temizleme yok. pg_dump cluster-global rol/parola yedeği değildir. Rol/grant/RLS ve migration geçmişi ayrı denetimli kurulmalı; migration körlemesine tekrar uygulanmaz.
5. Tablo sayımı, FK/unique, migration checksums, Decimal/snapshot hash ve non-owner tenant/RLS/izin testlerini karşılaştırın. Audit/fiyat geçmişi append-only ve eski satışa sonradan child INSERT engeli dahil guard'ları doğrulayın.
6. Hedef uygulamaya bağlanmasın; gerçek mail/outbox/scheduler kapalı olsun. Restore session/verification/davet/reset gibi geçici kanıtların iptali ayrı operatör incelemesiyle yapılmalı; yeni auth secret/cookie origin ve zorunlu yeniden giriş gerekir. Development session'larına dokunmayın; faktör/kurtarma sırlarını raporlamayın.
7. Hata olursa hedef izole ve başarısız kalır; otomatik temizleme/dev fallback yok. Yeniden denemeye yeni boş hedef/onay gerekir.
8. Job ID, ortam etiketleri, migration sürümü, ciphertext hash, sayım/ilişki testleri ve ölçülen süre/RPO/RTO güvenli rapora girer; dump/PII/credential girmez.

Anahtar kurtarma: seçilecek aracın private/symmetric key'i R2 ve GitHub'dan ayrı güvenli offline depoda en az iki kontrollü kopyayla korunmalı. Key ID/rotasyon manifestte olabilir; key bulunamaz. Eski key ilgili arşivler boyunca tutulmalı. Key kaybında arşiv kurtarılamaz; offline kurtarma tatbikatı kabul kapısıdır. Format/araç E2'de netleştirilecek; age mevcut tarihsel öneridir, uygulanmış özellik değildir.
