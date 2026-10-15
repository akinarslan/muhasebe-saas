# PUSULA — URUN YOL HARITASI
Surum: Plan v1.0 | Tarih: 2026-10-15 | Durum: Urun hedefleri ve gelistirme plani

## Vizyon
Pusula ilk etapta ZY Reklam ve yazilim faaliyetlerini yoneten, daha sonra reklam ajanslari, dijital baski atolyesi, tabelaci ve benzeri isletmelere abonelikle satilacak, cok kiracili (multi-tenant) SaaS isletme yonetim platformudur.
Moduller: CRM, satis/teklif, USD tabanli malzeme ve is maliyeti, rulo/plaka optimizasyonu, stok, tedarik, uretim is emirleri, cari hesap, alacak/borc, tahsilat/odeme, nakit akisi ve raporlar. Ticari e-belge/genel muhasebe entegrasyonlari ayri fazdir.

## Degismeyen urun ilkeleri
- Oncelik sirasi: veri dogrulugu > finansal tutarlilik > kullanilabilirlik > gorsellik.
- Malzemenin ana (otoritatif) alis birim maliyeti **kullanicinin girdigi USD fiyatidir**; kullanici degistirmedikce kur degisimi USD fiyati degistirmez.
- TCMB'nin son yayinlanan USD doviz satis kuru ile TL karsilik hesaplanir; TCMB anlik piyasa veri servisi degildir. Kur kaynagi/tarihi gorunur, eski kur uyarisiz kullanilmaz; gecmis islemlerde kur snapshot'i korunur.
- Kaynak TL/EUR fiyatlari varsa yalnizca bilincli ilk iceri aktarimda secilen/tarihli kurla USD'ye normalize edilir; sonra USD ana maliyet kalir. Tedarikci fiyati otomatik olarak guncelmis gibi sayilmaz.
- Malzeme, malzeme varyanti, stok kalemi, satilabilir urun/hizmet ve satis fiyat listesi ayri kavramlardir.
- Musteri segmenti (resmi kurum, reklamci, magaza/isyeri) ve faaliyet (reklam/yazilim) bagimsiz boyutlardir. Il/ilce filtreleri bulunur.
- Teklif/satis fiyatina malzeme tuketimi + fire politikasi + isçilik/murekkep/elektrik/makine/kesim/laminasyon/montaj/nakliye gibi ozel giderler + marj/markup etki eder; KDV ayridir.
- Gecmis satis maliyeti ve kur degisikliklerle geriye donuk sessizce degistirilmez.
- Gercek finansal islem localStorage'da tutulmaz; prototipte localStorage yalnizca demo/taslak icindir.
- Her tenant kendi musteri, fiyat, satis, banka ve kullanici verilerine yalnizca yetkileri olcusunde ulasir.
- Ticari defter/belgeler icin ilgili mevzuattaki saklama suresi ve KVKK yukumlulukleri incelenir; 3 yillik yedek hedefi yasal saklamayi kisaltmaz.

## Gerceklesen (kullanici/Codex raporuna gore; bagimsiz kod dogrulamasi bekliyor)
- v0.1: dashboard, satis, musteri listesi, musteri drawer, localStorage taslaklar. Build/lint/12 test gectigi bildirildi.
- v0.2: USD malzeme/varyant maliyetleri, fiyat gecmisi, ozel giderler, rulo tuketimi, marj/markup, manuel fiyat, TCMB sunucu servis ve fallback, snapshot, yeni UI. Build/lint/46 test gectigi bildirildi.
- Bilinen ciddi sorunlar: yeni musteri butonu uygulamayi cokertiyor; malzeme fiyatlari hesaplayiciya otomatik dusmuyor veya seed eksik; sayisal inputlarda 1000 yazarken baslangictaki 0 kalabiliyor; gercek tarayici E2E kontrolu henuz yapilmadi.

## Fazlar ve cikis kriterleri
### v0.2.1 — Kritik stabilizasyon [SIMDI]
- Yeni musteri drawer'inin cokme nedenini reprodükse et, gercek kok nedeni gider, mevcut satis taslagini ve secilen urunu koru; eklenen musteri otomatik secilsin.
- Malzeme katalogu ile maliyet hesaplayicisini tek kaynaga bagla; USD/m2 ve diger birimler gorunsun; eksik fiyat varsa 0 kabul etme ve kesin fiyat uretme.
- Idempotent seed/migrasyon: kullanicinin fiyatini ezmeden eksik baslangic malzemelerini ekle, cift kayit olusturma. Eski ZY Reklam TL listesi eski satis referansidir, aktif fiyat degildir.
- Sayisal form alanlarinda bos deger/tus girisi sorununu coz: giris aninda string-state, kaydet/blur aninda dogrulama, sayisal alanlara gereksiz '0' prepend etme. 0, 1000, 0.5, negatif, bos, silme, yapistirma ve Turkce ayiraclarini test et.
- Rulo ornekleri: Oracal 135 + 2+2 cm -> 137 reddedilir, 152 uygundur; 135x200 her kenar 2 cm icin 3.1008 m2 tuketim. Vinil 140 cm rulo icin 2.856 m2 ve 1.20 USD/m2 ile 3.4272 USD.
- Playwright ile drawer ac/kaydet, malzeme->maliyet, taslak koruma, input girisi testleri. Build/lint/unit/E2E raporu ve LAST_REPORT.md.
- Tamamlanma kosulu: tarayici akislari calisiyor, hesap tutarli, mevcut 46 test gerilemiyor.

