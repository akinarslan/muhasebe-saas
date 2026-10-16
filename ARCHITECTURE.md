# PUSULA — HEDEF MIMARI

## v0.2.2 gerçek uygulama sınırı

Kod Next.js modüler frontend prototipi ve TCMB sunucu route'udur. `src/lib/pricing.ts` Decimal hesap motoru, `catalog-seed.ts` fiyatı ezmeyen seed, `runtime.ts` tarayıcı uyumluluğu, `migrate.ts` eski demo/taslak dönüşümü içerir. NumericInput ham metni korur; boş/geçersiz giriş kesin fiyat üretmez. Snapshot/demo repository localStorage'da; `.data/` yalnız kur cache/audit içindir. Bunlar v0.3 PostgreSQL/kimlik/izin/yedek altyapısının yerine geçmez. [Tasarım sistemi](docs/design/DESIGN_SYSTEM.md), [motion](docs/design/MOTION_SYSTEM.md) ve [Master Admin blueprint](docs/design/SCREEN_BLUEPRINTS.md) bu sınırı korur. Pusula yalnız `/login` ve dashboard'da; reduced-motion ve kullanıcı tercihiyle kullanılır.
Surum: Plan v1.0 | 2026-10-15

> Bu belge hedef mimariyi anlatir. Yerel v0.2'nin gercek kod durumu Codex tarafindan incelenip raporlanmalidir.

## Temel strateji

16.10.2026 v0.3 Sprint A: [Neon Cloud kararı](docs/architecture/NEON_CLOUD.md), [authorization sözleşmesi](docs/security/AUTHORIZATION.md), [yedek/restore planı](docs/security/BACKUP_RECOVERY.md) ve [localStorage geçişi](docs/migration/LOCAL_TO_NEON.md) eklendi. Managed Neon Auth MFA yol haritasında olduğu için uygulamanın yönettiği Better Auth/TOTP seçildi. Bunlar tasarımdır; gerçek bağlantı/auth/PostgreSQL kalıcılığı henüz uygulanmadı. Mevcut çalışan demo korunur; [gerçek sprint durumu](research/PUSULA_V030_AUDIT.md) esas alınır.

Baslangicta moduler monolit: Next.js App Router + React + TypeScript + Tailwind CSS + shadcn/ui/Radix + TanStack Table + React Hook Form/Zod + Recharts. Domain hizmetlerini UI'den ayir. Sunucu tasarimini ileride PostgreSQL/Prisma ve guvenli API katmanina gecise uygun tut. Mikroservise erken gecme.

```text
Tarayici UI (Dashboard / Satis / CRM / Maliyet / Stok / Uretim / Finans)
       |
Uygulama/API katmani (auth, tenant context, validation, rate limit)
       |
Domain modulleri
 [Catalog] [CostEngine] [FX] [Sales] [CRM] [AR/AP] [Payments]
 [Inventory] [Production] [Reporting] [Billing/Subscriptions]
       |
Repository/Storage adapter
 demo: localStorage (yalnizca taslak/mock)
 prod: PostgreSQL + Prisma + transaction + RLS/tenant guard
       |
Dış servisler: TCMB (gosterge kur), odeme kurulusu, e-belge, e-ticaret
```

## Sinirlar ve veri modeli

- Tenant: SaaS musterisi olan kurulus/hesap. Tum tenant-scope kayitlarda tenant_id.
- LegalEntity: Bir tenant altindaki ayri tuzel kisilik; vergi, banka, fatura, muhasebe defterleri ayri.
- BusinessUnit/Activity: Reklam veya yazilim. Ayri tuzel kisilik olmak zorunda degil.
- Customer, CustomerSegment, Address/Province/District, Contact, Supplier.
- Material, MaterialVariant, UnitOfMeasure, MaterialPriceVersion, WidthOption, SheetSize, SupplierOffer.
- ProductOrService, ProductRecipe/BOM, RecipeLine, ExpenseType, ExpenseLine.
- Quote, QuoteLine, CostCalculation, CostSnapshot, FXRateSnapshot.
- SalesOrder, Sale, SaleLine, InvoiceReference; ARTransaction, APTransaction, PaymentSchedule, Payment, PaymentAllocation, CheckNote.
- InventoryItem, StockLot/Roll, StockMovement, Remnant, WorkOrder, ProductionStep.
- User, Membership, Role, Permission, AuditEvent.
- SaaSPlan, Subscription, FeatureEntitlement, SubscriptionInvoice, BillingEvent.

