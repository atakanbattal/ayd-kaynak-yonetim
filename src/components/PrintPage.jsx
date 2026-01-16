import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Kurumsal Renkler
const COLORS = {
  primary: '#0B2C5F',      // Koyu Mavi (Logo rengi)
  secondary: '#1e40af',    // Mavi
  accent: '#FFC107',       // Sarı/Altın
  text: '#1f2937',
  muted: '#64748b',
  border: '#e5e7eb',
  background: '#f8fafc'
};

// AYD Logo - Public klasöründen PNG/JPG olarak yüklenir
const AydLogo = ({ height = 50 }) => {
  return (
    <img 
      src="/logo.png" 
      alt="AYD Kaynak Teknolojileri" 
      style={{ 
        height: `${height}px`, 
        width: 'auto',
        display: 'block',
        objectFit: 'contain'
      }}
      onError={(e) => {
        // PNG bulunamazsa JPG dene
        if (e.target.src.endsWith('.png')) {
          e.target.src = '/logo.jpg';
        }
      }}
    />
  );
};

// Standart Rapor Header Bileşeni
const ReportHeader = ({ title, subtitle, date, reportId }) => {
  const today = date || new Date().toLocaleDateString('tr-TR');
  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `3px solid ${COLORS.primary}`,
      paddingBottom: '12px',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AydLogo height={50} />
        <div>
          <h1 style={{ fontSize: '14pt', fontWeight: '700', color: COLORS.primary, margin: '0' }}>AYD Kaynak Teknolojileri</h1>
          <p style={{ fontSize: '8pt', color: COLORS.muted, margin: '2px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Yönetim Sistemi</p>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <h2 style={{ fontSize: '11pt', fontWeight: '600', color: COLORS.primary, margin: '0 0 4px 0' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '9pt', color: COLORS.text, margin: '0 0 2px 0' }}>{subtitle}</p>}
        {reportId && <p style={{ fontSize: '7pt', color: COLORS.muted, margin: '0 0 2px 0', fontFamily: 'monospace' }}>{reportId}</p>}
        <p style={{ fontSize: '8pt', color: COLORS.muted, margin: '0' }}>{today} {now}</p>
      </div>
    </header>
  );
};

// Standart Sayfa Footer Bileşeni
const ReportFooter = ({ moduleName }) => {
  const today = new Date().toLocaleDateString('tr-TR');
  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <footer style={{
      marginTop: 'auto',
      paddingTop: '12px',
      borderTop: `1px solid ${COLORS.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '7pt',
      color: COLORS.muted
    }}>
      <span>AYD Kaynak Teknolojileri - {moduleName || 'Yönetim Sistemi'}</span>
      <span>Yazdırılma: {today} {now}</span>
      <span>© {new Date().getFullYear()}</span>
    </footer>
  );
};

// Standart İmza Alanı Bileşeni
const SignatureSection = ({ fields }) => {
  if (!fields || fields.length === 0) return null;
  
  return (
    <section style={{ 
      marginTop: '24px', 
      paddingTop: '16px', 
      borderTop: `1px solid ${COLORS.border}`,
      breakInside: 'avoid'
    }}>
      <h2 style={{ 
        fontSize: '9pt', 
        fontWeight: '700', 
        color: COLORS.muted, 
        textAlign: 'center', 
        margin: '0 0 24px 0', 
        textTransform: 'uppercase', 
        letterSpacing: '0.1em' 
      }}>İmza ve Onay</h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${fields.length}, 1fr)`, 
        gap: '32px' 
      }}>
        {fields.map((field, index) => (
          <div key={index} style={{ textAlign: 'center' }}>
            <p style={{ 
              fontSize: '8pt', 
              fontWeight: '600', 
              color: COLORS.muted, 
              textTransform: 'uppercase', 
              margin: '0 0 40px 0' 
            }}>{field.title}</p>
            <div style={{ 
              borderTop: `1px solid ${COLORS.text}`, 
              margin: '0 20px', 
              paddingTop: '8px' 
            }}>
              <p style={{ fontSize: '9pt', fontWeight: '600', color: COLORS.text, margin: '0 0 2px 0' }}>{field.name || '.............................'}</p>
              <p style={{ fontSize: '8pt', color: COLORS.muted, margin: '0' }}>{field.role || ' '}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const CertificatePrintLayout = ({ certificateData }) => {
  return (
    <div className="print-container certificate-layout bg-white text-[#0B2C5F] font-sans flex flex-col relative overflow-hidden" style={{ width: '297mm', height: '210mm', maxHeight: '210mm', padding: '8mm 20mm', boxSizing: 'border-box' }}>
      {/* Decorative Elements - Larger */}
      <div className="absolute top-0 left-0 bg-[#FFC107] opacity-90" style={{ width: '200px', height: '200px', clipPath: 'polygon(0 0, 100% 0, 0 40%)' }}></div>
      <div className="absolute bottom-0 right-0 bg-[#FFC107] opacity-90" style={{ width: '200px', height: '200px', clipPath: 'polygon(100% 100%, 0 100%, 100% 60%)' }}></div>

      <div className="absolute bg-[#4A90E2] rounded-full opacity-80" style={{ top: '-60px', right: '-60px', width: '220px', height: '220px' }}></div>
      <div className="absolute bg-[#357ABD] rounded-full opacity-70" style={{ top: '-30px', right: '-90px', width: '220px', height: '220px' }}></div>

      <div className="absolute bg-[#4A90E2] rounded-full opacity-80" style={{ bottom: '-60px', left: '-60px', width: '220px', height: '220px' }}></div>
      <div className="absolute bg-[#357ABD] rounded-full opacity-70" style={{ bottom: '-30px', left: '-90px', width: '220px', height: '220px' }}></div>

      {/* Main Content - Full page spread */}
      <div className="relative z-10 text-center w-full h-full flex flex-col items-center justify-between" style={{ padding: '0' }}>
        {/* Top Section: Logo */}
        <div>
          <AydLogo />
        </div>

        {/* Middle Section: Title, Name, Description */}
        <div className="flex flex-col items-center" style={{ flex: 1, justifyContent: 'center', width: '100%' }}>
          {/* Title */}
          <h1 style={{ fontFamily: "'Arial Black', sans-serif", fontSize: '42px', fontWeight: 800, letterSpacing: '6px', margin: '0 0 15px 0', color: '#0B2C5F' }}>
            BAŞARI SERTİFİKASI
          </h1>

          {/* Subtitle */}
          <p style={{ fontFamily: "'Georgia', serif", fontSize: '20px', color: '#555', margin: '0 0 10px 0' }}>
            Bu sertifika,
          </p>

          {/* Name */}
          <p style={{ fontFamily: "'Great Vibes', cursive", fontSize: '64px', margin: '0 0 25px 0', color: '#0B2C5F', lineHeight: '1.2' }}>
            {certificateData.participantName}
          </p>

          {/* Description */}
          <div style={{ fontFamily: "'Georgia', serif", fontSize: '17px', color: '#333', lineHeight: '1.8', maxWidth: '850px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px 0' }}>
              "<span style={{ fontWeight: 'bold' }}>{certificateData.trainingName}</span>" programına katılarak gerekli tüm bilgi, beceri ve yeterlilikleri başarıyla göstermiştir.
            </p>
            <p style={{ margin: '0 0 12px 0' }}>
              Görevine olan özverisi, öğrenmeye olan isteği ve gelişime açık yaklaşımıyla bu eğitimi başarıyla tamamlamış, kurumumuzun kalite ve mükemmeliyet hedeflerine değerli katkılarda bulunmuştur.
            </p>
            <p style={{ margin: '0' }}>
              Bu belge, göstermiş olduğu gayret ve başarıyı onurlandırmak amacıyla kendisine verilmiştir.
            </p>
          </div>
        </div>

        {/* Bottom Section: Signatures */}
        <div className="w-full">
          <div style={{ display: 'flex', justifyContent: 'center', gap: '180px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '3px solid #555', margin: '0 auto 10px auto' }}></div>
              <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '0 0 5px 0', color: '#0B2C5F' }}>{certificateData.trainerName || 'Eğitmen'}</p>
              <p style={{ color: '#666', fontSize: '15px', margin: '0' }}>Eğitmen</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '3px solid #555', margin: '0 auto 10px auto' }}></div>
              <p style={{ fontWeight: 'bold', fontSize: '18px', margin: '0 0 5px 0', color: '#0B2C5F' }}>Eren KAYA</p>
              <p style={{ color: '#666', fontSize: '15px', margin: '0' }}>Sac Salıncak Fabrika Müdürü</p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px', color: '#777' }}>
            Tarih: {certificateData.issueDate} | Sertifika No: {certificateData.certificateNumber}
          </div>
        </div>
      </div>
    </div>
  );
}

const WPSPrintLayout = ({ wpsData }) => {
  const signatureFields = [
    { title: 'Hazırlayan', name: 'Tuğçe MAVİ BATTAL', role: 'Kaynak Mühendisi' },
    { title: 'Kontrol Eden', name: '', role: '' },
    { title: 'Onaylayan', name: '', role: 'Kalite Müdürü' }
  ];

  const getPartInfo = (part, isPipe) => {
    if (!part) return { material: '', thickness: '' };
    const material = part.material_type || 'N/A';
    const thickness = isPipe ? `${part.pipe_wt || 'N/A'} mm (Ø${part.pipe_od || 'N/A'})` : `${part.thickness || 'N/A'} mm`;
    return { material, thickness };
  };

  const { isPart1Pipe, isPart2Pipe } = (() => {
    switch (wpsData.joint_type) {
      case 'Plaka/Plaka': return { isPart1Pipe: false, isPart2Pipe: false };
      case 'Boru/Plaka': return { isPart1Pipe: true, isPart2Pipe: false };
      case 'Boru/Boru': return { isPart1Pipe: true, isPart2Pipe: true };
      default: return { isPart1Pipe: false, isPart2Pipe: false };
    }
  })();

  const part1Info = getPartInfo(wpsData.part1, isPart1Pipe);
  const part2Info = getPartInfo(wpsData.part2, isPart2Pipe);
  const mainThickness = wpsData.part1?.thickness || wpsData.part1?.pipe_wt || 'N/A';
  const wpsTitle = `WPS-${wpsData.part1?.material_type || 'MALZEME'}-${mainThickness}mm`;

  const renderRow = (label, value) => (
    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <td style={{ padding: '8px 12px', fontWeight: '600', background: COLORS.background, width: '35%', fontSize: '9pt', color: COLORS.text }}>{label}</td>
      <td style={{ padding: '8px 12px', fontSize: '9pt', color: COLORS.text }}>{value || 'N/A'}</td>
    </tr>
  );

  return (
    <div className="print-container" style={{
      background: '#fff',
      color: COLORS.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      width: '210mm',
      minHeight: '297mm',
      padding: '12mm 15mm',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <ReportHeader 
        title="WPS Spesifikasyonu" 
        subtitle={wpsData.wps_code}
        reportId={`Parça: ${wpsData.part_code}`}
      />

      {/* Metadata */}
      <section style={{ 
        background: COLORS.background, 
        borderRadius: '4px', 
        padding: '10px 14px', 
        marginBottom: '16px',
        border: `1px solid ${COLORS.border}`,
        fontSize: '9pt'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>WPS No:</strong> {wpsData.wps_code}</span>
          <span><strong>Güncelleme:</strong> {new Date(wpsData.updated_at || wpsData.created_at).toLocaleDateString('tr-TR')}</span>
        </div>
      </section>

      {/* Temel Bilgiler */}
      <section style={{ marginBottom: '16px' }}>
        <h2 style={{ 
          fontSize: '10pt', 
          fontWeight: '700', 
          color: '#fff', 
          background: COLORS.primary, 
          padding: '8px 12px', 
          margin: '0',
          borderRadius: '4px 4px 0 0'
        }}>1. TEMEL BİLGİLER</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${COLORS.border}`, borderTop: 'none' }}>
          <tbody>
            {renderRow('WPS Başlığı', wpsTitle)}
            {renderRow('Ana Malzemeler', `${part1Info.material} / ${part2Info.material}`)}
            {renderRow('Dolgu Malzemesi', wpsData.wire_type)}
            {renderRow('Kaynak Prosesi', wpsData.welding_process)}
            {renderRow('Kaynak Pozisyonu', wpsData.position)}
            {renderRow('Malzeme Kalınlığı', `${mainThickness} mm`)}
            {renderRow('Birleştirme Tipi', wpsData.joint_type)}
            {renderRow('Kaynak Ağzı Tasarımı', wpsData.joint_design)}
          </tbody>
        </table>
      </section>

      {/* Robot Parametreleri */}
      <section style={{ marginBottom: '16px' }}>
        <h2 style={{ 
          fontSize: '10pt', 
          fontWeight: '700', 
          color: '#fff', 
          background: '#b91c1c', 
          padding: '8px 12px', 
          margin: '0',
          borderRadius: '4px 4px 0 0'
        }}>2. ROBOT PARAMETRELERİ</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${COLORS.border}`, borderTop: 'none' }}>
          <tbody>
            {renderRow('Kaynak Akımı', `${wpsData.current_range} A`)}
            {renderRow('Kaynak Gerilimi', `${wpsData.voltage_range} V`)}
            {renderRow('Robot Hızı', `${wpsData.robot_speed} mm/sn`)}
            {renderRow('Tel Sürme Hızı', `${wpsData.wire_feed_speed} m/min`)}
            {renderRow('Isı Girdisi (Heat Input)', `${wpsData.heat_input} kJ/mm`)}
            {renderRow('Koruyucu Gaz', wpsData.gas_type)}
            {renderRow('Gaz Debisi', `${wpsData.gas_flow} l/min`)}
            {renderRow('Tel Çapı', `${wpsData.wire_diameter} mm`)}
            {renderRow('Ark Boyu / Dinamik', `Ark: ${wpsData.arc_length}, Dinamik: ${wpsData.dynamic_correction}`)}
          </tbody>
        </table>
      </section>

      <SignatureSection fields={signatureFields} />
      <ReportFooter moduleName="WPS Sistemi" />
    </div>
  );
};

const ExamPrintLayout = ({ examData }) => {
  const totalPoints = examData.questions.reduce((acc, q) => acc + q.points, 0);

  return (
    <div className="print-container" style={{
      background: '#fff',
      color: COLORS.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      width: '210mm',
      minHeight: '297mm',
      padding: '12mm 15mm',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <ReportHeader 
        title="Eğitim Değerlendirme Sınavı" 
        subtitle={examData.trainingName}
      />

      {/* Katılımcı Bilgi Formu */}
      <section style={{ 
        background: COLORS.background, 
        borderRadius: '4px', 
        padding: '14px 16px', 
        marginBottom: '16px',
        border: `1px solid ${COLORS.border}`
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '9pt', width: '70px', color: COLORS.text }}>Ad Soyad:</label>
            <div style={{ flex: 1, borderBottom: `1px solid ${COLORS.muted}`, height: '20px' }}></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '9pt', width: '70px', color: COLORS.text }}>Tarih:</label>
            <div style={{ flex: 1, borderBottom: `1px solid ${COLORS.muted}`, height: '20px' }}></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '9pt', width: '70px', color: COLORS.text }}>Sicil No:</label>
            <div style={{ flex: 1, borderBottom: `1px solid ${COLORS.muted}`, height: '20px' }}></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: '600', fontSize: '9pt', width: '70px', color: COLORS.text }}>İmza:</label>
            <div style={{ flex: 1, borderBottom: `1px solid ${COLORS.muted}`, height: '20px' }}></div>
          </div>
        </div>
      </section>

      {/* Sorular */}
      <section style={{ flex: 1 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: '#dbeafe', 
          color: COLORS.primary, 
          padding: '8px 12px', 
          borderRadius: '4px', 
          marginBottom: '16px' 
        }}>
          <h3 style={{ fontSize: '11pt', fontWeight: '700', margin: 0 }}>Sorular</h3>
          <span style={{ fontSize: '10pt', fontWeight: '600' }}>Toplam Puan: {totalPoints}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {examData.questions.map((q, index) => (
            <div key={q.id} style={{ borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '12px' }}>
              <p style={{ fontWeight: '600', fontSize: '10pt', marginBottom: '10px', color: COLORS.text }}>
                {index + 1}. {q.question_text} <span style={{ fontWeight: '400', color: COLORS.muted }}>({q.points} Puan)</span>
              </p>
              {q.question_type === 'çoktan seçmeli' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', paddingLeft: '16px' }}>
                  {q.options.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '10pt', fontWeight: '600', marginRight: '8px', color: COLORS.primary }}>{String.fromCharCode(65 + i)})</span>
                      <span style={{ fontSize: '10pt', color: COLORS.text }}>{opt.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {q.question_type === 'doğru/yanlış' && (
                <div style={{ display: 'flex', gap: '32px', paddingLeft: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10pt', fontWeight: '600', marginRight: '8px', color: COLORS.primary }}>A)</span>
                    <span style={{ fontSize: '10pt' }}>Doğru</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10pt', fontWeight: '600', marginRight: '8px', color: COLORS.primary }}>B)</span>
                    <span style={{ fontSize: '10pt' }}>Yanlış</span>
                  </div>
                </div>
              )}
              {q.question_type === 'açık uçlu' && (
                <div style={{ marginTop: '8px', borderBottom: '2px dotted #cbd5e1', height: '60px' }}></div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Puan Kutusu */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <p style={{ fontSize: '11pt', fontWeight: '700', color: COLORS.primary, marginBottom: '8px' }}>Alınan Puan:</p>
        <div style={{ width: '120px', height: '50px', border: `2px solid ${COLORS.muted}`, margin: '0 auto' }}></div>
      </div>

      <ReportFooter moduleName="Eğitim Sistemi" />
    </div>
  );
}

const GeneralReportLayout = ({ reportData }) => {
  const today = new Date().toLocaleDateString('tr-TR');
  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Renk Paleti
  const CHART_COLORS = ['#1e40af', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#65a30d', '#475569'];

  // Grafik Render
  const renderChart = (chartType, data, config = {}) => {
    const { dataKey = 'value', nameKey = 'name', xAxisKey = 'name', bars = [], lines = [] } = config;
    if (!data || data.length === 0) return <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>Grafik verisi bulunamadı.</p>;

    const chartHeight = 200;

    if (chartType === 'bar') {
      return (
        <div style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
              {bars.length > 0 ? bars.map((bar, idx) => <Bar key={idx} dataKey={bar.key} name={bar.name} fill={bar.color || CHART_COLORS[idx % CHART_COLORS.length]} />) : <Bar dataKey={dataKey} fill={CHART_COLORS[0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (chartType === 'line') {
      return (
        <div style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#4b5563' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
              {lines.length > 0 ? lines.map((line, idx) => <Line key={idx} type="monotone" dataKey={line.key} name={line.name} stroke={line.color || CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={false} />) : <Line type="monotone" dataKey={dataKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (chartType === 'pie') {
      return (
        <div style={{ width: '100%', height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={70} fill="#8884d8" dataKey={dataKey} nameKey={nameKey} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
              <Legend wrapperStyle={{ fontSize: '9px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return null;
  };

  // Tablo Render Helper
  const renderTable = (headers, rows, options = {}) => {
    const { headerBg = COLORS.primary, zebraStripe = true } = options;
    if (!headers || !rows || rows.length === 0) return null;

  return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', tableLayout: 'auto' }}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{
                padding: '8px 10px',
                textAlign: 'left',
                fontWeight: '600',
                color: '#fff',
                background: headerBg,
                fontSize: '8pt',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap'
              }}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            // Section header detection
            const isSectionHeader = row.length > 0 && typeof row[0] === 'string' &&
              (row[0].includes('TOP') || row[0].includes('BOTTOM') || row[0].includes('BAZLI') ||
               row[0].includes('ANALİZ') || row[0].includes('ÖZET') || row[0].includes('PERSONEL') ||
               row[0].includes('HAT') || row[0].includes('PARÇA') || row[0].includes('ROBOT'));

            if (isSectionHeader) {
              const isTop = row[0].includes('TOP') || row[0].includes('EN YÜKSEK');
              const isBottom = row[0].includes('BOTTOM') || row[0].includes('EN DÜŞÜK');
              return (
                <tr key={rowIdx}>
                  <td colSpan={headers.length} style={{
                    padding: '10px 12px',
                    fontWeight: '700',
                    fontSize: '9pt',
                    color: isTop ? COLORS.secondary : isBottom ? '#b91c1c' : COLORS.primary,
                    background: isTop ? '#dbeafe' : isBottom ? '#fee2e2' : '#f1f5f9',
                    borderTop: '2px solid ' + (isTop ? '#3b82f6' : isBottom ? '#ef4444' : '#cbd5e1'),
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                  }}>{row[0]}</td>
                </tr>
              );
            }

            return (
              <tr key={rowIdx} style={{ background: zebraStripe && rowIdx % 2 === 1 ? '#f8fafc' : '#fff' }}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} style={{
                    padding: '7px 10px',
                    borderBottom: '1px solid #e5e7eb',
                    color: '#1f2937',
                    fontSize: '9pt',
                    fontWeight: cellIdx === 0 ? '500' : '400'
                  }}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  // KPI Kartları için renkler - Kurumsal Tema
  const kpiColors = [COLORS.primary, '#166534', '#c2410c', '#7e22ce', '#0e7490', '#b91c1c', '#4338ca', '#0f766e', '#a16207', '#6b21a8'];

  return (
    <div className="print-container" style={{
      background: '#fff',
      color: '#1f2937',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      width: '210mm',
      minHeight: '297mm',
      padding: '12mm 15mm',
      boxSizing: 'border-box'
    }}>

      {/* ===== HEADER ===== */}
      <ReportHeader 
        title={reportData.title || 'Rapor'}
        reportId={reportData.reportId}
      />

      {/* ===== METADATA / FİLTRELER ===== */}
      {reportData.filters && Object.keys(reportData.filters).length > 0 && (
        <section style={{
          background: '#f1f5f9',
          borderRadius: '4px',
          padding: '10px 14px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            {Object.entries(reportData.filters).map(([key, value]) => {
            if (key === 'Rapor Tarihi') return null;
            return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '8pt', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>{key}:</span>
                  <span style={{ fontSize: '9pt', fontWeight: '700', color: '#0f172a' }}>{value}</span>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* ===== KPI KARTLARI ===== */}
      {reportData.kpiCards && reportData.kpiCards.length > 0 && (
        <section style={{ marginBottom: '20px' }}>
          <h2 style={{
            fontSize: '10pt',
            fontWeight: '700',
            color: COLORS.primary,
            margin: '0 0 10px 0',
            paddingBottom: '6px',
            borderBottom: '2px solid #1e3a5f',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>Özet Göstergeler</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(reportData.kpiCards.length, 5)}, 1fr)`,
            gap: '10px'
          }}>
            {reportData.kpiCards.map((card, index) => (
              <div key={index} style={{
                background: kpiColors[index % kpiColors.length],
                padding: '10px 12px',
                borderRadius: '6px'
              }}>
                <p style={{
                  fontSize: '7pt',
                  fontWeight: '600',
                  color: 'rgba(255,255,255,0.8)',
                  margin: '0 0 4px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  lineHeight: '1.2'
                }}>{card.title}</p>
                <p style={{
                  fontSize: '14pt',
                  fontWeight: '700',
                  color: '#fff',
                  margin: '0',
                  lineHeight: '1.1'
                }}>{card.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== TEK KAYIT DETAY ===== */}
      {reportData.singleItemData && (
        <section style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '700', color: COLORS.primary, margin: '0 0 10px 0', paddingBottom: '6px', borderBottom: `2px solid ${COLORS.primary}`, textTransform: 'uppercase' }}>Detay Bilgiler</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
              <tbody>
              {Object.entries(reportData.singleItemData).map(([key, value], idx) => (
                <tr key={key} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '8px 12px', fontWeight: '600', color: '#475569', width: '35%', fontSize: '9pt', borderBottom: '1px solid #e5e7eb' }}>{key}</td>
                  <td style={{ padding: '8px 12px', color: '#1f2937', fontSize: '9pt', borderBottom: '1px solid #e5e7eb' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </section>
      )}

      {/* ===== EKLER ===== */}
      {reportData.attachments && reportData.attachments.length > 0 && (
        <section style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '700', color: COLORS.primary, margin: '0 0 10px 0', paddingBottom: '6px', borderBottom: '2px solid #059669', textTransform: 'uppercase' }}>Kanıt Dokümanları</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {reportData.attachments.map((file, index) => {
                const isImage = file.type && file.type.startsWith('image/');
                return (
                <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '4px', padding: '6px', background: '#f8fafc', textAlign: 'center' }}>
                    {isImage ? (
                    <img src={file.url} alt={file.name} style={{ width: '100%', height: '50px', objectFit: 'contain', borderRadius: '2px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', borderRadius: '2px' }}>
                      <span style={{ fontSize: '7pt', color: '#64748b' }}>DOSYA</span>
                            </div>
                          )}
                  <p style={{ fontSize: '7pt', color: '#475569', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ===== BÖLÜMLER (SECTIONS) ===== */}
      {reportData.sections && reportData.sections.length > 0 && (
        <section style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '700', color: COLORS.primary, margin: '0 0 12px 0', paddingBottom: '6px', borderBottom: `2px solid ${COLORS.primary}`, textTransform: 'uppercase' }}>Detaylı Analiz</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reportData.sections.map((section, sectionIndex) => {
              const isTopSection = section.title && (section.title.includes('TOP') || section.title.includes('EN YÜKSEK'));
              const isBottomSection = section.title && section.title.includes('BOTTOM');
              const accentColor = isTopSection ? COLORS.secondary : isBottomSection ? '#b91c1c' : COLORS.primary;
              const headerBg = isTopSection ? COLORS.secondary : isBottomSection ? '#b91c1c' : COLORS.primary;

              if (section.type === 'chart') {
                return (
                  <div key={sectionIndex} style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', breakInside: 'avoid' }}>
                    <div style={{ borderLeft: `4px solid ${accentColor}`, padding: '8px 12px', background: '#f8fafc' }}>
                      <h3 style={{ fontSize: '9pt', fontWeight: '700', color: accentColor, margin: '0', textTransform: 'uppercase' }}>{section.title}</h3>
                    </div>
                    <div style={{ padding: '10px' }}>{renderChart(section.chartType, section.data, section.config)}</div>
                  </div>
                );
              }

              const headers = section.headers || (section.tableData && section.tableData.headers);
              const rows = section.rows || (section.tableData && section.tableData.rows);

              return (
                <div key={sectionIndex} style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', breakInside: 'avoid' }}>
                  <div style={{ borderLeft: `4px solid ${accentColor}`, padding: '8px 12px', background: '#f8fafc' }}>
                    <h3 style={{ fontSize: '9pt', fontWeight: '700', color: accentColor, margin: '0', textTransform: 'uppercase' }}>{section.title}</h3>
                    </div>
                  {headers && rows && rows.length > 0 ? (
                    <div style={{ padding: '0' }}>{renderTable(headers, rows, { headerBg })}</div>
                  ) : section.type === 'list' && section.items ? (
                    <div style={{ padding: '10px 12px' }}>
                      {section.items.map((item, itemIdx) => (
                        <div key={itemIdx} style={{ marginBottom: '8px' }}>
                          <p style={{ fontWeight: '600', fontSize: '9pt', color: '#1f2937', margin: '0 0 4px 0' }}>{item.header}</p>
                          {item.details && (
                            <ul style={{ margin: '0', paddingLeft: '16px' }}>
                              {item.details.map((d, dIdx) => <li key={dIdx} style={{ fontSize: '8pt', color: '#475569', marginBottom: '2px' }}>{d}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '8pt', color: '#6b7280', fontStyle: 'italic', padding: '10px 12px', margin: '0' }}>Veri bulunamadı.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== TABLO VERİLERİ ===== */}
      {reportData.tableData && reportData.tableData.headers && reportData.tableData.rows && (
        <section style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '10pt', fontWeight: '700', color: COLORS.primary, margin: '0 0 12px 0', paddingBottom: '6px', borderBottom: `2px solid ${COLORS.primary}`, textTransform: 'uppercase' }}>Detaylı Veriler</h2>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
            {renderTable(reportData.tableData.headers, reportData.tableData.rows)}
          </div>
        </section>
      )}

      {/* ===== İMZA ALANI ===== */}
      <SignatureSection fields={reportData.signatureFields} />

      {/* ===== FOOTER ===== */}
      <ReportFooter />
    </div>
  );
};

const PrintPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [reportContent, setReportContent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageClass, setPageClass] = useState('page-portrait');

  useEffect(() => {
    const snapshotId = searchParams.get('snapshot_id');

    const fetchSnapshot = async (id) => {
      const { data, error: fetchError } = await supabase
        .from('report_snapshots')
        .select('data')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        throw new Error(fetchError?.message || "Rapor verisi bulunamadı.");
      }
      return data.data;
    };

    const loadData = async () => {
      try {
        if (!snapshotId) {
          throw new Error("Geçersiz Rapor ID'si. Lütfen ilgili sayfaya geri dönüp tekrar deneyin.");
        }

        const data = await fetchSnapshot(snapshotId);
        setReportContent(data);

        if (data.certificateData) {
          setPageClass('page-landscape');
          // Sertifika için landscape CSS'i zorla ekle
          const landscapeStyle = document.createElement('style');
          landscapeStyle.id = 'certificate-landscape-style';
          landscapeStyle.textContent = `
                @page {
                  size: A4 landscape;
                  margin: 0;
                }
                @media print {
                  @page {
                    size: A4 landscape;
                    margin: 0;
                  }
                }
              `;
          // Eğer daha önce eklenmişse kaldır
          const existingStyle = document.getElementById('certificate-landscape-style');
          if (existingStyle) {
            existingStyle.remove();
          }
          document.head.appendChild(landscapeStyle);
        } else {
          setPageClass('page-portrait');
          // Portrait için eski landscape style'ı kaldır
          const existingStyle = document.getElementById('certificate-landscape-style');
          if (existingStyle) {
            existingStyle.remove();
          }
        }

        document.title = `Rapor - ${data.wpsData?.wps_code || data.title || 'Detay'}`;
      } catch (e) {
        console.error("Failed to fetch print data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [searchParams, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Rapor verisi hazırlanıyor...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-red-600 p-4 text-center">
        <h2 className="font-bold text-lg mb-2">Yazdırma Hatası</h2>
        <p>{error}</p>
        <button onClick={() => window.close()} className="mt-4 p-2 bg-gray-200 text-gray-800 rounded">Pencereyi Kapat</button>
      </div>
    );
  }

  if (!reportContent) {
    return <div className="flex items-center justify-center h-screen">Yazdırılacak veri bulunamadı.</div>;
  }

  const renderLayout = () => {
    if (reportContent.wpsData) {
      return <WPSPrintLayout wpsData={reportContent.wpsData} />;
    }
    if (reportContent.examData) {
      return <ExamPrintLayout examData={reportContent.examData} />;
    }
    if (reportContent.certificateData) {
      return <CertificatePrintLayout certificateData={reportContent.certificateData} />;
    }
    return <GeneralReportLayout reportData={reportContent} />;
  };

  const handleSaveAsPDF = () => {
    // Tarayıcının native yazdırma/PDF kaydetme penceresini aç
    // Bu yöntem CSS @page kurallarına saygı duyar, metinleri bölmez ve en kaliteli çıktıyı verir.
    window.print();
  };

  return (
    <>
      <div className="print-controls no-print fixed top-4 right-4 flex flex-col gap-2">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Yazdır</Button>
        <Button onClick={handleSaveAsPDF} variant="default"><Download className="mr-2 h-4 w-4" /> PDF Olarak Kaydet</Button>
        <Button variant="secondary" onClick={() => window.close()}>Kapat</Button>
      </div>
      <div className={`print-area ${pageClass}`}>
        {renderLayout()}
      </div>
      <style jsx global>{`
        /* ===== EKRAN GÖRÜNÜMÜ ===== */
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
          background-color: #e5e7eb;
          margin: 0;
          padding: 0;
              }
              
              @media screen {
                .print-area {
                  display: flex;
                  justify-content: center;
                  align-items: flex-start;
            padding: 24px 0;
            min-height: 100vh;
                }
                .print-container {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            background: white;
                }
                .page-portrait .print-container {
                  width: 210mm;
                }
                .page-landscape .print-container {
                  width: 297mm;
                }
                .certificate-layout {
                  aspect-ratio: 297 / 210;
                }
              }
              
        /* ===== BASKI GÖRÜNÜMÜ ===== */
              @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
                  }
                  
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
            font-size: 10pt;
                  }
                  
                  .no-print {
                      display: none !important;
                  }
              
                  .print-area {
            display: block;
            width: 100%;
            margin: 0;
            padding: 0;
                  }
                  
                  .print-container {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
                      box-shadow: none !important;
                      border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }

          /* Tablo Yönetimi */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          tbody {
            display: table-row-group !important;
          }

          tr {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                  }
                  
          th, td {
                      page-break-inside: avoid !important;
                  }
                  
          /* Bölüm ve Kart Yönetimi */
          section {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                  }
                  
          header {
            page-break-after: avoid !important;
                  }
                  
          .signature-section, footer {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                  }
                  
          /* Grafik Yönetimi */
          .recharts-responsive-container {
                      page-break-inside: avoid !important;
                      break-inside: avoid !important;
                  }

          /* Sertifika Layout */
          .certificate-layout {
            width: 100% !important;
            height: 100% !important;
            page-break-inside: avoid !important;
          }
        }

        /* Landscape için özel */
        @media print and (orientation: landscape) {
                @page {
                  size: A4 landscape;
            margin: 8mm 10mm;
          }
        }
      `}</style>
    </>
  );
};

export default PrintPage;