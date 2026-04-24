# ment0rType

Tarayıcı tabanlı, sıfır bağımlılıklı bir yazma hızı test uygulaması. Türkçe ve İngilizce kelime listeleri, ayarlanabilir kelime uzunluğu ve canlı istatistikler içerir.

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## Özellikler

- **3 test modu** — Süre (15s / 30s / 60s / 120s), kelime sayısı (10 / 25 / 50 / 100) ve alıntı modu
- **Türkçe & İngilizce** — Anlık dil değiştirme, her dil için 3 ayrı kelime seviyesi (temel / yaygın / gelişmiş)
- **Kelime uzunluğu filtresi** — Minimum ve maksimum harf sayısına göre kelimeler filtrelenir
- **Canlı AOB göstergesi** — Yazarken anlık kelime hızı, gizlenebilir
- **Noktalama & sayı modu** — İlave karakter setleriyle zorluk artırılabilir
- **Sonuç ekranı** — AOB, doğruluk, ham AOB, tutarlılık ve zaman bazlı WPM grafiği
- **Kısayollar** — `Tab + Enter` hızlı yeniden başlatır, `Esc` testi sıfırlar
- **Yazı boyutu** — 14px ile 36px arasında ayarlanır
- **Sıfır bağımlılık** — Herhangi bir framework veya kütüphane kullanılmaz

## Kurulum

Herhangi bir kurulum gerekmez. `index.html` dosyasını doğrudan tarayıcıda açın.

```
type/
├── index.html
├── style.css
├── app.js
└── words.js
```

Yerel bir sunucu üzerinden çalıştırmak istersen:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

## Kullanım

| Eylem | Kısayol |
|---|---|
| Testi yeniden başlat | `Tab` + `Enter` |
| Testi sıfırla | `Esc` |
| Yazma alanına odaklan | Herhangi bir tuş |

Mod çubuğundan süre veya kelime modu seçildikten sonra yazmaya başlanınca sayaç otomatik başlar. Boşluk tuşu kelimeyi onaylar. Testi bitince WPM, doğruluk ve tutarlılık sonuçları grafik eşliğinde gösterilir.

## Kelime Listeleri

| Seviye | Türkçe | İngilizce |
|---|---|---|
| Temel | ~180 kelime | ~180 kelime |
| Yaygın | ~150 kelime | ~150 kelime |
| Gelişmiş | ~120 kelime | ~120 kelime |

Alıntı modunda her dil için 20 adet hazır alıntı bulunur.

## Teknik Notlar

- Tüm kelime üretimi ve test mantığı `app.js` içinde, kelime listeleri `words.js` içinde tutulur
- Sonuç grafiği native Canvas API ile çizilir
- Animasyonlar ve arka plan efektleri saf CSS ve vanilla JS ile yapılmıştır
- Yerel depolama (localStorage) kullanılmaz; oturum kapanınca veriler sıfırlanır

## Lisans

MIT
