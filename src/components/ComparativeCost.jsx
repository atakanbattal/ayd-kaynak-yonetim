import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, GitCompare, Save, Trash2, Info, FileText, AlertTriangle, Calendar as CalendarIcon, Plus, Edit, Factory, Bot, Paperclip, Upload, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, cn, logAction, openPrintWindow } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const initialFormState = {
  line_id: '', robot_id: '', part_code: '', annual_quantity: '',
  before: { robotTime: '', manualTime: '' },
  after: { robotTime: '', manualTime: '' },
  scenario_date: new Date().toISOString(),
  attachments: []
};

const ComparativeCost = () => {
  const [scenarios, setScenarios] = useState([]);
  const [filters, setFilters] = useState({ date: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }, lines: [], robots: [], partCode: '', quickSelect: 'thisMonth' });
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [viewingScenario, setViewingScenario] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [partCodeDuplicate, setPartCodeDuplicate] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [lines, setLines] = useState([]);
  const [robots, setRobots] = useState([]);

  const fetchData = async () => {
    const { data: linesData } = await supabase.from('lines').select('*');
    setLines(linesData || []);
    const { data: robotsData } = await supabase.from('robots').select('*');
    setRobots(robotsData || []);
    const { data: scenariosData } = await supabase.from('scenarios').select('*');
    setScenarios(scenariosData || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form değiştiğinde dirty flag'i set et (sadece dialog açıkken)
  useEffect(() => { 
    if (showFormDialog && (formState.line_id || formState.part_code || formState.annual_quantity || formState.before.robotTime || formState.after.robotTime)) {
      setIsDirty(true); 
    }
  }, [formState, showFormDialog]);

  // Parça kodu değiştiğinde duplikasyon kontrolü
  useEffect(() => {
    if (formState.part_code && !editingScenario) {
      const existingScenarios = scenarios.filter(s => s.part_code === formState.part_code);
      if (existingScenarios.length > 0) {
        setPartCodeDuplicate(existingScenarios.length);
      } else {
        setPartCodeDuplicate(null);
      }
    } else {
      setPartCodeDuplicate(null);
    }
  }, [formState.part_code, scenarios, editingScenario]);

  const getActiveCost = (line) => {
    if (!line || !line.costs || line.costs.length === 0) return { totalCostPerSecond: 0, validFrom: null };
    return [...line.costs].sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom))[0];
  };

  const handleAnalysis = () => {
    if (!formState.line_id) {
      toast({ title: "Eksik Bilgi", description: "Lütfen bir Hat seçin.", variant: "destructive" });
      return;
    }
    
    const line = lines.find(l => l.id.toString() === formState.line_id);
    const activeCost = getActiveCost(line);
    if (!activeCost || !activeCost.totalCostPerSecond) {
      toast({ title: "Maliyet Bilgisi Eksik", description: "Seçilen hat için saniye maliyeti tanımlanmamış.", variant: "destructive" });
      return;
    }

    const beforeTotalTime = (parseFloat(formState.before.robotTime) || 0) + (parseFloat(formState.before.manualTime) || 0);
    const afterTotalTime = (parseFloat(formState.after.robotTime) || 0) + (parseFloat(formState.after.manualTime) || 0);
    const timeDiff = beforeTotalTime - afterTotalTime;
    const annualImprovement = timeDiff * (parseFloat(formState.annual_quantity) || 0) * activeCost.totalCostPerSecond;

    setAnalysisResult({ timeDiff, annualImprovement, costPerSecond: activeCost.totalCostPerSecond });
    toast({ title: "Analiz Tamamlandı" });
  };

  const handleSaveScenario = async () => {
    if (!formState.line_id) {
      toast({ title: "Eksik Bilgi", description: "Lütfen bir Hat seçin.", variant: "destructive" });
      return;
    }

    const line = lines.find(l => l.id.toString() === formState.line_id);
    const activeCost = getActiveCost(line);
    const beforeTotalTime = (parseFloat(formState.before.robotTime) || 0) + (parseFloat(formState.before.manualTime) || 0);
    const afterTotalTime = (parseFloat(formState.after.robotTime) || 0) + (parseFloat(formState.after.manualTime) || 0);
    const timeDiff = beforeTotalTime - afterTotalTime;
    const timeDiffPercent = beforeTotalTime > 0 ? (timeDiff / beforeTotalTime) * 100 : 0;
    const annualImprovement = timeDiff * (parseFloat(formState.annual_quantity) || 0) * (activeCost?.totalCostPerSecond || 0);

    const finalPayload = {
      scope: formState,
      summary: { beforeTotalTime, afterTotalTime, timeDiff, timeDiffPercent, annualImprovement },
      data_source: 'Türetilmiş (Veri Yönetimi + Aktif Profil)',
      cost_snapshot: { costPerSecond: activeCost?.totalCostPerSecond || 0, validFrom: activeCost?.validFrom || null },
      scenario_date: formState.scenario_date || new Date().toISOString(),
      attachments: formState.attachments
    }

    let response;
    if (editingScenario) {
      response = await supabase.from('scenarios').update({ ...finalPayload, name: editingScenario.name }).eq('id', editingScenario.id).select();
    } else {
      const newName = `İyileştirme - ${line?.name || ''} - ${new Date(finalPayload.scenario_date).toLocaleDateString('tr-TR')}`;
      response = await supabase.from('scenarios').insert({ ...finalPayload, name: newName }).select();
    }

    if (response.error) {
      toast({ title: "Kayıt Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: editingScenario ? "İyileştirme Güncellendi" : "İyileştirme Kaydedildi" });
      logAction(editingScenario ? 'UPDATE_SCENARIO' : 'SAVE_SCENARIO', `İyileştirme: ${response.data[0].name}`, user);
      fetchData();
      setShowFormDialog(false);
      setEditingScenario(null);
      setAnalysisResult(null);
      setIsDirty(false);
    }
  };

  const handleDelete = async (id, isPermanent) => {
    let response;
    if (isPermanent) {
      response = await supabase.from('scenarios').delete().eq('id', id);
    } else {
      response = await supabase.from('scenarios').update({ deleted: true }).eq('id', id);
    }

    if (response.error) {
      toast({ title: "Silme Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: "Kayıt Silindi", variant: isPermanent ? "destructive" : "default" });
      logAction(isPermanent ? 'HARD_DELETE_SCENARIO' : 'SOFT_DELETE_SCENARIO', `İyileştirme silindi: ID ${id}`, user);
      fetchData();
    }
    setDeleteConfirm(null);
    setViewingScenario(null);
  };
  
    const handleFileChange = async (event) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setUploading(true);
    
    const file = event.target.files[0];
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('attachments').upload(`comparative_cost/${fileName}`, file);
    
    if (error) {
      toast({ title: "Dosya Yüklenemedi", description: error.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
      setFormState(prev => ({ ...prev, attachments: [...(prev.attachments || []), { name: file.name, url: publicUrl, size: file.size, type: file.type }] }));
      toast({ title: "Dosya Yüklendi", description: file.name });
    }
    setUploading(false);
  };

  const removeAttachment = (indexToRemove) => {
    const fileToRemove = formState.attachments[indexToRemove];
    setFormState(prev => ({ ...prev, attachments: prev.attachments.filter((_, index) => index !== indexToRemove) }));
    toast({ title: "Ek Kaldırıldı", description: fileToRemove.name, variant: "default" });
  };


  const handlePrint = async (item) => {
    const reportId = `RPR-OA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reportData = {
      title: 'Operasyon Azaltma Raporu',
      reportId,
      signatureFields: [
        { title: 'Hazırlayan', name: 'Tuğçe MAVİ BATTAL', role: ' ' },
        { title: 'Kontrol Eden', name: '', role: '..................' },
        { title: 'Onaylayan', name: '', role: '..................' }
      ]
    };

    if (item) {
      reportData.singleItemData = {
        'Kayıt Adı': item.name,
        'Hat': getLineName(item.scope.line_id),
        'Robot': getRobotName(item.scope.robot_id) || 'N/A',
        'Parça Kodu': item.scope.part_code || 'N/A',
        'Kayıt Tarihi': new Date(item.scenario_date).toLocaleDateString('tr-TR'),
        'Önceki Toplam Süre': `${item.summary.beforeTotalTime.toFixed(2)} sn`,
        'Sonraki Toplam Süre': `${item.summary.afterTotalTime.toFixed(2)} sn`,
        'Süre Kazancı': `${item.summary.timeDiff.toFixed(2)} sn`,
        'Yıllık Etki (₺)': formatCurrency(item.summary.annualImprovement),
      };
      reportData.attachments = item.attachments;
    } else {
      reportData.filters = {
        Dönem: filters.quickSelect === 'allTime' ? 'Tüm Zamanlar' : `${format(filters.date.from, 'dd.MM.yy')} - ${format(filters.date.to, 'dd.MM.yy')}`,
        Hat: filters.lines.length > 0 ? filters.lines.map(getLineName).join(', ') : 'Tümü',
        Robot: filters.robots.length > 0 ? filters.robots.map(getRobotName).join(', ') : 'Tümü',
      };
      reportData.kpiCards = [
        { title: 'Yıllık İyileştirme (₺)', value: formatCurrency(dashboardData.totalAnnualImprovement) },
        { title: 'İyileştirme Kaydı', value: dashboardData.count.toString() },
        { title: 'Toplam Süre Kazancı', value: `${dashboardData.totalSavingSeconds.toFixed(2)} sn` },
        { title: 'Ort. Kazanç/Kayıt', value: `${(dashboardData.count > 0 ? dashboardData.totalSavingSeconds / dashboardData.count : 0).toFixed(2)} sn` },
      ];
      reportData.tableData = {
        headers: ['Kayıt Adı', 'Hat', 'Parça Kodu', 'Önce (sn)', 'Sonra (sn)', 'Kazanç (sn)', 'Yıllık Etki (₺)'],
        rows: filteredScenarios.map(s => [
          s.name,
          getLineName(s.scope?.line_id),
          s.scope?.part_code || 'N/A',
          s.summary?.beforeTotalTime.toFixed(2),
          s.summary?.afterTotalTime.toFixed(2),
          s.summary?.timeDiff.toFixed(2),
          formatCurrency(s.summary?.annualImprovement)
        ])
      };
    }

    await openPrintWindow(reportData, toast);
  };

  const getLineName = (lineId) => lines.find(l => l.id.toString() === lineId)?.name || 'N/A';
  const getRobotName = (robotId) => robots.find(r => r.id.toString() === robotId)?.name || 'N/A';

  const filteredScenarios = useMemo(() => {
    return scenarios.filter(s => {
      if (s.deleted) return false;
      const lineMatch = filters.lines.length === 0 || (s.scope && filters.lines.includes(s.scope.line_id));
      const robotMatch = filters.robots.length === 0 || (s.scope && s.scope.robot_id && filters.robots.includes(s.scope.robot_id));
      const partMatch = !filters.partCode || (s.scope && s.scope.part_code.toLowerCase().includes(filters.partCode.toLowerCase()));
      
      if (filters.quickSelect === 'allTime') return lineMatch && robotMatch && partMatch;

      const itemDate = new Date(s.scenario_date);
      const fromDate = filters.date?.from ? startOfDay(new Date(filters.date.from)) : null;
      const toDate = filters.date?.to ? endOfDay(new Date(filters.date.to)) : null;
      const dateMatch = fromDate && toDate ? itemDate >= fromDate && itemDate <= toDate : true;
      return lineMatch && robotMatch && partMatch && dateMatch;
    });
  }, [filters, scenarios]);

  const dashboardData = useMemo(() => {
    const totalAnnualImprovement = filteredScenarios.reduce((sum, s) => sum + (s.summary?.annualImprovement || 0), 0);
    const totalSavingSeconds = filteredScenarios.reduce((sum, s) => sum + (s.summary?.timeDiff || 0), 0);
    return { totalAnnualImprovement, count: filteredScenarios.length, totalSavingSeconds };
  }, [filteredScenarios]);

  const handleDateFilterChange = (quickSelect) => {
    const now = new Date();
    let from, to = endOfDay(now);
    if (quickSelect === 'today') from = startOfDay(now);
    else if (quickSelect === 'thisWeek') from = startOfWeek(now, { locale: tr });
    else if (quickSelect === 'thisMonth') from = startOfMonth(now);
    else if (quickSelect === 'last3Months') from = startOfDay(subMonths(now, 3));
    else if (quickSelect === 'ytd') from = startOfYear(now);
    else if (quickSelect === 'last12Months') from = startOfDay(subMonths(now, 12));
    else if (quickSelect === 'allTime') { from = null; to = null; }
    setFilters(f => ({ ...f, date: { from, to }, quickSelect }));
  };

  const clearFilters = () => setFilters({ date: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) }, lines: [], robots: [], partCode: '', quickSelect: 'thisMonth' });

  const renderForm = () => (
    <>
      {isDirty && !editingScenario && <div className="p-2 mb-2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 flex items-center"><AlertTriangle className="h-5 w-5 mr-3" /> <p className="text-sm font-medium">Taslak – Kaydedilmedi</p></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Hat *</Label><Select value={formState.line_id} onValueChange={(v) => setFormState({...formState, line_id: v})}><SelectTrigger><SelectValue placeholder="Hat seçin" /></SelectTrigger><SelectContent>{lines.map(line => <SelectItem key={line.id} value={line.id.toString()}>{line.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Robot</Label><Select value={formState.robot_id} onValueChange={(v) => setFormState({...formState, robot_id: v})}><SelectTrigger><SelectValue placeholder="Robot seçin" /></SelectTrigger><SelectContent>{robots.filter(r => !formState.line_id || r.line_id.toString() === formState.line_id).map(robot => <SelectItem key={robot.id} value={robot.id.toString()}>{robot.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2">
          <Label>Parça Kodu</Label>
          <Input placeholder="Parça kodu" value={formState.part_code} onChange={(e) => setFormState({...formState, part_code: e.target.value})} />
          {partCodeDuplicate && (
            <div className="mt-1 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
              ⚠️ Bu parça kodu için daha önce {partCodeDuplicate} adet operasyon azaltma kaydı yapılmış!
            </div>
          )}
        </div>
        <div className="space-y-2"><Label>Yıllık Üretim Adedi</Label><Input type="number" placeholder="50000" value={formState.annual_quantity} onChange={(e) => setFormState({...formState, annual_quantity: e.target.value})} /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <Card><CardHeader><CardTitle className="text-base">Önce</CardTitle></CardHeader><CardContent className="space-y-2"><div className="space-y-1"><Label>Robot Süresi (sn)</Label><Input type="number" value={formState.before.robotTime} onChange={(e) => setFormState({...formState, before: {...formState.before, robotTime: e.target.value}})} /></div><div className="space-y-1"><Label>Manuel Süre (sn)</Label><Input type="number" value={formState.before.manualTime} onChange={(e) => setFormState({...formState, before: {...formState.before, manualTime: e.target.value}})} /></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sonra</CardTitle></CardHeader><CardContent className="space-y-2"><div className="space-y-1"><Label>Robot Süresi (sn)</Label><Input type="number" value={formState.after.robotTime} onChange={(e) => setFormState({...formState, after: {...formState.after, robotTime: e.target.value}})} /></div><div className="space-y-1"><Label>Manuel Süre (sn)</Label><Input type="number" value={formState.after.manualTime} onChange={(e) => setFormState({...formState, after: {...formState.after, manualTime: e.target.value}})} /></div></CardContent></Card>
      </div>
       <div className="space-y-2 mt-4">
        <Label>Kayıt Tarihi</Label>
        <Popover>
          <PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formState.scenario_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formState.scenario_date ? format(new Date(formState.scenario_date), "dd MMMM yyyy", { locale: tr }) : <span>Tarih seçin</span>}</Button></PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(formState.scenario_date)} onSelect={(d) => setFormState({ ...formState, scenario_date: d.toISOString() })} initialFocus locale={tr} /></PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2 mt-4">
        <Label>Kanıt Dokümanları</Label>
        <div className="p-4 border-2 border-dashed rounded-lg text-center">
            <Button asChild variant="outline" size="sm">
                <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Dosya Yükle (PDF, Resim, Excel)
                </label>
            </Button>
            <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} disabled={uploading} multiple={false} accept=".pdf,.jpg,.jpeg,.png,.gif,.xls,.xlsx" />
            {uploading && <p className="text-sm text-gray-500 mt-2">Yükleniyor...</p>}
        </div>
        {(formState.attachments && formState.attachments.length > 0) && (
            <div className="mt-2 space-y-2">
                {formState.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                        <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate" title={file.name}>
                                {file.name}
                            </a>
                            <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeAttachment(index)}><X className="h-4 w-4" /></Button>
                    </div>
                ))}
            </div>
        )}
      </div>
      {analysisResult && <Card className="mt-4"><CardContent className="p-4 text-center"><Label>Hesaplanan Yıllık İyileştirme</Label><p className="text-2xl font-bold text-green-600">{formatCurrency(analysisResult.annualImprovement)}</p><p className="text-xs text-muted-foreground">Birim Maliyet: {formatCurrency(analysisResult.costPerSecond)}/sn</p></CardContent></Card>}
    </>
  );

  const renderDetailView = (item) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">İyileştirme Detayı: {item.name}</h3>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div><span className="text-gray-500">Kayıt Tarihi: </span><span className="font-medium">{new Date(item.scenario_date).toLocaleDateString('tr-TR')}</span></div>
        <div><span className="text-gray-500">Hat: </span><span className="font-medium">{getLineName(item.scope.line_id)}</span></div>
        <div><span className="text-gray-500">Parça Kodu: </span><span className="font-medium">{item.scope.part_code || 'N/A'}</span></div>
        <div><span className="text-gray-500">Robot: </span><span className="font-medium">{getRobotName(item.scope.robot_id) || 'N/A'}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="border rounded-lg p-3 bg-gray-50">
          <h4 className="font-bold text-gray-700 mb-2">Önceki Durum</h4>
          <p>Toplam: <span className="font-bold text-red-600">{item.summary.beforeTotalTime.toFixed(2)} sn</span></p>
        </div>
        <div className="border rounded-lg p-3 bg-gray-50">
          <h4 className="font-bold text-gray-700 mb-2">Sonraki Durum</h4>
          <p>Toplam: <span className="font-bold text-green-600">{item.summary.afterTotalTime.toFixed(2)} sn</span></p>
        </div>
      </div>
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-800">Hesaplanan Yıllık Etki</p>
        <p className="text-2xl font-bold text-blue-600">{formatCurrency(item.summary.annualImprovement)}</p>
      </div>
      {item.attachments && item.attachments.length > 0 && (
          <div>
            <h4 className="text-md font-semibold mb-2">Kanıt Dokümanları</h4>
            <div className="space-y-2">
              {item.attachments.map((file, index) => (
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
    <div className="space-y-6">
      <Card>
        <CardHeader><div className="flex justify-between items-center"><div><CardTitle className="flex items-center space-x-2"><TrendingUp className="h-5 w-5" /><span>Operasyon Azaltma Dashboard</span></CardTitle><CardDescription>Operasyonel iyileştirmeleri ve maliyet etkilerini takip edin.</CardDescription></div><div className="flex space-x-2"><Button onClick={() => { setEditingScenario(null); setFormState(initialFormState); setAnalysisResult(null); setShowFormDialog(true); setIsDirty(false); }}><Plus className="h-4 w-4 mr-2" />Yeni Kayıt</Button><Button variant="outline" onClick={() => handlePrint()}><FileText className="h-4 w-4 mr-2" />Yazdır</Button></div></div></CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-4 no-print">
            <div className="space-y-2">
              <Label>Filtreler</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={filters.quickSelect} onValueChange={handleDateFilterChange} className="w-auto"><TabsList><TabsTrigger value="today">Bugün</TabsTrigger><TabsTrigger value="thisWeek">Bu Hafta</TabsTrigger><TabsTrigger value="thisMonth">Bu Ay</TabsTrigger><TabsTrigger value="last3Months">Son 3 Ay</TabsTrigger><TabsTrigger value="ytd">Yıl Başı</TabsTrigger><TabsTrigger value="last12Months">Son 12 Ay</TabsTrigger><TabsTrigger value="allTime">Tüm Zamanlar</TabsTrigger></TabsList></Tabs>
                <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="w-full md:w-auto"><CalendarIcon className="mr-2 h-4 w-4" />Özel Aralık</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={filters.date} onSelect={(date) => setFilters({...filters, date, quickSelect: 'custom'})} locale={tr} /></PopoverContent></Popover>
                <Select onValueChange={(v) => setFilters({...filters, lines: v === 'all' ? [] : [v]})}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Tüm Hatlar" /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Hatlar</SelectItem>{lines.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}</SelectContent></Select>
                <Select onValueChange={(v) => setFilters({...filters, robots: v === 'all' ? [] : [v]})}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Tüm Robotlar" /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Robotlar</SelectItem>{robots.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}</SelectContent></Select>
                <Input placeholder="Parça Kodu Ara..." className="w-[160px]" value={filters.partCode} onChange={(e) => setFilters({...filters, partCode: e.target.value})} />
                <Button variant="ghost" onClick={clearFilters}>Filtreleri Temizle</Button>
              </div>
            </div>
            {(filters.lines.length > 0 || filters.robots.length > 0 || filters.partCode) && <div className="flex items-center space-x-2 pt-2"><div className="flex flex-wrap gap-2">{filters.lines.map(l => <span key={l} className="chip"><Factory className="h-3 w-3 mr-1"/>{getLineName(l)}</span>)}{filters.robots.map(r => <span key={r} className="chip"><Bot className="h-3 w-3 mr-1"/>{getRobotName(r)}</span>)}{filters.partCode && <span className="chip">{filters.partCode}</span>}</div></div>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader><CardTitle className="text-xl">{formatCurrency(dashboardData.totalAnnualImprovement)}</CardTitle><CardDescription>Yıllık İyileştirme (₺)</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-xl">{dashboardData.count}</CardTitle><CardDescription>İyileştirme Kaydı</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-xl">{dashboardData.totalSavingSeconds.toFixed(2)} sn</CardTitle><CardDescription>Toplam Süre Kazancı</CardDescription></CardHeader></Card>
            <Card><CardHeader><CardTitle className="text-xl">{filteredScenarios.length > 0 ? (filteredScenarios.reduce((sum, s) => sum + s.summary.beforeTotalTime, 0) / filteredScenarios.length).toFixed(2) : 0} sn</CardTitle><CardDescription>Ort. Önceki Süre</CardDescription></CardHeader></Card>
          </div>
          <Card className="mt-6">
            <CardHeader><CardTitle>İyileştirme Kayıtları</CardTitle></CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr>{['Kayıt Adı', 'Hat', 'Parça Kodu', 'Önce (sn)', 'Sonra (sn)', 'Kazanç (sn)', 'Yıllık Etki (₺)', ''].map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase ${['Yıllık Etki (₺)', 'Önce (sn)', 'Sonra (sn)', 'Kazanç (sn)'].includes(h) ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredScenarios.length > 0 ? filteredScenarios.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingScenario(s)}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{s.name}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{getLineName(s.scope?.line_id)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{s.scope?.part_code || 'N/A'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{s.summary?.beforeTotalTime.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right">{s.summary?.afterTotalTime.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium">{s.summary?.timeDiff.toFixed(2)}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-green-600 text-right">{formatCurrency(s.summary?.annualImprovement)}</td>
                        <td className="px-4 py-2 text-right no-print"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePrint(s); }}><FileText className="h-4 w-4" /></Button></td>
                      </tr>
                    )) : <tr><td colSpan="8" className="text-center py-10 text-gray-500">Veri bulunamadı.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}><DialogContent className="sm:max-w-[700px]"><DialogHeader><DialogTitle>{editingScenario ? 'İyileştirme Düzenle' : 'Yeni İyileştirme Kaydı'}</DialogTitle></DialogHeader><div className="flex-1 overflow-y-auto px-6 py-4 modal-body-scroll">{renderForm()}</div><DialogFooter><Button variant="outline" onClick={() => setShowFormDialog(false)}>İptal</Button><Button onClick={handleAnalysis}><GitCompare className="h-4 w-4 mr-2" />Analiz Et</Button><Button onClick={handleSaveScenario}><Save className="h-4 w-4 mr-2" />{editingScenario ? 'Güncelle' : 'Kaydet'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!viewingScenario} onOpenChange={() => setViewingScenario(null)}><DialogContent className="sm:max-w-[700px]"><DialogHeader><DialogTitle>İyileştirme Detayı</DialogTitle></DialogHeader><div className="flex-1 overflow-y-auto px-6 py-4 modal-body-scroll">{viewingScenario && renderDetailView(viewingScenario)}</div><DialogFooter><Button variant="outline" onClick={() => handlePrint(viewingScenario)}><FileText className="h-4 w-4 mr-2" /> Yazdır</Button><Button onClick={() => { setEditingScenario(viewingScenario); setFormState(viewingScenario.scope); setShowFormDialog(true); setViewingScenario(null); }}><Edit className="h-4 w-4 mr-2" /> Düzenle</Button><Button variant="destructive" onClick={() => { setDeleteConfirm(viewingScenario); setViewingScenario(null); }}><Trash2 className="h-4 w-4 mr-2" /> Sil</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}><DialogContent><DialogHeader><DialogTitle>Kaydı Sil</DialogTitle><DialogDescription>"{deleteConfirm?.name}" kaydını silmek istediğinizden emin misiniz?</DialogDescription></DialogHeader><DialogFooter className="mt-4"><Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button><Button variant="secondary" onClick={() => handleDelete(deleteConfirm.id, false)}>Çöp Kutusuna Taşı</Button><Button variant="destructive" onClick={() => handleDelete(deleteConfirm.id, true)}>Kalıcı Olarak Sil</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};

export default ComparativeCost;