# Mağazaya yükleme

Bu dosya, Quiet Timeline'ı Chrome Web Store, Firefox Add-ons (AMO), Opera Add-ons ve Edge Add-ons mağazalarında yayımlamak isteyenler içindir. Eklentiyi yalnızca kullanmak istiyorsanız [README](README.md) dosyasındaki kurulum adımları yeterlidir.

Zip dosyalarını üretmek için önce `npm run build` komutunu çalıştırın.

`npm run build` şu dosyaları üretir:

- `dist/quiet-timeline-chrome.zip`: Chrome Web Store, Edge Add-ons ve Opera Add-ons için
- `dist/quiet-timeline-firefox.zip`: AMO için
- `dist/quiet-timeline-source.zip`: AMO'nun kaynak kodu sorusu için

## 1. Chrome Web Store

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

## 2. Firefox Add-ons (AMO)

1. **Hesap:** [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) adresinde ücretsiz bir Mozilla hesabı açın.
2. **Submit a New Add-on** seçeneğine tıklayın ve dağıtım türünü seçin:
   - **On this site (listed):** Eklenti AMO'da herkese açık listelenir ve insan incelemesinden geçebilir.
   - **On your own (unlisted):** Eklenti yalnızca imzalanır ve size `.xpi` olarak verilir. Listelenmez. Sadece kendiniz kalıcı olarak kullanmak istiyorsanız bunu seçin.
3. `quiet-timeline-firefox.zip` dosyasını yükleyin. Otomatik doğrulama (linter) çalışır.
4. **Kaynak kodu sorusu** ("Do you need to submit source code?"): `content.js`, build script'i tarafından `src/filter.js`, `src/mute.js` ve `src/inject.js` dosyaları **birleştirilerek** üretilir. Küçültme (minify) yoktur. İncelemeyi hızlandırmak için **Evet** deyin, `quiet-timeline-source.zip` dosyasını yükleyin ve not alanına şunu yazın: `npm run build (Node 18+, bağımlılık yok)`.
5. Listed seçtiyseniz açıklama, kategori ("Social & Communication"), lisans ve ekran görüntülerini ekleyin. Ardından gönderin.
6. Manifest'teki `data_collection_permissions: { required: ["none"] }` alanı, AMO'nun yeni eklentilerden istediği "veri toplanmıyor" beyanıdır.

## 3. Opera Add-ons (Opera ve Opera GX)

Opera kullanıcıları eklentiyi iki yoldan kurabilir:

- **Chrome Web Store'dan:** Opera, Chrome Web Store'da "Diğer mağazalardan uzantılara izin ver" uyarısı gösterir. Bu izin verildiğinde Chrome mağazasındaki eklenti doğrudan kurulur. Chrome Web Store'a yüklemek çoğu durumda yeterlidir.
- **Opera'nın kendi mağazasından:** Listelemek için:
  1. [addons.opera.com/developer](https://addons.opera.com/developer/) adresinde ücretsiz bir Opera hesabıyla giriş yapın.
  2. **Upload new extension** ile `quiet-timeline-chrome.zip` dosyasını yükleyin. Aynı zip kullanılır.
  3. Açıklama, kategori, ekran görüntüleri ve ikonu ekleyin. 5. bölümdeki metinler burada da kullanılabilir.
  4. Gönderin. İncelemeyi Opera moderatörleri elle yapar ve süre değişkendir. Opera GX kullanıcıları da aynı mağazadan kurar.

## 4. Microsoft Edge Add-ons

Edge kullanıcıları Chrome Web Store'dan da kurabilir. Edge'in kendi mağazasında listelemek isterseniz:

1. [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) adresinde ücretsiz bir geliştirici hesabı açın.
2. **Create new extension** ile `quiet-timeline-chrome.zip` dosyasını yükleyin. Aynı zip kullanılır.
3. Açıklama, gizlilik beyanı ve görselleri ekleyin (5. bölümdeki metinler kullanılabilir), sonra gönderin. İnceleme genelde birkaç iş günü sürer.

## 5. Hazır, kopyalanabilir metinler

**Kısa açıklama (≤132 karakter)**

```
Removes ads and adds Hide/Mute controls to posts from paid-verified accounts you don't follow on X/Twitter web.
```

**Uzun açıklama**

```
Quiet Timeline cleans up your home timeline on the X/Twitter website.

What it does:
• Removes all promoted posts (ads) completely, with no gaps
• Adds a small bar above posts from paid blue-check accounts that you do not follow

The bar has three buttons:
• Hide: collapse the post (click Show to open it again)
• Mute: mute the account on X (also applies in the X mobile app)
• Stop filtering: never mark this account again

What it keeps:
• Accounts you follow (blue check or not)
• Business (gold) and government (gray) verified accounts
• Your own posts
• Retweets and quotes made by people you follow
• Anything it is not sure about — when in doubt, the post is shown

Scope: only the home timeline ("For you" and "Following" tabs). Post details, profiles, search and notifications are untouched. Works on the desktop website only, not in the mobile apps.

Privacy: no data collection, no analytics, no extra permissions. Everything runs locally in your browser. The only request the extension makes is the mute request it sends to x.com when you click Mute.

Not affiliated with or endorsed by X Corp.
```

**Tek amaç (single purpose)**

```
Filters the user's X/Twitter web home timeline by removing promoted posts and adding hide, mute and stop-filtering controls to posts from paid-verified accounts the user does not follow.
```

**Host izni gerekçesi**

```
The extension needs access to x.com and twitter.com to filter the home timeline data that the site loads in the user's own browser. It only runs on these two domains. Its only network request is a mute request sent to x.com when the user clicks Mute. It does not collect or transmit any user data to anyone else.
```

**Gizlilik beyanı**

```
Quiet Timeline does not collect, transmit or sell any personal or usage data. It has no analytics and no tracking. All filtering happens locally in your browser, on x.com and twitter.com only. The extension reads the site's own login cookies in memory to recognise your own posts and, only when you click Mute, to send that mute request to x.com on your behalf. The list of accounts you chose to stop filtering is stored only in your browser's local storage for x.com. Nothing is sent to the developer or any third party.
```