## Domain kurallari

**Malzeme fiyatlari:** kullanici USD fiyatini elle girer; aktif USD birim fiyat tek otoritatif veri. Kaynak TRY/EUR yalnizca bir defalik ithal edilip ilgili kur snapshot'i ile USD'ye normallestirilebilir. USD fiyati kur degistikce yeniden yazilmaz. Fiyat gecmisi append-only versiyonlanir. Her tenant/legal entity kendi fiyatini tanimlar.

**Kur:** TCMB USD doviz satis, EUR gerekiyorsa EUR doviz satis, kaynak/yayin gunu/cekilis zamani. Cache, en son basarili kur, eskilik uyari ve yetkili manuel override. Son yayim tarihi gercek zamanli borsa ticareti degildir. Hesaplamada hangi kur kullanildigi kalici snapshot'a yazilir.

**Hesaplama:** Decimal aritmetik; birim tipleri (USD/m2, USD/metretul, USD/adet, USD/plaka) zorunlu ve birbirine karistirilmaz. Eksik fiyat, olcu, birim veya kur varsa sessiz 0 ile fiyat uretilmez.

- gerekliEnCm = baskiEnCm + solPayCm + sagPayCm.
- gerekliBoyCm = baskiBoyCm + ustPayCm + altPayCm.
- uygun = ruloEnCm >= gerekliEnCm (stok/makine/rotasyon ek kurallariyla).
- tuketilenAlanM2 = (ruloEnCm/100) * (gerekliBoyCm/100) * adet [basit tekli plan; gercek is/nesting ayri].
- malzemeUSD = tuketilenAlanM2 * birimUSD_per_m2; metretul ise tuketilenBoyMetre * USD_per_metretul.
- toplamUSD = malzeme satirlari + ilgili gider satirlari.
- marj ile teklifUSD = toplamUSD/(1-marj); markup ile teklifUSD = toplamUSD*(1+markup).
- teklifTRY = teklifUSD * snapshotUSDTRY; KDV ayri.
- brüt alan farki = tuketilen alan - baski alan; bu tutarin tamami otomatik kalici fire degildir, yeniden kullanilabilir remnant ayrilir.
  Oracal kontrolu: 135cm+2+2=139cm ->137 reddedilir/152 uygun; 135x200 ve dort yanda 2cm -> 3.1008m2.
  Vinil kontrolu: 135x200 + tum yanlarda 2 cm ve 140cm rulo -> 2.856m2 *1.20USD =3.4272USD.

**Finans:** cari defter ve hareketler borc/alacak isareti ve nedenleriyle; tahsilat planlari gercek para girisinden ayrilir. Cek/senet teslimi tahsil edildi demek degildir. Odeme kayitlari idempotent; finansal hareketler degistirilmez, ters kayit kullanilir. Satis, AR ve odeme atomik islem sinirlarini tanimla.

## Veri izolasyonu ve guvenlik

- Her istek dogrulanmis tenant context ve rol/yetki kontroluyle yapilir; istemcinin verdigi tenantId'ye guvenilmez.
- PostgreSQL Row Level Security ek savunma katmani; tenant sizintisi negatif testleri.
- Platform admin tenant kaynaklarini dogrudan sorgulayamaz; destek erisimi denetlenir.
- Sifreler/anahtarlar sadece sunucu env/secret manager, .env.local ve .gitignore, key rotasyonu; manuel kur yonetici anahtari son kullanici auth yerine gecmez.
- Kritik kayitlar audit trail, sifreli yedek, farkli depolama, geri yukleme testi, loglarda PII redaksiyonu.
- Saklama ve silme politikalari finansal mevzuat/KVKK ile uyumlu ele alinir; kullanicinin 3 yillik bulut yedek talebi mevzuatin yerini almaz.

