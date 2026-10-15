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


## REVIZE SURUM KAPISI — ONCE KENDI FIRMAMIZDA CANLI KULLANIM (2026-10-15)
Bu bolum onceki faz aciklamalarindaki zamanlama celiskilerinin yerine gecer. **v0.8 SaaS'a kadar beklenmez**: Pusula **v0.7 ile ZY Reklam ve kendi yazilim faaliyetlerimiz icin gercek, gunluk kullanima alinmis olmalidir**. v0.8 ve sonrasi, halihazirda calisan urunun harici firmalara satisina odaklanir.

### Yeni kesin sira
- v0.2.1: mevcut UI hatalari, musteri drawer cokmesi, malzeme fiyat baglantisi, oncu 0 input sorunu, kur/rulo hesaplama dogrulamasi.
- v0.3: **Kimlik dogrulama ve rol/yetki temeli ile gercek kalici veri altyapisini one cek**. PostgreSQL, sunucu kontrollu CRUD, guvenli oturum, admin/muhasebe/satis/uretim rolleri, denetim logu; finansal hareket modeli. Demo localStorage gercek veri icin kullanilmaz.
- v0.4: tedarikci, stok, alim, malzeme varyantlari/price version, gercek satin alma ve stok hareketleri; yetki testleri.
- v0.5: uretim/is emri, maliyet receteleri, fire ve stok tuketimi; maliyet onay/duzenleme yetkileri.
- v0.6: gunluk satis, teklif, alacak/borc, tahsilat/odeme, kasa/banka, cek/senet, cari ekstre; rapor ve yazdirma/disari aktarma; yetkili onaylari. v0.3 finans temeli uzerine tam is akislari.
- **v0.7 — KENDI FIRMAMIZ ICIN CANLI KULLANIM / GO-LIVE**: test edilmis guvenli tek-isletme kurulum; reklam ve yazilim faaliyetleri icin gerekiyorsa ayri legal entity kayitlari; login/RBAC; uretim maliyeti, stok, cari, satis, tahsilat, finans raporlari; kur/tarih snapshot; sifreli bulut yedek, geri yukleme tatbikati, kullanici egitimi ve veri tasima. Demo verisi ayri; gercek veri kalici ve yedekli. Pilot gercek islemler basariyla tamamlanmali.
- v0.8: mevcut canli urune dis firma self-service tenant onboarding, guclu tenant izolasyonu, paketler/abonelik, deneme, tahsilat ve paket limitleri; ic kullanimi aksatmadan.
- v0.9: baska firmalarla pilot, entegrasyon, olcek/performance/siber guvenlik ve destek.
- v1.0: ucretli ticari SaaS yayini.

### Rol/yetkilendirme (v0.3'ten itibaren, v0.7 oncesi zorunlu)
- **Sistem yoneticisi / isletme sahibi**: kullanici davet etme, rol/izin atama, firma ayarlari, finans raporlari, hassas fiyat/maliyet duzenleme ve denetim.
- **Muhasebe**: cari, tahsilat/odeme, kasa/banka, cek/senet, rapor; kritik iptal ve duzeltmeler icin onay mekanizmasi.
- **Satis**: musteri, teklif, siparis ve yetkili fiyatlandirma; diger kullanicilarin kritik maliyet/fiyat tanimlarini degistiremez.
- **Uretim**: is emirleri, sarf malzeme, stok dusumu, is ilerleme; finansal tahsilat yetkisi yok.
- **Depo/satin alma**: tedarikci, giris, stok hareketi, fiyat oneri/onayi; yetkiye gore sinirli.
- Izinler yalnizca menu gizleme degil, **sunucu API ve veri katmaninda** enforcement; kullanici/member, legal entity ve faaliyet kapsamiyla yetki kontrolu. Yetki degisikligi, hassas fiyat degisikligi, iptal, manuel kur, disari aktarma audit'e yazilir. En az yetki, MFA (ozellikle yonetici), oturum sonlandirma, kullanici pasiflestirme, sifre sifirlama, servis anahtari guvenligi; negatif yetki testleri.

