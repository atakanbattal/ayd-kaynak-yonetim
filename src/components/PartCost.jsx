import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { Calculator, Save, Trash2, Plus, Eye, Search, Calendar as CalendarIcon, Filter, X, Edit, TrendingUp, AlertCircle, Package, FileText, Download } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { logAction, formatCurrency, openPrintWindow } from '@/lib/utils';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
    import { tr } from 'date-fns/locale';

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

          const reportId = `RPR-PC-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const reportData = {
            title: 'Günlük Üretim ve Maliyet - Detaylı Rapor',
            reportId,
            filters: {
              'Rapor Dönemi': `${format(filters.dateRange?.from || startOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange?.to || endOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr })}`,
              'Arama Terimi': filters.searchTerm || 'Yok',
              'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr })
            },
            kpiCards: [
              { title: 'Toplam Üretim', value: totalProduction.toLocaleString('tr-TR') + ' adet' },
              { title: 'Toplam Hurda', value: totalScrap.toLocaleString('tr-TR') + ' adet' },
              { title: 'Ortalama PPM', value: Math.round(avgPPM).toString() },
              { title: 'Toplam Üretim Maliyeti', value: formatCurrency(totalProductionCost) },
              { title: 'Toplam Hurda Maliyeti', value: formatCurrency(totalScrapCost) },
              { title: 'Çalışılan Gün Sayısı', value: filteredDaily.length.toString() },
              { title: 'Farklı Parça Sayısı', value: Object.keys(byPart).length.toString() },
              { title: 'Çalışılan Hat Sayısı', value: Object.keys(byLine).length.toString() }
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

          // Parça bazlı özet ekle
          if (Object.keys(byPart).length > 0) {
            reportData.tableData.rows.push(
              ['---', '---', '---', '---', '---', '---', '---', '---', '---'],
              ...Object.entries(byPart)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 20)
                .map(([partCode, data]) => [
                  'ÖZET',
                  partCode,
                  'Parça Özeti',
                  '-',
                  data.quantity.toLocaleString('tr-TR'),
                  data.scrap.toLocaleString('tr-TR'),
                  formatCurrency(data.cost),
                  formatCurrency(data.scrapCost),
                  data.quantity > 0 ? Math.round((data.scrap * 1000000) / (data.quantity + data.scrap)).toString() : '0'
                ])
            );
          }

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