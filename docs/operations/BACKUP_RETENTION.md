# Saklama politikası — uygulanmamış taslak

18.10.2026. Günlük30 gün, haftalık12 hafta, aylık36 ay önerilir. Yıllık arşiv süresi hukuki politikayla ayrıca belirlenecek; üç yıllık teknik hedef ticari belge saklama süresini kısaltmaz.

Tek şifreli nesne birden fazla retention etiketi taşıyabilir. Gün/hafta/ay sınırları UTC tanımlanacak. Upload + geri indirme/hash doğrulaması olmayan nesne başarılı sayılmayacak. Son geçerli kopya, sonraki doğrulanmış kopya ve restore kanıtı olmadan silinmeyecek.

İlk kurulum yalnız dry-run aday listesi. Bu teslimde lifecycle/silme kuralı veya silme kodu yok. Restore testi ve kullanıcının ayrı silme onayı olmadan otomatik deletion açılamaz. Aday kayıtları yalnız ID/zaman/boyut/neden taşır. Manifest ve kurtarılabilir key sürümleri arşiv ömrü boyunca korunmalıdır.

Silme kapalıyken depolama birikir; maliyet izlenmelidir. [Maliyet modeli](../../research/PUSULA_V030_SPRINT_E_AUDIT.md) gerçek tüketim değildir.