### v0.3 — Operasyonel finans
- Satis/teklif durum modeli; musteri cari hesap hareketleri; alacak, borc, vade, kismi tahsilat, odeme plani.
- Nakit, EFT/havale, kredi karti, mail order, cek, senet; cek/senet teslimi tahsilat degildir.
- Kasa/banka/POS ve odeme hareketleri; duzeltme/ters kayit; musteri cari ekstresi.
- Demo otesine gecmeden once guvenilir sunucu verisi ve yetki altyapisini hazirla.

### v0.4 — Stok ve tedarik
- Tedarikci kartlari, alimlar, stok, depo/raf, parti/lot, rulo/levha olculeri, alis maliyet gecmisi.
- Satis/uretim sonrasi stok dusumu, yeniden kullanilabilir parca kaydi, stok uyarilari.
- Urun-malzeme recetesi (BOM), varyant/birim donusumleri, tedarikci fiyat gecerliligi.

### v0.5 — Uretim ve optimizasyon
- Is emri: teklif -> siparis -> tasarim onayi -> baski/kesim -> kalite -> teslimat -> fatura/tahsilat.
- Rulo/plaka secimi: teknik uygunluk, yon/rotasyon, makine kenar payi, birim maliyet, stok ve parca optimizasyonu.
- Tekrar kullanilabilir kalan malzeme ile gercek fireyi ayir; coklu is nesting sonraki optimizasyon.
- Baskes, laminasyon, lazer, lightbox, tabela, kompozit ve pleksi icin ayri receteler.

### v0.6 — Satis ve yonetim olgunlasmasi
- Teklif PDF, fiyat listeleri, musteri bazli fiyat, onay akisi, revizyon gecmisi.
- Il/ilce/segment/faaliyet bazli satis ve karlilik, stok, nakit akis, tahsilat tahmini.
- Rapor disari aktarimi, gelismis arama, rol bazli ekranlar.

### v0.7 — Bulut, finans guvenilirligi ve uyum
- PostgreSQL + Prisma, migrasyon, sunucu otoritesi, kimlik dogrulama/MFA, yetki ve denetim izi.
- Para hesaplarinda decimal, transaksiyonlar, tekillik ve idempotency, tenant scoping.
- Sifreli yedek + geri yukleme tatbikati, saklama politikasi, KVKK, hukuki e-belge/geneI muhasebe sinirlari.

### v0.8 — SaaS ticarilestirme
- Tenant kaydi/onboarding, planlar (Baslangic/Profesyonel/Kurumsal), abonelik dongusu, faturalama/odeme kurulusu entegrasyonu.
- Paket yetenek/limitleri, deneme, surekli odeme, iptal, gecikme ve veri tasima politikalari.
- Platform yoneticisi ve tenant yoneticisi yetkilerini kesin olarak ayir.

### v0.9 — Pilot ve entegrasyonlar
- Secilmis reklam firmalariyla pilot; destek, kullanim analitigi, guvenlik/performans ve yedek kurtarma testleri.
- E-fatura/e-arsiv, banka/POS ve e-ticaret entegrasyonlari gerekiyorsa belgeli API'lerle; gercek dis servisler ayrica onaylanir.

### v1.0 — Ticari yayin
- Ucretli SaaS, guvenli onboarding, veri ayrimi, izleme, destek, yasal metinler, is surekliligi ve SLA hedefleri.
- Gercek islem once guvenlik, denetim ve veri kurtarma kabul kapilarindan gecer.

## Is akislari
1. Segment + il/ilce filtrele -> musteri ara / drawer'dan ekle -> otomatik sec.
2. Faaliyet sec (reklam/yazilim) -> urun/hizmet sec -> urun recetesi/malzeme ve olcu -> uygun rulo/plaka -> USD malzeme tuketim maliyeti -> ozel giderler -> hedef marj veya markup -> TCMB TL karsiligi -> KDV -> teklif/satis.
3. Satis -> odeme plani -> alacak/cari kayit -> kismi veya tam tahsilat -> nakit/banka hareketi -> rapor.
4. Tedarikci alimi -> stok ve alis maliyet kaydi -> uretimde malzeme kullanimi -> stok dusumu ve fire/kalinti.
5. Tenant onboarding -> sirket kurulumu -> kullanici yetkileri -> paket/abonelik -> izleme/raporlama.

## Sürüm disiplini
Her faz icin issue/PR, kabul kriteri, otomatik test, gerektiginde gercek browser testi, migrasyon ve rollback notu, LAST_REPORT.md. Onemsiz kozmetik talepler temel finans/guvenlik hatalarinin onune gecmez.
