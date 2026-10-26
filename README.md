# Quiet Timeline

X/Twitter web anasayfasında reklamları kaldıran ve **takip etmediğiniz ücretli mavi tikli** hesapların gönderilerinin üstüne **Gizle / Sessize al / Filtrelemeyi bırak** düğmeleri ekleyen tarayıcı eklentisi. Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Arc ve Firefox'ta çalışır.

## İndir ve kur

### 1. Tarayıcınıza uygun dosyayı indirin

| Tarayıcı | İndirme bağlantısı |
|---|---|
| Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Arc | **[⬇ quiet-timeline-chrome.zip](https://github.com/Yasin-Yilmazz/quiet-timeline/releases/latest/download/quiet-timeline-chrome.zip)** |
| Firefox (128 veya üzeri) | **[⬇ quiet-timeline-firefox.zip](https://github.com/Yasin-Yilmazz/quiet-timeline/releases/latest/download/quiet-timeline-firefox.zip)** |

Tüm sürümler [Releases](https://github.com/Yasin-Yilmazz/quiet-timeline/releases) sayfasındadır.

### 2a. Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Arc

1. İndirdiğiniz zip dosyasını **klasöre çıkarın**. Mac'te dosyaya çift tıklayın; Windows'ta sağ tıklayıp **Tümünü ayıkla** deyin.
2. Tarayıcınızın eklenti sayfasını açın:
   `chrome://extensions` · `edge://extensions` · `brave://extensions` · `opera://extensions` · `vivaldi://extensions` · `arc://extensions`
3. **Geliştirici modu**nu açın. Çoğu tarayıcıda sağ üsttedir; Edge'de sol menüdedir.
4. **Paketlenmemiş öğe yükle** düğmesine basın ve 1. adımda çıkardığınız klasörü seçin. Bu, içinde `manifest.json` olan klasördür.
5. x.com sekmesini yenileyin.

> Klasörü silmeyin veya taşımayın. Tarayıcı eklentiyi her açılışta bu klasörden yükler.

### 2b. Firefox

1. `about:debugging#/runtime/this-firefox` adresini açın.
2. **Geçici Eklenti Yükle…** düğmesine basın ve indirdiğiniz `quiet-timeline-firefox.zip` dosyasını seçin. Zip'i çıkarmanıza gerek yoktur.
3. x.com sekmesini yenileyin.

> ⚠️ Bu yolla yüklenen eklenti **Firefox kapanınca kaldırılır**. Her açılışta tekrar yüklemeniz gerekir. Eklenti Firefox Add-ons mağazasında yayımlanınca kalıcı kurulum mümkün olacak.

### Güncelleme

Yeni sürümü indirip eski klasörün yerine çıkarın. Eklenti sayfasında **↻ (yenile)** simgesine basın, sonra x.com sekmesini yenileyin.

---

## 1. Ne yapar, ne yapmaz

| Durum | Sonuç |
|---|---|
| Reklam / sponsorlu girdi (`entryId` `promoted-` ile başlar ya da `promotedMetadata` var) | **Tamamen kaldırılır.** Geride boşluk kalmaz. Yazarın kim olduğu önemli değildir. |
| Yazar `is_blue_verified === true` **ve** `verified_type` yok **ve** onu takip etmiyorsunuz **ve** yazar siz değilsiniz | **Açık gelir, üstüne düğme şeridi eklenir** (aşağıya bakın) |

### Düğme şeridi

Takip etmediğiniz mavi tikli bir hesabın gönderisi normal şekilde açık gelir; üstünde tek satırlık bir şerit görünür:

```
Takip etmediğin mavi tikli hesap · Ad Soyad @kullanici   [Gizle] [Sessize al] [Filtrelemeyi bırak]
```

- **Gizle:** Gönderiyi kapatır. Yerinde **[Göster] [Sessize al] [Filtrelemeyi bırak]** düğmeli bir kutu kalır. **Göster** ya da kutuya tıklamak gönderiyi tekrar açar. Gizlediğiniz gönderi sayfa yenilenene kadar kapalı kalır.
- **Sessize al:** Hesabı X hesabınızda sessize alır; X'te "Sessize al" demekle aynıdır. O hesabın gönderileri anında kaybolur ve bir daha anasayfanıza gelmez. Sessize alma X'te kayıtlı olduğu için **telefondaki X uygulamasında da geçerlidir**. Geri almak için X'te *Ayarlar → Gizlilik ve güvenlik → Sessize al ve engelle → Sessize alınan hesaplar* yolunu izleyin.
- **Filtrelemeyi bırak:** O hesabın gönderilerinde şerit bir daha çıkmaz. Liste eklentinin kendi deposunda (`chrome.storage.local`) saklanır. x.com'dan çıkış yapmak, hesap değiştirmek ya da site verilerini temizlemek listeyi silmez. Liste x.com, twitter.com ve tüm açık sekmeler arasında ortaktır. Yalnızca eklentiyi kaldırırsanız silinir.

**Dokunmaz:**

- Altın tik (Business) ve gri tik (Government) hesaplar
- Takip ettiğiniz mavi tikliler ve tiksiz hesaplar
- Kendi gönderileriniz
- **Retweet:** Takip ettiğiniz biri mavi tikliyi RT'lerse görünür kalır. Karar her zaman RT'yi yapan kişiye göre verilir.
- **Alıntı:** Takip ettiğiniz biri mavi tikliyi alıntılarsa hem gönderi hem alıntı kutusu görünür kalır.
- **Emin olunamayan durumlar (fail-open):** Takip bilgisi ya da tik alanı eksikse, X yanıtın biçimini değiştirdiyse veya kendi kullanıcı kimliğiniz tespit edilemezse gönderi **gösterilir**. Kimliğiniz bulunamazsa yalnızca reklamlar kaldırılır.

**Konuşma modülleri** (anasayfadaki yanıt zincirleri): Her öğe ayrı değerlendirilir; kurala uyan yanıtların üstüne şerit eklenir. Kaldırılan öğeler (reklamlar ve sessize aldığınız hesaplar) için: zincirin ilk öğesi kaldırılırsa ya da zincirde öğe kalmazsa modülün tamamı kaldırılır.

**Kapsam:** Yalnızca anasayfa, yani "Sana özel" ve "Takip edilenler" sekmeleri (`HomeTimeline`, `HomeLatestTimeline`). Tweet detayı, profil, arama, bildirimler ve diğer sayfalara dokunulmaz.

**Çalışmadığı yerler:** X'in mobil (iOS/Android) uygulamaları. Eklenti yalnızca masaüstü tarayıcıdaki `x.com` ve `twitter.com` web sürümünde çalışır.

**Gizlilik:** Tek izin `storage`'dır ve yalnızca "Filtrelemeyi bırak" listesini tutmak için kullanılır. Kurulumda uyarı göstermez. Bunun dışında yalnızca `x.com` ve `twitter.com` eşleşmeleri vardır. Veri toplama ve analitik yoktur. Eklentinin kendi gönderdiği tek istek, **siz "Sessize al" düğmesine bastığınızda** x.com'a giden sessize alma isteğidir. Başka hiçbir sunucuya istek gönderilmez.

---

## 2. Tarayıcı uyumluluğu

Eklentinin iki sürümü vardır: **Chromium sürümü** (`quiet-timeline-chrome.zip`) ve **Firefox sürümü** (`quiet-timeline-firefox.zip`). İki sürüm de içerik betiğini sayfanın kendi ortamında (`world: "MAIN"`) çalıştırır. Bu yüzden tarayıcının bu özelliği desteklemesi gerekir: Chromium 111+ veya Firefox 128+.

| Tarayıcı | Çalışır mı? | İndirilecek dosya | Mağaza (yayımlanınca) |
|---|---|---|---|
| Google Chrome 111+ | ✅ Evet | chrome.zip | Chrome Web Store |
| Microsoft Edge 111+ | ✅ Evet | chrome.zip | Edge Add-ons (aynı zip) veya Chrome Web Store ("Diğer mağazalardan uzantılara izin ver") |
| Brave | ✅ Evet | chrome.zip | Chrome Web Store |
| Opera | ✅ Evet | chrome.zip | Opera Add-ons (aynı zip) veya Chrome Web Store ("Diğer mağazalardan uzantılara izin ver") |
| Opera GX | ✅ Evet | chrome.zip | Opera ile aynı |
| Vivaldi | ✅ Evet | chrome.zip | Chrome Web Store |
| Arc | ✅ Evet | chrome.zip | Chrome Web Store |
| Diğer güncel Chromium tabanlılar (Yandex vb.) | ✅ Büyük olasılıkla | chrome.zip | Chrome Web Store |
| Mozilla Firefox 128+ (ESR 128+ dahil) | ✅ Evet | firefox.zip | Firefox Add-ons (AMO) |
| Firefox tabanlılar (Zen, LibreWolf, Waterfox, Floorp) | ✅ Büyük olasılıkla | firefox.zip | Firefox Add-ons (AMO) |
| Safari (macOS / iOS) | ❌ Hayır | — | Safari için ayrı bir Xcode paketi gerekir; şu an yok |
| Mobil tarayıcılar (Chrome Android, iOS tarayıcıları) | ❌ Hayır | — | Bu tarayıcılar eklenti desteklemez |
| Firefox Android | ⚠️ Denenmedi | firefox.zip | Resmî olarak desteklenmiyor |
| X'in iOS / Android uygulamaları | ❌ Hayır | — | Eklenti yalnızca web sürümünde çalışır |

"Büyük olasılıkla" işaretli tarayıcılar aynı altyapıyı kullandığı için çalışmalıdır, ancak bu tarayıcılarda deneme yapılmadı.

---

## 3. Geliştirme

```bash
npm run build   # dist/chrome, dist/firefox ve 3 zip dosyası
npm test        # node --test, bağımlılık yok
```

Gereksinim: Node 18+. Hiç npm bağımlılığı yoktur; PNG ve ZIP üretimi Node'un yerleşik `zlib` modülüyle yapılır.

### Kaynaktan derleyip yükleme

`npm run build` sonrasında eklenti sayfasında **Paketlenmemiş öğe yükle** ile `dist/chrome` klasörünü seçin. Firefox'ta **Geçici Eklenti Yükle…** ile `dist/firefox/manifest.json` dosyasını seçin. Kodu değiştirdikten sonra yeniden derleyin, eklentiyi ↻ ile yenileyin ve x.com sekmesini yenileyin. Script `document_start` anında yüklendiği için sayfa yenilenmeden yeni sürüm devreye girmez.

### Yeni sürüm yayımlama

`package.json` içindeki `version` değerini artırın, `npm run build` çalıştırın ve iki zip'i yeni bir GitHub Release'e ekleyin:

```bash
gh release create v1.2.1 dist/quiet-timeline-chrome.zip dist/quiet-timeline-firefox.zip --title "v1.2.1"
```

README'deki indirme bağlantıları her zaman en son Release'i gösterir.

Mağazalarda (Chrome Web Store, Firefox Add-ons, Opera, Edge) yayımlama adımları ve hazır mağaza metinleri için: **[MAGAZA.md](MAGAZA.md)**

### Dosya yapısı

```
src/
  filter.js        Saf filtre: reklamları çıkarır, mavi tiklileri işaretler (flagged); decideDisplay
  mute.js          "Sessize al" isteğini oluşturur (x.com'un kendi uç noktası)
  inject.js        fetch/XHR yamaları, kimlik tespiti, düğme şeridi arayüzü, /home DOM katmanı, DEBUG
  bridge.js        "Filtrelemeyi bırak" listesini eklenti deposunda tutan köprü (ISOLATED world)
scripts/
  build.js         İki manifest, content.js ve bridge.js paketleri, ikonlar, zip'ler
  lib.js           CRC32, PNG kodlayıcı, ikon çizimi, ZIP yazıcı
tests/
  fixtures/        Gerçekçi HomeTimeline / HomeLatestTimeline JSON örnekleri
  filter.test.js   Her filtre kuralı ve dayanıklılık testleri
  inject.test.js   Derlenmiş content.js: fetch/XHR ve düğme şeridi arayüzü (vm + sahte DOM)
  mute.test.js     Sessize alma isteği ve çerez okuma
  build.test.js    Manifest, ikon ve zip doğrulaması
  helpers/         Bağımlılıksız küçük sahte DOM
icons/             Üretilen 16/32/48/128 px ikonlar
dist/              Build çıktısı (git'e eklenmez; zip'ler Releases'ta)
MAGAZA.md          Mağazalarda yayımlama rehberi
```

### Nasıl çalışır?

`content.js`, `world: "MAIN"` ve `run_at: "document_start"` ayarlarıyla sayfa kodundan önce yüklenir. `window.fetch` ve `XMLHttpRequest` çağrılarını sarar. Yalnızca `HomeTimeline` ve `HomeLatestTimeline` GraphQL cevaplarını `filterTimeline` fonksiyonundan geçirir ve sayfaya filtrelenmiş JSON'u verir. XHR için `responseText`, `response` ve `responseType="json"` durumlarının hepsi desteklenir. Parse veya filtre hatasında orijinal cevap olduğu gibi geçer.

Kendi kimliğiniz `twid` çerezinden (`u%3D<id>`) okunur. Çerez yoksa `window.__INITIAL_STATE__` kullanılır.

DOM yedek katmanı yalnızca `/home` yolunda çalışır. API filtresinden kaçan reklam işaretli `article[data-testid="tweet"]` öğelerini gizler.

### Hata ayıklama

`src/inject.js` dosyasında `const DEBUG = true;` yapın, yeniden derleyip eklentiyi yenileyin. Konsolda `[Quiet Timeline]` önekiyle her cevapta kaç girdinin, hangi nedenle (`promoted`, `muted`, `module-root-removed`, `module-empty`) kaldırıldığı ve kaç gönderinin işaretlendiği görünür.

### Test sonuçları

`npm test` komutu 82 test çalıştırır ve hepsi geçer. Kapsanan durumlar: takip edilen ve edilmeyen mavi tik, altın tik, gri tik, tiksiz hesap, iki tür reklam, RT, alıntı, TweetWithVisibilityResults, konuşma modülleri, PinEntry, AddToModule, kendi tweetiniz, eksik alanlar, eski ve yeni şema, bozuk girdiler, fetch/XHR yamaları, düğme şeridi arayüzü (varsayılan açık şerit, Gizle ve Göster, Sessize al ve başarısızlığı, Filtrelemeyi bırak, sanal liste hücre değişimi), kalıcı liste köprüsü (localStorage silinmesi, eski listenin taşınması, sekmeler arası eşitleme), sessize alma isteği ve manifest kuralları.

### Gerçek oturumda elle doğrulama

x.com'a giriş yapılmış tarayıcıda şunları kontrol edin:

1. **Şerit çıkıyor mu?** Takip etmediğiniz mavi tiklilerin gönderilerinin üstünde düğme şeridi görünmeli. Hiç çıkmıyorsa `DEBUG = true` ile konsola bakın; "0 tweet işaretlendi" yazıyor ve kimlik uyarısı yoksa, X bu hesaplar için `following` alanını göndermiyor demektir (fail-open). Bu durumda Network sekmesinde HomeTimeline cevabındaki `relationship_perspectives` alanına bakın.
2. **Kimlik tespiti:** Konsolda "kendi kimliğim bulunamadı" uyarısı çıkmamalı. Kendi gönderileriniz ve takip ettiğiniz mavi tikliler görünür kalmalı.
3. **Reklamlar ve boşluklar:** "Sana özel" sekmesinde aşağı kaydırın. "Reklam" etiketli gönderi ve boş satır görmemelisiniz.
4. **Kapsam:** Bir tweet detayına, bir mavi tiklinin profiline ve aramaya gidin. Oradaki mavi tikli yanıtlar ve gönderiler normal görünmeye devam etmeli.
5. **Sessize al:** Önemsemediğiniz bir hesapta **Sessize al** düğmesine basın. Hesabın gönderileri kaybolmalı ve X'te *Sessize alınan hesaplar* listesinde görünmeli. Düğme "Sessize alınamadı" derse sayfayı yenileyip tekrar deneyin; düzelmezse X uç noktayı değiştirmiş olabilir.

---

*Bu proje X Corp. ile bağlantılı değildir ve X Corp. tarafından onaylanmamıştır.*
