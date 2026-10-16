# Quiet Timeline

X/Twitter web anasayfasından reklamları ve **takip etmediğiniz ücretli mavi tikli** hesapların gönderilerini tamamen kaldıran, Chrome ve Firefox için Manifest V3 eklentisi.

---

## 1. Ne yapar, ne yapmaz

**Kaldırır** (geride "gizlendi" şeridi ya da boşluk kalmaz):

| Durum | Sonuç |
|---|---|
| Reklam / sponsorlu girdi (`entryId` `promoted-` ile başlar ya da `promotedMetadata` var) | Kaldırılır. Yazarın kim olduğu önemli değildir. |
| Yazar `is_blue_verified === true` **ve** `verified_type` yok **ve** onu takip etmiyorsunuz **ve** yazar siz değilsiniz | Kaldırılır |

**Kaldırmaz:**

- Altın tik (Business) ve gri tik (Government) hesaplar
- Takip ettiğiniz mavi tikliler ve tiksiz hesaplar
- Kendi gönderileriniz
- **Retweet:** Takip ettiğiniz biri mavi tikliyi RT'lerse görünür kalır. Karar her zaman RT'yi yapan kişiye göre verilir.
- **Alıntı:** Takip ettiğiniz biri mavi tikliyi alıntılarsa hem gönderi hem alıntı kutusu görünür kalır.
- **Emin olunamayan durumlar (fail-open):** Takip bilgisi ya da tik alanı eksikse, X yanıtın biçimini değiştirdiyse veya kendi kullanıcı kimliğiniz tespit edilemezse gönderi **gösterilir**. Kimliğiniz bulunamazsa yalnızca reklamlar kaldırılır.

**Konuşma modülleri** (anasayfadaki yanıt zincirleri): Her öğe ayrı değerlendirilir ve yalnızca kurala uyan yanıtlar çıkarılır. Zincirin ilk öğesi çıkarılırsa ya da zincirde öğe kalmazsa modülün tamamı kaldırılır.

**Kapsam:** Yalnızca anasayfa, yani "Sana özel" ve "Takip edilenler" sekmeleri (`HomeTimeline`, `HomeLatestTimeline`). Tweet detayı, profil, arama, bildirimler ve diğer sayfalara dokunulmaz.

**Çalışmadığı yerler:** X'in mobil (iOS/Android) uygulamaları. Eklenti yalnızca masaüstü tarayıcıdaki `x.com` ve `twitter.com` web sürümünde çalışır.

**Gizlilik:** Ek izin yoktur (storage, tabs vb.); yalnızca `x.com` ve `twitter.com` eşleşmeleri vardır. Dış ağ isteği, veri toplama ve analitik yoktur.

---

## 2. Tarayıcı uyumluluğu

Eklentinin iki sürümü vardır: **Chromium sürümü** (`dist/chrome`) ve **Firefox sürümü** (`dist/firefox`). İki sürüm de içerik betiğini sayfanın kendi ortamında (`world: "MAIN"`) çalıştırır. Bu yüzden tarayıcının bu özelliği desteklemesi gerekir: Chromium 111+ veya Firefox 128+.

| Tarayıcı | Çalışır mı? | Kullanılacak sürüm | Kalıcı kurulum yolu |
|---|---|---|---|
| Google Chrome 111+ | ✅ Evet | `dist/chrome` | Chrome Web Store |
| Microsoft Edge 111+ | ✅ Evet | `dist/chrome` | Edge Add-ons (aynı zip) veya Chrome Web Store ("Diğer mağazalardan uzantılara izin ver") |
| Brave | ✅ Evet | `dist/chrome` | Chrome Web Store |
| Opera | ✅ Evet | `dist/chrome` | Opera Add-ons (aynı zip) veya Chrome Web Store ("Diğer mağazalardan uzantılara izin ver") |
| Opera GX | ✅ Evet | `dist/chrome` | Opera ile aynı |
| Vivaldi | ✅ Evet | `dist/chrome` | Chrome Web Store |
| Arc | ✅ Evet | `dist/chrome` | Chrome Web Store |
| Diğer güncel Chromium tabanlılar (Yandex vb.) | ✅ Büyük olasılıkla | `dist/chrome` | Chrome Web Store |
| Mozilla Firefox 128+ (ESR 128+ dahil) | ✅ Evet | `dist/firefox` | Firefox Add-ons (AMO) |
| Firefox tabanlılar (Zen, LibreWolf, Waterfox, Floorp) | ✅ Büyük olasılıkla | `dist/firefox` | Firefox Add-ons (AMO) |
| Safari (macOS / iOS) | ❌ Hayır | — | Safari için ayrı bir Xcode paketi gerekir; şu an yok |
| Mobil tarayıcılar (Chrome Android, iOS tarayıcıları) | ❌ Hayır | — | Bu tarayıcılar eklenti desteklemez |
| Firefox Android | ⚠️ Denenmedi | `dist/firefox` | Resmî olarak desteklenmiyor |
| X'in iOS / Android uygulamaları | ❌ Hayır | — | Eklenti yalnızca web sürümünde çalışır |

