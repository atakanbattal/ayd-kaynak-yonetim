import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Calculator, Save, Trash2, Plus, Eye, Search, Calendar as CalendarIcon, Filter, X, Edit, TrendingUp, AlertCircle, Package, FileText, Download, BarChart3 } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { logAction, formatCurrency, openPrintWindow } from '@/lib/utils';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { format, startOfMonth, endOfMonth, parseISO, startOfYear, endOfYear } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

    const DailyRecordForm = ({ onSave, productionLines, initialData }) => {
      const [productionDate, setProductionDate] = useState(initialData?.productionDate || new Date().toISOString().split('T')[0]);
      const [rows, setRows] = useState(initialData?.rows || [{ part_code: '', welding_time: '', quantity: '', scrap_count: '', production_line_id: '' }]);
      const isEditing = !!initialData;

      const handleRowChange = (index, field, value) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
      };

      const addRow = () => {
        setRows([...rows, { part_code: '', welding_time: '', quantity: '', scrap_count: '', production_line_id: '' }]);
      };

      const removeRow = (index) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
      };

      const handleSaveClick = () => {
        onSave({ productionDate, rows });
      };

      const isSaveDisabled = useMemo(() => {
        if (!productionDate) return true;
        
        const validRows = rows.filter(r => r.part_code && r.quantity && r.scrap_count && r.welding_time && r.production_line_id);
        if (validRows.length === 0) return true;
        
        const hasInvalidRow = rows.some(r => 
            (r.part_code || r.quantity || r.scrap_count || r.welding_time) && 
            !(r.part_code && r.quantity && r.scrap_count && r.welding_time && r.production_line_id)
        );
        if (hasInvalidRow) return true;

        return false;
      }, [rows, productionDate]);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productionDate">Üretim Tarihi *</Label>
              <Input id="productionDate" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-2 border-t border-b py-4">
            <div className="grid grid-cols-12 gap-2 items-center px-1 text-xs font-medium text-gray-500">
                <div className="col-span-3">Parça Kodu *</div>
                <div className="col-span-3">Üretim Hattı *</div>
                <div className="col-span-2">Kaynak Süresi (sn) *</div>
                <div className="col-span-2">Üretilen Adet *</div>
                <div className="col-span-1">Hurda *</div>
            </div>
            {rows.map((row, index) => (
              <motion.div key={index} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-3" placeholder="Parça Kodu" value={row.part_code} onChange={(e) => handleRowChange(index, 'part_code', e.target.value)} />
                <div className="col-span-3">
                  <Select value={row.production_line_id} onValueChange={(value) => handleRowChange(index, 'production_line_id', value)}>
                    <SelectTrigger><SelectValue placeholder="Hat seçin" /></SelectTrigger>
                    <SelectContent>{productionLines.map((line) => <SelectItem key={line.id} value={line.id.toString()}>{line.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input className="col-span-2" type="number" placeholder="Süre (sn)" value={row.welding_time} onChange={(e) => handleRowChange(index, 'welding_time', e.target.value)} />
                <Input className="col-span-2" type="number" placeholder="Adet" value={row.quantity} onChange={(e) => handleRowChange(index, 'quantity', e.target.value)} />
                <Input className="col-span-1" type="number" placeholder="Hurda" value={row.scrap_count} onChange={(e) => handleRowChange(index, 'scrap_count', e.target.value)} />
                <Button variant="ghost" size="icon" onClick={() => removeRow(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-4">
            <Button variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-2" />Satır Ekle</Button>
            <Button onClick={handleSaveClick} disabled={isSaveDisabled}><Save className="h-4 w-4 mr-2" />{isEditing ? 'Değişiklikleri Kaydet' : 'Tümünü Kaydet'}</Button>
          </div>
        </div>
      );
    };

    const PartCost = () => {
      const [dailyRecords, setDailyRecords] = useState([]);
      const [productionLines, setProductionLines] = useState([]);
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [editingRecord, setEditingRecord] = useState(null);
      const [viewingRecord, setViewingRecord] = useState(null);
      const [detailedRecordData, setDetailedRecordData] = useState([]);
      const [recordToDelete, setRecordToDelete] = useState(null);
      const { toast } = useToast();
      const { user } = useAuth();

      const [filters, setFilters] = useState({
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
        searchTerm: ''
      });

      const fetchDailyRecords = async () => {
        let query = supabase.from('daily_production_summary').select('*');
        
        const fromDate = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const toDate = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd');

        query = query.gte('production_date', fromDate).lte('production_date', toDate);

        const { data, error } = await query.order('production_date', { ascending: false });

        if (error) {
          console.error("Daily records fetch error:", error);
          toast({ title: "Kayıtlar Yüklenemedi", description: "Günlük özet verileri çekilirken bir hata oluştu.", variant: "destructive" });
        } else {
          setDailyRecords(data);
        }
      };

      const fetchProductionLines = async () => {
        const { data, error } = await supabase.from('lines').select('id, name');
        if (error) {
          console.error("Lines fetch error:", error);
          toast({ title: "Hatlar Yüklenemedi", description: "Üretim hatları verisi çekilirken bir hata oluştu.", variant: "destructive" });
        } else {
          setProductionLines(data);
        }
      };

      useEffect(() => {
        fetchProductionLines();
      }, []);

      useEffect(() => {
        fetchDailyRecords();
      }, [filters.dateRange]);

      const handleSave = async ({ productionDate, rows }) => {
        if (!productionDate) {
          toast({ title: "Eksik Bilgi", description: "Üretim Tarihi zorunludur.", variant: "destructive" });
          return;
        }
        const validRows = rows.filter(r => r.part_code && r.quantity && r.scrap_count && r.welding_time && r.production_line_id);
        if (validRows.length === 0) {
          toast({ title: "Veri Yok", description: "Kaydedilecek geçerli bir satır bulunamadı. Her satırda hat seçimi zorunludur.", variant: "destructive" });
          return;
        }

        const recordsToSave = validRows.map(row => ({
          part_code: row.part_code,
          welding_time: Number(row.welding_time),
          quantity: Number(row.quantity),
          scrap_count: Number(row.scrap_count),
          production_line_id: row.production_line_id,
          production_date: productionDate,
          user_id: user.id
        }));

        let recordsToDelete = [];
        if (editingRecord && editingRecord.productionDate) {
            recordsToDelete = editingRecord.rows.map(r => r.id).filter(Boolean);
        }
        
        if(recordsToDelete.length > 0) {
            const { error: deleteError } = await supabase.from('part_costs').delete().in('id', recordsToDelete);
            if (deleteError) {
                toast({ title: "Güncelleme Hatası", description: `Eski kayıtlar silinemedi: ${deleteError.message}`, variant: "destructive" });
                return;
            }
        }

        const { error } = await supabase.from('part_costs').insert(recordsToSave);

        if (error) {
          toast({ title: "Kayıt Başarısız", description: error.message, variant: "destructive" });
        } else {
          toast({ title: editingRecord ? "Günlük Kayıt Güncellendi" : "Günlük Üretim Kaydedildi" });
          logAction(editingRecord ? 'UPDATE_DAILY_PRODUCTION' : 'SAVE_DAILY_PRODUCTION', `${productionDate} tarihi için ${validRows.length} kalem kayıt.`, user);
          setIsFormOpen(false);
          setEditingRecord(null);
          fetchDailyRecords();
        }
      };

      const handleViewDetails = async (record) => {
        if (!record || !record.production_date) {
            toast({ title: "Geçersiz Kayıt", description: "Detayları görüntülemek için geçerli bir kayıt seçilmelidir.", variant: "destructive" });
            return;
        }
        setViewingRecord(record);
        const { data, error } = await supabase
          .from('v_part_costs')
          .select('*')
          .eq('production_date', record.production_date);

        if (error) {
          toast({ title: "Detaylar Yüklenemedi", description: error.message, variant: "destructive" });
          setDetailedRecordData([]);
        } else {
          setDetailedRecordData(data);
        }
      };

      const handleEdit = async (record) => {
        if (!record || !record.production_date) {
            toast({ title: "Geçersiz Kayıt", description: "Düzenlemek için geçerli bir kayıt seçilmelidir.", variant: "destructive" });
            return;
        }
        const { data, error } = await supabase.from('part_costs').select('*').eq('production_date', record.production_date);
        if (error) {
          toast({ title: "Düzenleme için veri alınamadı", description: error.message, variant: "destructive" });
          return;
        }
        setEditingRecord({
          productionDate: record.production_date,
          rows: data.map(r => ({...r, production_line_id: r.production_line_id.toString()}))
        });
        setIsFormOpen(true);
      };

      const handleDelete = async () => {
        if (!recordToDelete || !recordToDelete.production_date) return;
        const { error } = await supabase.from('part_costs').delete().eq('production_date', recordToDelete.production_date);
        if (error) {
          toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Günlük Kayıt Silindi", variant: "destructive" });
          logAction('DELETE_DAILY_PRODUCTION', `${recordToDelete.production_date} tarihli kayıt silindi.`, user);
          fetchDailyRecords();
        }
        setRecordToDelete(null);
      };

      const handlePrint = async (item) => {
        const reportId = `RPR-DP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const reportData = {
          title: 'Günlük Üretim Raporu',
          reportId,
          signatureFields: [
            { title: 'Hazırlayan', name: 'Tuğçe MAVİ BATTAL', role: ' ' },
            { title: 'Kontrol Eden', name: '', role: '..................' },
            { title: 'Onaylayan', name: '', role: '..................' }
          ]
        };

        if (item) {
          const { data, error } = await supabase.from('v_part_costs').select('*').eq('production_date', item.production_date);
          if (error) {
            toast({ title: "Rapor Verisi Alınamadı", description: error.message, variant: "destructive" });
            return;
          }
          reportData.title = `${new Date(item.production_date).toLocaleDateString('tr-TR')} Üretim Raporu`;
          reportData.kpiCards = [
            { title: 'Toplam Üretim', value: item.total_quantity },
            { title: 'Toplam Hurda', value: item.total_scrap },
            { title: 'PPM', value: Math.round(item.ppm) },
            { title: 'Hurda Maliyeti', value: formatCurrency(item.total_scrap_cost) },
          ];
          reportData.tableData = {
            headers: ['Parça Kodu', 'Hat', 'Kaynak Süresi (sn)', 'Üretilen Adet', 'Hurda Adedi', 'Üretim Maliyeti', 'Hurda Maliyeti'],
            rows: data.map(d => [
              d.part_code,
              d.line_name,
              d.welding_time,
              d.quantity,
              d.scrap_count,
              formatCurrency(d.production_cost),
              formatCurrency(d.scrap_cost)
            ])
          };
        } else {
          reportData.filters = {
            Dönem: `${format(filters.dateRange.from, 'dd.MM.yy')} - ${format(filters.dateRange.to, 'dd.MM.yy')}`,
            'Aranan Terim': filters.searchTerm || 'Yok'
          };
          reportData.tableData = {
            headers: ['Tarih', 'Çalışılan Hatlar', 'Toplam Üretim', 'PPM', 'Üretim Maliyeti', 'Hurda Maliyeti'],
            rows: filteredRecords.map(r => [
              new Date(r.production_date).toLocaleDateString('tr-TR'),
              Array.from(r.lines).join(', '),
              r.total_quantity,
              Math.round(r.ppm),
              formatCurrency(r.total_production_cost),
              formatCurrency(r.total_scrap_cost)
            ])
          };
        }

        await openPrintWindow(reportData, toast);
      };

      const handleGenerateDetailedReport = async () => {
        try {
          toast({ title: "Detaylı üretim raporu hazırlanıyor...", description: "Tüm veriler toplanıyor." });

          const dateFrom = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd');
          const dateTo = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd');

          // Tüm detaylı verileri çek
          const [dailyRecordsData, linesData, partCostsData] = await Promise.all([
            supabase.from('daily_production_summary')
              .select('*')
              .gte('production_date', dateFrom)
              .lte('production_date', dateTo)
              .order('production_date', { ascending: false }),
            supabase.from('lines').select('*').eq('deleted', false),
            supabase.from('v_part_costs')
              .select('*')
              .gte('production_date', dateFrom)
              .lte('production_date', dateTo)
          ]);

          const allDailyRecords = dailyRecordsData.data || [];
          const allLines = linesData.data || [];
          const allPartCosts = partCostsData.data || [];

          // Filtrelenmiş veriler
          const filteredDaily = allDailyRecords.filter(record => {
            const lineNames = Array.from(record.lines || []).join(', ').toLowerCase();
            return filters.searchTerm === '' || lineNames.includes(filters.searchTerm.toLowerCase());
          });

          const totalProduction = filteredDaily.reduce((acc, p) => acc + (p.total_quantity || 0), 0);
          const totalScrap = filteredDaily.reduce((acc, p) => acc + (p.total_scrap || 0), 0);
          const totalProductionCost = filteredDaily.reduce((acc, p) => acc + (p.total_production_cost || 0), 0);
          const totalScrapCost = filteredDaily.reduce((acc, p) => acc + (p.total_scrap_cost || 0), 0);
          const avgPPM = filteredDaily.length > 0 
            ? filteredDaily.reduce((acc, p) => acc + (p.ppm || 0), 0) / filteredDaily.length 
            : 0;

          // Parça bazlı analiz
          const byPart = allPartCosts.reduce((acc, p) => {
            const partCode = p.part_code || 'Bilinmeyen';
            if (!acc[partCode]) {
              acc[partCode] = { quantity: 0, scrap: 0, cost: 0, scrapCost: 0, days: new Set() };
            }
            acc[partCode].quantity += p.quantity || 0;
            acc[partCode].scrap += p.scrap_count || 0;
            acc[partCode].cost += p.production_cost || 0;
            acc[partCode].scrapCost += p.scrap_cost || 0;
            acc[partCode].days.add(p.production_date);
            return acc;
          }, {});

          // Hat bazlı analiz
          const byLine = allPartCosts.reduce((acc, p) => {
            const lineName = p.line_name || 'Bilinmeyen';
            if (!acc[lineName]) {
              acc[lineName] = { quantity: 0, scrap: 0, cost: 0, scrapCost: 0, parts: new Set() };
            }
            acc[lineName].quantity += p.quantity || 0;
            acc[lineName].scrap += p.scrap_count || 0;
            acc[lineName].cost += p.production_cost || 0;
            acc[lineName].scrapCost += p.scrap_cost || 0;
            acc[lineName].parts.add(p.part_code);
            return acc;
          }, {});

          // Top/Bottom analizler
          const top10PartsByQuantity = Object.entries(byPart)
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

          const top10PartsByCost = Object.entries(byPart)
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10);

          const top10PartsByScrap = Object.entries(byPart)
            .map(([code, data]) => ({ code, ...data, ppm: data.quantity > 0 ? (data.scrap * 1000000) / (data.quantity + data.scrap) : 0 }))
            .sort((a, b) => b.scrap - a.scrap)
            .slice(0, 10);

          const top10LinesByQuantity = Object.entries(byLine)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

          const top10LinesByCost = Object.entries(byLine)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10);

          const top10LinesByScrapCost = Object.entries(byLine)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.scrapCost - a.scrapCost)
            .slice(0, 10);

          const reportId = `RPR-PC-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const reportData = {
            title: 'Günlük Üretim ve Maliyet - Detaylı Yönetici Raporu',
            reportId,
            filters: {
              'Rapor Dönemi': `${format(filters.dateRange?.from || startOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange?.to || endOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr })}`,
              'Arama Terimi': filters.searchTerm || 'Yok',
              'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
              'Toplam Gün': Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1 + ' gün'
            },
            kpiCards: [
              { title: 'Toplam Üretim', value: totalProduction.toLocaleString('tr-TR') + ' adet' },
              { title: 'Toplam Hurda', value: totalScrap.toLocaleString('tr-TR') + ' adet' },
              { title: 'Hurda Oranı', value: totalProduction > 0 ? `${((totalScrap / (totalProduction + totalScrap)) * 100).toFixed(2)}%` : '0%' },
              { title: 'Ortalama PPM', value: Math.round(avgPPM).toString() },
              { title: 'Toplam Üretim Maliyeti', value: formatCurrency(totalProductionCost) },
              { title: 'Toplam Hurda Maliyeti', value: formatCurrency(totalScrapCost) },
              { title: 'Ortalama Günlük Üretim', value: Math.round(totalProduction / Math.max(1, filteredDaily.length)).toLocaleString('tr-TR') + ' adet' },
              { title: 'Ortalama Günlük Hurda', value: Math.round(totalScrap / Math.max(1, filteredDaily.length)).toLocaleString('tr-TR') + ' adet' },
              { title: 'Çalışılan Gün Sayısı', value: filteredDaily.length.toString() },
              { title: 'Farklı Parça Sayısı', value: Object.keys(byPart).length.toString() },
              { title: 'Çalışılan Hat Sayısı', value: Object.keys(byLine).length.toString() },
              { title: 'Ortalama Günlük Maliyet', value: formatCurrency(totalProductionCost / Math.max(1, filteredDaily.length)) }
            ],
            tableData: {
              headers: ['Tarih', 'Parça Kodu', 'Hat', 'Kaynak Süresi (sn)', 'Üretilen Adet', 'Hurda Adedi', 'Üretim Maliyeti', 'Hurda Maliyeti', 'PPM'],
              rows: allPartCosts.map(d => [
                new Date(d.production_date).toLocaleDateString('tr-TR'),
                d.part_code || 'N/A',
                d.line_name || 'N/A',
                d.welding_time || '0',
                (d.quantity || 0).toString(),
                (d.scrap_count || 0).toString(),
                formatCurrency(d.production_cost || 0),
                formatCurrency(d.scrap_cost || 0),
                d.ppm ? Math.round(d.ppm).toString() : '0'
              ])
            },
            signatureFields: [
              { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
              { title: 'Kontrol Eden', name: '', role: '..................' },
              { title: 'Onaylayan', name: '', role: '..................' }
            ]
          };

          // Top 10 Parçalar (Adet)
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 PARÇA (EN ÇOK ÜRETİLEN)', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Parça Kodu', 'Toplam Adet', 'Hurda Adedi', 'Üretim Maliyeti', 'Hurda Maliyeti', 'PPM', 'Çalışılan Gün', ''],
            ...top10PartsByQuantity.map((part, index) => [
              (index + 1).toString(),
              part.code,
              part.quantity.toLocaleString('tr-TR'),
              part.scrap.toLocaleString('tr-TR'),
              formatCurrency(part.cost),
              formatCurrency(part.scrapCost),
              part.quantity > 0 ? Math.round((part.scrap * 1000000) / (part.quantity + part.scrap)).toString() : '0',
              part.days.size.toString(),
              ''
            ])
          );

          // Top 10 Parçalar (Maliyet)
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 PARÇA (EN YÜKSEK MALİYET)', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Parça Kodu', 'Toplam Maliyet', 'Toplam Adet', 'Hurda Maliyeti', 'Hurda Adedi', 'PPM', '', ''],
            ...top10PartsByCost.map((part, index) => [
              (index + 1).toString(),
              part.code,
              formatCurrency(part.cost),
              part.quantity.toLocaleString('tr-TR'),
              formatCurrency(part.scrapCost),
              part.scrap.toLocaleString('tr-TR'),
              part.quantity > 0 ? Math.round((part.scrap * 1000000) / (part.quantity + part.scrap)).toString() : '0',
              '', ''
            ])
          );

          // Top 10 Parçalar (Hurda)
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 PARÇA (EN ÇOK HURDA)', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Parça Kodu', 'Hurda Adedi', 'Toplam Adet', 'Hurda Maliyeti', 'PPM', 'Hurda Oranı', '', ''],
            ...top10PartsByScrap.map((part, index) => [
              (index + 1).toString(),
              part.code,
              part.scrap.toLocaleString('tr-TR'),
              part.quantity.toLocaleString('tr-TR'),
              formatCurrency(part.scrapCost),
              Math.round(part.ppm).toString(),
              part.quantity > 0 ? `${((part.scrap / (part.quantity + part.scrap)) * 100).toFixed(2)}%` : '0%',
              '', ''
            ])
          );

          // Top 10 Hatlar (Adet)
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 HAT (EN ÇOK ÜRETİM)', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Hat Adı', 'Toplam Adet', 'Hurda Adedi', 'Üretim Maliyeti', 'Hurda Maliyeti', 'Farklı Parça', 'PPM', ''],
            ...top10LinesByQuantity.map((line, index) => [
              (index + 1).toString(),
              line.name,
              line.quantity.toLocaleString('tr-TR'),
              line.scrap.toLocaleString('tr-TR'),
              formatCurrency(line.cost),
              formatCurrency(line.scrapCost),
              line.parts.size.toString(),
              line.quantity > 0 ? Math.round((line.scrap * 1000000) / (line.quantity + line.scrap)).toString() : '0',
              ''
            ])
          );

          // Top 10 Hatlar (Maliyet)
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 HAT (EN YÜKSEK MALİYET)', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Hat Adı', 'Toplam Maliyet', 'Toplam Adet', 'Hurda Maliyeti', 'Farklı Parça', '', '', ''],
            ...top10LinesByCost.map((line, index) => [
              (index + 1).toString(),
              line.name,
              formatCurrency(line.cost),
              line.quantity.toLocaleString('tr-TR'),
              formatCurrency(line.scrapCost),
              line.parts.size.toString(),
              '', '', ''
            ])
          );

          // Top 10 Hatlar (Hurda Maliyeti)
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 HAT (EN YÜKSEK HURDA MALİYETİ)', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Hat Adı', 'Hurda Maliyeti', 'Hurda Adedi', 'Toplam Adet', 'Hurda Oranı', '', '', ''],
            ...top10LinesByScrapCost.map((line, index) => [
              (index + 1).toString(),
              line.name,
              formatCurrency(line.scrapCost),
              line.scrap.toLocaleString('tr-TR'),
              line.quantity.toLocaleString('tr-TR'),
              line.quantity > 0 ? `${((line.scrap / (line.quantity + line.scrap)) * 100).toFixed(2)}%` : '0%',
              '', '', ''
            ])
          );

          await openPrintWindow(reportData, toast);
        } catch (error) {
          console.error('Detaylı rapor hatası:', error);
          toast({
            title: "Rapor Oluşturulamadı",
            description: error.message || "Rapor oluşturulurken bir hata oluştu.",
            variant: "destructive"
          });
        }
      };

      const aggregatedDailyRecords = useMemo(() => {
        const dailyAggregates = dailyRecords.reduce((acc, record) => {
            const date = record.production_date;
            if (!acc[date]) {
                acc[date] = {
                    production_date: date,
                    total_quantity: 0,
                    total_scrap: 0,
                    total_production_cost: 0,
                    total_scrap_cost: 0,
                    ppm: 0,
                    lines: new Set()
                };
            }
            acc[date].total_quantity += record.total_quantity;
            acc[date].total_scrap += record.total_scrap;
            acc[date].total_production_cost += record.total_production_cost;
            acc[date].total_scrap_cost += record.total_scrap_cost;
            const lineName = productionLines.find(l => l.id === record.production_line_id)?.name;
            if(lineName) acc[date].lines.add(lineName);
            return acc;
        }, {});

        return Object.values(dailyAggregates).map(agg => {
            const total_items = agg.total_quantity + agg.total_scrap;
            agg.ppm = total_items > 0 ? (agg.total_scrap * 1000000) / total_items : 0;
            return agg;
        });
      }, [dailyRecords, productionLines]);

      const filteredRecords = useMemo(() => {
        return aggregatedDailyRecords.filter(record => {
          const lineNames = Array.from(record.lines).join(', ').toLowerCase();
          const searchMatch = filters.searchTerm === '' || lineNames.includes(filters.searchTerm.toLowerCase());
          return searchMatch;
        }).sort((a, b) => new Date(b.production_date) - new Date(a.production_date));
      }, [aggregatedDailyRecords, filters.searchTerm]);
      
      // Analiz verileri
      const analysisData = useMemo(() => {
        const from = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
        const to = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        
        const filtered = filteredRecords.filter(r => {
          const recordDate = format(parseISO(r.production_date), 'yyyy-MM-dd');
          return recordDate >= from && recordDate <= to;
        });
        
        // Hat bazlı analiz
        const byLine = {};
        dailyRecords.forEach(record => {
          if (!record.production_date) return;
          const recordDate = format(parseISO(record.production_date), 'yyyy-MM-dd');
          if (recordDate < from || recordDate > to) return;
          
          const lineId = record.production_line_id;
          const line = productionLines.find(l => l.id === lineId);
          const lineName = line?.name || 'Bilinmeyen';
          
          if (!byLine[lineId]) {
            byLine[lineId] = {
              lineId,
              lineName,
              totalQuantity: 0,
              totalScrap: 0,
              totalProductionCost: 0,
              totalScrapCost: 0,
              records: 0,
              parts: new Set()
            };
          }
          
          byLine[lineId].totalQuantity += record.total_quantity || 0;
          byLine[lineId].totalScrap += record.total_scrap || 0;
          byLine[lineId].totalProductionCost += record.total_production_cost || 0;
          byLine[lineId].totalScrapCost += record.total_scrap_cost || 0;
          byLine[lineId].records += 1;
          if (record.part_code) byLine[lineId].parts.add(record.part_code);
        });
        
        // Parça bazlı analiz
        const byPart = {};
        dailyRecords.forEach(record => {
          if (!record.production_date || !record.part_code) return;
          const recordDate = format(parseISO(record.production_date), 'yyyy-MM-dd');
          if (recordDate < from || recordDate > to) return;
          
          const partCode = record.part_code;
          if (!byPart[partCode]) {
            byPart[partCode] = {
              partCode,
              totalQuantity: 0,
              totalScrap: 0,
              totalProductionCost: 0,
              totalScrapCost: 0,
              records: 0,
              lines: new Set()
            };
          }
          
          byPart[partCode].totalQuantity += record.total_quantity || 0;
          byPart[partCode].totalScrap += record.total_scrap || 0;
          byPart[partCode].totalProductionCost += record.total_production_cost || 0;
          byPart[partCode].totalScrapCost += record.total_scrap_cost || 0;
          byPart[partCode].records += 1;
          const line = productionLines.find(l => l.id === record.production_line_id);
          if (line) byPart[partCode].lines.add(line.name);
        });
        
        // Aylık trend
        const monthlyTrend = {};
        filtered.forEach(record => {
          const month = format(parseISO(record.production_date), 'yyyy-MM');
          if (!monthlyTrend[month]) {
            monthlyTrend[month] = {
              month,
              totalQuantity: 0,
              totalScrap: 0,
              totalProductionCost: 0,
              totalScrapCost: 0,
              ppm: 0
            };
          }
          monthlyTrend[month].totalQuantity += record.total_quantity;
          monthlyTrend[month].totalScrap += record.total_scrap;
          monthlyTrend[month].totalProductionCost += record.total_production_cost;
          monthlyTrend[month].totalScrapCost += record.total_scrap_cost;
        });
        
        Object.keys(monthlyTrend).forEach(month => {
          const data = monthlyTrend[month];
          const totalItems = data.totalQuantity + data.totalScrap;
          data.ppm = totalItems > 0 ? (data.totalScrap * 1000000) / totalItems : 0;
          data.monthLabel = format(parseISO(month + '-01'), 'MMM yyyy', { locale: tr });
        });
        
        const monthlyTrendArray = Object.values(monthlyTrend)
          .sort((a, b) => a.month.localeCompare(b.month));
        
        // Top 10 hatlar
        const top10Lines = Object.values(byLine)
          .map(l => ({
            ...l,
            partCount: l.parts.size,
            ppm: (l.totalQuantity + l.totalScrap) > 0 ? (l.totalScrap * 1000000) / (l.totalQuantity + l.totalScrap) : 0
          }))
          .sort((a, b) => b.totalQuantity - a.totalQuantity)
          .slice(0, 10);
        
        // Top 10 parçalar
        const top10Parts = Object.values(byPart)
          .map(p => ({
            ...p,
            lineCount: p.lines.size,
            ppm: (p.totalQuantity + p.totalScrap) > 0 ? (p.totalScrap * 1000000) / (p.totalQuantity + p.totalScrap) : 0
          }))
          .sort((a, b) => b.totalQuantity - a.totalQuantity)
          .slice(0, 10);
        
        return {
          byLine,
          byPart,
          monthlyTrend: monthlyTrendArray,
          top10Lines,
          top10Parts,
          totalQuantity: filtered.reduce((sum, r) => sum + r.total_quantity, 0),
          totalScrap: filtered.reduce((sum, r) => sum + r.total_scrap, 0),
          totalProductionCost: filtered.reduce((sum, r) => sum + r.total_production_cost, 0),
          totalScrapCost: filtered.reduce((sum, r) => sum + r.total_scrap_cost, 0),
          avgPPM: filtered.length > 0 
            ? filtered.reduce((sum, r) => sum + r.ppm, 0) / filtered.length 
            : 0
        };
      }, [filteredRecords, dailyRecords, productionLines, filters.dateRange]);

      return (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center space-x-2"><Calculator className="h-5 w-5" /><span>Günlük Üretim ve Maliyet</span></CardTitle>
                    <CardDescription>Gün sonu üretim verilerini girin ve günlük PPM oranlarını takip edin.</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button onClick={() => { setEditingRecord(null); setIsFormOpen(true); }}><Plus className="h-4 w-4 mr-2" />Yeni Günlük Kayıt Ekle</Button>
                    <Button variant="outline" onClick={() => handlePrint()}><FileText className="h-4 w-4 mr-2" />Raporla</Button>
                    <Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="data" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="data">Veri Takip</TabsTrigger>
                    <TabsTrigger value="analysis"><BarChart3 className="h-4 w-4 mr-2" />Detaylı Analiz</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="data" className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                      <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Hat adına göre ara..." value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} className="pl-10" /></div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateRange?.from ? (
                              filters.dateRange.to ? (
                                <>
                                  {format(filters.dateRange.from, "dd LLL, y", { locale: tr })} -{" "}
                                  {format(filters.dateRange.to, "dd LLL, y", { locale: tr })}
                                </>
                              ) : (
                                format(filters.dateRange.from, "dd LLL, y", { locale: tr })
                              )
                            ) : (
                              <span>Tarih Aralığı Seç</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={filters.dateRange?.from}
                            selected={filters.dateRange}
                            onSelect={(range) => setFilters({ ...filters, dateRange: range })}
                            numberOfMonths={2}
                            locale={tr}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button variant="ghost" onClick={() => setFilters({ dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }, searchTerm: '' })}><X className="h-4 w-4 mr-2" />Temizle</Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Çalışılan Hatlar</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Toplam Üretim</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">PPM</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Üretim Maliyeti</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hurda Maliyeti</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th></tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredRecords.map(record => (
                            <tr key={record.production_date} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">{new Date(record.production_date).toLocaleDateString('tr-TR')}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm">{Array.from(record.lines).join(', ')}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold">{record.total_quantity}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-bold text-orange-600">{Math.round(record.ppm)}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">{formatCurrency(record.total_production_cost)}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">{formatCurrency(record.total_scrap_cost)}</td>
                              <td className="px-4 py-4 whitespace-nowrap text-right"><div className="flex justify-end space-x-1"><Button variant="ghost" size="sm" onClick={() => handleViewDetails(record)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleEdit(record)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handlePrint(record)}><FileText className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => setRecordToDelete(record)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredRecords.length === 0 && <p className="text-center text-gray-500 py-8">Filtrelerle eşleşen kayıt bulunamadı.</p>}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="analysis" className="space-y-6">
                    {/* Özet KPI Kartları */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Toplam Üretim</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-blue-700">{analysisData.totalQuantity.toLocaleString('tr-TR')}</div>
                          <p className="text-xs text-muted-foreground mt-1">adet</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-red-50 to-red-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Toplam Hurda</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-red-700">{analysisData.totalScrap.toLocaleString('tr-TR')}</div>
                          <p className="text-xs text-muted-foreground mt-1">adet</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Üretim Maliyeti</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-green-700">{formatCurrency(analysisData.totalProductionCost)}</div>
                          <p className="text-xs text-muted-foreground mt-1">toplam</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Ortalama PPM</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-orange-700">{Math.round(analysisData.avgPPM)}</div>
                          <p className="text-xs text-muted-foreground mt-1">milyonda hata</p>
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Aylık Trend */}
                    {analysisData.monthlyTrend.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Aylık Üretim ve Hurda Trendi</CardTitle>
                          <CardDescription>Zaman içinde üretim, hurda ve maliyet trendleri</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={analysisData.monthlyTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="monthLabel" />
                              <YAxis yAxisId="left" />
                              <YAxis yAxisId="right" orientation="right" />
                              <Tooltip 
                                formatter={(value, name) => {
                                  if (name === 'totalProductionCost' || name === 'totalScrapCost') {
                                    return formatCurrency(value);
                                  }
                                  return value.toLocaleString('tr-TR');
                                }}
                              />
                              <Legend />
                              <Area yAxisId="left" type="monotone" dataKey="totalQuantity" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Üretim (adet)" />
                              <Area yAxisId="left" type="monotone" dataKey="totalScrap" stackId="2" stroke="#ef4444" fill="#ef4444" name="Hurda (adet)" />
                              <Line yAxisId="right" type="monotone" dataKey="ppm" stroke="#f97316" strokeWidth={2} name="PPM" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Hat Bazlı Analiz */}
                    {analysisData.top10Lines.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>Top 10 Hat - Üretim Bazlı</CardTitle>
                            <CardDescription>En çok üretim yapan hatlar</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                              <BarChart data={analysisData.top10Lines.map(l => ({
                                hat: l.lineName.length > 15 ? l.lineName.substring(0, 15) + '...' : l.lineName,
                                uretim: l.totalQuantity,
                                hurda: l.totalScrap,
                                uretimMaliyet: l.totalProductionCost,
                                hurdaMaliyet: l.totalScrapCost
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="hat" angle={-45} textAnchor="end" height={100} />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip 
                                  formatter={(value, name) => {
                                    if (name === 'uretimMaliyet' || name === 'hurdaMaliyet') {
                                      return formatCurrency(value);
                                    }
                                    return value.toLocaleString('tr-TR');
                                  }}
                                />
                                <Legend />
                                <Bar yAxisId="left" dataKey="uretim" fill="#3b82f6" name="Üretim (adet)" />
                                <Bar yAxisId="left" dataKey="hurda" fill="#ef4444" name="Hurda (adet)" />
                                <Bar yAxisId="right" dataKey="uretimMaliyet" fill="#10b981" name="Üretim Maliyeti (₺)" />
                                <Bar yAxisId="right" dataKey="hurdaMaliyet" fill="#f97316" name="Hurda Maliyeti (₺)" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle>Top 10 Hat Detayları</CardTitle>
                            <CardDescription>Hat bazında detaylı istatistikler</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {analysisData.top10Lines.map((line, index) => (
                                <div key={line.lineId} className="p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-bold text-blue-700">#{index + 1}</span>
                                      <p className="font-semibold">{line.lineName}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-blue-600">{line.totalQuantity.toLocaleString('tr-TR')} adet</p>
                                      <p className="text-xs text-gray-600">PPM: {Math.round(line.ppm)}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                                    <span>📋 {line.records} kayıt</span>
                                    <span>🔧 {line.partCount} parça</span>
                                    <span>💰 {formatCurrency(line.totalProductionCost)}</span>
                                    <span>❌ {formatCurrency(line.totalScrapCost)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    
                    {/* Parça Bazlı Analiz */}
                    {analysisData.top10Parts.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Top 10 Parça Bazlı Analiz</CardTitle>
                          <CardDescription>En çok üretilen parçalar ve hurda oranları</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={analysisData.top10Parts.map(p => ({
                              parca: p.partCode.length > 15 ? p.partCode.substring(0, 15) + '...' : p.partCode,
                              uretim: p.totalQuantity,
                              hurda: p.totalScrap,
                              ppm: Math.round(p.ppm)
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="parca" angle={-45} textAnchor="end" height={100} />
                              <YAxis yAxisId="left" />
                              <YAxis yAxisId="right" orientation="right" />
                              <Tooltip />
                              <Legend />
                              <Bar yAxisId="left" dataKey="uretim" fill="#3b82f6" name="Üretim (adet)" />
                              <Bar yAxisId="left" dataKey="hurda" fill="#ef4444" name="Hurda (adet)" />
                              <Line yAxisId="right" type="monotone" dataKey="ppm" stroke="#f97316" strokeWidth={2} name="PPM" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Hurda Maliyeti Analizi */}
                    {analysisData.monthlyTrend.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Hurda Maliyeti Trendi</CardTitle>
                          <CardDescription>Aylık bazda hurda maliyetleri ve üretim maliyetleri karşılaştırması</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={analysisData.monthlyTrend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="monthLabel" />
                              <YAxis />
                              <Tooltip 
                                formatter={(value, name) => {
                                  if (name === 'totalProductionCost' || name === 'totalScrapCost') {
                                    return formatCurrency(value);
                                  }
                                  return value.toLocaleString('tr-TR');
                                }}
                              />
                              <Legend />
                              <Bar dataKey="totalProductionCost" fill="#10b981" name="Üretim Maliyeti (₺)" />
                              <Bar dataKey="totalScrapCost" fill="#ef4444" name="Hurda Maliyeti (₺)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{editingRecord ? 'Günlük Kaydı Düzenle' : 'Yeni Günlük Kayıt'}</DialogTitle></DialogHeader><DailyRecordForm onSave={handleSave} productionLines={productionLines} initialData={editingRecord} /></DialogContent></Dialog>

          <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
            <DialogContent className="max-w-6xl">
              {viewingRecord && (
                <>
                  <DialogHeader>
                    <DialogTitle>{new Date(viewingRecord.production_date).toLocaleDateString('tr-TR', { dateStyle: 'full' })} - Üretim Detayları</DialogTitle>
                    <DialogDescription>Günlük üretim ve maliyet analizi</DialogDescription>
                  </DialogHeader>
                  <div className="py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Toplam Üretim</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{viewingRecord.total_quantity}</div><p className="text-xs text-muted-foreground">adet</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Toplam Hurda</CardTitle><Trash2 className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{viewingRecord.total_scrap}</div><p className="text-xs text-muted-foreground">adet</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">PPM</CardTitle><AlertCircle className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{Math.round(viewingRecord.ppm)}</div><p className="text-xs text-muted-foreground">milyonda hata</p></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Toplam Hurda Maliyeti</CardTitle><Calculator className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(viewingRecord.total_scrap_cost)}</div><p className="text-xs text-muted-foreground">toplam kayıp</p></CardContent></Card>
                  </div>
                  <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 z-10"><tr><th className="px-2 py-2 text-left font-medium">Parça Kodu</th><th className="px-2 py-2 text-left font-medium">Hat</th><th className="px-2 py-2 text-right font-medium">Kaynak Süresi (sn)</th><th className="px-2 py-2 text-right font-medium">Üretilen Adet</th><th className="px-2 py-2 text-right font-medium">Hurda Adedi</th><th className="px-2 py-2 text-right font-medium">Hat Saniye Maliyeti</th><th className="px-2 py-2 text-right font-medium">Üretim Maliyeti</th><th className="px-2 py-2 text-right font-medium">Hurda Maliyeti</th></tr></thead>
                      <tbody>
                        {detailedRecordData.map((item, index) => (
                          <tr key={`${item.id}-${index}`} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-2 font-mono">{item.part_code}</td>
                            <td className="px-2 py-2">{item.line_name}</td>
                            <td className="px-2 py-2 text-right">{item.welding_time}</td>
                            <td className="px-2 py-2 text-right">{item.quantity}</td>
                            <td className="px-2 py-2 text-right text-red-500">{item.scrap_count}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(item.second_cost)}</td>
                            <td className="px-2 py-2 text-right text-green-600 font-semibold">{formatCurrency(item.production_cost)}</td>
                            <td className="px-2 py-2 text-right text-red-600 font-semibold">{formatCurrency(item.scrap_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={!!recordToDelete} onOpenChange={() => setRecordToDelete(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Kaydı Silmeyi Onayla</DialogTitle><DialogDescription>{recordToDelete && `${new Date(recordToDelete.production_date).toLocaleDateString('tr-TR')} tarihli günlük kaydı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem o güne ait tüm parça girişlerini silecektir ve geri alınamaz.`}</DialogDescription></DialogHeader>
              <DialogFooter><DialogClose asChild><Button variant="outline">İptal</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Sil</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    };

    export default PartCost;