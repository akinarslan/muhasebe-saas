# localStorage → Neon — Sprint D geçişi

17.10.2026. Çalışan aktarım API'si `/api/cloud/workspace/imports/preview` ve `/confirm` altındadır. Gerçek kullanıcı verisi bu geliştirme sırasında aktarılmadı. Otomatik import veya localStorage temizleme yoktur.

## Kullanım

1. `/app` içinde şirket/faaliyet seçin; **Veri aktarımı** ekranına girin. Şirket geneli müşteri faaliyetsiz/paylaşılan kayıttır; bir faaliyetin kaydı başka faaliyete zorla bağlanmaz.
2. **Yerel kaynak yedeğini indir** yalnız açık tıklamayla `pusula.demo.v1`, `pusula.pricing.v2`, `pusula.quotes.v2`, `pusula.draft.v1`, `pusula.backup.v020` ham metinlerini yerel referans dosyasına indirir. Bu dosya özel veri içerir; Git/issue'ya eklemeyin. Ham referans yedeği doğrudan normalize import dosyası değildir.
3. **Bu tarayıcıdaki kayıtları önizle** müşteri, malzeme ve customProducts alanlarını normalize eder; dosya seçimi normalize JSON'u kabul eder. Önizleme kaynak ID/tür/durum, bulunan/hazır/demo/geçersiz/önceden aktarılmış sayıları ve finansal toplamları gösterir. Kaynak veriler silinmez.
4. Demo c1… müşteri, p1… ürün, mat-folyo/seed-* malzeme, legacyDemo veya legacy-demo kur işaretli finansal kayıtlar varsayılan olarak hariçtir. Kullanıcının değiştirdiği seed kimliği de gerçek kayıt varsayılmaz; yerel kaynak yedeğinde incelenir. Eski ZY satış referansı aktif alış fiyatına dönüşmez.
5. Geçersiz alan, kaynak ID çakışması, bozuk USD fiyat zinciri, eksik referans veya doğrulanamayan finansal geçmiş varsa onay engellenir. Önizleme **30 dakika** geçerlidir. Açık onay + güncel parola/TOTP step-up gerekir. Kimlik, tenant ve aktör gövdeden alınmaz.
6. Başarılı onay hedef kayıtları + ImportRecord eşlemelerini + mutabakat + audit'i tek transaction'da yazar. Aynı batch tekrar onaylanınca önceki mutabakat döner; farklı dosyadaki aynı kaynak ID yeniden oluşturulmaz. Aynı kaynak ID değişik içerikle gelirse conflict önizlemesi oluşur. Hata rollback yapar; başarı toast'ı verilmez.

## Normalize dosya sözleşmesi

Üst seviye `{ records: [...], financialRecords?: 0 }`. Şirket/faaliyet UI seçiminden sunulur. Her kayıt `{sourceId, kind, demo?:false, data}`; kind `customer`, `material`, `product`, `sale`, `quote` olabilir. Boyut controller'da 64 KB, kayıt sayısı en fazla200'dür; maliyet kalemleri ve varyantlar ayrıca sınırlandırılır. Büyük dosyaları bağımlılıkları koruyan küçük batch'lere ayırın; timeout tamamlanmış işlem sayılmaz. Aynı source ID namespace'ini farklı eski veri setleri için tekrar kullanmayın.

