# İnternet / Mobil Hotspot Bağlantı Sorunları (ERR_CONNECTION_RESET)

Tarayıcıda **“Bağlantı sıfırlandı”** veya **`ERR_CONNECTION_RESET`** görüyorsanız, sayfa genelde **sunucuya ulaşamadan** TCP bağlantısı kopuyor demektir. Bu, çoğunlukla **uygulama kaynaklı değildir**; aynı adres bazı ağlarda açılıp bazılarında (özellikle **telefon interneti / hotspot**) açılmıyorsa sorun **operatör, tethering veya bilgisayar ağ ayarları** ile ilgilidir.

## Hızlı denemeler

1. **Sayfayı ve DNS önbelleğini yenileyin**  
   - Tarayıcıda gizli pencerede tekrar deneyin.  
   - Mümkünse DNS olarak **8.8.8.8** ve **8.8.4.4** (Google) veya **1.1.1.1** (Cloudflare) kullanın (Windows: Ağ bağdaştırıcısı → IPv4 DNS).

2. **Hotspot yerine Wi‑Fi veya kablolu bağlantı**  
   Aynı site sabit internette açılıyorsa, sorun büyük olasılıkla **mobil hat veya USB/Wi‑Fi paylaşımı** ile ilgilidir.

3. **Farklı tarayıcı**  
   Chrome’da olup Edge/Firefox’ta çalışıyorsa eklenti veya proxy etkisi olabilir.

4. **VPN kapatın veya tersine deneyin**  
   Bazı operatörlerde VPN açıkken veya kapalıyken bağlantı davranışı değişir.

5. **Windows Güvenlik Duvarı / antivirüs**  
   Geçici olarak (test için) “Özel ağ” profilinde engel olup olmadığını kontrol edin.

## Mobil hotspot’ta sık görülen neden: MTU (paket boyutu)

Telefon üzerinden PC’ye internet verildiğinde bazen **büyük paketler** yolda düşer ve bağlantı **sıfırlanır**. Aşağıdaki adım birçok kullanıcıda işe yarar.

### Windows’ta tethering bağdaştırıcısına MTU düşürme

1. **Win + R** → `ncpa.cpl` → Enter  
2. Telefon hotspot’una bağlı bağdaştırıcıyı bulun (genelde “Wi‑Fi” veya “Ethernet” / “Remote NDIS”).  
3. **Özellikler → IPv4 → Gelişmiş** ile ilgili ayarlara gerek yok; MTU için **Yönetici olarak** PowerShell veya CMD:

```text
netsh interface ipv4 show subinterfaces
```

Listede kullandığınız arayüzün **MTU** ve **Bağdaştırıcı adı** sütununa bakın. Sonra (örnek: “Wi-Fi”):

```text
netsh interface ipv4 set subinterface "Wi-Fi" mtu=1400 store=persistent
```

Bağdaştırıcı adı Türkçe olabilir (ör. **Kablosuz Ağ Bağlantısı**). Hâlâ sorun varsa **1280** deneyin:

```text
netsh interface ipv4 set subinterface "Wi-Fi" mtu=1280 store=persistent
```

Eski değere dönmek için genelde **1500** veya listede gördüğünüz önceki değeri verin.

## IPv6

Bazı mobil ağlarda IPv6 yönlendirmesi bozuksa tarayıcı IPv6 üzerinden dener ve bağlantı kopabilir. Geçici test: Windows’ta ilgili bağdaştırıcıda **IPv6’yı kapatıp** yalnızca IPv4 ile deneyin (kalıcı çözüm değil; sadece teşhis).

## Operatör / kurumsal kısıt

Bazı iş veya okul hatlarında **belirli siteler veya HTTPS** kısıtlanır. Evdeki Wi‑Fi’de çalışıp mobilde çalışmıyorsa **operatör veya hat politikası** da olabilir; operatör desteğine “HTTPS 443 reset” diye bildirebilirsiniz.

## Uygulama tarafı

- Site **Netlify** üzerinde barındırılıyorsa, adres **`https://...netlify.app`** doğrudan Netlify altyapısına gider.  
- Bu tür **bağlantı sıfırlama** hataları için çözüm çoğunlukla **istemci veya ağ** tarafındadır; kod değişikliği ile tamamen ortadan kaldırılamaz.

Sorun devam ederse: hangi **operatör**, **USB tethering mi Wi‑Fi hotspot mu**, **Windows sürümü** ve hata **tüm sayfalarda mı yoksa sadece bir modülde mi** not alıp IT / operatör ile paylaşın.
