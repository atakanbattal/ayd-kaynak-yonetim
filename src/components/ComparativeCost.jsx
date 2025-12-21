import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, GitCompare, Save, Trash2, Info, FileText, AlertTriangle, Calendar as CalendarIcon, Plus, Edit, Factory, Bot, Paperclip, Upload, X, Download, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, cn, logAction, openPrintWindow } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

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

  const handleGenerateDetailedReport = async () => {
    try {
      toast({ title: "Detaylı operasyon azaltma raporu hazırlanıyor...", description: "Tüm veriler toplanıyor." });

      const dateFrom = filters.quickSelect === 'allTime' 
        ? null 
        : filters.date?.from 
          ? format(startOfDay(filters.date.from), 'yyyy-MM-dd')
          : format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const dateTo = filters.quickSelect === 'allTime'
        ? null
        : filters.date?.to
          ? format(endOfDay(filters.date.to), 'yyyy-MM-dd')
          : format(endOfMonth(new Date()), 'yyyy-MM-dd');

      let query = supabase.from('scenarios').select('*').eq('deleted', false);
      if (dateFrom && dateTo) {
        query = query.gte('scenario_date', dateFrom).lte('scenario_date', dateTo);
      }
      const { data: allScenarios } = await query;

      const filteredData = (allScenarios || []).filter(s => {
        const lineMatch = filters.lines.length === 0 || (s.scope && filters.lines.includes(s.scope.line_id));
        const robotMatch = filters.robots.length === 0 || (s.scope && s.scope.robot_id && filters.robots.includes(s.scope.robot_id));
        const partMatch = !filters.partCode || (s.scope && s.scope.part_code.toLowerCase().includes(filters.partCode.toLowerCase()));
        return lineMatch && robotMatch && partMatch;
      });

      const totalAnnualImprovement = filteredData.reduce((sum, s) => sum + (s.summary?.annualImprovement || 0), 0);
      const totalSavingSeconds = filteredData.reduce((sum, s) => sum + (s.summary?.timeDiff || 0), 0);

      // Hat bazlı analiz
      const byLine = filteredData.reduce((acc, s) => {
        const lineName = getLineName(s.scope?.line_id);
        if (!acc[lineName]) {
          acc[lineName] = { count: 0, impact: 0, savings: 0 };
        }
        acc[lineName].count++;
        acc[lineName].impact += s.summary?.annualImprovement || 0;
        acc[lineName].savings += s.summary?.timeDiff || 0;
        return acc;
      }, {});

      // Parça bazlı analiz
      const byPart = filteredData.reduce((acc, s) => {
        const partCode = s.scope?.part_code || 'Belirtilmemiş';
        if (!acc[partCode]) {
          acc[partCode] = { count: 0, impact: 0, avgImpact: 0 };
        }
        acc[partCode].count++;
        acc[partCode].impact += s.summary?.annualImprovement || 0;
        return acc;
      }, {});

      // Robot bazlı analiz
      const byRobot = filteredData.reduce((acc, s) => {
        const robotName = getRobotName(s.scope?.robot_id) || 'Belirtilmemiş';
        if (!acc[robotName]) {
          acc[robotName] = { count: 0, impact: 0, savings: 0 };
        }
        acc[robotName].count++;
        acc[robotName].impact += s.summary?.annualImprovement || 0;
        acc[robotName].savings += s.summary?.timeDiff || 0;
        return acc;
      }, {});

      // Top 10 en etkili senaryolar
      const top10Scenarios = [...filteredData]
        .sort((a, b) => (b.summary?.annualImprovement || 0) - (a.summary?.annualImprovement || 0))
        .slice(0, 10);

      // Top 10 en etkili hatlar
      const top10Lines = Object.entries(byLine)
        .map(([name, data]) => ({ name, ...data, avgImpact: data.count > 0 ? data.impact / data.count : 0 }))
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 10);

      // Top 10 en etkili parçalar
      const top10Parts = Object.entries(byPart)
        .map(([code, data]) => ({ code, ...data, avgImpact: data.count > 0 ? data.impact / data.count : 0 }))
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 10);

      // Top 10 en etkili robotlar
      const top10Robots = Object.entries(byRobot)
        .map(([name, data]) => ({ name, ...data, avgImpact: data.count > 0 ? data.impact / data.count : 0 }))
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 10);

      const reportId = `RPR-OA-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const reportData = {
        title: 'Operasyon Azaltma - Detaylı Yönetici Raporu',
        reportId,
        filters: {
          'Rapor Dönemi': filters.quickSelect === 'allTime' 
            ? 'Tüm Zamanlar'
            : dateFrom && dateTo
              ? `${format(new Date(dateFrom), 'dd.MM.yyyy', { locale: tr })} - ${format(new Date(dateTo), 'dd.MM.yyyy', { locale: tr })}`
              : 'Belirtilmemiş',
          'Filtreler': `Hat: ${filters.lines.length > 0 ? filters.lines.map(getLineName).join(', ') : 'Tümü'}, Robot: ${filters.robots.length > 0 ? filters.robots.map(getRobotName).join(', ') : 'Tümü'}, Parça: ${filters.partCode || 'Yok'}`,
          'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
          'Toplam Gün': dateFrom && dateTo ? Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1 + ' gün' : 'Tüm Zamanlar'
        },
        kpiCards: [
          { title: 'Toplam Yıllık İyileştirme', value: formatCurrency(totalAnnualImprovement) },
          { title: 'Toplam İyileştirme Kaydı', value: filteredData.length.toString() },
          { title: 'Toplam Süre Kazancı', value: `${totalSavingSeconds.toFixed(2)} sn` },
          { title: 'Ortalama Kazanç/Kayıt', value: `${(filteredData.length > 0 ? totalSavingSeconds / filteredData.length : 0).toFixed(2)} sn` },
          { title: 'Ortalama Etki/Kayıt', value: formatCurrency(filteredData.length > 0 ? totalAnnualImprovement / filteredData.length : 0) },
          { title: 'Farklı Hat Sayısı', value: Object.keys(byLine).length.toString() },
          { title: 'Farklı Parça Sayısı', value: Object.keys(byPart).length.toString() },
          { title: 'Farklı Robot Sayısı', value: Object.keys(byRobot).length.toString() }
        ],
        tableData: {
          headers: ['Kayıt Adı', 'Tarih', 'Hat', 'Robot', 'Parça Kodu', 'Önce (sn)', 'Sonra (sn)', 'Kazanç (sn)', 'Yıllık Etki (₺)', 'Durum'],
          rows: filteredData.map(s => [
            s.name || '-',
            new Date(s.scenario_date).toLocaleDateString('tr-TR'),
            getLineName(s.scope?.line_id),
            getRobotName(s.scope?.robot_id) || 'N/A',
            s.scope?.part_code || 'N/A',
            s.summary?.beforeTotalTime.toFixed(2) || '0',
            s.summary?.afterTotalTime.toFixed(2) || '0',
            s.summary?.timeDiff.toFixed(2) || '0',
            formatCurrency(s.summary?.annualImprovement || 0),
            s.deleted ? 'Silinmiş' : 'Aktif'
          ])
        },
        signatureFields: [
          { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
          { title: 'Kontrol Eden', name: '', role: '..................' },
          { title: 'Onaylayan', name: '', role: '..................' }
        ]
      };

      // Top 10 En Etkili Senaryolar
      reportData.tableData.rows.push(
        ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
        ['TOP 10 EN ETKİLİ SENARYOLAR', '', '', '', '', '', '', '', '', ''],
        ['Sıra', 'Kayıt Adı', 'Tarih', 'Hat', 'Parça Kodu', 'Yıllık Etki', 'Süre Kazancı', 'Önce/Sonra', '', ''],
        ...top10Scenarios.map((s, index) => [
          (index + 1).toString(),
          s.name || '-',
          new Date(s.scenario_date).toLocaleDateString('tr-TR'),
          getLineName(s.scope?.line_id),
          s.scope?.part_code || 'N/A',
          formatCurrency(s.summary?.annualImprovement || 0),
          `${s.summary?.timeDiff.toFixed(2)} sn`,
          `${s.summary?.beforeTotalTime.toFixed(2)}s → ${s.summary?.afterTotalTime.toFixed(2)}s`,
          '', ''
        ])
      );

      // Top 10 En Etkili Hatlar
      reportData.tableData.rows.push(
        ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
        ['TOP 10 EN ETKİLİ HATLAR', '', '', '', '', '', '', '', '', ''],
        ['Sıra', 'Hat Adı', 'Toplam Etki', 'Senaryo Sayısı', 'Ortalama Etki', 'Toplam Süre Kazancı', '', '', '', ''],
        ...top10Lines.map((line, index) => [
          (index + 1).toString(),
          line.name,
          formatCurrency(line.impact),
          line.count.toString(),
          formatCurrency(line.avgImpact),
          `${line.savings.toFixed(2)} sn`,
          '', '', '', ''
        ])
      );

      // Top 10 En Etkili Parçalar
      reportData.tableData.rows.push(
        ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
        ['TOP 10 EN ETKİLİ PARÇALAR', '', '', '', '', '', '', '', '', ''],
        ['Sıra', 'Parça Kodu', 'Toplam Etki', 'Senaryo Sayısı', 'Ortalama Etki', '', '', '', '', ''],
        ...top10Parts.map((part, index) => [
          (index + 1).toString(),
          part.code,
          formatCurrency(part.impact),
          part.count.toString(),
          formatCurrency(part.avgImpact),
          '', '', '', '', ''
        ])
      );

      // Top 10 En Etkili Robotlar
      if (top10Robots.length > 0) {
        reportData.tableData.rows.push(
          ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
          ['TOP 10 EN ETKİLİ ROBOTLAR', '', '', '', '', '', '', '', '', ''],
          ['Sıra', 'Robot Adı', 'Toplam Etki', 'Senaryo Sayısı', 'Ortalama Etki', 'Toplam Süre Kazancı', '', '', '', ''],
          ...top10Robots.map((robot, index) => [
            (index + 1).toString(),
            robot.name,
            formatCurrency(robot.impact),
            robot.count.toString(),
            formatCurrency(robot.avgImpact),
            `${robot.savings.toFixed(2)} sn`,
            '', '', '', ''
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

  // Başarılı hatları analiz et (en başarılıdan başarısıza doğru)
  const successfulLinesData = useMemo(() => {
    const lineStats = {};
    
    filteredScenarios.forEach(s => {
      const lineId = s.scope?.line_id;
      if (!lineId) return;
      
      const lineName = getLineName(lineId);
      if (!lineStats[lineId]) {
        lineStats[lineId] = {
          lineId,
          lineName,
          totalGain: 0,
          count: 0,
          avgGain: 0,
          totalTimeSaving: 0
        };
      }
      
      lineStats[lineId].totalGain += s.summary?.annualImprovement || 0;
      lineStats[lineId].totalTimeSaving += s.summary?.timeDiff || 0;
      lineStats[lineId].count += 1;
    });
    
    // Ortalama kazanç hesapla ve sırala
    return Object.values(lineStats)
      .map(line => ({
        ...line,
        avgGain: line.count > 0 ? line.totalGain / line.count : 0
      }))
      .sort((a, b) => b.totalGain - a.totalGain); // En başarılıdan başarısıza
  }, [filteredScenarios, getLineName]);
  
  // Detaylı analiz verileri
  const analysisData = useMemo(() => {
    // Robot bazlı analiz
    const byRobot = {};
    filteredScenarios.forEach(s => {
      const robotId = s.scope?.robot_id;
      if (!robotId) return;
      const robotName = getRobotName(robotId);
      if (!byRobot[robotId]) {
        byRobot[robotId] = {
          robotId,
          robotName,
          count: 0,
          totalGain: 0,
          totalTimeSaving: 0
        };
      }
      byRobot[robotId].count += 1;
      byRobot[robotId].totalGain += s.summary?.annualImprovement || 0;
      byRobot[robotId].totalTimeSaving += s.summary?.timeDiff || 0;
    });
    
    // Parça bazlı analiz
    const byPart = {};
    filteredScenarios.forEach(s => {
      const partCode = s.scope?.part_code;
      if (!partCode) return;
      if (!byPart[partCode]) {
        byPart[partCode] = {
          partCode,
          count: 0,
          totalGain: 0,
          totalTimeSaving: 0
        };
      }
      byPart[partCode].count += 1;
      byPart[partCode].totalGain += s.summary?.annualImprovement || 0;
      byPart[partCode].totalTimeSaving += s.summary?.timeDiff || 0;
    });
    
    // Aylık trend analizi
    const monthlyTrend = {};
    filteredScenarios.forEach(s => {
      if (!s.scenario_date) return;
      const month = format(parseISO(s.scenario_date), 'yyyy-MM');
      if (!monthlyTrend[month]) {
        monthlyTrend[month] = {
          month,
          count: 0,
          totalGain: 0,
          totalTimeSaving: 0
        };
      }
      monthlyTrend[month].count += 1;
      monthlyTrend[month].totalGain += s.summary?.annualImprovement || 0;
      monthlyTrend[month].totalTimeSaving += s.summary?.timeDiff || 0;
    });
    
    const monthlyTrendArray = Object.values(monthlyTrend)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        monthLabel: format(parseISO(m.month + '-01'), 'MMM yyyy', { locale: tr })
      }));
    
    // Top 10 robotlar
    const top10Robots = Object.values(byRobot)
      .map(r => ({ ...r, avgGain: r.count > 0 ? r.totalGain / r.count : 0 }))
      .sort((a, b) => b.totalGain - a.totalGain)
      .slice(0, 10);
    
    // Top 10 parçalar
    const top10Parts = Object.values(byPart)
      .map(p => ({ ...p, avgGain: p.count > 0 ? p.totalGain / p.count : 0 }))
      .sort((a, b) => b.totalGain - a.totalGain)
      .slice(0, 10);
    
    // Top 10 en etkili senaryolar
    const top10Scenarios = [...filteredScenarios]
      .map(s => ({
        ...s,
        gain: s.summary?.annualImprovement || 0
      }))
      .sort((a, b) => b.gain - a.gain)
      .slice(0, 10);
    
    return {
      byRobot,
      byPart,
      monthlyTrend: monthlyTrendArray,
      top10Robots,
      top10Parts,
      top10Scenarios,
      totalCount: filteredScenarios.length,
      totalGain: filteredScenarios.reduce((sum, s) => sum + (s.summary?.annualImprovement || 0), 0),
      totalTimeSaving: filteredScenarios.reduce((sum, s) => sum + (s.summary?.timeDiff || 0), 0)
    };
  }, [filteredScenarios, getRobotName]);
  
  const COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
        <CardHeader><div className="flex justify-between items-center"><div><CardTitle className="flex items-center space-x-2"><TrendingUp className="h-5 w-5" /><span>Operasyon Azaltma Dashboard</span></CardTitle><CardDescription>Operasyonel iyileştirmeleri ve maliyet etkilerini takip edin.</CardDescription></div><div className="flex space-x-2"><Button onClick={() => { setEditingScenario(null); setFormState(initialFormState); setAnalysisResult(null); setShowFormDialog(true); setIsDirty(false); }}><Plus className="h-4 w-4 mr-2" />Yeni Kayıt</Button><Button variant="outline" onClick={() => handlePrint()}><FileText className="h-4 w-4 mr-2" />Yazdır</Button><Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button></div></div></CardHeader>
        <CardContent>
          <Tabs defaultValue="data" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="data">Veri Takip</TabsTrigger>
              <TabsTrigger value="analysis"><BarChart3 className="h-4 w-4 mr-2" />Detaylı Analiz</TabsTrigger>
            </TabsList>
            
            <TabsContent value="data" className="space-y-4">
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
              
              {/* Başarılı Hatlar Grafiği */}
              {successfulLinesData.length > 0 && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Başarılı Hatlar ve Kazanç Maliyetleri</CardTitle>
                    <CardDescription>En başarılıdan başarısıza doğru hat performansı</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={successfulLinesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="lineName" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name === 'totalGain' || name === 'avgGain') {
                              return formatCurrency(value);
                            }
                            return value;
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalGain" fill="#3b82f6" name="Toplam Kazanç (₺)" />
                        <Bar yAxisId="left" dataKey="avgGain" fill="#10b981" name="Ortalama Kazanç (₺)" />
                        <Bar yAxisId="right" dataKey="count" fill="#f97316" name="Kayıt Sayısı" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
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
            </TabsContent>
            
            <TabsContent value="analysis" className="space-y-6">
              {/* Özet KPI Kartları */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam Senaryo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-700">{analysisData.totalCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">Kayıt sayısı</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam Kazanç</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-700">{formatCurrency(analysisData.totalGain)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Yıllık kazanç</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Ortalama Kazanç</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-700">
                      {formatCurrency(analysisData.totalCount > 0 ? analysisData.totalGain / analysisData.totalCount : 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Senaryo başına</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Toplam Süre Kazancı</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-700">{analysisData.totalTimeSaving.toFixed(2)} sn</div>
                    <p className="text-xs text-muted-foreground mt-1">Saniye</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Robot Bazlı Analiz */}
              {analysisData.top10Robots.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 10 Robot Analizi</CardTitle>
                      <CardDescription>En etkili robotlar ve kazançları</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={analysisData.top10Robots.map(r => ({
                          robot: r.robotName.length > 15 ? r.robotName.substring(0, 15) + '...' : r.robotName,
                          kazanc: r.totalGain,
                          ortalama: r.avgGain,
                          sayi: r.count
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="robot" angle={-45} textAnchor="end" height={100} />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip 
                            formatter={(value, name) => {
                              if (name === 'kazanc' || name === 'ortalama') {
                                return formatCurrency(value);
                              }
                              return value;
                            }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="kazanc" fill="#3b82f6" name="Toplam Kazanç (₺)" />
                          <Bar yAxisId="left" dataKey="ortalama" fill="#10b981" name="Ortalama Kazanç (₺)" />
                          <Bar yAxisId="right" dataKey="sayi" fill="#f97316" name="Kayıt Sayısı" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 10 Robot Detayları</CardTitle>
                      <CardDescription>Robot bazında detaylı istatistikler</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {analysisData.top10Robots.map((robot, index) => (
                          <div key={robot.robotId} className="p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-blue-700">#{index + 1}</span>
                                <p className="font-semibold">{robot.robotName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-blue-600">{formatCurrency(robot.totalGain)}</p>
                                <p className="text-xs text-gray-600">{robot.totalTimeSaving.toFixed(2)} sn</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                              <span>📋 {robot.count} kayıt</span>
                              <span>💰 {formatCurrency(robot.avgGain)} ortalama</span>
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
                    <CardDescription>En çok iyileştirme yapılan parçalar</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={analysisData.top10Parts.map(p => ({
                        parca: p.partCode.length > 15 ? p.partCode.substring(0, 15) + '...' : p.partCode,
                        kazanc: p.totalGain,
                        ortalama: p.avgGain,
                        sure: p.totalTimeSaving
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="parca" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name === 'kazanc' || name === 'ortalama') {
                              return formatCurrency(value);
                            }
                            return value.toFixed(2);
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="kazanc" fill="#3b82f6" name="Toplam Kazanç (₺)" />
                        <Bar yAxisId="left" dataKey="ortalama" fill="#10b981" name="Ortalama Kazanç (₺)" />
                        <Line yAxisId="right" type="monotone" dataKey="sure" stroke="#f97316" strokeWidth={2} name="Süre Kazancı (sn)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              
              {/* Aylık Trend */}
              {analysisData.monthlyTrend.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Aylık İyileştirme Trendi</CardTitle>
                    <CardDescription>Zaman içinde senaryo sayıları ve kazançlar</CardDescription>
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
                            if (name === 'totalGain') {
                              return formatCurrency(value);
                            }
                            return value;
                          }}
                        />
                        <Legend />
                        <Area yAxisId="left" type="monotone" dataKey="count" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Kayıt Sayısı" />
                        <Line yAxisId="right" type="monotone" dataKey="totalGain" stroke="#10b981" strokeWidth={2} name="Toplam Kazanç (₺)" />
                        <Line yAxisId="right" type="monotone" dataKey="totalTimeSaving" stroke="#f97316" strokeWidth={2} name="Süre Kazancı (sn)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              
              {/* Top 10 En Etkili Senaryolar */}
              {analysisData.top10Scenarios.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 En Etkili Senaryolar</CardTitle>
                    <CardDescription>En yüksek kazanca sahip iyileştirmeler</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisData.top10Scenarios.map((scenario, index) => (
                        <div key={scenario.id} className="p-3 bg-green-50 rounded border-l-4 border-green-500">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <span className="text-xl font-bold text-green-700">#{index + 1}</span>
                              <div>
                                <p className="font-semibold">{scenario.name}</p>
                                <p className="text-xs text-gray-600">
                                  {getLineName(scenario.scope?.line_id)} | {scenario.scope?.part_code || 'N/A'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">{formatCurrency(scenario.gain)}</p>
                              <p className="text-xs text-gray-600">
                                {scenario.summary?.timeDiff.toFixed(2)} sn kazanç
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Hat Bazlı Detaylı Analiz */}
              {successfulLinesData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Hat Bazlı Detaylı Performans Analizi</CardTitle>
                    <CardDescription>Tüm hatların kapsamlı performans karşılaştırması</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={500}>
                      <BarChart data={successfulLinesData.slice(0, 15)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="lineName" angle={-45} textAnchor="end" height={120} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name === 'totalGain' || name === 'avgGain') {
                              return formatCurrency(value);
                            }
                            return value;
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalGain" fill="#3b82f6" name="Toplam Kazanç (₺)" />
                        <Bar yAxisId="left" dataKey="avgGain" fill="#10b981" name="Ortalama Kazanç (₺)" />
                        <Bar yAxisId="right" dataKey="count" fill="#f97316" name="Kayıt Sayısı" />
                        <Bar yAxisId="right" dataKey="totalTimeSaving" fill="#8b5cf6" name="Toplam Süre Kazancı (sn)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}><DialogContent className="sm:max-w-[700px]"><DialogHeader><DialogTitle>{editingScenario ? 'İyileştirme Düzenle' : 'Yeni İyileştirme Kaydı'}</DialogTitle></DialogHeader><div className="flex-1 overflow-y-auto px-6 py-4 modal-body-scroll">{renderForm()}</div><DialogFooter><Button variant="outline" onClick={() => setShowFormDialog(false)}>İptal</Button><Button onClick={handleAnalysis}><GitCompare className="h-4 w-4 mr-2" />Analiz Et</Button><Button onClick={handleSaveScenario}><Save className="h-4 w-4 mr-2" />{editingScenario ? 'Güncelle' : 'Kaydet'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!viewingScenario} onOpenChange={() => setViewingScenario(null)}><DialogContent className="sm:max-w-[700px]"><DialogHeader><DialogTitle>İyileştirme Detayı</DialogTitle></DialogHeader><div className="flex-1 overflow-y-auto px-6 py-4 modal-body-scroll">{viewingScenario && renderDetailView(viewingScenario)}</div><DialogFooter><Button variant="outline" onClick={() => handlePrint(viewingScenario)}><FileText className="h-4 w-4 mr-2" /> Yazdır</Button><Button onClick={() => { setEditingScenario(viewingScenario); setFormState(viewingScenario.scope); setShowFormDialog(true); setViewingScenario(null); }}><Edit className="h-4 w-4 mr-2" /> Düzenle</Button><Button variant="destructive" onClick={() => { setDeleteConfirm(viewingScenario); setViewingScenario(null); }}><Trash2 className="h-4 w-4 mr-2" /> Sil</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}><DialogContent><DialogHeader><DialogTitle>Kaydı Sil</DialogTitle><DialogDescription>"{deleteConfirm?.name}" kaydını silmek istediğinizden emin misiniz?</DialogDescription></DialogHeader><DialogFooter className="mt-4"><Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button><Button variant="secondary" onClick={() => handleDelete(deleteConfirm.id, false)}>Çöp Kutusuna Taşı</Button><Button variant="destructive" onClick={() => handleDelete(deleteConfirm.id, true)}>Kalıcı Olarak Sil</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
};

export default ComparativeCost;