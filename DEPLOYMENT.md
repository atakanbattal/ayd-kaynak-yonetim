# 🚀 AYD Kaynak Teknolojileri - Netlify Deployment Rehberi

## 📋 Ön Hazırlık

### 1. GitHub Repository Oluşturma

```bash
# Git reposunu initialize et (eğer henüz yapılmadıysa)
cd "/Users/atakanbattal/Desktop/Uygulamalar/AYD Kaynak Teknolojileri"
git init

# İlk commit
git add .
git commit -m "Initial commit: AYD Production Management System"

# GitHub'da yeni bir repository oluştur (ayd-kaynak-yonetim)
# Sonra aşağıdaki komutları çalıştır:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ayd-kaynak-yonetim.git
git push -u origin main
```

### 2. Supabase Konfigürasyonu

1. **Supabase Dashboard'a Git**: https://supabase.com
2. **Project Settings > API** bölümünden al:
   - `Project URL` → `https://wowvecfviptpfkovblhv.supabase.co`
   - `anon/public key` → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvd3ZlY2Z2aXB0cGZrb3ZibGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Njc4MTEsImV4cCI6MjA3NDQ0MzgxMX0.60yCUJY28aDttmhuYhDUvhHzNk_bmC9IWmo--h00qUM`

### 3. Netlify Hesabı ve Proje Kurulumu

#### Adım 1: Netlify'a Giriş
1. https://app.netlify.com/ adresine git
2. GitHub ile giriş yap

#### Adım 2: Yeni Site Oluştur
1. **"Add new site"** → **"Import an existing project"** tıkla
2. **GitHub'ı seç**
3. Repository'ni seç: `ayd-kaynak-yonetim`
4. Branch'i seç: `main`

#### Adım 3: Build Ayarları
```
Build command: npm run build
Publish directory: dist
```

#### Adım 4: Environment Variables Ekle
**Site settings > Environment variables** bölümüne git ve ekle:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc... (your anon key)
```

#### Adım 5: Deploy Et!
- **"Deploy site"** butonuna tıkla
- Build log'unu izle
- Site URL'i al (örn: `ayd-kaynak-yonetim.netlify.app`)

## 🔄 Otomatik Deployment Akışı

```
Developer → Git Push → GitHub → Netlify → Build → Deploy → Live Site
```

### Her Git Push'ta Otomatik Deploy:
```bash
git add .
git commit -m "Yeni özellik: Vardiya analizi düzeltildi"
git push origin main
```

Netlify otomatik olarak:
1. GitHub'dan kod çeker
2. `npm install` çalıştırır
3. `npm run build` ile build alır
4. `dist/` klasörünü production'a deploy eder
5. 2-3 dakika içinde yeni versiyon yayında!

## 🔧 Supabase Database Migration

### Production veritabanı için gerekli tablolar:

```sql
-- 1. Manuel üretim kayıtları
CREATE TABLE IF NOT EXISTS manual_production_records (
    id SERIAL PRIMARY KEY,
    record_date DATE NOT NULL,
    line_id INTEGER REFERENCES lines(id),
    shift INTEGER CHECK (shift IN (1, 2, 3)),
    operator_id UUID REFERENCES employees(id),
    operator_name TEXT,
    part_code TEXT,
    quantity INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tamir kayıtları  
CREATE TABLE IF NOT EXISTS repair_records (
    id SERIAL PRIMARY KEY,
    record_date DATE NOT NULL,
    line_id INTEGER REFERENCES lines(id),
    shift INTEGER CHECK (shift IN (1, 2, 3)),
    operator_id UUID REFERENCES employees(id),
    operator_name TEXT,
    part_code TEXT,
    quantity INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Aylık toplam üretim
CREATE TABLE IF NOT EXISTS monthly_production_totals (
    id SERIAL PRIMARY KEY,
    year_month TEXT UNIQUE NOT NULL,
    total_production INTEGER NOT NULL DEFAULT 0,
    total_manual INTEGER,
    total_repair INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Günlük toplam üretim
CREATE TABLE IF NOT EXISTS daily_production_totals (
    id SERIAL PRIMARY KEY,
    record_date DATE UNIQUE NOT NULL,
    total_production INTEGER NOT NULL DEFAULT 0,
    total_manual INTEGER,
    total_repair INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Fikstür iyileştirme kayıtları
CREATE TABLE IF NOT EXISTS fixture_improvements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    improvement_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    part_code TEXT NOT NULL,
    before_image TEXT,
    after_image TEXT,
    improvement_reason TEXT NOT NULL,
    result TEXT,
    responsible TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) Politikaları
ALTER TABLE manual_production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_production_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_production_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixture_improvements ENABLE ROW LEVEL SECURITY;

-- Authenticated kullanıcılar için tam erişim
CREATE POLICY "Enable all for authenticated users" ON manual_production_records
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON repair_records
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON monthly_production_totals
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON daily_production_totals
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users" ON fixture_improvements
    FOR ALL USING (auth.role() = 'authenticated');

-- Updated_at için trigger fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fikstür iyileştirme tablosu için updated_at trigger
CREATE TRIGGER update_fixture_improvements_updated_at
    BEFORE UPDATE ON fixture_improvements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

## 📱 Custom Domain (İsteğe Bağlı)

1. **Netlify Dashboard** → **Domain settings**
2. **Add custom domain** tıkla
3. Domain'i gir (örn: `ayd.kaynak.com.tr`)
4. DNS kayıtlarını güncelle:
   ```
   A Record: 75.2.60.5
   CNAME: ayd-kaynak-yonetim.netlify.app
   ```
5. SSL otomatik aktif olacak (Let's Encrypt)

## 🔒 Güvenlik

- ✅ HTTPS otomatik (Netlify SSL)
- ✅ Environment variables güvenli (Netlify'da)
- ✅ Supabase RLS aktif
- ✅ API keys client-side'da güvenli (VITE_ prefix ile)

## 🐛 Troubleshooting

### Build Hatası?
```bash
# Lokal olarak test et
npm run build

# Hata varsa düzelt ve push et
git add .
git commit -m "Fix: Build hatası düzeltildi"
git push origin main
```

### Environment Variables Çalışmıyor?
- Netlify dashboard'da değişkenleri kontrol et
- `VITE_` prefix'i olmalı
- Redeploy yap (Deploys → Trigger deploy → Clear cache and deploy)

### Supabase Bağlantı Hatası?
- `.env` dosyası doğru mu?
- Supabase RLS politikaları aktif mi?
- API keys güncel mi?

## 📞 Destek

Sorularınız için:
- GitHub Issues: https://github.com/YOUR_USERNAME/ayd-kaynak-yonetim/issues
- Email: support@aydtr.com

---

**Son Güncelleme**: Kasım 2025  
**Versiyon**: 1.0.0