### v0.7 gercek kullanim kabul kontrol listesi
- Yonetici, muhasebe, satis, uretim farkli hesaplarla girip yalnizca yetkili islemleri yapabiliyor.
- Yeni musteri/tedarikci/urun/malzeme/gider guncellemesi uygulamayi cokertmiyor; kalici kaydediliyor.
- USD malzeme ana fiyatlari manual belirlenip saklaniyor; TCMB sadece kurla TL karsilik sunuyor; fiyat/kur gecmisi islemde degismiyor.
- 135 cm + 2 cm yan pay Oracal 137 cm rulo reddedilip 152 cm seciliyor; maliyetler dogru stok varyantindan okunuyor.
- Teklif -> satis/siparis -> uretim -> stok -> alacak -> kismi tahsilat -> cari ekstre -> rapor zinciri gercek veriyle uyumlu.
- Tum para hareketlerinin degisikligi/kismi tahsilat/iptali tutar ve denetim acisindan tutarli; tekrar islemle cift kayit olusmaz.
- Gercek firma verisiyle calisma, rol testleri, kabul testleri, tarayici E2E, yedekten geri donus denemesi, temel guvenlik testi ve operasyon kilavuzu tamam.
- Hukuki e-belge/genel muhasebe zorunluluklari sinirlari belgeli; desteklenmeyen resmi muhasebe fonksiyonlari varmis gibi pazarlanmaz.

### Acik tasarim kararlari
Kendi isletmesinin reklam/yazilim faaliyetleri iki farkli tuzel kisilige aitse vergi/fatura/cari defterleri ayri tutulur. Tenant kavrami hedef mimaride tanimli olabilir, ancak harici tenant self-servis ve faturalama v0.8'e kadar gerekli degildir.


## ZORUNLU BULUT VERI GUVENLIGI KARARI — 2026-10-15
**Bulut veri saklama v0.7'den sonra degil, v0.3 ile baslar.** v0.7'ye kadar gercek isletme verilerinin tamami guvenli bulut ortaminda kalici, erisim kontrollu, sifreli, yedekli ve geri yuklenebilir olmalidir.
- **v0.3**: Yonetilen bulut PostgreSQL (prod/staging ayri), sunucu tarafli kullanici kimligi ve yetkiler, TLS, at-rest sifreleme, otomatik gunluk yedek ve point-in-time recovery (saglayici destekliyorsa), erisim anahtari/secret yonetimi, ayrik yedek hedefi ve ilk geri yukleme testi. localStorage yalnizca gecici kullanici taslaklari icindir; gercek fiyat, musteri, finans, stok orada ana kaynak olarak tutulamaz.
- **v0.4–v0.6**: Alim, stok, satis, musteri, tedarik, cari, tahsilat, maliyet, is emirleri ve kullanici islemleri bulut PostgreSQL'e islenir; migrasyonlar geri donus planli, islemler audit loglu ve testli; otomatik yedek izleme ve geri yukleme tatbikatlari tekrarlanir.
- **v0.7**: Kendi firmamiz icin canli kullanim oncesi veri tasima ve mutabakat; gercek personel yetkileri; RPO/RTO hedefleri; otomatik yedek basari alarmlari; baska hesaba/bolgeye sifreli ikincil yedek; noktasal kurtarma veya esdeger; belgeli/veri kaybi senaryosu testli restore; felaket kurtarma proseduru. Bu kapilar basarilmazsa canli kullanim onayi verilmez.
- Bulut hizmetinde saglayici, barindirma bolgesi, KVKK/yurt disina aktarim, sifreleme anahtarinin kimin kontrolunde oldugu, yedek saklama sureleri, maliyet ve veri disari aktarilabilirligi go-live oncesi karara baglanir.
- 3 yillik yedekleme istegi gunluk yedeklerin tamamini 3 yil saklamak demek degildir: gunluk/kisa sureli teknik kurtarma, aylik/yillik arsiv ve yasal kayit saklama planlari ayridir; gereken ticari kayit saklama sureleri ayrica uygulanir.