"Büyük olasılıkla" işaretli tarayıcılar aynı altyapıyı kullandığı için çalışmalıdır, ancak bu tarayıcılarda deneme yapılmadı.

---

## 3. Klasörden yükleme (geliştirici modu)

Önce derleyin:

```bash
npm run build
```

### Chromium tabanlı tarayıcılar (Chrome, Edge, Brave, Opera, Opera GX, Vivaldi, Arc)

Tüm Chromium tabanlı tarayıcılarda adımlar aynıdır. Yalnızca eklenti sayfasının adresi değişir:

| Tarayıcı | Eklenti sayfası |
|---|---|
| Chrome | `chrome://extensions` |
| Edge | `edge://extensions` |
| Brave | `brave://extensions` |
| Opera / Opera GX | `opera://extensions` |
| Vivaldi | `vivaldi://extensions` |
| Arc | `arc://extensions` |

1. Tarayıcınızın eklenti sayfasını açın.
2. **Geliştirici modu**nu açın. Çoğu tarayıcıda sağ üsttedir; Edge'de sol menüdedir.
3. **Paketlenmemiş öğe yükle** düğmesine basın ve `dist/chrome` klasörünü seçin.
4. Açık olan x.com sekmesini yenileyin.

### Firefox (128 veya üzeri)

1. `about:debugging#/runtime/this-firefox` adresini açın.
2. **Geçici Eklenti Yükle…** düğmesine basın ve `dist/firefox/manifest.json` dosyasını seçin.
3. x.com sekmesini yenileyin.

> ⚠️ Geçici yüklenen eklenti **Firefox kapanınca silinir**. Kalıcı kullanım için AMO üzerinden imzalatmanız gerekir (bkz. 4.2; "unlisted" seçeneği yeterlidir).

### Kodu değiştirdikten sonra

1. `npm run build` komutunu çalıştırın.
2. Chromium tabanlı tarayıcılarda eklenti sayfasındaki kartta **↻ (yenile)** simgesine basın. Firefox'ta `about:debugging` sayfasında **Yeniden yükle** düğmesine basın.
3. x.com sekmesini **yenileyin**. Script `document_start` anında yüklendiği için sayfa yenilenmeden yeni sürüm devreye girmez.

---

## 4. Mağazaya yükleme

`npm run build` şu dosyaları üretir:

- `dist/quiet-timeline-chrome.zip`: Chrome Web Store, Edge Add-ons ve Opera Add-ons için
- `dist/quiet-timeline-firefox.zip`: AMO için
- `dist/quiet-timeline-source.zip`: AMO'nun kaynak kodu sorusu için

### 4.1 Chrome Web Store

1. **Geliştirici hesabı:** [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) adresine bir Google hesabıyla girin. Kayıt için **tek seferlik 5 USD** ödenir. Hesap doğrulamasını ve iletişim e-postası doğrulamasını tamamlayın.
2. **Yeni öğe** düğmesine basıp `quiet-timeline-chrome.zip` dosyasını yükleyin.
3. **Mağaza girişi** sekmesini doldurun. Gerekli görseller:
   - Mağaza ikonu: **128×128** PNG (`icons/icon-128.png` kullanılabilir)
   - Ekran görüntüsü: en az 1, en fazla 5 adet, **1280×800** veya **640×400**
   - Küçük tanıtım kutusu: **440×280** (panel bunu ister)
   - Marquee: **1400×560** (isteğe bağlı)
4. **Gizlilik uygulamaları** sekmesi:
   - *Tek amaç (single purpose)* alanına aşağıdaki metni yapıştırın.
   - *İzin gerekçesi:* Host izni için aşağıdaki metni yapıştırın.
   - *Uzak kod:* "Hayır, uzak kod kullanmıyorum".
   - *Veri kullanımı:* Hiçbir kutuyu işaretlemeyin (veri toplanmıyor). Ardından üç uyum beyanını onaylayın.
   - Veri toplanmadığı için gizlilik politikası URL'si zorunlu değildir. Yine de isterseniz aşağıdaki beyanı bir sayfada yayımlayıp bağlantısını verebilirsiniz.
5. **İncelemeye gönder.** İnceleme genelde birkaç gün sürer, bazen birkaç haftaya uzayabilir. Yalnızca iki alan adına erişim istendiği için geniş host izni uyarısı çıkmaz.

