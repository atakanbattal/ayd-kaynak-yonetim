import React, { useEffect, useState } from 'react';
    import { useSearchParams, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { Button } from '@/components/ui/button';
    import { Printer } from 'lucide-react';
    
    const AydLogo = () => (
      <img src="https://horizons-cdn.hostinger.com/42102681-7ddc-4184-98a5-73d4f6325bfd/ada2181c81988ef298490de9a3c6d391.png" alt="AYD Logo" className="h-20" />
    );
    
    const CertificatePrintLayout = ({ certificateData }) => {
      return (
        <div className="print-container certificate-layout bg-white text-[#0B2C5F] font-sans w-[297mm] h-[210mm] flex flex-col p-8 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-80 h-80 bg-[#FFC107] opacity-90" style={{ clipPath: 'polygon(0 0, 100% 0, 0 40%)' }}></div>
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#FFC107] opacity-90" style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 60%)' }}></div>
            
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#4A90E2] rounded-full opacity-80"></div>
            <div className="absolute -top-12 -right-36 w-96 h-96 bg-[#357ABD] rounded-full opacity-70"></div>
    
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#4A90E2] rounded-full opacity-80"></div>
            <div className="absolute -bottom-12 -left-36 w-96 h-96 bg-[#357ABD] rounded-full opacity-70"></div>
    
            <div className="relative z-10 text-center w-full flex-grow flex flex-col items-center">
                <div className="w-full flex justify-center mt-4">
                    <AydLogo />
                </div>
                
                <h1 className="text-5xl font-extrabold tracking-wider mt-4" style={{ fontFamily: "'Arial Black', sans-serif" }}>
                    BAŞARI SERTİFİKASI
                </h1>
    
                <p className="mt-8 text-2xl text-gray-600" style={{ fontFamily: "'Georgia', serif" }}>
                    Bu sertifika,
                </p>
    
                <p className="text-7xl mt-4" style={{ fontFamily: "'Great Vibes', cursive" }}>
                    {certificateData.participantName}
                </p>
                
                <div className="mt-8 text-center text-lg text-[#333] leading-relaxed max-w-4xl mx-auto" style={{ fontFamily: "'Georgia', serif" }}>
                    <p>
                        "<span className="font-bold">{certificateData.trainingName}</span>" programına katılarak gerekli tüm bilgi, beceri ve yeterlilikleri başarıyla göstermiştir.
                    </p>
                    <p className="mt-4">
                        Görevine olan özverisi, öğrenmeye olan isteği ve gelişime açık yaklaşımıyla bu eğitimi başarıyla tamamlamış, kurumumuzun kalite ve mükemmeliyet hedeflerine değerli katkılarda bulunmuştur.
                    </p>
                    <p className="mt-4">
                        Bu belge, göstermiş olduğu gayret ve başarıyı onurlandırmak amacıyla kendisine verilmiştir.
                    </p>
                </div>
                
                <div className="mt-auto mb-12 grid grid-cols-2 gap-48 text-center w-full max-w-3xl">
                    <div className="text-lg">
                        <p className="font-bold border-t-2 border-gray-400 pt-3">Tuğçe MAVİ BATTAL</p>
                        <p className="text-base text-gray-600 mt-1">Eğitmen</p>
                    </div>
                    <div className="text-lg">
                        <p className="font-bold border-t-2 border-gray-400 pt-3">Yusuf ÇAKIR</p>
                        <p className="text-base text-gray-600 mt-1">Genel Müdür</p>
                    </div>
                </div>
    
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-gray-500">
                    Tarih: {certificateData.issueDate} | Sertifika No: {certificateData.certificateNumber}
                </div>
            </div>
        </div>
      );
    }
    
    const WPSPrintLayout = ({ wpsData }) => {
      const today = new Date().toLocaleDateString('tr-TR');
      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
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
        <tr className="border-b border-gray-200">
          <td className="p-2 font-semibold bg-gray-50 w-1/3">{label}</td>
          <td className="p-2">{value || 'N/A'}</td>
        </tr>
      );
    
      return (
        <div className="print-container bg-white text-gray-800 font-sans w-[210mm] min-h-[297mm] p-8">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">AYD Kaynak Teknolojileri Yönetim Sistemi</h1>
            <p className="text-md text-gray-600">Kaynak Yönetim Sistemi</p>
          </header>
    
          <section className="border border-gray-300 rounded-lg p-4 mb-6 grid grid-cols-2 gap-4 items-center">
            <div>
              <p><span className="font-semibold">Belge Türü:</span> WPS Spesifikasyonu</p>
              <p><span className="font-semibold">WPS No:</span> {wpsData.wps_code}</p>
              <p><span className="font-semibold">Parça Kodu:</span> {wpsData.part_code}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Yazdırılma:</span> {today} {now}</p>
              <p><span className="font-semibold">Sistem:</span> AYD Kaynak Teknolojileri Yönetim Sistemi</p>
              <p><span className="font-semibold">Güncelleme:</span> {new Date(wpsData.updated_at || wpsData.created_at).toLocaleDateString('tr-TR')}</p>
            </div>
          </section>
    
          <section className="mb-6">
            <h2 className="text-lg font-bold text-white bg-blue-800 p-2 rounded-t-md">1. TEMEL BİLGİLER</h2>
            <table className="w-full border-collapse border border-gray-300">
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
    
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white bg-red-700 p-2 rounded-t-md">2. ROBOT PARAMETRELERİ</h2>
            <table className="w-full border-collapse border border-gray-300">
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
    
          <section className="signature-section">
            <h2 className="text-lg font-bold text-white bg-gray-700 p-2 rounded-t-md">3. İMZA VE ONAY</h2>
            <div className="grid grid-cols-3 gap-8 pt-4 pb-4 border border-t-0 border-gray-300 rounded-b-md text-center">
              {signatureFields.map((field, index) => (
                <div key={index} className="signature-box">
                  <p className="font-bold mb-12">{field.title.toUpperCase()}</p>
                  <p className="border-t border-gray-400 mx-4 pt-1">{field.name || 'Ad Soyad'}</p>
                  <p className="text-sm text-gray-600">{field.role || ' '}</p>
                </div>
              ))}
            </div>
          </section>
    
          <footer className="print-footer text-xs text-gray-500 flex justify-between items-center mt-auto pt-4">
            <span>AYD Kaynak Yönetimi - WPS Sistemi</span>
            <span>Yazdırılma: {today} {now}</span>
            <span>Sayfa 1/1</span>
          </footer>
        </div>
      );
    };
    
    const ExamPrintLayout = ({ examData }) => {
      const today = new Date().toLocaleDateString('tr-TR');
      const totalPoints = examData.questions.reduce((acc, q) => acc + q.points, 0);
    
      return (
        <div className="print-container bg-white text-gray-800 font-sans w-[210mm] min-h-[297mm] p-8 flex flex-col">
            <header className="flex justify-between items-center mb-6 border-b-2 border-blue-800 pb-4">
                <div className="text-left">
                    <h1 className="text-2xl font-bold text-blue-900">Eğitim Değerlendirme Sınavı</h1>
                    <p className="text-lg text-gray-700 mt-1">{examData.trainingName}</p>
                </div>
                <img src="https://horizons-cdn.hostinger.com/42102681-7ddc-4184-98a5-73d4f6325bfd/ada2181c81988ef298490de9a3c6d391.png" alt="AYD Logo" className="h-14" />
            </header>
    
          <section className="border border-gray-300 rounded-lg p-4 mb-6 text-sm bg-gray-50">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex items-center gap-2"><label className="font-semibold w-20">Ad Soyad:</label><div className="flex-1 border-b border-gray-400"></div></div>
              <div className="flex items-center gap-2"><label className="font-semibold w-20">Tarih:</label><div className="flex-1 border-b border-gray-400"></div></div>
              <div className="flex items-center gap-2"><label className="font-semibold w-20">Sicil No:</label><div className="flex-1 border-b border-gray-400"></div></div>
              <div className="flex items-center gap-2"><label className="font-semibold w-20">İmza:</label><div className="flex-1 border-b border-gray-400"></div></div>
            </div>
          </section>
    
          <section className="mb-6 flex-grow">
            <div className="flex justify-between items-center bg-blue-100 text-blue-900 p-2 rounded-md mb-4">
              <h3 className="text-lg font-bold">Sorular</h3>
              <span className="font-semibold">Toplam Puan: {totalPoints}</span>
            </div>
            <div className="space-y-6">
              {examData.questions.map((q, index) => (
                <div key={q.id} className="text-sm border-b pb-4">
                  <p className="font-semibold mb-3 text-base">{index + 1}. {q.question_text} <span className="font-normal text-gray-600">({q.points} Puan)</span></p>
                  {q.question_type === 'çoktan seçmeli' && (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-4">
                      {q.options.map((opt, i) => (
                        <div key={i} className="flex items-center">
                          <span className="text-base font-semibold mr-2">{String.fromCharCode(65 + i)})</span>
                          <span className="text-base">{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.question_type === 'doğru/yanlış' && (
                     <div className="flex items-center space-x-8 pl-4">
                       <div className="flex items-center"><span className="text-base font-semibold mr-2">A)</span><span className="text-base">Doğru</span></div>
                       <div className="flex items-center"><span className="text-base font-semibold mr-2">B)</span><span className="text-base">Yanlış</span></div>
                     </div>
                  )}
                  {q.question_type === 'açık uçlu' && (
                    <div className="mt-2 border-b-2 border-dotted h-20"></div>
                  )}
                </div>
              ))}
            </div>
          </section>
            <div className="text-center mt-8">
                <p className="text-lg font-bold">Alınan Puan:</p>
                <div className="w-32 h-16 border-2 border-gray-400 mx-auto mt-2"></div>
            </div>
          <footer className="print-footer text-xs text-gray-500 flex justify-between items-center mt-auto pt-4">
            <span>AYD Kaynak Yönetimi - Eğitim Sistemi</span>
            <span>Yazdırılma: {today}</span>
            <span>Sayfa 1/1</span>
          </footer>
        </div>
      );
    }
    
    const GeneralReportLayout = ({ reportData }) => {
      const today = new Date().toLocaleDateString('tr-TR');
      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
      return (
        <div className="print-container bg-white text-gray-800 font-sans w-[210mm] min-h-[297mm] p-8">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">AYD Kaynak Teknolojileri Yönetim Sistemi</h1>
            <p className="text-md text-gray-600">Kaynak Yönetim Sistemi</p>
          </header>
    
          <section className="border border-gray-300 rounded-lg p-4 mb-6 grid grid-cols-2 gap-4 items-center">
            <div>
              <p><span className="font-semibold">Belge Türü:</span> {reportData.title}</p>
              <p><span className="font-semibold">Rapor No:</span> {reportData.reportId}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Yazdırılma:</span> {today} {now}</p>
              <p><span className="font-semibold">Sistem:</span> AYD Kaynak Teknolojileri Yönetim Sistemi</p>
            </div>
          </section>
    
          {reportData.filters && (
            <section className="mb-6">
              <h2 className="text-lg font-bold text-white bg-gray-700 p-2 rounded-t-md">FİLTRELER</h2>
              <div className="border border-t-0 p-4 rounded-b-md grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(reportData.filters).map(([key, value]) => (
                  <div key={key}>
                    <p className="font-semibold text-sm">{key}</p>
                    <p className="text-gray-600 text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
    
          {reportData.kpiCards && (
            <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {reportData.kpiCards.map((card, index) => (
                <div key={index} className="p-4 border rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{card.value}</p>
                  <p className="text-sm text-gray-600">{card.title}</p>
                </div>
              ))}
            </section>
          )}
    
          {reportData.singleItemData && (
            <section className="mb-6">
              <h2 className="text-lg font-bold text-white bg-blue-800 p-2 rounded-t-md">DETAYLAR</h2>
              <table className="w-full border-collapse border border-gray-300">
                <tbody>
                  {Object.entries(reportData.singleItemData).map(([key, value]) => (
                    <tr key={key} className="border-b border-gray-200">
                      <td className="p-2 font-semibold bg-gray-50 w-1/3">{key}</td>
                      <td className="p-2">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          
          {reportData.attachments && reportData.attachments.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-bold text-white bg-green-700 p-2 rounded-t-md">KANIT DOKÜMANLARI</h2>
              <div className="border border-t-0 p-4 rounded-b-md">
                <ul className="list-disc pl-5 space-y-1">
                  {reportData.attachments.map((file, index) => (
                    <li key={index}>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{file.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
    
          {reportData.tableData && (
            <section className="mb-6">
              <h2 className="text-lg font-bold text-white bg-red-700 p-2 rounded-t-md">VERİ TABLOSU</h2>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    {reportData.tableData.headers.map((header, index) => (
                      <th key={index} className="p-2 border text-left font-semibold">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.tableData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="p-2 border">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
    
          {reportData.signatureFields && (
            <section className="signature-section mt-8">
              <h2 className="text-lg font-bold text-white bg-gray-700 p-2 rounded-t-md">İMZA VE ONAY</h2>
              <div className="grid grid-cols-3 gap-8 pt-4 pb-4 border border-t-0 border-gray-300 rounded-b-md text-center">
                {reportData.signatureFields.map((field, index) => (
                  <div key={index} className="signature-box">
                    <p className="font-bold mb-12">{field.title.toUpperCase()}</p>
                    <p className="border-t border-gray-400 mx-4 pt-1">{field.name || 'Ad Soyad'}</p>
                    <p className="text-sm text-gray-600">{field.role || ' '}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
    
          <footer className="print-footer text-xs text-gray-500 flex justify-between items-center mt-auto pt-4">
            <span>AYD Kaynak Yönetimi - Raporlama Sistemi</span>
            <span>Yazdırılma: {today} {now}</span>
            <span>Sayfa 1/1</span>
          </footer>
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
            } else {
              setPageClass('page-portrait');
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
    
      return (
        <>
          <div className="print-controls no-print fixed top-4 right-4 flex flex-col gap-2">
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Yazdır</Button>
            <Button variant="secondary" onClick={() => window.close()}>Kapat</Button>
          </div>
          <div className={`print-area ${pageClass}`}>
            {renderLayout()}
          </div>
          <style jsx global>{`
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              @media screen {
                body {
                  background-color: #f0f0f0;
                }
                .print-area {
                  display: flex;
                  justify-content: center;
                  align-items: flex-start;
                  padding: 2rem 0;
                }
                .print-container {
                  transform-origin: top center;
                  box-shadow: 0 0 20px rgba(0,0,0,0.15);
                  border: 1px solid #ccc;
                }
                .page-portrait .print-container {
                  transform: scale(0.9);
                }
                .page-landscape .print-container {
                  transform: scale(0.75);
                }
              }
              
              @page {
                  margin: 0;
              }
              
              @media print {
                  .no-print {
                      display: none !important;
                  }
                  body {
                    background: white !important;
                  }

                  .page-portrait {
                    @page { size: A4 portrait; }
                  }

                  .page-landscape {
                     @page { size: A4 landscape; }
                  }
              
                  .print-area {
                    width: 100%;
                    height: 100%;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                  }
                  
                  .print-container {
                      position: absolute;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      box-shadow: none;
                      border: none;
                      border-radius: 0;
                      transform: scale(1);
                      overflow: hidden !important;
                  }
              }
          `}</style>
        </>
      );
    };
    
    export default PrintPage;