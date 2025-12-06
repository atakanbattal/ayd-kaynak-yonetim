import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { TrendingUp, Plus, Edit, Trash2, Save, FileText, Bot, Factory, Paperclip, Upload, X, Crown, Calendar as CalendarIcon, Download } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { formatCurrency, cn, logAction, openPrintWindow } from '@/lib/utils';
    import { format, startOfMonth, endOfMonth, subDays, startOfQuarter, endOfQuarter, parseISO, startOfDay, endOfDay } from 'date-fns';
    import { tr } from 'date-fns/locale';
    import { Combobox } from '@/components/ui/combobox';

    const initialFormState = {
      improvement_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      type: 'cycle_time',
      description: '',
      line_id: null,
      robot_id: null,
      part_code: '',
      responsible_id: null,
      prev_time: '',
      new_time: '',
      annual_quantity: '',
      status: 'Tamamlandı',
      attachments: [],
      before_image: null,
      after_image: null,
      cost_snapshot: null,
    };

    const statusMap = {
        'Planlandı': { label: 'Planlandı', color: 'bg-yellow-100 text-yellow-800' },
        'Devam Ediyor': { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800' },
        'Tamamlandı': { label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
        'İptal Edildi': { label: 'İptal Edildi', color: 'bg-red-100 text-red-800' },
    };

    const getStatusStyle = (status) => statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

    const ImprovementFilters = ({ filters, setFilters, lines }) => {
        const [open, setOpen] = useState(false);

        const setDateRange = (range) => {
            setFilters(prev => ({ ...prev, dateRange: range }));
            setOpen(false);
        };

        const predefinedRanges = [
            { label: 'Bu Ay', range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } },
            { label: 'Son 30 Gün', range: { from: subDays(new Date(), 29), to: new Date() } },
            { label: 'Bu Çeyrek', range: { from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) } },
            { label: 'Tüm Zamanlar', range: { from: new Date('2020-01-01'), to: new Date() } },
        ];

        return (
            <div className="p-4 bg-gray-50 rounded-lg mb-4 flex flex-wrap items-center gap-4">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !filters.dateRange && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateRange?.from && filters.dateRange?.to ? (
                                `${format(filters.dateRange.from, "dd LLL, y", { locale: tr })} - ${format(filters.dateRange.to, "dd LLL, y", { locale: tr })}`
                            ) : (
                                <span>Tüm Zamanlar</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 flex" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={filters.dateRange?.from} selected={filters.dateRange} onSelect={(range) => setFilters(prev => ({ ...prev, dateRange: range }))} numberOfMonths={2} locale={tr} />
                        <div className="flex flex-col space-y-2 p-2 border-l">
                            {predefinedRanges.map(({ label, range }) => (
                                <Button key={label} variant="ghost" className="justify-start" onClick={() => setDateRange(range)}>
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
                <Input 
                    placeholder="Parça Kodu Ara..." 
                    value={filters.partCode || ''} 
                    onChange={e => setFilters(prev => ({ ...prev, partCode: e.target.value }))} 
                    className="w-[200px]"
                />
                <Select value={filters.type} onValueChange={v => setFilters(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Tüm Tipler</SelectItem><SelectItem value="cycle_time">Çevrim Süresi</SelectItem><SelectItem value="quality">Kalite</SelectItem><SelectItem value="cost">Maliyet</SelectItem><SelectItem value="ergonomics">Ergonomi</SelectItem><SelectItem value="other">Diğer</SelectItem></SelectContent>
                </Select>
                <Select value={filters.line} onValueChange={v => setFilters(prev => ({ ...prev, line: v }))}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Tüm Hatlar</SelectItem>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        );
    };

    const KpiCards = ({ improvements, calculateImpact, getLineName }) => {
        const totalAnnualImpact = useMemo(() => improvements.reduce((sum, item) => sum + calculateImpact(item), 0), [improvements, calculateImpact]);
        const completionRate = useMemo(() => {
            const completed = improvements.filter(i => i.status === 'Tamamlandı').length;
            return improvements.length > 0 ? (completed / improvements.length) * 100 : 0;
        }, [improvements]);
        const topImpactLine = useMemo(() => {
            if (improvements.length === 0) return { name: 'N/A', impact: 0 };
            const impactByLine = improvements.reduce((acc, item) => {
                const lineId = item.line_id;
                const impact = calculateImpact(item);
                if (!acc[lineId]) acc[lineId] = 0;
                acc[lineId] += impact;
                return acc;
            }, {});
            const topEntry = Object.entries(impactByLine).sort((a, b) => b[1] - a[1])[0];
            if (!topEntry) return { name: 'N/A', impact: 0 };
            return { name: getLineName(topEntry[0]), impact: topEntry[1] };
        }, [improvements, calculateImpact, getLineName]);

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Toplam Yıllık Etki</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(totalAnnualImpact)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Toplam İyileştirme</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{improvements.length}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tamamlanma Oranı</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">%{completionRate.toFixed(1)}</div></CardContent></Card>
                <Card className="bg-amber-50 border-amber-200"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-amber-800">En Yüksek Etkili Hat</CardTitle><Crown className="h-4 w-4 text-amber-600" /></CardHeader><CardContent><div className="text-xl font-bold">{topImpactLine.name}</div><p className="text-xs text-muted-foreground">{formatCurrency(topImpactLine.impact)}</p></CardContent></Card>
            </div>
        );
    };

    const ImprovementTable = ({ improvements, calculateImpact, getLineName, setViewingItem, handlePrint, openDialog, setDeleteConfirm }) => (
        <div className="border rounded-lg overflow-x-auto">
            <table className="w-full">
                <thead className="bg-gray-50"><tr>{['Kayıt Tarihi/Saat', 'İyileştirme Tarihi', 'Açıklama', 'Parça Kodu', 'Hat', 'Süre (Ö/Y)', 'Yıllık Etki', 'Durum', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                    {improvements.map(item => {
                        const statusStyle = getStatusStyle(item.status);
                        return (
                            <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingItem(item)}>
                                <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium">{item.created_at ? format(new Date(item.created_at), 'dd.MM.yyyy') : '-'}</span>
                                        <span className="text-xs text-gray-500">{item.created_at ? format(new Date(item.created_at), 'HH:mm:ss') : '-'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">{format(parseISO(item.improvement_date), 'dd.MM.yyyy')}</td>
                                <td className="px-4 py-2 max-w-sm truncate" title={item.description}>{item.description}</td>
                                <td className="px-4 py-2 whitespace-nowrap font-semibold">{item.part_code || 'N/A'}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{getLineName(item.line_id)}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{item.prev_time}s → {item.new_time}s</td>
                                <td className="px-4 py-2 font-medium text-green-600 whitespace-nowrap">{formatCurrency(calculateImpact(item))}</td>
                                <td className="px-4 py-2"><span className={cn('px-2 inline-flex text-xs leading-5 font-semibold rounded-full', statusStyle.color)}>{statusStyle.label}</span></td>
                                <td className="px-4 py-2 text-right whitespace-nowrap">
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePrint(item); }}><FileText className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDialog(item); }}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            {improvements.length === 0 && <p className="text-center py-8">Veri bulunamadı.</p>}
        </div>
    );

    const ContinuousImprovement = () => {
      const [improvements, setImprovements] = useState([]);
      const [lines, setLines] = useState([]);
      const [robots, setRobots] = useState([]);
      const [employees, setEmployees] = useState([]);
      const [filters, setFilters] = useState({
        dateRange: { from: new Date('2020-01-01'), to: new Date() },
        type: 'all',
        line: 'all',
        partCode: '',
      });
      const [showDialog, setShowDialog] = useState(false);
      const [editingItem, setEditingItem] = useState(null);
      const [viewingItem, setViewingItem] = useState(null);
      const [formState, setFormState] = useState(initialFormState);
      const [deleteConfirm, setDeleteConfirm] = useState(null);
      const [uploading, setUploading] = useState(false);
      const [partCodeDuplicate, setPartCodeDuplicate] = useState(null);
      const { toast } = useToast();
      const { user } = useAuth();
      
      const employeeOptions = useMemo(() => employees.map(emp => ({
          value: emp.id,
          label: `${emp.registration_number} - ${emp.first_name} ${emp.last_name}`
      })), [employees]);

      const getLineName = useCallback((lineId) => lines.find(l => l.id === lineId)?.name || 'N/A', [lines]);
      const getRobotName = useCallback((robotId) => robots.find(r => r.id === robotId)?.name || 'N/A', [robots]);
      const getEmployeeName = useCallback((employeeId) => {
        const emp = employees.find(e => e.id === employeeId);
        return emp ? `${emp.first_name} ${emp.last_name}` : 'N/A';
      }, [employees]);

      const fetchData = useCallback(async () => {
        try {
          const [improvementsData, linesData, robotsData, employeesData] = await Promise.all([
            supabase.from('improvements').select('*').order('improvement_date', { ascending: false }),
            supabase.from('lines').select('*').eq('deleted', false),
            supabase.from('robots').select('*').eq('deleted', false),
            supabase.from('employees').select('*').eq('is_active', true),
          ]);

          if (improvementsData.error) throw improvementsData.error;
          if (linesData.error) throw linesData.error;
          if (robotsData.error) throw robotsData.error;
          if (employeesData.error) throw employeesData.error;
          
          setImprovements(improvementsData.data);
          setLines(linesData.data);
          setRobots(robotsData.data);
          setEmployees(employeesData.data);
        } catch (error) {
          toast({ title: "Veri Yüklenemedi", description: error.message, variant: "destructive" });
        }
      }, [toast]);
      
      useEffect(() => {
        fetchData();
      }, [fetchData]);

      const getActiveCost = useCallback((lineId, date) => {
        const line = lines.find(l => l.id === lineId);
        
        if (!line) {
          return null;
        }
      
        if (!line.costs || !Array.isArray(line.costs) || line.costs.length === 0) {
          return null;
        }
      
        const targetDate = parseISO(date);
      
        const validCosts = line.costs.filter(c => {
          if (!c.validFrom) return false;
          const costDate = parseISO(c.validFrom);
          return costDate <= targetDate;
        });
      
        if (validCosts.length === 0) {
          const oldestCost = line.costs.sort((a, b) => 
            parseISO(a.validFrom) - parseISO(b.validFrom)
          )[0];
          return oldestCost;
        }
      
        const sortedCosts = validCosts.sort((a, b) => 
          parseISO(b.validFrom) - parseISO(a.validFrom)
        );
      
        const selectedCost = sortedCosts[0];
        
        return selectedCost;
      }, [lines]);

      const calculateImpact = useCallback((item) => {
          if (!item || !item.improvement_date || !item.line_id) return 0;
          
          let costSnapshot = item.cost_snapshot;
          
          if (!costSnapshot || typeof costSnapshot.totalCostPerSecond === 'undefined') {
              costSnapshot = getActiveCost(item.line_id, item.improvement_date);
          }
          
          const prevTime = Number(item.prev_time) || 0;
          const newTime = Number(item.new_time) || 0;
          const annualQuantity = Number(item.annual_quantity) || 0;
          const costPerSecond = Number(costSnapshot?.totalCostPerSecond) || 0;

          const timeSaving = prevTime - newTime;
          if (timeSaving <= 0) return 0;

          return timeSaving * annualQuantity * costPerSecond;
      }, [getActiveCost]);

      const formCalculatedImpact = useMemo(() => {
        if (!formState.line_id) return 0;
        const activeCost = getActiveCost(formState.line_id, formState.improvement_date);
        const itemForCalc = { ...formState, cost_snapshot: activeCost };
        return calculateImpact(itemForCalc);
      }, [formState, getActiveCost, calculateImpact]);

      // Parça kodu değiştiğinde duplikasyon kontrolü
      useEffect(() => {
        if (formState.part_code && !editingItem) {
          const existingImprovements = improvements.filter(i => i.part_code === formState.part_code);
          if (existingImprovements.length > 0) {
            setPartCodeDuplicate(existingImprovements.length);
          } else {
            setPartCodeDuplicate(null);
          }
        } else {
          setPartCodeDuplicate(null);
        }
      }, [formState.part_code, improvements, editingItem]);

      const handleSave = async () => {
          try {
              // Zorunlu alan kontrolü
              if (!formState.improvement_date) {
                  toast({ title: "Hata", description: "İyileştirme tarihi zorunludur.", variant: "destructive" });
                  return;
              }
              
              if (!formState.description || formState.description.trim() === '') {
                  toast({ title: "Hata", description: "Açıklama zorunludur.", variant: "destructive" });
                  return;
              }
              
              // line_id kontrolü - boş string de kontrol edilmeli
              const lineId = formState.line_id && formState.line_id !== '' ? formState.line_id : null;
              if (!lineId) {
                  toast({ title: "Hata", description: "Hat seçimi zorunludur.", variant: "destructive" });
                  return;
              }

              // Aynı parça kodu kontrolü
              const partCode = formState.part_code && formState.part_code.trim() !== '' ? formState.part_code.trim() : null;
              if (!editingItem && partCode) {
                  const existingImprovements = improvements.filter(i => i.part_code === partCode);
                  if (existingImprovements.length > 0) {
                      const confirmed = window.confirm(
                          `Bu parça kodu (${partCode}) için daha önce ${existingImprovements.length} adet iyileştirme kaydı yapılmış.\n\nYine de kaydetmek istiyor musunuz?`
                      );
                      if (!confirmed) {
                          return;
                      }
                  }
              }

              const activeCost = getActiveCost(lineId, formState.improvement_date);
              const impact = calculateImpact({ 
                  ...formState, 
                  line_id: lineId,
                  cost_snapshot: activeCost 
              });
              
              // Helper function: boş string'leri null'a çevir
              const cleanValue = (value) => {
                  if (value === '' || value === undefined) return null;
                  if (typeof value === 'string' && value.trim() === '') return null;
                  return value;
              };
              
              // Veritabanına gönderilecek veriyi hazırla
              const dataToSave = {
                  improvement_date: formState.improvement_date,
                  type: formState.type || 'cycle_time',
                  description: formState.description.trim(),
                  line_id: lineId,
                  robot_id: cleanValue(formState.robot_id),
                  part_code: partCode,
                  responsible_id: cleanValue(formState.responsible_id),
                  prev_time: formState.prev_time && formState.prev_time !== '' ? parseFloat(formState.prev_time) : null,
                  new_time: formState.new_time && formState.new_time !== '' ? parseFloat(formState.new_time) : null,
                  annual_quantity: formState.annual_quantity && formState.annual_quantity !== '' ? parseFloat(formState.annual_quantity) : null,
                  status: formState.status || 'Tamamlandı',
                  attachments: formState.attachments && Array.isArray(formState.attachments) && formState.attachments.length > 0 ? formState.attachments : null,
                  before_image: cleanValue(formState.before_image),
                  after_image: cleanValue(formState.after_image),
                  cost_snapshot: activeCost,
              };
              
              // Yeni kayıt için created_at ekle
              if (!editingItem) {
                  dataToSave.created_at = new Date().toISOString();
              }
      
              let response;
              if (editingItem) {
                  // Güncelleme işlemi
                  const { id, created_at, ...updateData } = dataToSave;
                  response = await supabase
                      .from('improvements')
                      .update(updateData)
                      .eq('id', editingItem.id)
                      .select();
              } else {
                  // Yeni kayıt işlemi
                  const { id, ...insertData } = dataToSave;
                  response = await supabase
                      .from('improvements')
                      .insert(insertData)
                      .select();
              }
      
              if (response.error) {
                  console.error('Supabase Error:', response.error);
                  console.error('Data being sent:', dataToSave);
                  toast({ 
                      title: "Kayıt Başarısız", 
                      description: response.error.message || "Kayıt sırasında bir hata oluştu.", 
                      variant: "destructive" 
                  });
              } else if (response.data && response.data.length > 0) {
                  toast({ title: "Başarılı", description: "İyileştirme başarıyla kaydedildi." });
                  logAction(editingItem ? 'UPDATE' : 'CREATE', `Improvement: ${response.data[0].id}`, user);
                  setShowDialog(false);
                  setEditingItem(null);
                  setFormState(initialFormState);
                  fetchData();
              } else {
                  toast({ 
                      title: "Kayıt Başarısız", 
                      description: "Kayıt yapıldı ancak veri döndürülmedi.", 
                      variant: "destructive" 
                  });
              }
          } catch (error) {
              console.error('Save Error:', error);
              toast({ 
                  title: "Kayıt Başarısız", 
                  description: error.message || "Beklenmeyen bir hata oluştu.", 
                  variant: "destructive" 
              });
          }
      };

      const handleDelete = async () => {
        if (!deleteConfirm) return;
        const { error } = await supabase.from('improvements').delete().eq('id', deleteConfirm.id);
        if (error) {
          toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Silindi", description: "İyileştirme başarıyla silindi.", variant: "destructive" });
          logAction('DELETE', `Improvement: ${deleteConfirm.id}`, user);
          fetchData();
        }
        setDeleteConfirm(null);
        setViewingItem(null);
      };
      
        const handleFileChange = async (event) => {
        if (!event.target.files || event.target.files.length === 0) return;
        setUploading(true);
        
        const file = event.target.files[0];
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('attachments').upload(`continuous_improvement/${fileName}`, file);
        
        if (error) {
          toast({ title: "Dosya Yüklenemedi", description: error.message, variant: "destructive" });
        } else {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
          setFormState(prev => ({ ...prev, attachments: [...(prev.attachments || []), { name: file.name, url: publicUrl, size: file.size, type: file.type }] }));
          toast({ title: "Dosya Yüklendi", description: file.name });
        }
        setUploading(false);
      };

      const handleImageUpload = async (event, imageType) => {
        if (!event.target.files || event.target.files.length === 0) return;
        setUploading(true);
        
        const file = event.target.files[0];
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('attachments').upload(`continuous_improvement/images/${fileName}`, file);
        
        if (error) {
          toast({ title: "Resim Yüklenemedi", description: error.message, variant: "destructive" });
        } else {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
          setFormState(prev => ({ ...prev, [imageType]: publicUrl }));
          toast({ title: "Resim Yüklendi", description: file.name });
        }
        setUploading(false);
      };

      const removeAttachment = (indexToRemove) => {
        const fileToRemove = formState.attachments[indexToRemove];
        setFormState(prev => ({ ...prev, attachments: prev.attachments.filter((_, index) => index !== indexToRemove) }));
        toast({ title: "Ek Kaldırıldı", description: fileToRemove.name, variant: "default" });
      };
      
      const handlePrint = async (item) => {
        const reportId = `RPR-SI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const reportData = {
            title: 'Sürekli İyileştirme Raporu',
            reportId,
            signatureFields: [
                { title: 'Hazırlayan', name: 'Tuğçe MAVİ BATTAL', role: ' ' },
                { title: 'Kontrol Eden', name: '', role: '..................' },
                { title: 'Onaylayan', name: '', role: '..................' }
            ]
        };
         if (item) {
            reportData.singleItemData = {
                'İyileştirme Konusu': item.description,
                'Parça Kodu': item.part_code || 'N/A',
                'Hat / Robot': `${getLineName(item.line_id)} / ${getRobotName(item.robot_id)}`,
                'Sorumlu': getEmployeeName(item.responsible_id),
                'Önceki Süre': `${item.prev_time} sn`,
                'Yeni Süre': `${item.new_time} sn`,
                'Kazanç': `${(item.prev_time - item.new_time).toFixed(2)} sn`,
                'Yıllık Etki': formatCurrency(calculateImpact(item)),
            };
            reportData.attachments = item.attachments;
        } else {
            const totalAnnualImpact = filteredImprovements.reduce((sum, item) => sum + calculateImpact(item), 0);
            reportData.kpiCards = [
              { title: 'Toplam Yıllık Etki', value: formatCurrency(totalAnnualImpact) },
              { title: 'Toplam İyileştirme', value: filteredImprovements.length },
              { title: 'Ortalama Etki', value: formatCurrency(totalAnnualImpact / (filteredImprovements.length || 1)) },
            ];
            reportData.tableData = {
                headers: ['Tarih', 'Açıklama', 'Parça Kodu', 'Hat', 'Önceki Süre', 'Yeni Süre', 'Yıllık Etki'],
                rows: filteredImprovements.map(s => [
                    format(parseISO(s.improvement_date), 'dd.MM.yyyy'),
                    s.description,
                    s.part_code || 'N/A',
                    getLineName(s.line_id),
                    s.prev_time,
                    s.new_time,
                    formatCurrency(calculateImpact(s))
                ])
            };
        }
        
        await openPrintWindow(reportData, toast);
      };

      const handleGenerateDetailedReport = async () => {
        try {
          toast({ title: "Detaylı rapor hazırlanıyor...", description: "Tüm veriler toplanıyor, lütfen bekleyin." });

          const dateFrom = filters.dateRange?.from ? format(startOfDay(filters.dateRange.from), 'yyyy-MM-dd') : format(startOfDay(new Date('2020-01-01')), 'yyyy-MM-dd');
          const dateTo = filters.dateRange?.to ? format(endOfDay(filters.dateRange.to), 'yyyy-MM-dd') : format(endOfDay(new Date()), 'yyyy-MM-dd');

          // Tüm detaylı verileri çek
          const [improvementsData, linesData, robotsData, employeesData] = await Promise.all([
            supabase.from('improvements')
              .select('*, line:lines(name), robot:robots(name), responsible:employees(first_name, last_name)')
              .eq('deleted', false)
              .gte('improvement_date', dateFrom)
              .lte('improvement_date', dateTo)
              .order('improvement_date', { ascending: false }),
            supabase.from('lines').select('*').eq('deleted', false),
            supabase.from('robots').select('*').eq('deleted', false),
            supabase.from('employees').select('*').eq('is_active', true)
          ]);

          const allImprovements = improvementsData.data || [];
          const allLines = linesData.data || [];
          const allRobots = robotsData.data || [];
          const allEmployees = employeesData.data || [];

          // Filtrelenmiş veriler
          const filteredData = allImprovements.filter(item => {
            const typeMatch = filters.type === 'all' || item.type === filters.type;
            const lineMatch = filters.line === 'all' || item.line_id === filters.line;
            const partCodeMatch = !filters.partCode || (item.part_code && item.part_code.toLowerCase().includes(filters.partCode.toLowerCase()));
            return typeMatch && lineMatch && partCodeMatch;
          });

          const totalAnnualImpact = filteredData.reduce((sum, item) => sum + calculateImpact(item), 0);
          const completedCount = filteredData.filter(i => i.status === 'Tamamlandı').length;
          const inProgressCount = filteredData.filter(i => i.status === 'Devam Ediyor').length;
          const plannedCount = filteredData.filter(i => i.status === 'Planlandı').length;

          // Hat bazlı analiz
          const byLine = filteredData.reduce((acc, i) => {
            const lineName = i.line?.name || 'Belirtilmemiş';
            if (!acc[lineName]) {
              acc[lineName] = { count: 0, impact: 0, completed: 0, timeSaved: 0, avgTimeSaving: 0 };
            }
            acc[lineName].count++;
            acc[lineName].impact += calculateImpact(i);
            acc[lineName].timeSaved += ((i.prev_time || 0) - (i.new_time || 0)) * (i.annual_quantity || 0);
            if (i.status === 'Tamamlandı') acc[lineName].completed++;
            return acc;
          }, {});

          // Tip bazlı analiz
          const byType = filteredData.reduce((acc, i) => {
            const type = i.type || 'Diğer';
            if (!acc[type]) {
              acc[type] = { count: 0, impact: 0, avgImpact: 0 };
            }
            acc[type].count++;
            acc[type].impact += calculateImpact(i);
            return acc;
          }, {});

          // Sorumlu personel bazlı analiz
          const byResponsible = filteredData.reduce((acc, i) => {
            const responsibleName = i.responsible ? `${i.responsible.first_name} ${i.responsible.last_name}` : 'Belirtilmemiş';
            if (!acc[responsibleName]) {
              acc[responsibleName] = { count: 0, impact: 0, completed: 0 };
            }
            acc[responsibleName].count++;
            acc[responsibleName].impact += calculateImpact(i);
            if (i.status === 'Tamamlandı') acc[responsibleName].completed++;
            return acc;
          }, {});

          // Parça bazlı analiz
          const byPart = filteredData.reduce((acc, i) => {
            const partCode = i.part_code || 'Belirtilmemiş';
            if (!acc[partCode]) {
              acc[partCode] = { count: 0, impact: 0, avgTimeSaving: 0 };
            }
            acc[partCode].count++;
            acc[partCode].impact += calculateImpact(i);
            acc[partCode].avgTimeSaving += (i.prev_time || 0) - (i.new_time || 0);
            return acc;
          }, {});

          // Robot bazlı analiz
          const byRobot = filteredData.reduce((acc, i) => {
            const robotName = i.robot?.name || 'Belirtilmemiş';
            if (!acc[robotName]) {
              acc[robotName] = { count: 0, impact: 0 };
            }
            acc[robotName].count++;
            acc[robotName].impact += calculateImpact(i);
            return acc;
          }, {});

          // Top 10 en etkili iyileştirmeler
          const top10Improvements = [...filteredData]
            .sort((a, b) => calculateImpact(b) - calculateImpact(a))
            .slice(0, 10);

          // Top 10 en etkili hatlar
          const top10Lines = Object.entries(byLine)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 10);

          // Top 10 en etkili personeller
          const top10Responsible = Object.entries(byResponsible)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 10);

          // Ortalama süre kazancı hesapla
          Object.keys(byLine).forEach(lineName => {
            const lineData = byLine[lineName];
            lineData.avgTimeSaving = lineData.count > 0 ? lineData.timeSaved / lineData.count : 0;
          });

          Object.keys(byType).forEach(type => {
            const typeData = byType[type];
            typeData.avgImpact = typeData.count > 0 ? typeData.impact / typeData.count : 0;
          });

          Object.keys(byPart).forEach(partCode => {
            const partData = byPart[partCode];
            partData.avgTimeSaving = partData.count > 0 ? partData.avgTimeSaving / partData.count : 0;
          });

          const reportId = `RPR-SI-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const reportData = {
            title: 'Sürekli İyileştirme - Detaylı Yönetici Raporu',
            reportId,
            filters: {
              'Rapor Dönemi': `${format(filters.dateRange?.from || new Date('2020-01-01'), 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange?.to || new Date(), 'dd.MM.yyyy', { locale: tr })}`,
              'Filtreler': `Tip: ${filters.type === 'all' ? 'Tümü' : filters.type}, Hat: ${filters.line === 'all' ? 'Tümü' : getLineName(filters.line)}, Parça Kodu: ${filters.partCode || 'Yok'}`,
              'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
              'Toplam Gün': Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1 + ' gün'
            },
            kpiCards: [
              { title: 'Toplam Yıllık Etki', value: formatCurrency(totalAnnualImpact) },
              { title: 'Toplam İyileştirme', value: filteredData.length.toString() },
              { title: 'Tamamlanan', value: completedCount.toString() },
              { title: 'Devam Eden', value: inProgressCount.toString() },
              { title: 'Planlanan', value: plannedCount.toString() },
              { title: 'Tamamlanma Oranı', value: filteredData.length > 0 ? `${Math.round((completedCount / filteredData.length) * 100)}%` : '0%' },
              { title: 'Ortalama Etki', value: formatCurrency(totalAnnualImpact / (filteredData.length || 1)) },
              { title: 'Aktif Hat Sayısı', value: Object.keys(byLine).length.toString() },
              { title: 'İyileştirme Tipleri', value: Object.keys(byType).length.toString() },
              { title: 'Farklı Parça Sayısı', value: Object.keys(byPart).length.toString() },
              { title: 'Farklı Robot Sayısı', value: Object.keys(byRobot).length.toString() },
              { title: 'Sorumlu Personel Sayısı', value: Object.keys(byResponsible).length.toString() }
            ],
            tableData: {
              headers: ['Tarih', 'Açıklama', 'Parça Kodu', 'Hat', 'Robot', 'Sorumlu', 'Tip', 'Önceki Süre', 'Yeni Süre', 'Kazanç', 'Yıllık Etki', 'Durum'],
              rows: filteredData.map(s => [
                format(parseISO(s.improvement_date), 'dd.MM.yyyy'),
                s.description ? (s.description.length > 40 ? s.description.substring(0, 40) + '...' : s.description) : '-',
                s.part_code || 'N/A',
                s.line?.name || 'N/A',
                s.robot?.name || 'N/A',
                s.responsible ? `${s.responsible.first_name} ${s.responsible.last_name}` : 'N/A',
                s.type || 'Diğer',
                `${s.prev_time || 0} sn`,
                `${s.new_time || 0} sn`,
                `${((s.prev_time || 0) - (s.new_time || 0)).toFixed(2)} sn`,
                formatCurrency(calculateImpact(s)),
                s.status || 'Belirtilmemiş'
              ])
            },
            signatureFields: [
              { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
              { title: 'Kontrol Eden', name: '', role: '..................' },
              { title: 'Onaylayan', name: '', role: '..................' }
            ]
          };

          // Top 10 En Etkili İyileştirmeler
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 EN ETKİLİ İYİLEŞTİRMELER', '', '', '', '', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Tarih', 'Açıklama', 'Parça Kodu', 'Hat', 'Yıllık Etki', 'Süre Kazancı', 'Durum', '', '', '', ''],
            ...top10Improvements.map((imp, index) => [
              (index + 1).toString(),
              format(parseISO(imp.improvement_date), 'dd.MM.yyyy'),
              imp.description ? (imp.description.length > 30 ? imp.description.substring(0, 30) + '...' : imp.description) : '-',
              imp.part_code || 'N/A',
              imp.line?.name || 'N/A',
              formatCurrency(calculateImpact(imp)),
              `${((imp.prev_time || 0) - (imp.new_time || 0)).toFixed(2)} sn`,
              imp.status || 'Belirtilmemiş',
              '', '', '', ''
            ])
          );

          // Top 10 En Etkili Hatlar
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 EN ETKİLİ HATLAR', '', '', '', '', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Hat Adı', 'Toplam Etki', 'İyileştirme Sayısı', 'Tamamlanan', 'Tamamlanma Oranı', 'Ortalama Süre Kazancı', '', '', '', '', ''],
            ...top10Lines.map((line, index) => [
              (index + 1).toString(),
              line.name,
              formatCurrency(line.impact),
              line.count.toString(),
              line.completed.toString(),
              `${Math.round((line.completed / line.count) * 100)}%`,
              `${line.avgTimeSaving.toFixed(2)} sn`,
              '', '', '', '', ''
            ])
          );

          // Top 10 En Etkili Personeller
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['TOP 10 EN ETKİLİ SORUMLU PERSONEL', '', '', '', '', '', '', '', '', '', '', '', ''],
            ['Sıra', 'Personel', 'Toplam Etki', 'İyileştirme Sayısı', 'Tamamlanan', 'Tamamlanma Oranı', '', '', '', '', '', ''],
            ...top10Responsible.map((resp, index) => [
              (index + 1).toString(),
              resp.name,
              formatCurrency(resp.impact),
              resp.count.toString(),
              resp.completed.toString(),
              `${Math.round((resp.completed / resp.count) * 100)}%`,
              '', '', '', '', '', ''
            ])
          );

          // Tip bazlı detaylı analiz
          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['İYİLEŞTİRME TİPİ BAZLI ANALİZ', '', '', '', '', '', '', '', '', '', '', ''],
            ['Tip', 'Sayı', 'Toplam Etki', 'Ortalama Etki', '', '', '', '', '', '', '', ''],
            ...Object.entries(byType).map(([type, data]) => [
              type,
              data.count.toString(),
              formatCurrency(data.impact),
              formatCurrency(data.avgImpact),
              '', '', '', '', '', '', '', ''
            ])
          );

          // Parça bazlı analiz
          const topParts = Object.entries(byPart)
            .map(([code, data]) => ({ code, ...data }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 15);

          reportData.tableData.rows.push(
            ['===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
            ['PARÇA BAZLI ANALİZ (TOP 15)', '', '', '', '', '', '', '', '', '', '', ''],
            ['Parça Kodu', 'İyileştirme Sayısı', 'Toplam Etki', 'Ortalama Süre Kazancı', '', '', '', '', '', '', '', ''],
            ...topParts.map(part => [
              part.code,
              part.count.toString(),
              formatCurrency(part.impact),
              `${part.avgTimeSaving.toFixed(2)} sn`,
              '', '', '', '', '', '', '', ''
            ])
          );

          // Robot bazlı analiz
          const topRobots = Object.entries(byRobot)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.impact - a.impact)
            .slice(0, 10);

          if (topRobots.length > 0) {
            reportData.tableData.rows.push(
              ['===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
              ['ROBOT BAZLI ANALİZ (TOP 10)', '', '', '', '', '', '', '', '', '', '', ''],
              ['Robot Adı', 'İyileştirme Sayısı', 'Toplam Etki', '', '', '', '', '', '', '', '', ''],
              ...topRobots.map(robot => [
                robot.name,
                robot.count.toString(),
                formatCurrency(robot.impact),
                '', '', '', '', '', '', '', '', ''
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

      const openDialog = (item = null) => {
        if (item) {
          setEditingItem(item);
          const activeCost = getActiveCost(item.line_id, item.improvement_date);
          
          setFormState({ 
            ...initialFormState, 
            ...item, 
            improvement_date: item.improvement_date,
            cost_snapshot: item.cost_snapshot || activeCost,
          });
        } else {
          setEditingItem(null);
          setFormState(initialFormState);
        }
        setShowDialog(true);
      };

      const filteredImprovements = useMemo(() => {
        return improvements.filter(item => {
          try {
            const date = parseISO(item.improvement_date);
            const inDateRange = !filters.dateRange.from || !filters.dateRange.to || (date >= filters.dateRange.from && date <= filters.dateRange.to);
            const typeMatch = filters.type === 'all' || item.type === filters.type;
            const lineMatch = filters.line === 'all' || item.line_id === filters.line;
            const partCodeMatch = !filters.partCode || (item.part_code && item.part_code.toLowerCase().includes(filters.partCode.toLowerCase()));
            return inDateRange && typeMatch && lineMatch && partCodeMatch;
          } catch(e) {
            return false;
          }
        });
      }, [improvements, filters]);
      
      const renderForm = () => (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formState.improvement_date} onChange={(e) => setFormState({ ...formState, improvement_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Tip</Label><Select value={formState.type} onValueChange={v => setFormState({ ...formState, type: v })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cycle_time">Çevrim Süresi</SelectItem><SelectItem value="quality">Kalite</SelectItem><SelectItem value="cost">Maliyet</SelectItem><SelectItem value="ergonomics">Ergonomi</SelectItem><SelectItem value="other">Diğer</SelectItem></SelectContent></Select></div>
            <div className="md:col-span-2 space-y-2"><Label>Açıklama</Label><Input placeholder="İyileştirmenin kısa tanımı" value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Hat</Label><Select value={formState.line_id || ''} onValueChange={v => setFormState({ ...formState, line_id: v })}><SelectTrigger><SelectValue placeholder="Hat seçin"/></SelectTrigger><SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Robot</Label><Select value={formState.robot_id || ''} onValueChange={v => setFormState({ ...formState, robot_id: v })}><SelectTrigger><SelectValue placeholder="Robot seçin"/></SelectTrigger><SelectContent>{robots.filter(r => !formState.line_id || r.line_id === formState.line_id).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2">
              <Label>Parça Kodu</Label>
              <Input value={formState.part_code} onChange={(e) => setFormState({ ...formState, part_code: e.target.value })} />
              {partCodeDuplicate && (
                <div className="mt-1 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                  ⚠️ Bu parça kodu için daha önce {partCodeDuplicate} adet iyileştirme kaydı yapılmış!
                </div>
              )}
            </div>
            <div className="space-y-2"><Label>Sorumlu</Label><Combobox options={employeeOptions} value={formState.responsible_id} onSelect={v => setFormState({ ...formState, responsible_id: v})} placeholder="Sorumlu seçin" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı."/></div>
            <div className="space-y-2"><Label>Önceki Süre (sn)</Label><Input type="number" value={formState.prev_time} onChange={(e) => setFormState({ ...formState, prev_time: e.target.value })} /></div>
            <div className="space-y-2"><Label>Yeni Süre (sn)</Label><Input type="number" value={formState.new_time} onChange={(e) => setFormState({ ...formState, new_time: e.target.value })} /></div>
            <div className="space-y-2"><Label>Yıllık Adet</Label><Input type="number" value={formState.annual_quantity} onChange={(e) => setFormState({ ...formState, annual_quantity: e.target.value })} /></div>
            <div className="space-y-2"><Label>Durum</Label><Select value={formState.status} onValueChange={v => setFormState({ ...formState, status: v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.keys(statusMap).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <Label className="text-sm text-green-800">Hesaplanan Yıllık Etki</Label>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(formCalculatedImpact)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Önceki Durum Resmi</Label>
              <div className="p-4 border-2 border-dashed rounded-lg text-center">
                {formState.before_image ? (
                  <div className="space-y-2">
                    <img src={formState.before_image} alt="Önceki durum" className="w-full h-40 object-cover rounded" />
                    <Button variant="outline" size="sm" onClick={() => setFormState(prev => ({ ...prev, before_image: null }))}>
                      <X className="h-4 w-4 mr-2" />Kaldır
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button asChild variant="outline" size="sm" disabled={uploading}>
                      <label htmlFor="before-image-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />Resim Yükle
                      </label>
                    </Button>
                    <Input id="before-image-upload" type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'before_image')} disabled={uploading} accept="image/*" />
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sonraki Durum Resmi</Label>
              <div className="p-4 border-2 border-dashed rounded-lg text-center">
                {formState.after_image ? (
                  <div className="space-y-2">
                    <img src={formState.after_image} alt="Sonraki durum" className="w-full h-40 object-cover rounded" />
                    <Button variant="outline" size="sm" onClick={() => setFormState(prev => ({ ...prev, after_image: null }))}>
                      <X className="h-4 w-4 mr-2" />Kaldır
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button asChild variant="outline" size="sm" disabled={uploading}>
                      <label htmlFor="after-image-upload" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />Resim Yükle
                      </label>
                    </Button>
                    <Input id="after-image-upload" type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'after_image')} disabled={uploading} accept="image/*" />
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label>Kanıt Dokümanları</Label>
            <div className="p-4 border-2 border-dashed rounded-lg text-center">
                <Button asChild variant="outline" size="sm">
                    <label htmlFor="file-upload-ci" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" /> Dosya Yükle
                    </label>
                </Button>
                <Input id="file-upload-ci" type="file" className="hidden" onChange={handleFileChange} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.gif,.xls,.xlsx"/>
                {uploading && <p className="text-sm text-gray-500 mt-2">Yükleniyor...</p>}
            </div>
            {(formState.attachments && formState.attachments.length > 0) && (
                <div className="mt-2 space-y-2">
                    {formState.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                             <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4" />
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate" title={file.name}>{file.name}</a>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeAttachment(index)}><X className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </>
      );

      const renderDetailView = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2"><p className="font-semibold text-gray-500">Açıklama:</p><p className="font-medium text-lg">{viewingItem.description}</p></div>
                <div><p className="font-semibold text-gray-500">Parça Kodu:</p><p className="font-semibold">{viewingItem.part_code || 'N/A'}</p></div>
                <div><p className="font-semibold text-gray-500">Hat / Robot:</p><p>{getLineName(viewingItem.line_id)} / {getRobotName(viewingItem.robot_id)}</p></div>
                <div><p className="font-semibold text-gray-500">Sorumlu:</p><p>{getEmployeeName(viewingItem.responsible_id)}</p></div>
                <div><p className="font-semibold text-gray-500">İyileştirme Tarihi:</p><p>{format(parseISO(viewingItem.improvement_date), 'dd.MM.yyyy')}</p></div>
                <div><p className="font-semibold text-gray-500">Kayıt Tarihi/Saat:</p><p>{viewingItem.created_at ? format(new Date(viewingItem.created_at), 'dd.MM.yyyy HH:mm:ss') : '-'}</p></div>
                <div><p className="font-semibold text-gray-500">Durum:</p><p className="capitalize">{viewingItem.status}</p></div>
            </div>
            {(viewingItem.before_image || viewingItem.after_image) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {viewingItem.before_image && (
                  <div>
                    <p className="font-semibold text-gray-500 mb-2">Önceki Durum</p>
                    <img src={viewingItem.before_image} alt="Önceki durum" className="w-full h-60 object-cover rounded-lg border" />
                  </div>
                )}
                {viewingItem.after_image && (
                  <div>
                    <p className="font-semibold text-gray-500 mb-2">Sonraki Durum</p>
                    <img src={viewingItem.after_image} alt="Sonraki durum" className="w-full h-60 object-cover rounded-lg border" />
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 pt-4">
                 <Card><CardHeader className="p-4"><CardTitle className="text-sm">Önceki Süre</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-xl font-bold">{viewingItem.prev_time} sn</p></CardContent></Card>
                 <Card><CardHeader className="p-4"><CardTitle className="text-sm">Yeni Süre</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-xl font-bold">{viewingItem.new_time} sn</p></CardContent></Card>
                 <Card><CardHeader className="p-4"><CardTitle className="text-sm">Yıllık Adet</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-xl font-bold">{viewingItem.annual_quantity}</p></CardContent></Card>
            </div>
            <Card className="bg-green-50 border-green-200"><CardHeader className="p-4"><CardTitle className="text-base text-green-800">Yıllık Etki</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-3xl font-bold text-green-600">{formatCurrency(calculateImpact(viewingItem))}</p></CardContent></Card>
             {viewingItem.attachments && viewingItem.attachments.length > 0 && (
              <div>
                <h4 className="text-md font-semibold mb-2">Kanıt Dokümanları</h4>
                <div className="space-y-2">
                  {viewingItem.attachments.map((file, index) => (
                    <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-gray-100 rounded-md hover:bg-gray-200">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-sm font-medium text-blue-600 hover:underline">{file.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
        </div>
    );

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2"><TrendingUp className="h-5 w-5" /><span>Sürekli İyileştirme</span></CardTitle>
                  <CardDescription>Yapılan iyileştirmeleri, etkilerini ve durumlarını takip edin.</CardDescription>
                </div>
                <div className="flex space-x-2">
                    <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2"/>Yeni İyileştirme</Button>
                    <Button variant="outline" onClick={() => handlePrint()}><FileText className="h-4 w-4 mr-2"/>Yazdır</Button>
                    <Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2"/>Detaylı Rapor</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ImprovementFilters filters={filters} setFilters={setFilters} lines={lines} />
              <KpiCards improvements={filteredImprovements} calculateImpact={calculateImpact} getLineName={getLineName} />
              <ImprovementTable 
                improvements={filteredImprovements} 
                calculateImpact={calculateImpact} 
                getLineName={getLineName}
                setViewingItem={setViewingItem}
                handlePrint={handlePrint}
                openDialog={openDialog}
                setDeleteConfirm={setDeleteConfirm}
              />
            </CardContent>
          </Card>
          
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader><DialogTitle>{editingItem ? 'İyileştirmeyi Düzenle' : 'Yeni İyileştirme Ekle'}</DialogTitle></DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 modal-body-scroll">{renderForm()}</div>
              <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button><Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/>{editingItem ? 'Güncelle' : 'Kaydet'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={!!viewingItem} onOpenChange={(isOpen) => !isOpen && setViewingItem(null)}>
             <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>İyileştirme Detayı</DialogTitle></DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 modal-body-scroll">{viewingItem && renderDetailView()}</div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handlePrint(viewingItem)}>Yazdır</Button>
                <Button onClick={() => { openDialog(viewingItem); setViewingItem(null); }}>Düzenle</Button>
                <Button variant="destructive" onClick={() => setDeleteConfirm(viewingItem)}>Sil</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Silme Onayı</DialogTitle></DialogHeader>
              <DialogDescription>"{deleteConfirm?.description}" kaydını kalıcı olarak silmek istediğinizden emin misiniz?</DialogDescription>
              <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button><Button variant="destructive" onClick={handleDelete}>Sil</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      );
    };

    export default ContinuousImprovement;