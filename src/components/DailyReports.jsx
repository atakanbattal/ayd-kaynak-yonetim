import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download, FileText, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const DailyReports = () => {
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateReport = async () => {
    setLoading(true);
    
    const { data: productionRecords, error: recordsError } = await supabase
      .from('production_records')
      .select('*, robots(name)')
      .gte('record_date', dateFrom)
      .lte('record_date', dateTo);

    if (recordsError) {
      toast({ title: "Rapor Hatası", description: recordsError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: partCosts, error: costsError } = await supabase.from('part_costs').select('*');
    if (costsError) {
      toast({ title: "Maliyet Verisi Hatası", description: costsError.message, variant: "destructive" });
    }

    if (productionRecords.length === 0) {
      setReportData(null);
      setLoading(false);
      toast({ title: "Veri Bulunamadı", description: "Seçilen tarih aralığı için üretim kaydı bulunamadı.", variant: "destructive" });
      return;
    }

    const summary = {
      totalQuantity: productionRecords.reduce((sum, r) => sum + r.quantity, 0),
      totalCost: 0,
      totalRecords: productionRecords.length,
      averageCostPerPart: 0
    };

    const partBreakdown = {};
    const robotBreakdown = {};

    productionRecords.forEach(record => {
      const costInfo = partCosts.find(pc => pc.part_code === record.part_code);
      const cost = costInfo ? costInfo.calculations.totalCost * record.quantity : 0;
      summary.totalCost += cost;

      if (!partBreakdown[record.part_code]) {
        partBreakdown[record.part_code] = { partCode: record.part_code, quantity: 0, cost: 0 };
      }
      partBreakdown[record.part_code].quantity += record.quantity;
      partBreakdown[record.part_code].cost += cost;

      const robotName = record.robots?.name || 'Bilinmeyen Robot';
      if (!robotBreakdown[robotName]) {
        robotBreakdown[robotName] = { robot: robotName, quantity: 0, cost: 0 };
      }
      robotBreakdown[robotName].quantity += record.quantity;
      robotBreakdown[robotName].cost += cost;
    });

    summary.averageCostPerPart = summary.totalQuantity > 0 ? summary.totalCost / summary.totalQuantity : 0;

    const finalPartBreakdown = Object.values(partBreakdown).map(p => ({
      ...p,
      percentage: summary.totalCost > 0 ? (p.cost / summary.totalCost) * 100 : 0
    })).sort((a, b) => b.cost - a.cost);

    setReportData({
      summary,
      partBreakdown: finalPartBreakdown,
      robotBreakdown: Object.values(robotBreakdown).sort((a, b) => b.cost - a.cost),
    });

    setLoading(false);
  };

  const handleExport = (type) => {
    toast({
      title: `${type} Oluşturuluyor`,
      description: `🚧 ${type} export özelliği henüz uygulanmadı—ama merak etme! Bir sonraki istekte talep edebilirsin! 🚀`,
    });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2"><BarChart3 className="h-5 w-5" /><span>Günlük Raporlar</span></CardTitle>
            <CardDescription>Üretim verilerini analiz edin ve detaylı raporlar oluşturun</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2"><Label htmlFor="dateFrom">Başlangıç Tarihi</Label><Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="dateTo">Bitiş Tarihi</Label><Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
                <div className="flex space-x-2"><Button onClick={generateReport} disabled={loading} className="flex-1">{loading ? 'Oluşturuluyor...' : 'Rapor Oluştur'}</Button></div>
              </div>
            </div>

            {!reportData && !loading && (
              <div className="text-center py-12 text-gray-500"><Info className="h-8 w-8 mx-auto mb-2" /><p>Rapor oluşturmak için tarih aralığı seçin ve butona tıklayın.</p><p className="text-xs mt-2">Eğer veri bulunamazsa, ilgili modüllerden (Üretim İzleme, Parça Maliyeti) kayıt eklediğinizden emin olun.</p></div>
            )}

            {reportData && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{reportData.summary.totalQuantity.toLocaleString('tr-TR')}</p><p className="text-sm text-gray-600">Toplam Adet</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{reportData.summary.totalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 })}</p><p className="text-sm text-gray-600">Toplam Maliyet</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-purple-600">{reportData.summary.totalRecords}</p><p className="text-sm text-gray-600">Toplam Kayıt</p></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-orange-600">{reportData.summary.averageCostPerPart.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</p><p className="text-sm text-gray-600">Ort. Parça Maliyeti</p></CardContent></Card>
                </div>

                <div className="flex space-x-4"><Button onClick={() => handleExport('PDF')} variant="outline"><FileText className="h-4 w-4 mr-2" />PDF İndir</Button><Button onClick={() => handleExport('Excel')} variant="outline"><Download className="h-4 w-4 mr-2" />Excel İndir</Button></div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card><CardHeader><CardTitle className="text-lg">Parça Bazlı Dağılım</CardTitle></CardHeader><CardContent><div className="space-y-4">{reportData.partBreakdown.map((part, index) => (<div key={index} className="space-y-2"><div className="flex justify-between items-center"><span className="font-medium">{part.partCode}</span><span className="text-sm text-gray-500">{part.percentage.toFixed(1)}%</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${part.percentage}%` }} /></div><div className="flex justify-between text-sm text-gray-600"><span>{part.quantity} adet</span><span>{part.cost.toLocaleString('tr-TR')} ₺</span></div></div>))}</div></CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-lg">Robot Performansı</CardTitle></CardHeader><CardContent><div className="space-y-4">{reportData.robotBreakdown.map((robot, index) => (<div key={index} className="p-4 border rounded-lg"><div className="flex justify-between items-center mb-2"><span className="font-medium">{robot.robot}</span></div><div className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-gray-600">Üretim:</p><p className="font-medium">{robot.quantity} adet</p></div><div><p className="text-gray-600">Maliyet:</p><p className="font-medium">{robot.cost.toLocaleString('tr-TR')} ₺</p></div></div></div>))}</div></CardContent></Card>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default DailyReports;