## UX / navigasyon

Finance Desk + Commerce Analytics + Client Desk'ten ilham alan ozgun tasarim: premium ama hizli; koyu lacivert sidebar, turkuaz/mavi ana vurgu, durum bazli renkler, belirgin ikonlar, mobil uygunluk.

- Dashboard: faaliyet, tarih, musteri segmenti ve il/ilce filtreleri; satis, kar, AR/AP, tahsilat, gecikmeler.
- Satis: musteri segmenti ve secimi + yeni musteri drawer, satirlar, malzeme/recete ve olcu, maliyet sag paneli, kismi odeme ve vadeler.
- Musteri: arama, il/ilce, segment, detay, cari ekstre ve hizli islemler.
- Stok/uretim: malzeme varyantlari ve rulolar, secim/fire hesaplayici, is emirleri.
- Form numeric UX: edit esnasinda ham metin durumuyla calis; input '0' eklememeli; bos/0/1000/0.5/negatif/paste/Turkce ondalik dogrulanmali. Hesaplama gecersiz veya bos deger icin sessiz sabit sifir gosterme.

## Deployment/operasyon

Development -> staging -> production ayrimi, CI (typecheck/lint/unit/E2E/build), migration/rollback, performans metrikleri, gozlemlenebilirlik ve hata izleme; production'da otomatik gunluk sifreli yedek ve restore tatbikati.
SaaS planlari: Baslangic (CRM+cari+basit fiyat), Profesyonel (stok/uretim/maliyet/rapor), Kurumsal (coklu legal entity, yetkiler, API). Sinirlar once feature-entitlement katmaninda tanimlanir, abonelik/ucretlendirme v0.8+.

## CANLI KULLANIM ONCELIGI VE YETKI MIMARISI (Revizyon 2026-10-15)

**v0.7 Pusula'nin ZY Reklam ve kendi yazilim faaliyetlerinde gercek kullanima girecegi ilk zorunlu teslimat kapisidir.** Altyapi ve guvenlik v0.3'te baslar; v0.8 dis SaaS tenant/abonelik katmanidir. Önceki faz listesi bu kurala gore yorumlanir.

### v0.3'ten itibaren zorunlu mimari

Browser (React) -> Server API/Services -> authn+authz middleware + transactional domain operations -> PostgreSQL. localStorage yalnizca kaydedilmemis taslak ve UI tercihi icindir. Gercek musteriler, tedarikciler, USD fiyatlari, finansal kayitlar ve izinler sunucuda kalici tutulur.

- Users (kimlik), Memberships (company/legal entity scope), Roles, Permissions, RolePermission, optional UserPermissionOverride; default-deny, least privilege.
- Sunucu tarafli session / httpOnly secure cookies, MFA yonetici, davet/kullanici dondurma/cikis/oturum iptali, sifre reset.
- Her endpoint/resource icin izin: customers.read/write, sales.create/approve, costs.read/override, materials.price.edit, fx.manual.override, ar.read/write, ap.read/write, cash.post, inventory.adjust, users.manage, reports.export, audit.read.
- Frontend'de gizli menus sadece UX; gercek koruma sunucu ve veri katmaninda. Tenant/legal entity scope her sorguya tasinir; baska firma verisi gorulmez; RLS ileride SaaS'ta ek savunma katmani.
- Finansal duzeltme silme yerine ters kayit; hassas degisikliklerde yapan/onaylayan farkli olabilir. Yetki ve degisiklikler append-only AuditEvent'e yazilir.
- Doviz/fiyat kurali: user-entered USD authoritative; TCMB USDTRY en son yayinlanan referans gunu/tarihiyle TL goruntuleme; fiyati sessizce guncelleme. Quote, sale, inventory usage icin USD fiyat, birim, miktar, tuketim, gider, marj ve FX snapshot.
- Company/LegalEntity sirket belge ve finans defteri ayrimini saglar; Activity reklam/yazilim raporlama boyutudur. v0.7 tek isletme kurulumu olsa bile iki faaliyet, gerekiyorsa ayri legal entity desteklenir.
- Production readiness: managed Postgres, migration/rollback, en az bir ayri yedek hedefi, sifreleme, restore tatbikati, audit, yetki-negatif testleri, go-live E2E ve operasyon kilavuzu.

