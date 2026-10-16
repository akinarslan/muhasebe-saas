# localStorage -> Neon geçiş sözleşmesi

**Sprint A planı; henüz exporter/importer veya veri taşıma çalıştırılmadı.** Tarayıcıdaki veriler okunup GitHub'a gönderilmedi. `.env.local` bağlantısı tek başına otomatik import başlatmayacaktır.

## Korunacak kaynaklar

`pusula.demo.v1`: müşteri/satış/demo borçlar/customProducts; `pusula.pricing.v2`: malzeme/varyant/USD fiyat geçmişi/gider/tedarikçi tanımı; `pusula.quotes.v2`: teklif snapshot'ı; `pusula.draft.v1`: geçici aktif taslak. Mevcut `pusula.backup.v020` yedeği ve bütün anahtarlar yerinde kalır. Tema/pusula tercihleri tarayıcıda kalır; gerçek bulut veri kaynağına dönüşmez.

## Onaylı geçiş akışı

1. Tarayıcı içinde Export: sürüm, UTC tarih, kaynak anahtarları ve bütün ham JSON'lar kullanıcıya yerel dosya olarak sunulur. Dosya özel müşteri/finans verisi içerir; Git/issue/log'a konmaz. Server'a otomatik yükleme yok.
2. Parse ve preview: Zod boyut/satır sınırları, eski şema dönüşümü (`repairCustomers`, `migrateDemo`, `migrateDraft`), referans/unique kontrolü, USD/unit/Decimal/tarih doğrulaması. Geçersiz satırlar gerekçeyle karantinaya ayrılır; sıfıra çevrilmez. Migration öncesi/sonrası karşılaştırma hash'i alınır.
3. Demo sınıflaması: mevcut demo namespace/legacyDemo/seed ID'ler güçlü işarettir; yalnız bunlarla gerçeklik kesin belirlenmez. Varsayılan seçim **hiçbiri**; kullanıcı gerçek kayıtları açıkça seçer, referans bağımlılıkları preview'da gösterilir. 32 demo müşteri/84 demo satış/24 demo borç otomatik aktarılmaz. Tarihsel örnek fiyat referansları gerçek alım/satış gibi işlenmez.
4. Authenticated Import: yetkili kullanıcı + tenant sunucuda çözülür; `import.create` ve ilgili modül izinleri, gerekçe/step-up gerekir. Kullanıcının payload tenantId/userId alanları yok sayılmaz, şema gereği reddedilir veya kontrollü source metadata'ya ayrılır; otorite değildir.
5. Idempotency: tenant+source namespace+source ID unique ImportRecord eşlemesi ve import manifest hash. Tekrar aynı batch/satır aynı kayıtları döndürür; eşzamanlı import unique constraint ile engellenir. Aynı source ID farklı içerik içerirse conflict preview gerekir; eski fiyat ve snapshot ezilmez.
6. Transaction: tüm seçili bağımlılıklar doğrulanmadan yazma yok; uygun batch sınırları ve rollback/tekrar devam manifest'i. Yeni UUID eşlemeleri satış-müşteri-varyant ilişkilerini korur. Fiyat geçmişinin actor/source bilgisi legacy metadata olarak korunur; gerçek import aktörü ayrı audit'tedir.
7. Mutabakat: satır sayımları, USD fiyat/birim/önceki-sonraki revision, satış maliyet/gider/kur/tarih snapshot hash'i ve Decimal toplamları eşleşir. Sunucudan tekrar okuyarak doğrulama; başarıdan sonra dahi localStorage silinmez. Eski veriler kullanıcıya salt referans/export olarak kalır; bulut state için fallback yapılmaz.

## Kalıcılık ve taslak

Gerçek müşteri/katalog/teklif/satış/kullanıcı/izin kaynakları PostgreSQL olacak. UI tercihi ve geçici taslak localStorage olabilir; taslak anahtarı authenticated user+tenant ile ayrılır. Eski `pusula.draft.v1` yalnız demo/legacy olarak kalır; başka kullanıcıya veya tenant'a otomatik bağlanmaz. Logout sırasında sunucu verisi tarayıcıda otoritatif cache olarak bırakılmaz. Kaydetme hatasında form korunur ve başarı toast'ı verilmez.

Aktarım, demo borç ve ödeme alanlarını operasyonel cari/kasa modülüne çeviremez; v0.4/v0.6 işlevleri ayrı fazdır. Ödeme planı finansal tahsilat değildir. Decimal hesap motoru aynı kalır; sunucu maliyeti tekrar hesaplar, istemcinin kâr/kur/price snapshot beyanına doğrudan güvenmez.

## Sprint D kabul testleri

Eski/null alanlı export; bozuk JSON/NaN/birim/eksik maliyet uyarıları; mükerrer ve eşzamanlı import; tenant ID manipülasyonu; yetkisiz içe aktarma; demo varsayılan dışlama; immutable satış/teklif kur ve USD snapshot karşılaştırması; başarısız transaction sonrası sıfır kısmi kayıt; orijinal localStorage metninin birebir korunması. **Bu testler henüz uygulanmadı.**