## MASTER ADMIN OZEL YETKI MATRISI (2026-10-15)
v0.3'ten itibaren Master Admin her kullanicinin izinlerini tek tek ayarlar; v0.7 canli kullanim oncesi zorunludur. Hazir roller (muhasebe, satis, uretim, depo) yalnizca baslangic sablonudur; kullanici bazli izin ekleme/kaldirma ve kapsam belirleme esastir.
Her modul icin goruntuleme, ekleme, duzenleme, fiyat/maliyet gorme, fiyat degistirme, onaylama, ters kayit, tahsilat/odeme, rapor disari aktarma ve kullanici yonetimi gibi bagimsiz izinler bulunur. Kapsam kullanicinin kendi kaydi, departmani, faaliyet alani, legal entity veya tum sirket olabilir; tutar limiti/onay kosulu tanimlanabilir.
Master Admin kullanici davet eder, pasiflestirir, rol sablonu uygular ve ozellestirir. Diger kullanicilar kendine izin veya Master Admin rolu atayamaz.
Yetki kontrolu yalniz UI gizleme degildir: sunucu API ve veri erisiminde default deny, tenant/legal entity siniri ve ozel izinler uygulanir. Hassas alanlar yetkisiz API yanitina dahil edilmez. Degisiklikler AuditEvent'e yazilir, oturumlar gerektiğinde iptal edilir, kritik degisiklik MFA ister.
v0.7 kabul testleri: yetkisiz API erisimi reddi, izin iptali sonrasi erisim kaybi, USD maliyet ve banka bilgilerinin gizliligi, faaliyet/sirket ayrimi, izinsiz yetki artirma engeli ve master hesap kurtarma yolu.


## YETKILENDIRME UYGULAMA PLANI — KESIN TEKNIK KABUL KRITERLERI
Bu bolum v0.3-v0.7 arasinda Codex'in uygulayacagi zorunlu is paketidir; onceki genel rol aciklamalarini somutlastirir.

**v0.3 temel teslimat:**
1. Yonetilen bulut PostgreSQL uzerinde users, memberships, roles, permissions, role_permissions, user_permission_overrides, audit_events ve sessions semalari; migrasyonlar ve seed.
2. Master Admin kurulum/bootstrap akisi: ilk sahip guvenli ortamda olusturulur; istemciden self-assign edilemez. Aktif tek Master Admin'in kaybolmasini engelleyen kurtarma proseduru.
3. Kullanici daveti, devre disi birakma, oturum iptal etme; MFA ozellikle Master Admin icin. Oturum secure, httpOnly cookie ile yonetilir.
4. Kullanici detayinda izin matrisi: her kaynak icin Gor/Ekle/Duzenle/Onayla/Iptal-TersKayit/DisaAktar, fiyat ve finans icin ozel aksiyonlar. Rol sablonu secilir, kisiye ozel allow/deny override yapilir, izinlerin etkili ozeti gosterilir.
5. Backend merkezi authorize(user, action, resource, scope) politikasi. Istemciden gelen userId, role, tenantId otorite kabul edilmez; default deny. Yetkisiz API istekleri reddedilir, hassas alanlar response'dan cikarilir.
6. Tum izin atama/geri alma, kritik maliyet duzenleme, manuel kur degisikligi ve finansal onaylar append-only audit event'e kaydolur.
7. Negatif guvenlik testleri: kendine yetki verememe; dogrudan API cagrisiyla kisitli islem yapamama; URL degistirerek baska kayda erisememe; revoke sonrasi yetkinin kalkmasi.

**v0.4-v0.6:** Yeni modullerin her endpoint ve server action'i izin kontrolunden gecer; stok duzeltme, fiyat goruntuleme/degistirme, cari hareket, tahsilat, banka, rapor ihraci ayri izinlere ayrilir. Gerektiginde tutar limiti/onay sureci.

**v0.7 canli kullanim kapisi:** Master Admin'in sifirdan personel olusturup yetki verebilmesi; tum personelin gorevlerine gore erisimi; izin degisikliginin oturumda uygulanmasi; yetkili onay ve islem denetimi; Playwright senaryolari ve API negatif testlerinin gectigini kanitlayan rapor. Izin testi basarisizsa canliya cikma.

**v0.8:** Her harici tenant kendi Master Admin'ini yonetir; baska tenantin kaydina/rolune/izinlerine erişemez; platform operatoru ile tenant yoneticisi ayridir.