### Faz siniri

v0.7: sizin personeliniz gercek satis, stok, tahsilat, uretim ve rapor girer; kisi bazli yetkiler, guvenilir DB, gercek yedekleme ve kurtarma vardir.
v0.8+: dis musteri tenant olusturma, planlar/abonelik, abonelik odeme ve destek; mevcut canli isletme surecinin geriye donuk bozulmamasi zorunludur.

## BULUT VERI KATMANI — v0.3 BASLANGIC ZORUNLULUGU (2026-10-15)

Canli verilerin otoritatif kaynagi yerel dosya veya localStorage degil, yonetilen bulut PostgreSQL'dir. v0.3'te gelistirme/staging/production ayrimi, guvenli sunucu oturumlari, role-based authorization, tls, at-rest encryption, least-privilege DB kullanicilari, secret management, baglanti havuzu ve otomatik yedeklemeyi kur. Kullanici fiyat/musteri/finans/uretim verileri sunucudan dogrulanip transaction'la saklanir. Frontend yalnizca UI cache/taslak barindirir.
Yedekleme: Gunluk otomatik yedek, mumkunse point-in-time recovery, sifreli ayrik ikinci kopya, basari/failure alarmi, periyodik restore testi, versiyonlu sema migrasyonu ve raporlanmis RPO/RTO hedefi. Uygun kurtarma ve guncelleme politikasi olmadan prod veri girisine izin verme.
Saklama: teknik yedek penceresi, 3 yillik is arşivi hedefi ve ticari belgelerin mevzuat kaynakli saklamasi farkli politikalardir. KVKK, ulke disina aktarim kosullari, saglayici ve veri bolgesi go-live oncesi degerlendirilir. Sahte yedek basarisi veya test edilmemis kurtarma iddiasi kullanilmaz.

## MASTER ADMIN TARAFINDAN GRANULER YETKILENDIRME (2026-10-15)

Yetki modeli: Role-Based Access Control sablonlari + user-specific PermissionGrant/PermissionDeny + scope kurallari. Model: User, Membership, Role, Permission, RolePermission, UserPermissionOverride, PermissionScope, AuditEvent.
Izin adlari kaynak/eylem bazinda: customers.view/create/edit, sales.view/create/approve, materials.cost.view/edit, materials.variant.manage, fx.manual_override, ar.view/collect, ap.view/pay, cash.view/post, bank.view/post, production.view/update, inventory.view/adjust, reports.view/export, users.invite/disable, permissions.manage.
Master Admin UI matrisi ile kullaniciya her izni ayri verir veya geri alir; rol secimi sadece hizli sablondur. Explicit deny onceligi ve default deny kurali uygulanir.
Kapsamlar tenantId, legalEntityId, activityId, department ve ownRecords; secili islemler icin limit/onay kosulu. Sunucu verified session'dan kullaniciyi belirler, istemcinin rol veya tenant id beyanina guvenmez.
API/server actions ve hassas domain islemleri permission policy kontrolu yapar; yetkisiz alan API yanitlarindan cikarilir. Her degisiklik audit log'da. Master Admin rolu yalniz kontrollu master akisi ve MFA ile verilir. En az bir kurtarilabilir Master Admin hesabi ve session revocation desteklenir.
v0.3 izin motoru, master izin paneli ve kimlik dogrulama; sonraki moduller izinlere baglanir; v0.7 oncesi negatif API ve browser E2E yetki testleri zorunlu.

## AUTHORIZATION DESIGN CONTRACT — UYGULANACAK ALGORITMA VE VERI MODELI

### Model ve iliskiler

