# 🏭 AYD Kaynak Teknolojileri - Üretim Yönetim Sistemi

Modern ve kapsamlı kaynak üretim yönetim sistemi. React, Vite, TailwindCSS ve Supabase ile geliştirilmiştir.

## 🚀 Özellikler

### 📊 Ana Modüller
- **Dashboard**: Genel üretim metrikleri ve performans göstergeleri
- **WPS Yönetimi**: Welding Procedure Specification oluşturma ve yönetimi
- **Manuel Veri Takip**: Manuel ve tamir hatları üretim takibi
  - Vardiya bazlı analiz
  - Personel performans takibi
  - Maliyet analizi
  - Detaylı raporlama
- **Operasyon Azaltma**: Karşılaştırmalı maliyet analizi
- **Sürekli İyileştirme**: İyileştirme projelerini takip
- **Fikstür İyileştirme**: Fikstür geliştirme kayıtları
- **Aksiyon Takibi**: Görev ve aksiyon yönetimi
- **Eğitim Planı**: Personel eğitim programları
- **Denetim**: Kalite denetim kayıtları
- **Ana Veri**: Hat ve personel yönetimi

### 🔐 Güvenlik
- Supabase Authentication
- Row Level Security (RLS)
- Rol tabanlı erişim kontrolü
- Güvenli environment variables

### 📱 Kullanıcı Deneyimi
- Modern ve responsive tasarım
- Dark mode desteği
- Real-time data updates
- Offline support (yakında)

## 🛠️ Teknoloji Stack

```
Frontend:
├── React 18.2
├── Vite 4.4
├── TailwindCSS 3.3
├── Radix UI Components
├── Framer Motion (animasyonlar)
├── React Router DOM 6
└── Lucide React (iconlar)

Backend:
├── Supabase (PostgreSQL)
├── Supabase Auth
├── Supabase Storage
└── Real-time subscriptions

Deployment:
├── Netlify
├── GitHub Actions (CI/CD)
└── Let's Encrypt SSL
```

## 📦 Kurulum

### Gereksinimler
- Node.js 18+ 
- npm veya yarn
- Supabase hesabı

### Lokal Development

```bash
# Repository'i klonla
git clone https://github.com/YOUR_USERNAME/ayd-kaynak-yonetim.git
cd ayd-kaynak-yonetim

# Dependencies yükle
npm install

# Environment variables ayarla
cp env.example .env
# .env dosyasını Supabase bilgilerinle doldur

# Development server başlat
npm run dev
```

Uygulama `http://localhost:3000` adresinde çalışacaktır.

### Production Build

```bash
# Build al
npm run build

# Build'i test et
npm run preview
```

## 🚀 Deployment

### Netlify ile Deploy

1. **GitHub'a Push Et**:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Netlify'da Proje Oluştur**:
   - https://app.netlify.com → New site from Git
   - GitHub repository'ni seç
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`

3. **Environment Variables Ekle**:
   - Site settings → Environment variables
   - Ekle:
     ```
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_anon_key
     ```

4. **Deploy!**
   - Netlify otomatik olarak deploy edecek
   - Her push'ta otomatik re-deploy

Detaylı deployment rehberi: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📂 Proje Yapısı

```
ayd-kaynak-yonetim/
├── src/
│   ├── components/          # React bileşenleri
│   │   ├── ui/             # Temel UI bileşenleri
│   │   ├── Dashboard.jsx
│   │   ├── ManualDataTracking.jsx
│   │   └── ...
│   ├── contexts/           # React contexts
│   │   └── SupabaseAuthContext.jsx
│   ├── lib/                # Yardımcı fonksiyonlar
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── App.jsx             # Ana uygulama
│   └── main.jsx            # Entry point
├── public/                 # Static dosyalar
├── netlify.toml           # Netlify config
├── vite.config.js         # Vite config
├── tailwind.config.js     # TailwindCSS config
└── package.json           # Dependencies

```

## 🗄️ Database Schema

Temel tablolar:
- `employees` - Personel bilgileri
- `lines` - Üretim hatları
- `manual_production_records` - Manuel üretim kayıtları
- `repair_records` - Tamir kayıtları
- `monthly_production_totals` - Aylık toplam üretim
- `daily_production_totals` - Günlük toplam üretim

Detaylı schema: [DEPLOYMENT.md](./DEPLOYMENT.md#supabase-database-migration)

## 👥 Kullanıcı Rolleri

- **Admin**: Tam erişim
- **Manager**: Yönetim modülleri
- **Quality**: Kalite modülleri
- **Operator**: Sadece veri girişi

## 🔧 Development

### Yeni Modül Ekleme

```jsx
// 1. src/components/ altında yeni component oluştur
// 2. src/App.jsx içinde route ekle
// 3. src/components/MainLayout.jsx içinde menüye ekle
```

### Supabase Query Örneği

```javascript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('manual_production_records')
  .select('*')
  .eq('record_date', '2025-11-05');
```

## 📈 Performans

- ⚡ Vite ile hızlı hot reload
- 🎯 Code splitting
- 📦 Optimized bundle size
- 🔄 React.memo optimizasyonları

## 🐛 Troubleshooting

### Build Hatası
```bash
# Cache temizle
rm -rf node_modules dist
npm install
npm run build
```

### Supabase Bağlantı Sorunu
- `.env` dosyasını kontrol et
- Supabase dashboard'da RLS politikalarını kontrol et
- Network konsolu (F12) ile hataları incele

## 📝 License

Private - AYD Kaynak Teknolojileri

## 🤝 Destek

Sorularınız için:
- Email: info@aydtr.com
- GitHub Issues: [Issues](https://github.com/YOUR_USERNAME/ayd-kaynak-yonetim/issues)

---

**Geliştirici**: AYD Kaynak Teknolojileri IT Ekibi  
**Son Güncelleme**: Kasım 2025  
**Versiyon**: 1.0.0