- **customer:** ad, segment, il/ilçe, telefon/e-posta, vergi, adres/iletişim/notlar/vade/aktiflik. Bozuk/null alanlar preview'da reddedilir; sessizce 0 veya örnek kişi yapılmaz. Yeni UUID, ImportRecord kaynak ID eşlemesiyle tutulur.
- **material:** bulut materialCreate alanları; birim `square_meter|linear_meter|piece|sheet`, rulo/ölçü/varyant, USD fiyatı string veya null. Varyant `history` alanı isteğe bağlıdır: `{id?,at,previous,next,userId,userName}`. Tarihler sıralı ve geçmişte, zincir tutarlı, son next mevcut USD maliyetine eşit olmalıdır. Eski olaylar immutable MaterialPriceHistory'ye orijinal tarih ve `legacy:` aktör etiketiyle yazılır; son ithal durum gerçek import aktörüyle ayrı kaydolur. Orijinal kaynak ID ve tam metadata önizleme manifestinde korunur. Bulutta yeni fiyat değişiklikleri gerçek session aktörünü kullanır.
- **product:** ad, kategori, birim, `service|manufacture|resale`, aktiflik. Eski sabit satış/alış fiyatı ürün fiyatı olarak seed edilmez.
- **sale/quote:** `customerSourceId`, başlık, orijinal tarih/vade, para birimi, `rate {value,source:tcmb|manual,publishedAt,fetchedAt,reason?}`, kalemler ve `expected {costUsd,netUsd,netTry,vatTry,totalTry}` gerekir. Kalem `productSourceId`, ölçü/adet/iskonto/KDV, costing girdisi ve **orijinal tarihsel catalog** içerir. Sunucu mevcut katalogla yeniden fiyatlamak yerine bu tarihsel katalog ve kurdan Decimal hesaplar; beklenen tüm tutarları birebir karşılaştırır. Referans customer/product aynı batch'te hazır veya önceden aktarılmış olmalıdır. Örnek format doğrulaması `scripts/auth/verify-d.ts` içindeki sentetik historical fixture'dadır.

Tarihsel katalogdaki malzeme/varyant/expense ID'leri UUID olmalıdır; eski yerel ID'lerin kaynak eşlemesi hazırlanırken tutarlı UUID'lerle normalize edilmesi gerekir. Eski localStorage finansal belgeleri otomatik olarak şirket/müşteri/ürüne bağlanmaz: müşteri içermeyen maliyet teklifleri, demo ürün referansları ve eski şemalar **inceleme gerektiren finansal kayıt** olarak sayılır. İlişkileri belirlenmiş normalize dosya hazırlanıp tekrar önizlenmeden bu belgeler taşınamaz. Mevcut UI bunun için otomatik eşleme sihirbazı sunmaz; hatalı/eksik arşivi başarılı aktarıldı saymaz.

Gider türleri gerçek bulut Giderler ekranında eklenir; eski varsayılan gider şablonları ve tedarikçi tanımları otomatik operasyonel kayda dönüşmez. Eski gerçek ödeme/kasa/demo borç alanları import edilmez. Ödeme planları yalnız TRY vade planıdır; tahsilat/cari hareket değildir. Tema, pusula tercihi ve eski satış taslağı tarayıcıda kalır. Bulut taslağı açık sayfa belleğindedir; yenilemede kalıcı taslak iddiası yoktur.

## Mutabakat ve sınırlar

Sonuç customer/material/product/sale/quote sayıları, atlanan kaynak sayısı ve ayrı satış/teklif TRY toplamlarını döndürür. Tarihsel maliyet, birim, gerçek tüketim, gider ve kur snapshot'ı belgenin içinde saklanır; güncel fiyat/kur bunları değiştirmez. Yetkisiz kullanıcı USD veya nested cost/profit snapshot'ını alamaz. Import edilmiş maliyet metadata'sı yalnız costView yetkisiyle önizlenir.

Sentetik testler demo dışlama, açık onay, yeniden onay, değişik kaynak içerik conflict'i, USD fiyat geçmişi, tarihsel satış/teklif mutabakatı ve bozuk toplam reddini doğrular. Gerçek işletme verisi taşınmadan önce kullanıcı kendi önizlemesini incelemelidir. Bu araç bağımsız yedek değildir; Sprint E şifreli bağımsız yedek/scheduler/restore testi henüz yoktur.

Satış satırları ve planları sonradan aynı satışa eklenemez; ana satışın yaratıldığı transaction'da yazılır. Yeni belge/revizyon oluşturmak eski snapshot'ı değiştirmez. Restore işlemlerinde child sealing guard'ının post-data oluşturulması veya tüm veri yükünün uygun atomik transaction'ı Sprint E kabulünde ayrıca sınanmalıdır.
