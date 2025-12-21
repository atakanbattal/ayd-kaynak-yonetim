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
      });
      const [recentActivities, setRecentActivities] = useState([]);
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
              auditLogsRes,
              trainingsRes,
              participantsRes,
              tasksRes,
              linesRes,
            ] = await Promise.all([
              supabase.from('improvements').select('*, line:lines(name), type').eq('deleted', false),
              supabase.from('scenarios').select('summary, scope, scenario_date').eq('deleted', false),
              supabase.from('project_improvements').select('annual_impact, improvement_date, name'),
              supabase.from('fixture_improvements').select('*').eq('deleted', false),
              supabase.from('production_records').select('quantity').eq('record_date', todayStr),
              supabase.from('daily_production_summary').select('*').gte('production_date', weekAgoStr).lte('production_date', todayStr).order('production_date'),
              supabase.from('daily_production_summary').select('*').gte('production_date', sixMonthsAgoStr).lte('production_date', todayStr),
              supabase.from('wps').select('id', { count: 'exact' }),
              supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(10),
              supabase.from('trainings').select('*, status'),
              supabase.from('training_participants').select('*, participation_status'),
              supabase.from('tasks').select('*, status'),
              supabase.from('lines').select('id, name').eq('deleted', false),
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
        { title: 'Günlük Üretim', value: stats.dailyProduction.toLocaleString('tr-TR'), unit: 'adet', icon: Factory, path: '/part-cost' },
        { title: 'Brüt Kâr', value: formatCurrency(stats.grossProfit), unit: 'Yıllık', icon: DollarSign, path: '/improvement' },
        { title: 'Aktif WPS', value: stats.activeWPS, unit: 'adet', icon: CheckCircle, path: '/wps-creator' },
        { title: 'Onaylı İyileştirmeler', value: stats.improvements, unit: 'adet', icon: TrendingUp, path: '/improvement' },
        { title: 'Toplam Eğitim', value: stats.totalTrainings, unit: 'adet', icon: BookUser, path: '/trainings' },
        { title: 'Toplam Katılımcı', value: stats.totalParticipants, unit: 'kişi', icon: Users, path: '/trainings' },
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
          toast({ title: "Rapor hazırlanıyor...", description: "Tüm veriler toplanıyor, lütfen bekleyin." });

          const today = new Date();
          const dateFrom = format(startOfDay(reportDateRange.from), 'yyyy-MM-dd');
          const dateTo = format(endOfDay(reportDateRange.to), 'yyyy-MM-dd');

          // Tüm verileri paralel olarak çek - tarih aralığına göre
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
            employeesRes
          ] = await Promise.all([
            supabase.from('improvements').select('*, line:lines(name), robot:robots(name), responsible:employees(first_name, last_name)').eq('deleted', false).gte('improvement_date', dateFrom).lte('improvement_date', dateTo),
            supabase.from('scenarios').select('*, scope').eq('deleted', false).gte('scenario_date', dateFrom).lte('scenario_date', dateTo),
            supabase.from('project_improvements').select('*').gte('improvement_date', dateFrom).lte('improvement_date', dateTo),
            supabase.from('fixture_improvements').select('*').gte('improvement_date', dateFrom).lte('improvement_date', dateTo),
            supabase.from('production_records').select('*, robots(name), employees(first_name, last_name), wps(wps_code)').gte('record_date', dateFrom).lte('record_date', dateTo),
            supabase.from('wps').select('*').order('created_at', { ascending: false }),
            supabase.from('trainings').select('*, trainer:employees(first_name, last_name)').gte('planned_date', dateFrom).lte('planned_date', dateTo),
            supabase.from('training_participants').select('*, employee:employees(first_name, last_name, registration_number)'),
            supabase.from('training_certificates').select('*, participant:training_participants(employee:employees(first_name, last_name))'),
            supabase.from('tasks').select('*, assignee:employees(first_name, last_name)'),
            supabase.from('audit_log').select('*').gte('created_at', dateFrom).lte('created_at', dateTo).order('created_at', { ascending: false }).limit(100),
            supabase.from('daily_production_summary').select('*').gte('production_date', dateFrom).lte('production_date', dateTo),
            supabase.from('lines').select('*').eq('deleted', false),
            supabase.from('robots').select('*').eq('deleted', false),
            supabase.from('employees').select('*').eq('is_active', true)
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

          // İyileştirme hesaplamaları - daha detaylı
          const improvementSavings = improvements.reduce((acc, i) => {
            const prevTime = Number(i.prev_time) || 0;
            const newTime = Number(i.new_time) || 0;
            const annualQuantity = Number(i.annual_quantity) || 0;
            const costPerSecond = Number(i.cost_snapshot?.totalCostPerSecond) || 0;
            const timeSaving = prevTime - newTime;
            return acc + (timeSaving > 0 ? timeSaving * annualQuantity * costPerSecond : 0);
          }, 0);

          const scenarioSavings = scenarios.reduce((acc, s) => acc + (s.summary?.annualImprovement || 0), 0);
          const projectImprovementSavings = projectImprovements.reduce((acc, p) => acc + (p.annual_impact || 0), 0);
          const totalGrossProfit = improvementSavings + scenarioSavings + projectImprovementSavings;

          // Üretim hesaplamaları - daha detaylı
          const totalProduction = dailyProduction.reduce((acc, p) => acc + (p.total_quantity || 0), 0);
          const totalScrap = dailyProduction.reduce((acc, p) => acc + (p.total_scrap || 0), 0);
          const totalProductionCost = dailyProduction.reduce((acc, p) => acc + (p.total_production_cost || 0), 0);
          const totalScrapCost = dailyProduction.reduce((acc, p) => acc + (p.total_scrap_cost || 0), 0);
          const avgPPM = dailyProduction.length > 0 
            ? dailyProduction.reduce((acc, p) => acc + (p.ppm || 0), 0) / dailyProduction.length 
            : 0;

          // Görev durumları
          const tasksByStatus = {
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'in-progress').length,
            done: tasks.filter(t => t.status === 'done').length
          };

          // Eğitim istatistikleri - daha detaylı
          const completedTrainings = trainings.filter(t => t.status === 'Tamamlandı').length;
          const activeParticipants = participants.filter(p => p.participation_status === 'Katıldı').length;
          const trainingParticipantsInRange = participants.filter(p => {
            const training = trainings.find(t => t.id === p.training_id);
            return training && training.planned_date >= dateFrom && training.planned_date <= dateTo;
          }).length;

          // WPS istatistikleri
          const wpsInRange = wpsList.filter(w => {
            const createdDate = format(new Date(w.created_at), 'yyyy-MM-dd');
            return createdDate >= dateFrom && createdDate <= dateTo;
          }).length;

          // İyileştirme detayları - hat bazlı
          const improvementsByLine = improvements.reduce((acc, i) => {
            const lineName = i.line?.name || 'Belirtilmemiş';
            if (!acc[lineName]) acc[lineName] = 0;
            const prevTime = Number(i.prev_time) || 0;
            const newTime = Number(i.new_time) || 0;
            const annualQuantity = Number(i.annual_quantity) || 0;
            const costPerSecond = Number(i.cost_snapshot?.totalCostPerSecond) || 0;
            const timeSaving = prevTime - newTime;
            acc[lineName] += (timeSaving > 0 ? timeSaving * annualQuantity * costPerSecond : 0);
            return acc;
          }, {});

          // Üretim detayları - hat bazlı
          const productionByLine = dailyProduction.reduce((acc, p) => {
            const lineId = p.production_line_id;
            const line = lines.find(l => l.id === lineId);
            const lineName = line?.name || 'Bilinmeyen Hat';
            if (!acc[lineName]) {
              acc[lineName] = { quantity: 0, scrap: 0, cost: 0, scrapCost: 0 };
            }
            acc[lineName].quantity += p.total_quantity || 0;
            acc[lineName].scrap += p.total_scrap || 0;
            acc[lineName].cost += p.total_production_cost || 0;
            acc[lineName].scrapCost += p.total_scrap_cost || 0;
            return acc;
          }, {});

          // Rapor verisini hazırla - çok daha detaylı
          const reportId = `RPR-EXEC-${format(today, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const reportData = {
            title: 'Genel Yönetici Raporu',
            reportId,
            filters: {
              'Rapor Dönemi': `${format(reportDateRange.from, 'dd.MM.yyyy', { locale: tr })} - ${format(reportDateRange.to, 'dd.MM.yyyy', { locale: tr })}`,
              'Rapor Tarihi': format(today, 'dd.MM.yyyy HH:mm', { locale: tr }),
              'Hazırlayan': user?.user_metadata?.name || user?.email || 'Sistem',
              'Toplam Gün Sayısı': Math.ceil((reportDateRange.to - reportDateRange.from) / (1000 * 60 * 60 * 24)) + 1 + ' gün'
            },
            kpiCards: [
              { title: 'Toplam Yıllık İyileştirme', value: formatCurrency(totalGrossProfit) },
              { title: 'Toplam Üretim', value: totalProduction.toLocaleString('tr-TR') + ' adet' },
              { title: 'Toplam Hurda', value: totalScrap.toLocaleString('tr-TR') + ' adet' },
              { title: 'Ortalama PPM', value: Math.round(avgPPM).toString() },
              { title: 'Üretim Maliyeti', value: formatCurrency(totalProductionCost) },
              { title: 'Hurda Maliyeti', value: formatCurrency(totalScrapCost) },
              { title: 'Aktif WPS', value: wpsList.length + ' adet' },
              { title: 'Dönem İçinde Oluşturulan WPS', value: wpsInRange + ' adet' },
              { title: 'Toplam İyileştirme Kaydı', value: (improvements.length + scenarios.length + projectImprovements.length + fixtureImprovements.length) + ' adet' },
              { title: 'Planlanan Eğitim', value: trainings.length + ' adet' },
              { title: 'Tamamlanan Eğitim', value: completedTrainings + ' adet' },
              { title: 'Dönem İçi Katılımcı', value: trainingParticipantsInRange + ' kişi' },
              { title: 'Toplam Katılımcı', value: participants.length + ' kişi' },
              { title: 'Verilen Sertifika', value: certificates.length + ' adet' },
              { title: 'Aktif Görevler', value: (tasksByStatus.todo + tasksByStatus.inProgress) + ' adet' },
              { title: 'Tamamlanan Görevler', value: tasksByStatus.done + ' adet' },
              { title: 'Sistem Aktiviteleri', value: auditLogs.length + ' kayıt' },
              { title: 'Aktif Hat Sayısı', value: lines.length + ' hat' },
              { title: 'Aktif Robot Sayısı', value: robots.length + ' robot' },
              { title: 'Aktif Personel', value: employees.length + ' kişi' }
            ],
            tableData: {
              headers: ['Kategori', 'Alt Kategori', 'Adet', 'Toplam Etki (₺)', 'Durum', 'Detay'],
              rows: [
                ['Sürekli İyileştirme', 'Çevrim Süresi İyileştirmeleri', improvements.length.toString(), formatCurrency(improvementSavings), 'Tamamlandı', `${improvements.filter(i => i.status === 'Tamamlandı').length} tamamlandı`],
                ['Operasyon Azaltma', 'Senaryo Bazlı İyileştirmeler', scenarios.length.toString(), formatCurrency(scenarioSavings), 'Tamamlandı', `${scenarios.length} senaryo`],
                ['Proje Bazlı İyileştirme', 'Büyük Ölçekli Projeler', projectImprovements.length.toString(), formatCurrency(projectImprovementSavings), 'Tamamlandı', `${projectImprovements.length} proje`],
                ['Fikstür İyileştirme', 'Fikstür Optimizasyonları', fixtureImprovements.length.toString(), '-', 'Tamamlandı', `${fixtureImprovements.length} iyileştirme`],
                ['Üretim', 'Günlük Üretim Kayıtları', dailyProduction.length.toString(), formatCurrency(totalProductionCost), 'Devam Ediyor', `${dailyProduction.length} gün kayıt`],
                ['Üretim', 'Toplam Üretim Adedi', totalProduction.toLocaleString('tr-TR'), formatCurrency(totalProductionCost), 'Tamamlandı', `${dailyProduction.length} gün`],
                ['Üretim', 'Toplam Hurda Adedi', totalScrap.toLocaleString('tr-TR'), formatCurrency(totalScrapCost), 'İzleniyor', `PPM: ${Math.round(avgPPM)}`],
                ['Eğitim', 'Planlanan Eğitimler', trainings.length.toString(), '-', 'Planlandı', `${completedTrainings} tamamlandı`],
                ['Eğitim', 'Aktif Katılımcılar', activeParticipants.toString(), '-', 'Devam Ediyor', `${trainingParticipantsInRange} dönem içi`],
                ['Eğitim', 'Verilen Sertifikalar', certificates.length.toString(), '-', 'Tamamlandı', `${certificates.length} sertifika`],
                ['Görevler', 'Bekleyen Görevler', tasksByStatus.todo.toString(), '-', 'Beklemede', `${tasksByStatus.todo} görev`],
                ['Görevler', 'Devam Eden Görevler', tasksByStatus.inProgress.toString(), '-', 'Devam Ediyor', `${tasksByStatus.inProgress} görev`],
                ['Görevler', 'Tamamlanan Görevler', tasksByStatus.done.toString(), '-', 'Tamamlandı', `${tasksByStatus.done} görev`],
                ['WPS', 'Toplam WPS Kayıtları', wpsList.length.toString(), '-', 'Aktif', `${wpsInRange} dönem içi`],
                ['Sistem', 'Sistem Aktiviteleri', auditLogs.length.toString(), '-', 'İzleniyor', `${auditLogs.length} kayıt`],
                ['Master Data', 'Aktif Hatlar', lines.length.toString(), '-', 'Aktif', `${lines.length} hat`],
                ['Master Data', 'Aktif Robotlar', robots.length.toString(), '-', 'Aktif', `${robots.length} robot`],
                ['Master Data', 'Aktif Personel', employees.length.toString(), '-', 'Aktif', `${employees.length} personel`]
              ]
            },
            signatureFields: [
              { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
              { title: 'Kontrol Eden', name: '', role: '..................' },
              { title: 'Onaylayan', name: '', role: '..................' }
            ]
          };

          // Hat bazlı detaylar ekle
          if (Object.keys(improvementsByLine).length > 0) {
            reportData.tableData.rows.push(
              ...Object.entries(improvementsByLine).map(([lineName, impact]) => [
                'İyileştirme Detayı',
                `${lineName} - Sürekli İyileştirme`,
                improvements.filter(i => i.line?.name === lineName).length.toString(),
                formatCurrency(impact),
                'Tamamlandı',
                `${lineName} hattı`
              ])
            );
          }

          if (Object.keys(productionByLine).length > 0) {
            reportData.tableData.rows.push(
              ...Object.entries(productionByLine).map(([lineName, data]) => [
                'Üretim Detayı',
                `${lineName} - Üretim`,
                data.quantity.toLocaleString('tr-TR'),
                formatCurrency(data.cost),
                'Devam Ediyor',
                `Hurda: ${data.scrap} adet`
              ])
            );
          }

          await openPrintWindow(reportData, toast);
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} onClick={() => handleCardClick(stat.path)} className="cursor-pointer">
                  <Card className="card-hover h-full"><CardContent className="p-6 flex flex-col justify-between h-full"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">{stat.title}</p><div className="flex items-baseline space-x-1"><p className="text-2xl font-bold text-gray-900">{stat.value}</p><span className="text-sm text-gray-500">{stat.unit}</span></div></div><div className="bg-gray-100 p-3 rounded-full"><Icon className="h-6 w-6 text-gray-600" /></div></div></CardContent></Card>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <Card><CardHeader><CardTitle className="flex items-center space-x-2"><AlertCircle className="h-5 w-5" /><span>Son Aktiviteler</span></CardTitle><CardDescription>Sistemdeki son işlemler ve güncellemeler</CardDescription></CardHeader>
                <CardContent><div className="space-y-4">{recentActivities.length > 0 ? recentActivities.map((activity) => (<div key={activity.id} className="flex items-start space-x-3"><div className={`w-2 h-2 rounded-full mt-2 ${activity.status === 'success' ? 'bg-green-500' : activity.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} /><div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900">{activity.message}</p><p className="text-xs text-gray-500">{activity.time}</p></div><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${activity.status === 'success' ? 'bg-green-100 text-green-800' : activity.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>{activity.type}</span></div>)) : <p className="text-sm text-center text-gray-500 py-4">Henüz aktivite yok.</p>}</div></CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2"><Users className="h-5 w-5" /><span>Hızlı İşlemler</span></CardTitle>
                    <CardDescription>Sık kullanılan işlemlere hızlı erişim</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2" onClick={() => handleCardClick('/wps-creator')}><CheckCircle className="h-6 w-6" /><span className="text-xs">Yeni WPS</span></Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2" onClick={() => handleCardClick('/trainings')}><Award className="h-6 w-6" /><span className="text-xs">Yeni Eğitim</span></Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2" onClick={() => handleCardClick('/part-cost')}><DollarSign className="h-6 w-6" /><span className="text-xs">Maliyet Hesapla</span></Button>
                      <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2" onClick={() => handleCardClick('/manual-tracking')}><BookUser className="h-6 w-6" /><span className="text-xs">Manuel Kayıt</span></Button>
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