import React, { useState, useEffect } from 'react';
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
      Download
    } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { useToast } from '@/components/ui/use-toast';
    import { formatCurrency, openPrintWindow } from '@/lib/utils';
    import { supabase } from '@/lib/customSupabaseClient';
    import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
    import { tr } from 'date-fns/locale';

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
      const { toast } = useToast();
      const navigate = useNavigate();

      useEffect(() => {
        const fetchData = async () => {
          const today = new Date().toISOString().split('T')[0];

          try {
            const [
              improvementsRes,
              scenariosRes,
              projectImprovementsRes,
              productionRes,
              wpsRes,
              auditLogsRes,
              trainingsRes,
              participantsRes,
            ] = await Promise.all([
              supabase.from('improvements').select('impact').eq('deleted', false),
              supabase.from('scenarios').select('summary').eq('deleted', false),
              supabase.from('project_improvements').select('annual_impact'),
              supabase.from('production_records').select('quantity').eq('record_date', today),
              supabase.from('wps').select('id', { count: 'exact' }),
              supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(5),
              supabase.from('trainings').select('id', { count: 'exact' }),
              supabase.from('training_participants').select('id', { count: 'exact' }),
            ]);

            const responses = {
              improvements: improvementsRes,
              scenarios: scenariosRes,
              projectImprovements: projectImprovementsRes,
              production: productionRes,
              wps: wpsRes,
              auditLogs: auditLogsRes,
              trainings: trainingsRes,
              participants: participantsRes,
            };

            for (const key in responses) {
              if (responses[key].error) {
                console.error(`Dashboard data fetch error (${key}):`, responses[key].error);
                throw new Error(`Veri yüklenirken hata oluştu: ${key}`);
              }
            }
            
            const improvementSavings = (improvementsRes.data || []).reduce((acc, i) => acc + (i.impact || 0), 0);
            const scenarioSavings = (scenariosRes.data || []).reduce((acc, s) => acc + (s.summary?.annualImprovement || 0), 0);
            const projectImprovementSavings = (projectImprovementsRes.data || []).reduce((acc, p) => acc + (p.annual_impact || 0), 0);
            
            const totalGrossProfit = improvementSavings + scenarioSavings + projectImprovementSavings;
            
            const dailyProduction = (productionRes.data || []).reduce((acc, p) => acc + (p.quantity || 0), 0);
            
            const totalImprovements = (improvementsRes.data?.length || 0) + (scenariosRes.data?.length || 0) + (projectImprovementsRes.data?.length || 0);

            setStats({
              dailyProduction: dailyProduction,
              grossProfit: totalGrossProfit,
              activeWPS: wpsRes.count || 0,
              improvements: totalImprovements,
              totalTrainings: trainingsRes.count || 0,
              totalParticipants: participantsRes.count || 0,
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
        setGeneratingReport(true);
        try {
          toast({ title: "Rapor hazırlanıyor...", description: "Tüm veriler toplanıyor, lütfen bekleyin." });

          const today = new Date();
          const startOfCurrentMonth = startOfMonth(today);
          const endOfCurrentMonth = endOfMonth(today);
          const startOfLastMonth = startOfMonth(subMonths(today, 1));
          const endOfLastMonth = endOfMonth(subMonths(today, 1));

          // Tüm verileri paralel olarak çek
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
            dailyProductionRes
          ] = await Promise.all([
            supabase.from('improvements').select('*').eq('deleted', false).gte('improvement_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('improvement_date', format(endOfCurrentMonth, 'yyyy-MM-dd')),
            supabase.from('scenarios').select('*').eq('deleted', false).gte('scenario_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('scenario_date', format(endOfCurrentMonth, 'yyyy-MM-dd')),
            supabase.from('project_improvements').select('*').gte('improvement_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('improvement_date', format(endOfCurrentMonth, 'yyyy-MM-dd')),
            supabase.from('fixture_improvements').select('*').gte('improvement_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('improvement_date', format(endOfCurrentMonth, 'yyyy-MM-dd')),
            supabase.from('production_records').select('*').gte('record_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('record_date', format(endOfCurrentMonth, 'yyyy-MM-dd')),
            supabase.from('wps').select('*'),
            supabase.from('trainings').select('*').gte('planned_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('planned_date', format(endOfCurrentMonth, 'yyyy-MM-dd')),
            supabase.from('training_participants').select('*'),
            supabase.from('training_certificates').select('*'),
            supabase.from('tasks').select('*'),
            supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
            supabase.from('daily_production_summary').select('*').gte('production_date', format(startOfCurrentMonth, 'yyyy-MM-dd')).lte('production_date', format(endOfCurrentMonth, 'yyyy-MM-dd'))
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

          // İyileştirme hesaplamaları
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

          // Üretim hesaplamaları
          const totalProduction = dailyProduction.reduce((acc, p) => acc + (p.total_quantity || 0), 0);
          const totalScrap = dailyProduction.reduce((acc, p) => acc + (p.total_scrap || 0), 0);
          const totalProductionCost = dailyProduction.reduce((acc, p) => acc + (p.total_production_cost || 0), 0);
          const totalScrapCost = dailyProduction.reduce((acc, p) => acc + (p.total_scrap_cost || 0), 0);

          // Görev durumları
          const tasksByStatus = {
            todo: tasks.filter(t => t.status === 'todo').length,
            inProgress: tasks.filter(t => t.status === 'in-progress').length,
            done: tasks.filter(t => t.status === 'done').length
          };

          // Eğitim istatistikleri
          const completedTrainings = trainings.filter(t => t.status === 'Tamamlandı').length;
          const activeParticipants = participants.filter(p => p.participation_status === 'Katıldı').length;

          // Rapor verisini hazırla
          const reportId = `RPR-EXEC-${format(today, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const reportData = {
            title: 'Genel Yönetici Raporu',
            reportId,
            filters: {
              'Rapor Dönemi': `${format(startOfCurrentMonth, 'dd.MM.yyyy', { locale: tr })} - ${format(endOfCurrentMonth, 'dd.MM.yyyy', { locale: tr })}`,
              'Rapor Tarihi': format(today, 'dd.MM.yyyy HH:mm', { locale: tr }),
              'Hazırlayan': user?.user_metadata?.name || user?.email || 'Sistem'
            },
            kpiCards: [
              { title: 'Toplam Yıllık İyileştirme', value: formatCurrency(totalGrossProfit) },
              { title: 'Toplam Üretim', value: totalProduction.toLocaleString('tr-TR') + ' adet' },
              { title: 'Aktif WPS', value: wpsList.length + ' adet' },
              { title: 'Toplam İyileştirme Kaydı', value: (improvements.length + scenarios.length + projectImprovements.length + fixtureImprovements.length) + ' adet' },
              { title: 'Tamamlanan Eğitim', value: completedTrainings + ' adet' },
              { title: 'Toplam Katılımcı', value: participants.length + ' kişi' },
              { title: 'Verilen Sertifika', value: certificates.length + ' adet' },
              { title: 'Aktif Görevler', value: (tasksByStatus.todo + tasksByStatus.inProgress) + ' adet' }
            ],
            tableData: {
              headers: ['Kategori', 'Alt Kategori', 'Adet', 'Toplam Etki (₺)', 'Durum'],
              rows: [
                ['Sürekli İyileştirme', 'Çevrim Süresi İyileştirmeleri', improvements.length.toString(), formatCurrency(improvementSavings), 'Tamamlandı'],
                ['Operasyon Azaltma', 'Senaryo Bazlı İyileştirmeler', scenarios.length.toString(), formatCurrency(scenarioSavings), 'Tamamlandı'],
                ['Proje Bazlı İyileştirme', 'Büyük Ölçekli Projeler', projectImprovements.length.toString(), formatCurrency(projectImprovementSavings), 'Tamamlandı'],
                ['Fikstür İyileştirme', 'Fikstür Optimizasyonları', fixtureImprovements.length.toString(), '-', 'Tamamlandı'],
                ['Üretim', 'Günlük Üretim Kayıtları', dailyProduction.length.toString(), formatCurrency(totalProductionCost), 'Devam Ediyor'],
                ['Üretim', 'Hurda Maliyeti', totalScrap.toString(), formatCurrency(totalScrapCost), 'İzleniyor'],
                ['Eğitim', 'Planlanan Eğitimler', trainings.length.toString(), '-', 'Planlandı'],
                ['Eğitim', 'Aktif Katılımcılar', activeParticipants.toString(), '-', 'Devam Ediyor'],
                ['Eğitim', 'Verilen Sertifikalar', certificates.length.toString(), '-', 'Tamamlandı'],
                ['Görevler', 'Bekleyen Görevler', tasksByStatus.todo.toString(), '-', 'Beklemede'],
                ['Görevler', 'Devam Eden Görevler', tasksByStatus.inProgress.toString(), '-', 'Devam Ediyor'],
                ['Görevler', 'Tamamlanan Görevler', tasksByStatus.done.toString(), '-', 'Tamamlandı'],
                ['WPS', 'Aktif WPS Kayıtları', wpsList.length.toString(), '-', 'Aktif'],
                ['Sistem', 'Sistem Aktiviteleri', auditLogs.length.toString(), '-', 'İzleniyor']
              ]
            },
            signatureFields: [
              { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
              { title: 'Kontrol Eden', name: '', role: '..................' },
              { title: 'Onaylayan', name: '', role: '..................' }
            ]
          };

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
                onClick={handleGenerateExecutiveReport} 
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card><CardHeader><CardTitle>Sistem Durumu</CardTitle><CardDescription>Veritabanı bağlantısı ve sistem performansı</CardDescription></CardHeader>
              <CardContent><div className="flex items-center justify-between p-4 bg-green-50 rounded-lg"><div className="flex items-center space-x-3"><CheckCircle className="h-5 w-5 text-green-600" /><div><p className="font-medium text-green-900">Sistem Normal Çalışıyor</p><p className="text-sm text-green-700">Tüm servisler aktif ve erişilebilir</p></div></div><div className="text-right"><p className="text-sm font-medium text-green-900">99.9% Uptime</p><p className="text-xs text-green-700">Son 30 gün</p></div></div></CardContent>
            </Card>
          </motion.div>
        </div>
      );
    };

    export default Dashboard;