### 4.2 Firefox Add-ons (AMO)

1. **Hesap:** [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) adresinde ücretsiz bir Mozilla hesabı açın.
2. **Submit a New Add-on** seçeneğine tıklayın ve dağıtım türünü seçin:
   - **On this site (listed):** Eklenti AMO'da herkese açık listelenir ve insan incelemesinden geçebilir.
   - **On your own (unlisted):** Eklenti yalnızca imzalanır ve size `.xpi` olarak verilir. Listelenmez. Sadece kendiniz kalıcı olarak kullanmak istiyorsanız bunu seçin.
3. `quiet-timeline-firefox.zip` dosyasını yükleyin. Otomatik doğrulama (linter) çalışır.
4. **Kaynak kodu sorusu** ("Do you need to submit source code?"): `content.js`, build script'i tarafından `src/filter.js` ve `src/inject.js` dosyaları **birleştirilerek** üretilir. Küçültme (minify) yoktur. İncelemeyi hızlandırmak için **Evet** deyin, `quiet-timeline-source.zip` dosyasını yükleyin ve not alanına şunu yazın: `npm run build (Node 18+, bağımlılık yok)`.
5. Listed seçtiyseniz açıklama, kategori ("Social & Communication"), lisans ve ekran görüntülerini ekleyin. Ardından gönderin.
6. Manifest'teki `data_collection_permissions: { required: ["none"] }` alanı, AMO'nun yeni eklentilerden istediği "veri toplanmıyor" beyanıdır.

### 4.3 Opera Add-ons (Opera ve Opera GX)

Opera kullanıcıları eklentiyi iki yoldan kurabilir:

- **Chrome Web Store'dan:** Opera, Chrome Web Store'da "Diğer mağazalardan uzantılara izin ver" uyarısı gösterir. Bu izin verildiğinde Chrome mağazasındaki eklenti doğrudan kurulur. Chrome Web Store'a yüklemek çoğu durumda yeterlidir.
- **Opera'nın kendi mağazasından:** Listelemek için:
  1. [addons.opera.com/developer](https://addons.opera.com/developer/) adresinde ücretsiz bir Opera hesabıyla giriş yapın.
  2. **Upload new extension** ile `quiet-timeline-chrome.zip` dosyasını yükleyin. Aynı zip kullanılır.
  3. Açıklama, kategori, ekran görüntüleri ve ikonu ekleyin. 4.5'teki metinler burada da kullanılabilir.
  4. Gönderin. İncelemeyi Opera moderatörleri elle yapar ve süre değişkendir. Opera GX kullanıcıları da aynı mağazadan kurar.

### 4.4 Microsoft Edge Add-ons

Edge kullanıcıları Chrome Web Store'dan da kurabilir. Edge'in kendi mağazasında listelemek isterseniz:

1. [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) adresinde ücretsiz bir geliştirici hesabı açın.
2. **Create new extension** ile `quiet-timeline-chrome.zip` dosyasını yükleyin. Aynı zip kullanılır.
3. Açıklama, gizlilik beyanı ve görselleri ekleyin (4.5'teki metinler kullanılabilir), sonra gönderin. İnceleme genelde birkaç iş günü sürer.

### 4.5 Hazır, kopyalanabilir metinler

**Kısa açıklama (≤132 karakter)**

```
Removes ads and posts from paid-verified accounts you don't follow from your home timeline, for X/Twitter web.
```

**Uzun açıklama**

```
Quiet Timeline cleans up your home timeline on the X/Twitter website.

What it removes:
• All promoted posts (ads)
• Posts from paid blue-check accounts that you do not follow

What it keeps:
• Accounts you follow (blue check or not)
• Business (gold) and government (gray) verified accounts
• Your own posts
• Retweets and quotes made by people you follow
• Anything it is not sure about — when in doubt, the post is shown

Removed posts disappear completely: no "hidden" placeholders, no gaps.

Scope: only the home timeline ("For you" and "Following" tabs). Post details, profiles, search and notifications are untouched. Works on the desktop website only, not in the mobile apps.

Privacy: no data collection, no analytics, no external network requests, no extra permissions. Everything runs locally in your browser.

Not affiliated with or endorsed by X Corp.
```

**Tek amaç (single purpose)**

```
Filters the user's X/Twitter web home timeline by removing promoted posts and posts from paid-verified accounts the user does not follow.
```

**Host izni gerekçesi**

```
The extension needs access to x.com and twitter.com to filter the home timeline data that the site loads in the user's own browser. It only runs on these two domains, makes no network requests of its own, and does not read, store or transmit any user data.
```

**Gizlilik beyanı**

```
Quiet Timeline does not collect, store, transmit or sell any personal or usage data. It has no analytics, no tracking and makes no external network requests. All filtering happens locally in your browser, on x.com and twitter.com only. The extension reads the site's own login cookie solely in memory to recognise your own posts so they are never hidden; this value never leaves the page.
```

---

## 5. Geliştirme

```bash
npm run build   # dist/chrome, dist/firefox ve 3 zip dosyası
npm test        # node --test, bağımlılık yok
```

Gereksinim: Node 18+. Hiç npm bağımlılığı yoktur; PNG ve ZIP üretimi Node'un yerleşik `zlib` modülüyle yapılır.

### Dosya yapısı

```
src/
  filter.js        Saf filtre fonksiyonu: filterTimeline(json, { selfId }) → json
  inject.js        fetch/XHR yamaları, kimlik tespiti, /home DOM yedek katmanı, DEBUG
scripts/
  build.js         İki manifest, content.js paketi, ikonlar, zip'ler
  lib.js           CRC32, PNG kodlayıcı, ikon çizimi, ZIP yazıcı
tests/
  fixtures/        Gerçekçi HomeTimeline / HomeLatestTimeline JSON örnekleri
  filter.test.js   Her filtre kuralı ve dayanıklılık testleri
  inject.test.js   Derlenmiş content.js'in fetch/XHR davranışı (vm ile)
  build.test.js    Manifest, ikon ve zip doğrulaması
icons/             Üretilen 16/32/48/128 px ikonlar
dist/              Build çıktısı (git'e eklenmez)
```

### Nasıl çalışır?

`content.js`, `world: "MAIN"` ve `run_at: "document_start"` ayarlarıyla sayfa kodundan önce yüklenir. `window.fetch` ve `XMLHttpRequest` çağrılarını sarar. Yalnızca `HomeTimeline` ve `HomeLatestTimeline` GraphQL cevaplarını `filterTimeline` fonksiyonundan geçirir ve sayfaya filtrelenmiş JSON'u verir. XHR için `responseText`, `response` ve `responseType="json"` durumlarının hepsi desteklenir. Parse veya filtre hatasında orijinal cevap olduğu gibi geçer.

Kendi kimliğiniz `twid` çerezinden (`u%3D<id>`) okunur. Çerez yoksa `window.__INITIAL_STATE__` kullanılır.

DOM yedek katmanı yalnızca `/home` yolunda çalışır. API filtresinden kaçan reklam işaretli `article[data-testid="tweet"]` öğelerini gizler.

### Hata ayıklama

`src/inject.js` dosyasında `const DEBUG = true;` yapın, yeniden derleyip eklentiyi yenileyin. Konsolda `[Quiet Timeline]` önekiyle her cevapta kaç girdinin, hangi nedenle (`promoted`, `blue-unfollowed`, `module-root-removed`, `module-empty`) kaldırıldığı görünür.

### Test sonuçları

`npm test` komutu 55 test çalıştırır ve hepsi geçer. Kapsanan durumlar: takip edilen ve edilmeyen mavi tik, altın tik, gri tik, tiksiz hesap, iki tür reklam, RT, alıntı, TweetWithVisibilityResults, konuşma modülleri (kısmi ve tamamen kaldırma), PinEntry, AddToModule, kendi tweetiniz, eksik alanlar, eski ve yeni şema, bozuk girdiler, fetch/XHR yamaları ve manifest kuralları.

### Gerçek oturumda elle doğrulama

x.com'a giriş yapılmış tarayıcıda şunları kontrol edin:

1. **Takip alanı geliyor mu?** `DEBUG = true` ile anasayfayı açın. Konsolda `blue-unfollowed` kayıtları görünmeli. Hiç çıkmıyorsa ve uyarı yoksa, X bu hesaplar için `following` alanını göndermiyor demektir (fail-open). Bu durumda Network sekmesinde HomeTimeline cevabındaki `relationship_perspectives` alanına bakın.
2. **Kimlik tespiti:** Konsolda "kendi kimliğim bulunamadı" uyarısı çıkmamalı. Kendi gönderileriniz ve takip ettiğiniz mavi tikliler görünür kalmalı.
3. **Reklamlar ve boşluklar:** "Sana özel" sekmesinde aşağı kaydırın. "Reklam" etiketli gönderi ve boş satır görmemelisiniz.
4. **Kapsam:** Bir tweet detayına, bir mavi tiklinin profiline ve aramaya gidin. Oradaki mavi tikli yanıtlar ve gönderiler görünmeye devam etmeli.

---

*Bu proje X Corp. ile bağlantılı değildir ve X Corp. tarafından onaylanmamıştır.*