- User(id, identityProviderId, status, mfaState)
- Tenant(id), LegalEntity(id, tenantId), Activity(id, legalEntityId)
- Membership(id, userId, tenantId, status) ve membership kapsaminda RoleAssignment(membershipId, roleId)
- Role(id, tenantId, name, isSystemTemplate)
- Permission(key, description, resource, action)
- RolePermission(roleId, permissionKey, effect=allow)
- UserPermissionOverride(membershipId, permissionKey, effect=allow|deny, scopeType, scopeId, optionalLimit, expiresAt)
- AuditEvent(id, actorUserId, tenantId, legalEntityId, action, targetType, targetId, before, after, reason, timestamp)
- Session(id, userId, expiresAt, revokedAt), gerekli indeks/foreign key ve unique kisitlari.

### Yetki cozme sirasi (deterministik)

1. Dogrulanmis sunucu oturumundan user kimligini al. Aktif membership'i ve kaynak kaydinin server tarafindan teyit edilen tenant/legal entity baglamini belirle. Uyusmuyorsa RED.
2. User ve membership aktif degilse RED.
3. Permission anahtarini hedef eyleme esle. Explicit DENY override varsa RED.
4. Gecerli scope ve limitler icinde explicit ALLOW override varsa ALLOW; aksi halde atanmis rollerin ALLOW izni varsa ALLOW; hicbiri yoksa RED.
5. Yetki olmadan DB mutasyonu yapma; kritik islem icin yeniden dogrulama/onay gerekliligini uygula.
6. Yetkiler UI'de buton/menunun durumunu yonetir ama API policy her istekte bagimsiz kontrol eder. Kaydin gizli alanlari DTO/serializer seviyesinde kaldirilir.
7. Yetki ve master role degisikliklerinde audit kaydi, MFA ve oturum/yetki cache gecersizlestirmesi yap.

Master Admin bir isletme icindeki izinleri yonetebilir; Master Admin unvani baska tenant yetkisi vermez. Master yetkisi siradan override izniyle olusturulamaz, yalniz guvenli bootstrap ve mevcut Master Admin'in yeniden dogrulanmis onay akisi ile atanabilir. Son aktif Master Admin'i kaldirmaya izin verme.

### Yetki katalogu ornekleri

customers.view/create/edit/export; suppliers.view/create/edit; sales.view/create/edit/approve/discount; products.view/create/edit; materials.view; materials.cost.view/edit; materials.variant.manage; expenses.view/edit; fx.manual_override; inventory.view/receive/adjust; production.view/create/update/approve; receivables.view/collect; payables.view/pay; cash.view/post; bank.view/post; checks.view/accept/settle; reports.view/export; users.invite/disable; permissions.manage; audit.view.

### Scope ve finans

Scope: own | activity | legal_entity | tenant; gerekirse department ve tutar tavanlari. Onay surecleri actor/approver ayrimina gore denetlenir. USD maliyet, banka bakiye ve vergi kimlik bilgileri gibi hassas alanlar icin field-level read izinleri uygulanir. Kritik finans hareketleri append-only/ters kayit kurali ile calisir.

### Test matrisinin asgari kapsami

- Satis gorevlisi teklif olusturabilir; USD malzeme fiyatini permission olmadan goremez/degistiremez.
- Muhasebe tahsilat kaydeder ama permissions.manage yoksa kullanici haklarini degistiremez.
- Uretim personeli banka veya alacaklar modulunun API'sine erisemez.
- Izin iptali yeniden login gerektirmeden veya kontrollu session invalidation sonrasinda etkili olur.
- Tenant/legal entity/activity scope asimi, IDOR, sahte userId/role/tenantId parametresi ve browser URL manipülasyonu reddedilir.
- Master Admin MFA olmadan kritik yetki artiramaz; son Master Admin iptal edilemez.
- AuditEvent izin, kur, fiyat ve finans onay degisikliklerini icerir ve normal kullanici tarafindan degistirilemez.

Bu tasarim gercek kullanima gecmeden uygulanir. localStorage yetkiler icin guvenilir kaynak degildir.
