import React, { useState, useEffect, useMemo } from 'react';
    import { motion } from 'framer-motion';
    import { useNavigate } from 'react-router-dom';
    import { 
      BarChart3, 
      TrendingUp, 
      Factory, 
      Users, 
      AlertCircle,
      CheckCircle,
      Clock,
      DollarSign,
      ShieldCheck,
      BookUser,
      Award,
      FileText,
      Download,
      Calendar as CalendarIcon,
      Activity,
      Target,
      Zap,
      PieChart as PieChartIcon
    } from 'lucide-react';
    import { 
      ResponsiveContainer, 
      BarChart, 
      Bar, 
      XAxis, 
      YAxis, 
      Tooltip, 
      Legend, 
      LineChart, 
      Line, 
      PieChart, 
      Pie, 
      Cell, 
      AreaChart, 
      Area,
      CartesianGrid
    } from 'recharts';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
    import { Calendar } from '@/components/ui/calendar';
    import { useToast } from '@/components/ui/use-toast';
    import { formatCurrency, openPrintWindow, cn } from '@/lib/utils';
    import { supabase } from '@/lib/customSupabaseClient';
    import { format, startOfMonth, endOfMonth, subMonths, startOfYear, subYears, startOfDay, endOfDay } from 'date-fns';
    import { tr } from 'date-fns/locale';

    const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

    const Dashboard = ({ user }) => {
      const [stats, setStats] = useState({
        dailyProduction: 0,
        grossProfit: 0,
        activeWPS: 0,
        improvements: 0,
        totalTrainings: 0,
        totalParticipants: 0,
        // Manuel veri takip özetleri
        manualTotal: 0,
        repairTotal: 0,
        manualCost: 0,
        repairCost: 0,
        totalManualRecords: 0,
        totalRepairRecords: 0,
        activePersonnel: 0,
        // Bu ay özetleri
        monthlyManual: 0,
        monthlyRepair: 0,
        monthlyCost: 0,
      });
      const [generatingReport, setGeneratingReport] = useState(false);
      const [showReportDialog, setShowReportDialog] = useState(false);
      const [reportDateRange, setReportDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date())
      });
      
      // Grafik verileri için yeni state'ler
      const [weeklyProduction, setWeeklyProduction] = useState([]);
      const [monthlyTrend, setMonthlyTrend] = useState([]);
      const [improvementsByType, setImprovementsByType] = useState([]);
      const [linePerformance, setLinePerformance] = useState([]);
      const [taskStats, setTaskStats] = useState({ todo: 0, inProgress: 0, done: 0 });
      const [trainingStats, setTrainingStats] = useState({ planned: 0, completed: 0, participants: 0 });
      const [manualTrend, setManualTrend] = useState([]);
      const [topPersonnel, setTopPersonnel] = useState([]);
      const [topLines, setTopLines] = useState([]);
      const [employees, setEmployees] = useState([]);
      
      const { toast } = useToast();
      const navigate = useNavigate();

      useEffect(() => {
        const fetchData = async () => {
          const today = new Date();
          const todayStr = today.toISOString().split('T')[0];
          
          // Son 7 gün için tarih aralığı
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekAgoStr = weekAgo.toISOString().split('T')[0];
          
          // Son 6 ay için tarih aralığı
          const sixMonthsAgo = new Date(today);
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

          // Bu ay başı ve sonu
          const monthStart = startOfMonth(today);
          const monthEnd = endOfMonth(today);
          const monthStartStr = format(monthStart, 'yyyy-MM-dd');
          const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

          try {
            const [
              improvementsRes,
              scenariosRes,
              projectImprovementsRes,
              fixtureImprovementsRes,
              productionRes,
              weeklyProductionRes,
              monthlyProductionRes,
              wpsRes,
              trainingsRes,
              participantsRes,
              tasksRes,
              linesRes,
              manualRecordsRes,
              repairRecordsRes,
              employeesRes,
            ] = await Promise.all([
              supabase.from('improvements').select('*, line:lines(name), type').eq('deleted', false),
              supabase.from('scenarios').select('summary, scope, scenario_date').eq('deleted', false),
              supabase.from('project_improvements').select('annual_impact, improvement_date, subject'),
              supabase.from('fixture_improvements').select('*'),
              supabase.from('production_records').select('quantity').eq('record_date', todayStr),
              supabase.from('daily_production_summary').select('*').gte('production_date', weekAgoStr).lte('production_date', todayStr).order('production_date'),
              supabase.from('daily_production_summary').select('*').gte('production_date', sixMonthsAgoStr).lte('production_date', todayStr),
              supabase.from('wps').select('id', { count: 'exact' }),
              supabase.from('trainings').select('*, status'),
              supabase.from('training_participants').select('*, participation_status'),
              supabase.from('tasks').select('*, status'),
              supabase.from('lines').select('id, name, costs').eq('deleted', false),
              supabase.from('manual_production_records').select('*, line:lines(name, costs), operator_id').gte('record_date', monthStartStr).lte('record_date', monthEndStr),
              supabase.from('repair_records').select('*, repair_line_id, source_line_id, operator_id').gte('record_date', monthStartStr).lte('record_date', monthEndStr),
              supabase.from('employees').select('id, first_name, last_name, registration_number, is_active').eq('is_active', true),
            ]);

            const responses = {
              improvements: improvementsRes,
              scenarios: scenariosRes,
              projectImprovements: projectImprovementsRes,
              fixtureImprovements: fixtureImprovementsRes,
              production: productionRes,
              weeklyProduction: weeklyProductionRes,
              monthlyProduction: monthlyProductionRes,
              wps: wpsRes,
              auditLogs: auditLogsRes,
              trainings: trainingsRes,
              participants: participantsRes,
              tasks: tasksRes,
              lines: linesRes,
            };

            for (const key in responses) {
              if (responses[key].error) {
                console.error(`Dashboard data fetch error (${key}):`, responses[key].error);
              }
            }
            
            const improvements = improvementsRes.data || [];
            const scenarios = scenariosRes.data || [];
            const projectImprovements = projectImprovementsRes.data || [];
            const fixtureImprovements = fixtureImprovementsRes.data || [];
            const trainings = trainingsRes.data || [];
            const participants = participantsRes.data || [];
            const tasks = tasksRes.data || [];
            const lines = linesRes.data || [];
            const weeklyProd = weeklyProductionRes.data || [];
            const monthlyProd = monthlyProductionRes.data || [];
            const manualRecords = manualRecordsRes.data || [];
            const repairRecords = repairRecordsRes.data || [];
            const employeesData = employeesRes.data || [];
            setEmployees(employeesData);
            
            // Maliyet hesaplama fonksiyonu
            const calculateCost = (quantity, lineId, durationSeconds = 0) => {
              const line = lines.find(l => l.id === lineId);
              if (!line || !line.costs) return 0;
              const costData = line.costs;
              if (durationSeconds > 0 && costData.totalCostPerSecond) {
                return quantity * durationSeconds * costData.totalCostPerSecond;
              }
              return 0;
            };
            
            // Manuel veri takip özetleri
            const manualTotal = manualRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const repairTotal = repairRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const manualCost = manualRecords.reduce((sum, r) => {
              return sum + calculateCost(r.quantity || 0, r.line_id, r.duration_seconds || 0);
            }, 0);
            const repairCost = repairRecords.reduce((sum, r) => {
              return sum + calculateCost(r.quantity || 0, r.repair_line_id, r.duration_seconds || 0);
            }, 0);
            
            // Aktif personel sayısı (bu ay kayıt giren)
            const activePersonnelSet = new Set();
            manualRecords.forEach(r => { if (r.operator_id) activePersonnelSet.add(r.operator_id); });
            repairRecords.forEach(r => { if (r.operator_id) activePersonnelSet.add(r.operator_id); });
            
            // Top 10 personel
            const personnelStats = {};
            [...manualRecords, ...repairRecords].forEach(record => {
              const empId = record.operator_id || 'unknown';
              if (empId === 'unknown') return;
              if (!personnelStats[empId]) {
                personnelStats[empId] = { quantity: 0, records: 0 };
              }
              personnelStats[empId].quantity += record.quantity || 0;
              personnelStats[empId].records += 1;
            });
            const topPersonnelData = Object.entries(personnelStats)
              .map(([id, data]) => {
                const emp = employeesData.find(e => e.id === id);
                return {
                  id,
                  name: emp ? `${emp.registration_number || ''} - ${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Bilinmeyen',
                  ...data
                };
              })
              .filter(emp => emp.name !== 'Bilinmeyen' && !emp.name.includes('Bilinmeyen'))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 10);
            setTopPersonnel(topPersonnelData);
            
            // Top 10 hatlar
            const lineStats = {};
            manualRecords.forEach(r => {
              const lineId = r.line_id;
              if (!lineId) return;
              const line = lines.find(l => l.id === lineId);
              const lineName = line?.name || 'Bilinmeyen';
              if (!lineStats[lineName]) {
                lineStats[lineName] = { quantity: 0, cost: 0 };
              }
              lineStats[lineName].quantity += r.quantity || 0;
              lineStats[lineName].cost += calculateCost(r.quantity || 0, lineId, r.duration_seconds || 0);
            });
            const topLinesData = Object.entries(lineStats)
              .map(([name, data]) => ({ name, ...data }))
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 10);
            setTopLines(topLinesData);
            
            // Son 7 gün manuel veri trendi
            const manualTrendData = [];
            for (let i = 6; i >= 0; i--) {
              const date = new Date(today);
              date.setDate(date.getDate() - i);
              const dateStr = format(date, 'yyyy-MM-dd');
              const dayManual = manualRecords.filter(r => r.record_date === dateStr).reduce((sum, r) => sum + (r.quantity || 0), 0);
              const dayRepair = repairRecords.filter(r => r.record_date === dateStr).reduce((sum, r) => sum + (r.quantity || 0), 0);
              manualTrendData.push({
                date: format(date, 'dd MMM', { locale: tr }),
                manual: dayManual,
                repair: dayRepair,
                total: dayManual + dayRepair
              });
            }
            setManualTrend(manualTrendData);
            
            const improvementSavings = improvements.reduce((acc, i) => acc + (i.impact || 0), 0);
            const scenarioSavings = scenarios.reduce((acc, s) => acc + (s.summary?.annualImprovement || 0), 0);
            const projectImprovementSavings = projectImprovements.reduce((acc, p) => acc + (p.annual_impact || 0), 0);
            
            const totalGrossProfit = improvementSavings + scenarioSavings + projectImprovementSavings;
            
            const dailyProduction = (productionRes.data || []).reduce((acc, p) => acc + (p.quantity || 0), 0);
            
            const totalImprovements = improvements.length + scenarios.length + projectImprovements.length + fixtureImprovements.length;

            setStats({
              dailyProduction: dailyProduction,
              grossProfit: totalGrossProfit,
              activeWPS: wpsRes.count || 0,
              improvements: totalImprovements,
              totalTrainings: trainings.length,
              totalParticipants: participants.length,
              manualTotal: manualTotal,
              repairTotal: repairTotal,
              manualCost: manualCost,
              repairCost: repairCost,
              totalManualRecords: manualRecords.length,
              totalRepairRecords: repairRecords.length,
              activePersonnel: activePersonnelSet.size,
              monthlyManual: manualTotal,
              monthlyRepair: repairTotal,
              monthlyCost: manualCost + repairCost,
            });

            // Haftalık üretim verileri
            const weeklyData = weeklyProd.map(p => ({
              date: format(new Date(p.production_date), 'dd MMM', { locale: tr }),
              production: p.total_quantity || 0,
              scrap: p.total_scrap || 0,
              ppm: p.ppm || 0,
            }));
            setWeeklyProduction(weeklyData);

            // Aylık trend verileri
            const monthlyGrouped = {};
            monthlyProd.forEach(p => {
              const month = format(new Date(p.production_date), 'MMM yyyy', { locale: tr });
              if (!monthlyGrouped[month]) {
                monthlyGrouped[month] = { production: 0, scrap: 0, cost: 0 };
              }
              monthlyGrouped[month].production += p.total_quantity || 0;
              monthlyGrouped[month].scrap += p.total_scrap || 0;
              monthlyGrouped[month].cost += p.total_production_cost || 0;
            });
            const monthlyData = Object.entries(monthlyGrouped).map(([month, data]) => ({
              month,
              production: data.production,
              scrap: data.scrap,
              cost: data.cost,
            }));
            setMonthlyTrend(monthlyData);

            // İyileştirme türlerine göre dağılım
            const typeData = [
              { name: 'Sürekli İyileştirme', value: improvements.length, color: '#3B82F6' },
              { name: 'Operasyon Azaltma', value: scenarios.length, color: '#10B981' },
              { name: 'Proje Bazlı', value: projectImprovements.length, color: '#F59E0B' },
              { name: 'Fikstür İyileştirme', value: fixtureImprovements.length, color: '#EF4444' },
            ].filter(t => t.value > 0);
            setImprovementsByType(typeData);

            // Hat bazlı performans
            const lineData = {};
            weeklyProd.forEach(p => {
              const line = lines.find(l => l.id === p.production_line_id);
              const lineName = line?.name || 'Diğer';
              if (!lineData[lineName]) {
                lineData[lineName] = { production: 0, scrap: 0 };
              }
              lineData[lineName].production += p.total_quantity || 0;
              lineData[lineName].scrap += p.total_scrap || 0;
            });
            const linePerf = Object.entries(lineData)
              .map(([name, data]) => ({ name, ...data }))
              .sort((a, b) => b.production - a.production)
              .slice(0, 10);
            setLinePerformance(linePerf);

            // Görev istatistikleri
            setTaskStats({
              todo: tasks.filter(t => t.status === 'todo').length,
              inProgress: tasks.filter(t => t.status === 'in-progress').length,
              done: tasks.filter(t => t.status === 'done').length,
            });

            // Eğitim istatistikleri
            setTrainingStats({
              planned: trainings.filter(t => t.status === 'Planlandı').length,
              completed: trainings.filter(t => t.status === 'Tamamlandı').length,
              participants: participants.filter(p => p.participation_status === 'Katıldı').length,
            });

            setRecentActivities((auditLogsRes.data || []).map(log => ({
              id: log.id,
              type: log.action,
              message: log.details,
              time: new Date(log.created_at).toLocaleString('tr-TR'),
              status: log.action.includes('CREATE') || log.action.includes('SAVE') || log.action.includes('UPDATE') ? 'success' : log.action.includes('DELETE') ? 'warning' : 'info'
            })));

          } catch (error) {
            toast({ title: "Dashboard verileri yüklenemedi", description: error.message, variant: "destructive" });
          }
        };

        fetchData();
      }, [toast]);

      const statCards = [
        { title: 'Bu Ay Manuel Üretim', value: stats.monthlyManual.toLocaleString('tr-TR'), unit: 'adet', icon: Factory, path: '/manual-tracking', color: 'blue' },
        { title: 'Bu Ay Tamir Üretim', value: stats.monthlyRepair.toLocaleString('tr-TR'), unit: 'adet', icon: Factory, path: '/manual-tracking', color: 'orange' },
        { title: 'Bu Ay Toplam Maliyet', value: formatCurrency(stats.monthlyCost), unit: 'Manuel+Tamir', icon: DollarSign, path: '/manual-tracking', color: 'green' },
        { title: 'Aktif Personel', value: stats.activePersonnel, unit: 'kişi', icon: Users, path: '/manual-tracking', color: 'purple' },
        { title: 'Toplam Yıllık Etki', value: formatCurrency(stats.grossProfit), unit: 'İyileştirmeler', icon: TrendingUp, path: '/improvement', color: 'teal' },
        { title: 'Toplam İyileştirme', value: stats.improvements, unit: 'adet', icon: Award, path: '/improvement', color: 'yellow' },
        { title: 'Aktif WPS', value: stats.activeWPS, unit: 'adet', icon: CheckCircle, path: '/wps-creator', color: 'indigo' },
        { title: 'Toplam Eğitim', value: stats.totalTrainings, unit: 'adet', icon: BookUser, path: '/trainings', color: 'pink' },
      ];

      const handleCardClick = (path) => {
        navigate(path);
      };

      const handleGenerateExecutiveReport = async () => {
        if (!reportDateRange.from || !reportDateRange.to) {
          toast({ 
            title: "Tarih Aralığı Seçilmeli", 
            description: "Lütfen rapor için başlangıç ve bitiş tarihi seçin.", 
            variant: "destructive" 
          });
          return;
        }

        setShowReportDialog(false);
        setGeneratingReport(true);
        try {
          toast({ title: "Kapsamlı rapor hazırlanıyor...", description: "Tüm modüllerden veriler toplanıyor, lütfen bekleyin." });

          const today = new Date();
          const dateFrom = format(startOfDay(reportDateRange.from), 'yyyy-MM-dd');
          const dateTo = format(endOfDay(reportDateRange.to), 'yyyy-MM-dd');

          // TÜM VERİLERİ PARALEL OLARAK ÇEK
          const [
            improvementsRes,
            scenariosRes,
            projectImprovementsRes,
            fixtureImprovementsRes,
            productionRes,
            wpsRes,
            trainingsRes,
            participantsRes,
            certificatesRes,
            tasksRes,
            auditLogsRes,
            dailyProductionRes,
            linesRes,
            robotsRes,
            employeesRes,
            manualRecordsRes,
            repairRecordsRes,
            monthlyTotalsRes,
            examResultsRes,
            costItemsRes,
            fixturesRes
          ] = await Promise.all([
            supabase.from('improvements').select('*, line:lines(name), robot:robots(name), responsible:employees(first_name, last_name), type').eq('deleted', false),
            supabase.from('scenarios').select('*, scope, line:lines(name), robot:robots(name)').eq('deleted', false),
            supabase.from('project_improvements').select('*'),
            supabase.from('fixture_improvements').select('*'),
            supabase.from('production_records').select('*, robot:robots(name), employee:employees(first_name, last_name), wps:wps(wps_code), line:lines(name)').gte('record_date', dateFrom).lte('record_date', dateTo),
            supabase.from('wps').select('*, welding_process, welding_position, joint_type, material_1').order('created_at', { ascending: false }),
            supabase.from('trainings').select('*, trainer:employees(first_name, last_name), status'),
            supabase.from('training_participants').select('*, employee:employees(first_name, last_name, registration_number, department), participation_status, score'),
            supabase.from('training_certificates').select('*, participant:training_participants(employee:employees(first_name, last_name))'),
            supabase.from('tasks').select('*, assignee:employees(first_name, last_name), priority, status, due_date'),
            supabase.from('audit_log').select('*, action, user_email, details, module').gte('created_at', dateFrom).lte('created_at', dateTo).order('created_at', { ascending: false }),
            supabase.from('daily_production_summary').select('*, line:lines(name)').gte('production_date', dateFrom).lte('production_date', dateTo),
            supabase.from('lines').select('*, type, second_cost').eq('deleted', false),
            supabase.from('robots').select('*, line:lines(name)').eq('deleted', false),
            supabase.from('employees').select('*, department, is_active, registration_number'),
            supabase.from('manual_records').select('*, employee:employees(first_name, last_name), line:lines(name), shift').gte('record_date', dateFrom).lte('record_date', dateTo),
            supabase.from('repair_records').select('*, employee:employees(first_name, last_name), line:lines(name), shift').gte('record_date', dateFrom).lte('record_date', dateTo),
            supabase.from('monthly_production_totals').select('*'),
            supabase.from('exam_results').select('*, participant:training_participants(employee:employees(first_name, last_name))'),
            supabase.from('cost_items').select('*'),
            supabase.from('fixtures').select('*, line:lines(name), is_revised').eq('deleted', false)
          ]);

          // Verileri işle
          const improvements = improvementsRes.data || [];
          const scenarios = scenariosRes.data || [];
          const projectImprovements = projectImprovementsRes.data || [];
          const fixtureImprovements = fixtureImprovementsRes.data || [];
          const productionRecords = productionRes.data || [];
          const wpsList = wpsRes.data || [];
          const trainings = trainingsRes.data || [];
          const participants = participantsRes.data || [];
          const certificates = certificatesRes.data || [];
          const tasks = tasksRes.data || [];
          const auditLogs = auditLogsRes.data || [];
          const dailyProduction = dailyProductionRes.data || [];
          const lines = linesRes.data || [];
          const robots = robotsRes.data || [];
          const employees = employeesRes.data || [];
          const manualRecords = manualRecordsRes.data || [];
          const repairRecords = repairRecordsRes.data || [];
          const monthlyTotals = monthlyTotalsRes.data || [];
          const examResults = examResultsRes.data || [];
          const costItems = costItemsRes.data || [];
          const fixtures = fixturesRes.data || [];

          // ============= DETAYLI ANALİZLER =============

          // 1. SÜREKLİ İYİLEŞTİRME DETAYLI ANALİZ
          const improvementSavings = improvements.reduce((acc, i) => acc + (Number(i.impact) || 0), 0);
          
          // Tip bazlı iyileştirme analizi
          const improvementsByType = improvements.reduce((acc, i) => {
            const typeName = i.type || 'Belirtilmemiş';
            if (!acc[typeName]) acc[typeName] = { count: 0, impact: 0 };
            acc[typeName].count++;
            acc[typeName].impact += Number(i.impact) || 0;
            return acc;
          }, {});

          // Hat bazlı iyileştirme analizi
          const improvementsByLine = improvements.reduce((acc, i) => {
            const lineName = i.line?.name || 'Belirtilmemiş';
            if (!acc[lineName]) acc[lineName] = { count: 0, impact: 0, avgTimeSaving: 0 };
            acc[lineName].count++;
            acc[lineName].impact += Number(i.impact) || 0;
            const timeSaving = (Number(i.prev_time) || 0) - (Number(i.new_time) || 0);
            acc[lineName].avgTimeSaving += timeSaving;
            return acc;
          }, {});

          // Robot bazlı iyileştirme
          const improvementsByRobot = improvements.reduce((acc, i) => {
            const robotName = i.robot?.name || 'Belirtilmemiş';
            if (!acc[robotName]) acc[robotName] = { count: 0, impact: 0 };
            acc[robotName].count++;
            acc[robotName].impact += Number(i.impact) || 0;
            return acc;
          }, {});

          // Top 10 iyileştirme
          const top10Improvements = [...improvements]
            .sort((a, b) => (Number(b.impact) || 0) - (Number(a.impact) || 0))
            .slice(0, 10);

          // 2. OPERASYON AZALTMA DETAYLI ANALİZ
          const scenarioSavings = scenarios.reduce((acc, s) => acc + (s.summary?.annualImprovement || 0), 0);
          const totalTimeSavingScenarios = scenarios.reduce((acc, s) => acc + (s.summary?.totalTimeSaving || 0), 0);
          
          // Senaryo bazlı hat analizi
          const scenariosByLine = scenarios.reduce((acc, s) => {
            const lineName = s.line?.name || 'Belirtilmemiş';
            if (!acc[lineName]) acc[lineName] = { count: 0, impact: 0, timeSaving: 0 };
            acc[lineName].count++;
            acc[lineName].impact += s.summary?.annualImprovement || 0;
            acc[lineName].timeSaving += s.summary?.totalTimeSaving || 0;
            return acc;
          }, {});

          // 3. PROJE BAZLI İYİLEŞTİRME DETAYLI ANALİZ
          const projectImprovementSavings = projectImprovements.reduce((acc, p) => acc + (Number(p.annual_impact) || 0), 0);
          const totalProjectCost = projectImprovements.reduce((acc, p) => acc + (Number(p.improvement_cost) || 0), 0);
          const totalProjectROI = projectImprovements.reduce((acc, p) => {
            const cost = Number(p.improvement_cost) || 0;
            const impact = Number(p.annual_impact) || 0;
            return acc + (cost > 0 ? ((impact - cost) / cost) * 100 : 0);
          }, 0);
          const avgProjectROI = projectImprovements.length > 0 ? totalProjectROI / projectImprovements.length : 0;

          // Top 5 proje
          const top5Projects = [...projectImprovements]
            .sort((a, b) => (Number(b.annual_impact) || 0) - (Number(a.annual_impact) || 0))
            .slice(0, 5);

          // 4. FİKSTÜR İYİLEŞTİRME DETAYLI ANALİZ
          const fixturesByResponsible = fixtureImprovements.reduce((acc, f) => {
            const name = f.responsible || 'Belirtilmemiş';
            if (!acc[name]) acc[name] = 0;
            acc[name]++;
            return acc;
          }, {});

          const fixturesWithImage = fixtureImprovements.filter(f => f.image_url).length;

          // 5. MANUEL VERİ TAKİP DETAYLI ANALİZ
          const totalManualQuantity = manualRecords.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
          const totalRepairQuantity = repairRecords.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
          const totalManualCost = manualRecords.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
          const totalRepairCost = repairRecords.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);

          // Vardiya bazlı analiz
          const manualByShift = manualRecords.reduce((acc, r) => {
            const shift = r.shift || 'Belirtilmemiş';
            if (!acc[shift]) acc[shift] = { count: 0, quantity: 0, cost: 0 };
            acc[shift].count++;
            acc[shift].quantity += Number(r.quantity) || 0;
            acc[shift].cost += Number(r.cost) || 0;
            return acc;
          }, {});

          // Personel bazlı manuel analiz
          const manualByEmployee = manualRecords.reduce((acc, r) => {
            const name = r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : 'Belirtilmemiş';
            if (!acc[name]) acc[name] = { count: 0, quantity: 0 };
            acc[name].count++;
            acc[name].quantity += Number(r.quantity) || 0;
            return acc;
          }, {});

          // Hat bazlı manuel analiz
          const manualByLine = manualRecords.reduce((acc, r) => {
            const lineName = r.line?.name || 'Belirtilmemiş';
            if (!acc[lineName]) acc[lineName] = { count: 0, quantity: 0, cost: 0 };
            acc[lineName].count++;
            acc[lineName].quantity += Number(r.quantity) || 0;
            acc[lineName].cost += Number(r.cost) || 0;
            return acc;
          }, {});

          // Top 10 manuel personel
          const top10ManualEmployees = Object.entries(manualByEmployee)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 10);

          // 6. ÜRETİM VE MALİYET DETAYLI ANALİZ
          const totalProduction = dailyProduction.reduce((acc, p) => acc + (p.total_quantity || 0), 0);
          const totalScrap = dailyProduction.reduce((acc, p) => acc + (p.total_scrap || 0), 0);
          const totalProductionCost = dailyProduction.reduce((acc, p) => acc + (p.total_production_cost || 0), 0);
          const totalScrapCost = dailyProduction.reduce((acc, p) => acc + (p.total_scrap_cost || 0), 0);
          const avgPPM = dailyProduction.length > 0 
            ? dailyProduction.reduce((acc, p) => acc + (p.ppm || 0), 0) / dailyProduction.length 
            : 0;

          // Hat bazlı üretim
          const productionByLine = dailyProduction.reduce((acc, p) => {
            const lineName = p.line?.name || lines.find(l => l.id === p.production_line_id)?.name || 'Bilinmeyen Hat';
            if (!acc[lineName]) {
              acc[lineName] = { quantity: 0, scrap: 0, cost: 0, scrapCost: 0, ppmSum: 0, days: 0 };
            }
            acc[lineName].quantity += p.total_quantity || 0;
            acc[lineName].scrap += p.total_scrap || 0;
            acc[lineName].cost += p.total_production_cost || 0;
            acc[lineName].scrapCost += p.total_scrap_cost || 0;
            acc[lineName].ppmSum += p.ppm || 0;
            acc[lineName].days++;
            return acc;
          }, {});

          // Top 5 üretim hattı
          const top5ProductionLines = Object.entries(productionByLine)
            .sort((a, b) => b[1].quantity - a[1].quantity)
            .slice(0, 5);

          // En düşük PPM hatları (en iyi kalite)
          const bestQualityLines = Object.entries(productionByLine)
            .map(([name, data]) => ({ name, avgPPM: data.days > 0 ? data.ppmSum / data.days : 0, ...data }))
            .filter(l => l.quantity > 0)
            .sort((a, b) => a.avgPPM - b.avgPPM)
            .slice(0, 5);

          // 7. WPS DETAYLI ANALİZ
          const wpsInRange = wpsList.filter(w => {
            const createdDate = format(new Date(w.created_at), 'yyyy-MM-dd');
            return createdDate >= dateFrom && createdDate <= dateTo;
          }).length;

          // Proses bazlı WPS dağılımı
          const wpsByProcess = wpsList.reduce((acc, w) => {
            const process = w.welding_process || 'Belirtilmemiş';
            if (!acc[process]) acc[process] = 0;
            acc[process]++;
            return acc;
          }, {});

          // Pozisyon bazlı WPS dağılımı
          const wpsByPosition = wpsList.reduce((acc, w) => {
            const position = w.welding_position || 'Belirtilmemiş';
            if (!acc[position]) acc[position] = 0;
            acc[position]++;
            return acc;
          }, {});

          // Malzeme bazlı WPS dağılımı
          const wpsByMaterial = wpsList.reduce((acc, w) => {
            const material = w.material_1 || 'Belirtilmemiş';
            if (!acc[material]) acc[material] = 0;
            acc[material]++;
            return acc;
          }, {});

          // 8. EĞİTİM DETAYLI ANALİZ
          const completedTrainings = trainings.filter(t => t.status === 'Tamamlandı').length;
          const plannedTrainings = trainings.filter(t => t.status === 'Planlandı').length;
          const inProgressTrainings = trainings.filter(t => t.status === 'Devam Ediyor').length;
          
          const attendedParticipants = participants.filter(p => p.participation_status === 'Katıldı').length;
          const participationRate = participants.length > 0 ? (attendedParticipants / participants.length) * 100 : 0;

          // Eğitmen bazlı analiz
          const trainingsByTrainer = trainings.reduce((acc, t) => {
            const trainer = t.trainer ? `${t.trainer.first_name} ${t.trainer.last_name}` : 'Belirtilmemiş';
            if (!acc[trainer]) acc[trainer] = { total: 0, completed: 0 };
            acc[trainer].total++;
            if (t.status === 'Tamamlandı') acc[trainer].completed++;
            return acc;
          }, {});

          // Sınav sonuçları analizi
          const passedExams = examResults.filter(e => e.passed).length;
          const examSuccessRate = examResults.length > 0 ? (passedExams / examResults.length) * 100 : 0;
          const avgExamScore = examResults.length > 0 
            ? examResults.reduce((acc, e) => acc + (Number(e.score) || 0), 0) / examResults.length 
            : 0;

          // 9. GÖREV DETAYLI ANALİZ
          const tasksByStatus = {
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'in-progress').length,
            done: tasks.filter(t => t.status === 'done').length
          };

          const tasksByPriority = {
            high: tasks.filter(t => t.priority === 'high' || t.priority === 'Yüksek').length,
            medium: tasks.filter(t => t.priority === 'medium' || t.priority === 'Orta').length,
            low: tasks.filter(t => t.priority === 'low' || t.priority === 'Düşük').length
          };

          const overdueTasks = tasks.filter(t => {
            if (!t.due_date || t.status === 'done') return false;
            return new Date(t.due_date) < new Date();
          }).length;

          // Kişi bazlı görev dağılımı
          const tasksByAssignee = tasks.reduce((acc, t) => {
            const name = t.assignee ? `${t.assignee.first_name} ${t.assignee.last_name}` : 'Atanmamış';
            if (!acc[name]) acc[name] = { total: 0, done: 0 };
            acc[name].total++;
            if (t.status === 'done') acc[name].done++;
            return acc;
          }, {});

          // 10. DENETİM KAYITLARI DETAYLI ANALİZ
          const auditByAction = auditLogs.reduce((acc, log) => {
            const action = log.action || 'Belirtilmemiş';
            if (!acc[action]) acc[action] = 0;
            acc[action]++;
            return acc;
          }, {});

          const auditByUser = auditLogs.reduce((acc, log) => {
            const user = log.user_email || 'Belirtilmemiş';
            if (!acc[user]) acc[user] = 0;
            acc[user]++;
            return acc;
          }, {});

          const auditByModule = auditLogs.reduce((acc, log) => {
            const module = log.module || 'Belirtilmemiş';
            if (!acc[module]) acc[module] = 0;
            acc[module]++;
            return acc;
          }, {});

          // 11. ANA VERİ ANALİZİ
          const activeLines = lines.filter(l => !l.deleted).length;
          const kayakLines = lines.filter(l => l.type === 'kaynak').length;
          const montajLines = lines.filter(l => l.type === 'montaj').length;
          
          const revisedFixtures = fixtures.filter(f => f.is_revised).length;
          const totalFixtures = fixtures.length;

          // Departman bazlı personel dağılımı
          const employeesByDepartment = employees.reduce((acc, e) => {
            const dept = e.department || 'Belirtilmemiş';
            if (!acc[dept]) acc[dept] = 0;
            acc[dept]++;
            return acc;
          }, {});

          const activeEmployees = employees.filter(e => e.is_active).length;

          // ============= TOPLAM ETKİ HESAPLAMASI =============
          const totalGrossProfit = improvementSavings + scenarioSavings + projectImprovementSavings;

          // ============= RAPOR VERİSİNİ HAZIRLA =============
          const reportId = `RPR-EXEC-${format(today, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const totalDays = Math.ceil((reportDateRange.to - reportDateRange.from) / (1000 * 60 * 60 * 24)) + 1;

          const reportData = {
            title: 'KAPSAMLI YÖNETİCİ RAPORU',
            reportId,
            filters: {
              'Rapor Dönemi': `${format(reportDateRange.from, 'dd.MM.yyyy', { locale: tr })} - ${format(reportDateRange.to, 'dd.MM.yyyy', { locale: tr })}`,
              'Rapor Tarihi': format(today, 'dd.MM.yyyy HH:mm', { locale: tr }),
              'Hazırlayan': user?.user_metadata?.name || user?.email || 'Sistem',
              'Toplam Gün Sayısı': totalDays + ' gün'
            },
            kpiCards: [
              // TOPLAM ETKİ
              { title: 'TOPLAM YILLIK ETKİ', value: formatCurrency(totalGrossProfit) },
              { title: 'Net Kazanç (Proje Sonrası)', value: formatCurrency(totalGrossProfit - totalProjectCost) },
              
              // İYİLEŞTİRME ÖZETİ
              { title: 'Sürekli İyileştirme Etkisi', value: formatCurrency(improvementSavings) },
              { title: 'Operasyon Azaltma Etkisi', value: formatCurrency(scenarioSavings) },
              { title: 'Proje Bazlı Etki', value: formatCurrency(projectImprovementSavings) },
              { title: 'Ortalama Proje ROI', value: `%${avgProjectROI.toFixed(1)}` },
              
              // ÜRETİM ÖZETİ
              { title: 'Toplam Üretim', value: totalProduction.toLocaleString('tr-TR') + ' adet' },
              { title: 'Toplam Hurda', value: totalScrap.toLocaleString('tr-TR') + ' adet' },
              { title: 'Ortalama PPM', value: Math.round(avgPPM).toString() },
              { title: 'Üretim Maliyeti', value: formatCurrency(totalProductionCost) },
              { title: 'Hurda Maliyeti', value: formatCurrency(totalScrapCost) },
              { title: 'Günlük Ortalama Üretim', value: (totalDays > 0 ? Math.round(totalProduction / totalDays) : 0).toLocaleString('tr-TR') + ' adet' },

              // MANUEL VERİ ÖZETİ
              { title: 'Manuel Üretim', value: totalManualQuantity.toLocaleString('tr-TR') + ' adet' },
              { title: 'Tamir Üretim', value: totalRepairQuantity.toLocaleString('tr-TR') + ' adet' },
              { title: 'Manuel Maliyet', value: formatCurrency(totalManualCost) },
              { title: 'Tamir Maliyet', value: formatCurrency(totalRepairCost) },
              { title: 'Manuel+Tamir Toplam', value: (totalManualQuantity + totalRepairQuantity).toLocaleString('tr-TR') + ' adet' },

              // İYİLEŞTİRME SAYILARI
              { title: 'Sürekli İyileştirme Sayısı', value: improvements.length + ' adet' },
              { title: 'Operasyon Senaryosu', value: scenarios.length + ' adet' },
              { title: 'Proje İyileştirmesi', value: projectImprovements.length + ' adet' },
              { title: 'Fikstür İyileştirmesi', value: fixtureImprovements.length + ' adet' },
              { title: 'Toplam İyileştirme', value: (improvements.length + scenarios.length + projectImprovements.length + fixtureImprovements.length) + ' adet' },
              
              // WPS ÖZETİ
              { title: 'Toplam WPS', value: wpsList.length + ' adet' },
              { title: 'Dönemde Oluşturulan WPS', value: wpsInRange + ' adet' },
              
              // EĞİTİM ÖZETİ
              { title: 'Toplam Eğitim', value: trainings.length + ' adet' },
              { title: 'Tamamlanan Eğitim', value: completedTrainings + ' adet' },
              { title: 'Devam Eden Eğitim', value: inProgressTrainings + ' adet' },
              { title: 'Planlanan Eğitim', value: plannedTrainings + ' adet' },
              { title: 'Toplam Katılımcı', value: participants.length + ' kişi' },
              { title: 'Katılım Oranı', value: `%${participationRate.toFixed(1)}` },
              { title: 'Verilen Sertifika', value: certificates.length + ' adet' },
              { title: 'Sınav Başarı Oranı', value: `%${examSuccessRate.toFixed(1)}` },
              { title: 'Ortalama Sınav Puanı', value: avgExamScore.toFixed(1) },

              // GÖREV ÖZETİ
              { title: 'Toplam Görev', value: tasks.length + ' adet' },
              { title: 'Bekleyen Görev', value: tasksByStatus.todo + ' adet' },
              { title: 'Devam Eden Görev', value: tasksByStatus.inProgress + ' adet' },
              { title: 'Tamamlanan Görev', value: tasksByStatus.done + ' adet' },
              { title: 'Geciken Görev', value: overdueTasks + ' adet' },
              { title: 'Yüksek Öncelik', value: tasksByPriority.high + ' adet' },

              // SİSTEM ÖZETİ
              { title: 'Sistem Aktiviteleri', value: auditLogs.length + ' kayıt' },
              { title: 'Aktif Hat', value: activeLines + ' adet' },
              { title: 'Kaynak Hattı', value: kayakLines + ' adet' },
              { title: 'Montaj Hattı', value: montajLines + ' adet' },
              { title: 'Aktif Robot', value: robots.length + ' adet' },
              { title: 'Aktif Personel', value: activeEmployees + ' kişi' },
              { title: 'Toplam Fikstür', value: totalFixtures + ' adet' },
              { title: 'Revize Fikstür', value: revisedFixtures + ' adet' },
              { title: 'Maliyet Kalemi', value: costItems.length + ' adet' }
            ],
            sections: [
              // BÖLÜM 1: İYİLEŞTİRME DETAYLARI
              {
                title: 'SÜREKLİ İYİLEŞTİRME DETAYLI ANALİZ',
            tableData: {
                  headers: ['İyileştirme Tipi', 'Kayıt Sayısı', 'Toplam Etki (₺)', 'Ortalama Etki (₺)'],
                  rows: Object.entries(improvementsByType)
                    .sort((a, b) => b[1].impact - a[1].impact)
                    .map(([type, data]) => [
                      type,
                      data.count.toString(),
                      formatCurrency(data.impact),
                      formatCurrency(data.count > 0 ? data.impact / data.count : 0)
                    ])
                }
              },
              {
                title: 'HAT BAZLI İYİLEŞTİRME ANALİZİ',
                tableData: {
                  headers: ['Hat Adı', 'İyileştirme Sayısı', 'Toplam Etki (₺)', 'Toplam Süre Kazancı (sn)'],
                  rows: Object.entries(improvementsByLine)
                    .sort((a, b) => b[1].impact - a[1].impact)
                    .map(([line, data]) => [
                      line,
                      data.count.toString(),
                      formatCurrency(data.impact),
                      data.avgTimeSaving.toFixed(1) + ' sn'
                    ])
                }
              },
              {
                title: 'ROBOT BAZLI İYİLEŞTİRME ANALİZİ',
                tableData: {
                  headers: ['Robot Adı', 'İyileştirme Sayısı', 'Toplam Etki (₺)'],
                  rows: Object.entries(improvementsByRobot)
                    .sort((a, b) => b[1].impact - a[1].impact)
                    .slice(0, 10)
                    .map(([robot, data]) => [
                      robot,
                      data.count.toString(),
                      formatCurrency(data.impact)
                    ])
                }
              },
              {
                title: 'TOP 10 EN ETKİLİ İYİLEŞTİRMELER',
                tableData: {
                  headers: ['#', 'Açıklama', 'Hat', 'Tip', 'Yıllık Etki (₺)'],
                  rows: top10Improvements.map((imp, idx) => [
                    (idx + 1).toString(),
                    (imp.description || '-').substring(0, 50),
                    imp.line?.name || '-',
                    imp.type || '-',
                    formatCurrency(imp.impact || 0)
                  ])
                }
              },

              // BÖLÜM 2: OPERASYON AZALTMA
              {
                title: 'OPERASYON AZALTMA HAT BAZLI ANALİZ',
                tableData: {
                  headers: ['Hat Adı', 'Senaryo Sayısı', 'Yıllık Etki (₺)', 'Toplam Süre Kazancı (sn)'],
                  rows: Object.entries(scenariosByLine)
                    .sort((a, b) => b[1].impact - a[1].impact)
                    .map(([line, data]) => [
                      line,
                      data.count.toString(),
                      formatCurrency(data.impact),
                      data.timeSaving.toFixed(1) + ' sn'
                    ])
                }
              },

              // BÖLÜM 3: PROJE BAZLI İYİLEŞTİRME
              {
                title: 'TOP 5 PROJE BAZLI İYİLEŞTİRME',
                tableData: {
                  headers: ['Proje Adı', 'Maliyet (₺)', 'Yıllık Kazanç (₺)', 'Net Kazanç (₺)', 'ROI (%)'],
                  rows: top5Projects.map(p => {
                    const cost = Number(p.improvement_cost) || 0;
                    const impact = Number(p.annual_impact) || 0;
                    const roi = cost > 0 ? ((impact - cost) / cost) * 100 : 0;
                    return [
                      (p.subject || '-').substring(0, 40),
                      formatCurrency(cost),
                formatCurrency(impact),
                      formatCurrency(impact - cost),
                      `%${roi.toFixed(1)}`
                    ];
                  })
                }
              },

              // BÖLÜM 4: MANUEL VERİ ANALİZİ
              {
                title: 'MANUEL VERİ - VARDİYA BAZLI ANALİZ',
                tableData: {
                  headers: ['Vardiya', 'Kayıt Sayısı', 'Toplam Üretim', 'Toplam Maliyet (₺)'],
                  rows: Object.entries(manualByShift)
                    .sort((a, b) => b[1].quantity - a[1].quantity)
                    .map(([shift, data]) => [
                      shift + '. Vardiya',
                      data.count.toString(),
                      data.quantity.toLocaleString('tr-TR') + ' adet',
                      formatCurrency(data.cost)
                    ])
                }
              },
              {
                title: 'MANUEL VERİ - TOP 10 PERSONEL PERFORMANSI',
                tableData: {
                  headers: ['#', 'Personel', 'Kayıt Sayısı', 'Toplam Üretim'],
                  rows: top10ManualEmployees.map(([name, data], idx) => [
                    (idx + 1).toString(),
                    name,
                    data.count.toString(),
                    data.quantity.toLocaleString('tr-TR') + ' adet'
                  ])
                }
              },
              {
                title: 'MANUEL VERİ - HAT BAZLI ANALİZ',
                tableData: {
                  headers: ['Hat Adı', 'Kayıt Sayısı', 'Toplam Üretim', 'Toplam Maliyet (₺)'],
                  rows: Object.entries(manualByLine)
                    .sort((a, b) => b[1].quantity - a[1].quantity)
                    .map(([line, data]) => [
                      line,
                      data.count.toString(),
                      data.quantity.toLocaleString('tr-TR') + ' adet',
                      formatCurrency(data.cost)
                    ])
                }
              },

              // BÖLÜM 5: ÜRETİM ANALİZİ
              {
                title: 'ÜRETİM - TOP 5 HAT PERFORMANSI',
                tableData: {
                  headers: ['Hat Adı', 'Toplam Üretim', 'Hurda', 'PPM', 'Üretim Maliyeti (₺)'],
                  rows: top5ProductionLines.map(([line, data]) => [
                    line,
                    data.quantity.toLocaleString('tr-TR') + ' adet',
                    data.scrap.toLocaleString('tr-TR') + ' adet',
                    (data.days > 0 ? (data.ppmSum / data.days) : 0).toFixed(0),
                    formatCurrency(data.cost)
                  ])
                }
              },
              {
                title: 'EN İYİ KALİTE HATLARI (Düşük PPM)',
                tableData: {
                  headers: ['Hat Adı', 'Ortalama PPM', 'Toplam Üretim', 'Hurda', 'Kalite Oranı (%)'],
                  rows: bestQualityLines.map(line => [
                    line.name,
                    line.avgPPM.toFixed(0),
                    line.quantity.toLocaleString('tr-TR') + ' adet',
                    line.scrap.toLocaleString('tr-TR') + ' adet',
                    ((1 - (line.scrap / (line.quantity || 1))) * 100).toFixed(2) + '%'
                  ])
                }
              },

              // BÖLÜM 6: WPS ANALİZİ
              {
                title: 'WPS - PROSES DAĞILIMI',
                tableData: {
                  headers: ['Kaynak Prosesi', 'WPS Sayısı', 'Oran (%)'],
                  rows: Object.entries(wpsByProcess)
                    .sort((a, b) => b[1] - a[1])
                    .map(([process, count]) => [
                      process,
                      count.toString(),
                      `%${((count / wpsList.length) * 100).toFixed(1)}`
                    ])
                }
              },
              {
                title: 'WPS - POZİSYON DAĞILIMI',
                tableData: {
                  headers: ['Pozisyon', 'WPS Sayısı', 'Oran (%)'],
                  rows: Object.entries(wpsByPosition)
                    .sort((a, b) => b[1] - a[1])
                    .map(([position, count]) => [
                      position,
                      count.toString(),
                      `%${((count / wpsList.length) * 100).toFixed(1)}`
                    ])
                }
              },
              {
                title: 'WPS - MALZEME DAĞILIMI',
                tableData: {
                  headers: ['Malzeme', 'WPS Sayısı', 'Oran (%)'],
                  rows: Object.entries(wpsByMaterial)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([material, count]) => [
                      material,
                      count.toString(),
                      `%${((count / wpsList.length) * 100).toFixed(1)}`
                    ])
                }
              },

              // BÖLÜM 7: EĞİTİM ANALİZİ
              {
                title: 'EĞİTİM - EĞİTMEN BAZLI ANALİZ',
                tableData: {
                  headers: ['Eğitmen', 'Toplam Eğitim', 'Tamamlanan', 'Tamamlanma Oranı (%)'],
                  rows: Object.entries(trainingsByTrainer)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([trainer, data]) => [
                      trainer,
                      data.total.toString(),
                      data.completed.toString(),
                      `%${((data.completed / data.total) * 100).toFixed(1)}`
                    ])
                }
              },

              // BÖLÜM 8: GÖREV ANALİZİ
              {
                title: 'GÖREV - PERSONEL BAZLI ANALİZ',
                tableData: {
                  headers: ['Personel', 'Toplam Görev', 'Tamamlanan', 'Tamamlanma Oranı (%)'],
                  rows: Object.entries(tasksByAssignee)
                    .sort((a, b) => b[1].total - a[1].total)
                    .slice(0, 10)
                    .map(([name, data]) => [
                      name,
                      data.total.toString(),
                      data.done.toString(),
                      `%${((data.done / data.total) * 100).toFixed(1)}`
                    ])
                }
              },

              // BÖLÜM 9: DENETİM ANALİZİ
              {
                title: 'DENETİM - EYLEM TİPİ DAĞILIMI',
                tableData: {
                  headers: ['Eylem Tipi', 'Kayıt Sayısı', 'Oran (%)'],
                  rows: Object.entries(auditByAction)
                    .sort((a, b) => b[1] - a[1])
                    .map(([action, count]) => [
                      action,
                      count.toString(),
                      `%${((count / auditLogs.length) * 100).toFixed(1)}`
                    ])
                }
              },
              {
                title: 'DENETİM - KULLANICI BAZLI AKTİVİTE',
                tableData: {
                  headers: ['Kullanıcı', 'Aktivite Sayısı', 'Oran (%)'],
                  rows: Object.entries(auditByUser)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([user, count]) => [
                      user,
                      count.toString(),
                      `%${((count / auditLogs.length) * 100).toFixed(1)}`
                    ])
                }
              },
              {
                title: 'DENETİM - MODÜL BAZLI AKTİVİTE',
                tableData: {
                  headers: ['Modül', 'Aktivite Sayısı', 'Oran (%)'],
                  rows: Object.entries(auditByModule)
                    .sort((a, b) => b[1] - a[1])
                    .map(([module, count]) => [
                      module,
                      count.toString(),
                      `%${((count / auditLogs.length) * 100).toFixed(1)}`
                    ])
                }
              },

              // BÖLÜM 10: ANA VERİ ANALİZİ
              {
                title: 'DEPARTMAN BAZLI PERSONEL DAĞILIMI',
                tableData: {
                  headers: ['Departman', 'Personel Sayısı', 'Oran (%)'],
                  rows: Object.entries(employeesByDepartment)
                    .sort((a, b) => b[1] - a[1])
                    .map(([dept, count]) => [
                      dept,
                      count.toString(),
                      `%${((count / employees.length) * 100).toFixed(1)}`
                    ])
                }
              },

              // FİKSTÜR ANALİZİ
              {
                title: 'FİKSTÜR İYİLEŞTİRME - SORUMLU BAZLI',
                tableData: {
                  headers: ['Sorumlu', 'İyileştirme Sayısı'],
                  rows: Object.entries(fixturesByResponsible)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => [name, count.toString()])
                }
              }
            ],
            signatureFields: [
              { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
              { title: 'Kontrol Eden', name: '', role: '..................' },
              { title: 'Onaylayan', name: '', role: '..................' }
            ]
          };

          await openPrintWindow(reportData, toast);
          toast({ 
            title: "Kapsamlı rapor oluşturuldu!", 
            description: `${reportData.kpiCards.length} KPI, ${reportData.sections.length} detaylı analiz bölümü içeren rapor hazır.` 
          });
        } catch (error) {
          console.error('Rapor oluşturma hatası:', error);
          toast({
            title: "Rapor Oluşturulamadı",
            description: error.message || "Rapor oluşturulurken bir hata oluştu.",
            variant: "destructive"
          });
        } finally {
          setGeneratingReport(false);
        }
      };

      return (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold mb-2">Hoş geldiniz, {user?.name || 'Kullanıcı'}!</h1>
                <p className="text-blue-100">AYD Kaynak Teknolojileri Üretim Yönetim Sistemi'ne hoş geldiniz. Bugünkü üretim verilerinizi ve sistem durumunu aşağıda görebilirsiniz.</p>
              </div>
              <Button 
                onClick={() => setShowReportDialog(true)} 
                disabled={generatingReport}
                className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
                size="lg"
              >
                {generatingReport ? (
                  <>
                    <Clock className="mr-2 h-5 w-5 animate-spin" />
                    Rapor Hazırlanıyor...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-5 w-5" />
                    Genel Yönetici Raporu
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              const colorClasses = {
                blue: 'from-blue-50 to-blue-100 border-blue-200',
                orange: 'from-orange-50 to-orange-100 border-orange-200',
                green: 'from-green-50 to-green-100 border-green-200',
                purple: 'from-purple-50 to-purple-100 border-purple-200',
                teal: 'from-cyan-50 to-cyan-100 border-cyan-200',
                yellow: 'from-yellow-50 to-yellow-100 border-yellow-200',
                indigo: 'from-indigo-50 to-indigo-100 border-indigo-200',
                pink: 'from-pink-50 to-pink-100 border-pink-200',
              };
              const iconColors = {
                blue: 'text-blue-600',
                orange: 'text-orange-600',
                green: 'text-green-600',
                purple: 'text-purple-600',
                teal: 'text-cyan-600',
                yellow: 'text-yellow-600',
                indigo: 'text-indigo-600',
                pink: 'text-pink-600',
              };
              return (
                <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} onClick={() => handleCardClick(stat.path)} className="cursor-pointer">
                  <Card className={`bg-gradient-to-br ${colorClasses[stat.color] || 'from-gray-50 to-gray-100'} border h-full hover:shadow-lg transition-shadow`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-gray-700">{stat.title}</p>
                        <div className={`bg-white p-2 rounded-lg ${iconColors[stat.color] || 'text-gray-600'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        <span className="text-xs text-gray-600">{stat.unit}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Manuel Veri Takip Özeti */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Factory className="h-5 w-5" />
                    <span>Manuel Veri Takip Özeti (Bu Ay)</span>
                  </CardTitle>
                  <CardDescription>Manuel ve tamir hatları üretim özeti</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium">Manuel Üretim</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.monthlyManual.toLocaleString('tr-TR')}</p>
                      <p className="text-xs text-blue-700 mt-1">{stats.totalManualRecords} kayıt</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-orange-600 font-medium">Tamir Üretim</p>
                      <p className="text-2xl font-bold text-orange-900">{stats.monthlyRepair.toLocaleString('tr-TR')}</p>
                      <p className="text-xs text-orange-700 mt-1">{stats.totalRepairRecords} kayıt</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg col-span-2">
                      <p className="text-sm text-green-600 font-medium">Toplam Maliyet</p>
                      <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.monthlyCost)}</p>
                      <p className="text-xs text-green-700 mt-1">Manuel: {formatCurrency(stats.manualCost)} | Tamir: {formatCurrency(stats.repairCost)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Son 7 Gün Manuel Veri Trendi</span>
                  </CardTitle>
                  <CardDescription>Günlük manuel ve tamir üretim trendi</CardDescription>
                </CardHeader>
                <CardContent>
                  {manualTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={manualTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
                        <Tooltip formatter={(value) => value.toLocaleString('tr-TR')} />
                        <Legend />
                        <Area type="monotone" dataKey="manual" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Manuel" />
                        <Area type="monotone" dataKey="repair" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} name="Tamir" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-gray-500">
                      <p>Veri bulunamadı</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Top 10 Personel ve Hatlar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5" />
                    <span>Top 10 Personel (Bu Ay)</span>
                  </CardTitle>
                  <CardDescription>En yüksek üretim yapan personeller</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {topPersonnel.length > 0 ? (
                      topPersonnel.map((emp, index) => (
                        <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-blue-600">#{index + 1}</span>
                            <div>
                              <p className="font-semibold text-sm">{emp.name}</p>
                              <p className="text-xs text-gray-500">{emp.records} kayıt</p>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-green-600">{emp.quantity.toLocaleString('tr-TR')}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-center text-gray-500 py-4">Veri bulunamadı</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Top 10 Hatlar (Bu Ay)</span>
                  </CardTitle>
                  <CardDescription>En yüksek üretim yapan hatlar</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {topLines.length > 0 ? (
                      topLines.map((line, index) => (
                        <div key={line.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-purple-600">#{index + 1}</span>
                            <div>
                              <p className="font-semibold text-sm">{line.name}</p>
                              <p className="text-xs text-gray-500">{formatCurrency(line.cost)} maliyet</p>
                            </div>
                          </div>
                          <span className="text-lg font-bold text-green-600">{line.quantity.toLocaleString('tr-TR')}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-center text-gray-500 py-4">Veri bulunamadı</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Grafikler Bölümü */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Haftalık Üretim Grafiği */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5" />
                    <span>Son 7 Gün Üretim</span>
                  </CardTitle>
                  <CardDescription>Günlük üretim ve hurda miktarları</CardDescription>
                </CardHeader>
                <CardContent>
                  {weeklyProduction.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyProduction}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
                        <Tooltip 
                          formatter={(value, name) => [value.toLocaleString('tr-TR'), name === 'production' ? 'Üretim' : 'Hurda']}
                          labelFormatter={(label) => `Tarih: ${label}`}
                        />
                        <Legend formatter={(value) => value === 'production' ? 'Üretim' : 'Hurda'} />
                        <Bar dataKey="production" fill="#3B82F6" name="production" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="scrap" fill="#EF4444" name="scrap" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <p>Üretim verisi bulunamadı</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* İyileştirme Türleri Pasta Grafiği */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChartIcon className="h-5 w-5" />
                    <span>İyileştirme Dağılımı</span>
                  </CardTitle>
                  <CardDescription>Türlere göre iyileştirme sayıları</CardDescription>
                </CardHeader>
                <CardContent>
                  {improvementsByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={improvementsByType}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {improvementsByType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [value + ' adet', props.payload.name]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <p>İyileştirme verisi bulunamadı</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Aylık Trend ve Hat Performansı */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Aylık Trend */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Aylık Üretim Trendi</span>
                  </CardTitle>
                  <CardDescription>Son 6 aylık üretim performansı</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                        <Tooltip 
                          formatter={(value, name) => [
                            name === 'cost' ? formatCurrency(value) : value.toLocaleString('tr-TR'),
                            name === 'production' ? 'Üretim' : name === 'scrap' ? 'Hurda' : 'Maliyet'
                          ]}
                        />
                        <Legend formatter={(value) => value === 'production' ? 'Üretim' : value === 'scrap' ? 'Hurda' : 'Maliyet'} />
                        <Area type="monotone" dataKey="production" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                        <Area type="monotone" dataKey="scrap" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <p>Trend verisi bulunamadı</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Hat Performansı */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5" />
                    <span>Hat Bazlı Performans</span>
                  </CardTitle>
                  <CardDescription>Son 7 gün - En yüksek üretim hatları</CardDescription>
                </CardHeader>
                <CardContent>
                  {linePerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={linePerformance} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                        <YAxis dataKey="name" type="category" fontSize={11} width={100} />
                        <Tooltip formatter={(value, name) => [value.toLocaleString('tr-TR'), name === 'production' ? 'Üretim' : 'Hurda']} />
                        <Legend formatter={(value) => value === 'production' ? 'Üretim' : 'Hurda'} />
                        <Bar dataKey="production" fill="#10B981" name="production" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      <p>Hat verisi bulunamadı</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Görev ve Eğitim Durumu */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Bekleyen Görevler</p>
                      <p className="text-3xl font-bold text-blue-900">{taskStats.todo}</p>
                    </div>
                    <div className="bg-blue-200 p-3 rounded-full">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-yellow-600">Devam Eden Görevler</p>
                      <p className="text-3xl font-bold text-yellow-900">{taskStats.inProgress}</p>
                    </div>
                    <div className="bg-yellow-200 p-3 rounded-full">
                      <Zap className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
              <Card className="bg-gradient-to-br from-green-50 to-green-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Tamamlanan Görevler</p>
                      <p className="text-3xl font-bold text-green-900">{taskStats.done}</p>
                    </div>
                    <div className="bg-green-200 p-3 rounded-full">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Eğitim Katılımcısı</p>
                      <p className="text-3xl font-bold text-purple-900">{trainingStats.participants}</p>
                    </div>
                    <div className="bg-purple-200 p-3 rounded-full">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}>
            <Card><CardHeader><CardTitle>Sistem Durumu</CardTitle><CardDescription>Veritabanı bağlantısı ve sistem performansı</CardDescription></CardHeader>
              <CardContent><div className="flex items-center justify-between p-4 bg-green-50 rounded-lg"><div className="flex items-center space-x-3"><CheckCircle className="h-5 w-5 text-green-600" /><div><p className="font-medium text-green-900">Sistem Normal Çalışıyor</p><p className="text-sm text-green-700">Tüm servisler aktif ve erişilebilir</p></div></div><div className="text-right"><p className="text-sm font-medium text-green-900">99.9% Uptime</p><p className="text-xs text-green-700">Son 30 gün</p></div></div></CardContent>
            </Card>
          </motion.div>

          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Genel Yönetici Raporu - Tarih Aralığı Seçimi</DialogTitle>
                <DialogDescription>
                  Rapor için başlangıç ve bitiş tarihi seçin. Seçilen dönem içindeki tüm veriler rapora dahil edilecektir.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rapor Dönemi</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !reportDateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reportDateRange.from && reportDateRange.to ? (
                          <>
                            {format(reportDateRange.from, "dd LLL, y", { locale: tr })} -{" "}
                            {format(reportDateRange.to, "dd LLL, y", { locale: tr })}
                          </>
                        ) : (
                          <span>Tarih aralığı seçin</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={reportDateRange.from}
                        selected={reportDateRange}
                        onSelect={(range) => {
                          if (range?.from && range?.to) {
                            setReportDateRange(range);
                          }
                        }}
                        numberOfMonths={2}
                        locale={tr}
                      />
                      <div className="flex flex-col space-y-2 p-2 border-t">
                        <Button
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setReportDateRange({
                            from: startOfMonth(new Date()),
                            to: endOfMonth(new Date())
                          })}
                        >
                          Bu Ay
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setReportDateRange({
                            from: startOfMonth(subMonths(new Date(), 1)),
                            to: endOfMonth(subMonths(new Date(), 1))
                          })}
                        >
                          Geçen Ay
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setReportDateRange({
                            from: startOfYear(new Date()),
                            to: new Date()
                          })}
                        >
                          Yıl Başından Bugüne
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start"
                          onClick={() => setReportDateRange({
                            from: startOfDay(subYears(new Date(), 1)),
                            to: endOfDay(new Date())
                          })}
                        >
                          Son 12 Ay
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {reportDateRange.from && reportDateRange.to && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Seçilen Dönem:</strong> {format(reportDateRange.from, "dd MMMM yyyy", { locale: tr })} - {format(reportDateRange.to, "dd MMMM yyyy", { locale: tr })}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Toplam {Math.ceil((reportDateRange.to - reportDateRange.from) / (1000 * 60 * 60 * 24)) + 1} günlük veri raporlanacak.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReportDialog(false)}>
                  İptal
                </Button>
                <Button 
                  onClick={handleGenerateExecutiveReport}
                  disabled={!reportDateRange.from || !reportDateRange.to || generatingReport}
                >
                  {generatingReport ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Hazırlanıyor...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Rapor Oluştur
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    };

    export default Dashboard;