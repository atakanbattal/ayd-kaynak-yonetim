import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Search, Calendar, User, Download, FileText, BarChart3, TrendingUp, Activity, Clock, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { openPrintWindow } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';

const CHART_COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filters, setFilters] = useState({
    searchTerm: '',
    user: 'all',
    action: 'all',
    dateRange: null
  });
  const [activeTab, setActiveTab] = useState('data');
  const { toast } = useToast();

  // Analiz verileri
  const analysisData = useMemo(() => {
    if (!logs.length) return null;

    // Eylem tipi bazlı analiz
    const byAction = {};
    logs.forEach(log => {
      let actionType = 'Diğer';
      if (log.action?.includes('CREATE')) actionType = 'Oluşturma';
      else if (log.action?.includes('UPDATE')) actionType = 'Güncelleme';
      else if (log.action?.includes('DELETE')) actionType = 'Silme';
      else if (log.action?.includes('SAVE')) actionType = 'Kaydetme';
      
      if (!byAction[actionType]) byAction[actionType] = 0;
      byAction[actionType]++;
    });

    const actionColors = {
      'Oluşturma': '#10B981',
      'Güncelleme': '#3B82F6',
      'Silme': '#EF4444',
      'Kaydetme': '#F59E0B',
      'Diğer': '#9CA3AF'
    };

    const actionData = Object.entries(byAction)
      .map(([name, value]) => ({ name, value, color: actionColors[name] || '#9CA3AF' }))
      .sort((a, b) => b.value - a.value);

    // Kullanıcı bazlı analiz
    const byUser = {};
    logs.forEach(log => {
      const userName = log.user_name || 'Bilinmeyen';
      if (!byUser[userName]) byUser[userName] = { total: 0, create: 0, update: 0, delete: 0 };
      byUser[userName].total++;
      if (log.action?.includes('CREATE')) byUser[userName].create++;
      else if (log.action?.includes('UPDATE')) byUser[userName].update++;
      else if (log.action?.includes('DELETE')) byUser[userName].delete++;
    });

    const userData = Object.entries(byUser)
      .map(([name, data]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Saatlik aktivite
    const byHour = {};
    logs.forEach(log => {
      const hour = new Date(log.created_at).getHours();
      if (!byHour[hour]) byHour[hour] = 0;
      byHour[hour]++;
    });

    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      count: byHour[i] || 0
    }));

    // Günlük trend
    const byDate = {};
    logs.forEach(log => {
      const date = format(new Date(log.created_at), 'dd MMM', { locale: tr });
      if (!byDate[date]) byDate[date] = 0;
      byDate[date]++;
    });

    const dailyData = Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .slice(-30);

    // Modül bazlı analiz
    const byModule = {};
    logs.forEach(log => {
      let module = 'Diğer';
      const action = log.action || '';
      if (action.includes('WPS')) module = 'WPS';
      else if (action.includes('TRAINING')) module = 'Eğitim';
      else if (action.includes('TASK')) module = 'Görevler';
      else if (action.includes('IMPROVEMENT')) module = 'İyileştirme';
      else if (action.includes('FIXTURE')) module = 'Fikstür';
      else if (action.includes('SCENARIO')) module = 'Senaryo';
      else if (action.includes('PROJECT')) module = 'Proje';
      else if (action.includes('EMPLOYEE')) module = 'Personel';
      
      if (!byModule[module]) byModule[module] = 0;
      byModule[module]++;
    });

    const moduleData = Object.entries(byModule)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      total: logs.length,
      uniqueUsers: Object.keys(byUser).length,
      creates: byAction['Oluşturma'] || 0,
      updates: byAction['Güncelleme'] || 0,
      deletes: byAction['Silme'] || 0,
      todayCount: logs.filter(l => {
        const today = new Date();
        const logDate = new Date(l.created_at);
        return logDate.toDateString() === today.toDateString();
      }).length,
      actionData,
      userData,
      hourlyData,
      dailyData,
      moduleData,
    };
  }, [logs]);

  const fetchLogs = async () => {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ title: "Denetim Kayıtları Yüklenemedi", description: error.message, variant: "destructive" });
    } else {
      setLogs(data);
      setFilteredLogs(data);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let tempLogs = logs;
    if (filters.searchTerm) {
      tempLogs = tempLogs.filter(log => 
        (log.details && log.details.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (log.user_name && log.user_name.toLowerCase().includes(filters.searchTerm.toLowerCase()))
      );
    }
    if (filters.user !== 'all') {
      tempLogs = tempLogs.filter(log => log.user_name === filters.user);
    }
    if (filters.action !== 'all') {
      tempLogs = tempLogs.filter(log => log.action === filters.action);
    }
    if (filters.dateRange?.from && filters.dateRange?.to) {
      const dateFrom = startOfDay(filters.dateRange.from);
      const dateTo = endOfDay(filters.dateRange.to);
      tempLogs = tempLogs.filter(log => {
        const logDate = new Date(log.created_at);
        return logDate >= dateFrom && logDate <= dateTo;
      });
    }
    setFilteredLogs(tempLogs);
  }, [filters, logs]);

  const uniqueUsers = [...new Set(logs.map(log => log.user_name).filter(Boolean))];
  const uniqueActions = [...new Set(logs.map(log => log.action).filter(Boolean))];

  const handleGenerateDetailedReport = async () => {
    try {
      toast({ title: "Detaylı denetim raporu hazırlanıyor...", description: "Tüm aktivite verileri toplanıyor." });

      const dateFrom = filters.dateRange?.from ? format(startOfDay(filters.dateRange.from), 'yyyy-MM-dd') : null;
      const dateTo = filters.dateRange?.to ? format(endOfDay(filters.dateRange.to), 'yyyy-MM-dd') : null;

      let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false });
      if (dateFrom && dateTo) {
        query = query.gte('created_at', dateFrom).lte('created_at', dateTo);
      }
      const { data: allLogs } = await query.limit(1000);

      const filteredData = (allLogs || []).filter(log => {
        const searchMatch = !filters.searchTerm || 
          (log.details && log.details.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
          (log.user_name && log.user_name.toLowerCase().includes(filters.searchTerm.toLowerCase()));
        const userMatch = filters.user === 'all' || log.user_name === filters.user;
        const actionMatch = filters.action === 'all' || log.action === filters.action;
        return searchMatch && userMatch && actionMatch;
      });

      // Kullanıcı bazlı analiz
      const byUser = filteredData.reduce((acc, log) => {
        const userName = log.user_name || 'Bilinmeyen';
        if (!acc[userName]) {
          acc[userName] = { total: 0, create: 0, update: 0, delete: 0, other: 0 };
        }
        acc[userName].total++;
        if (log.action.includes('CREATE')) acc[userName].create++;
        else if (log.action.includes('UPDATE')) acc[userName].update++;
        else if (log.action.includes('DELETE')) acc[userName].delete++;
        else acc[userName].other++;
        return acc;
      }, {});

      // Eylem bazlı analiz
      const byAction = filteredData.reduce((acc, log) => {
        const action = log.action || 'Bilinmeyen';
        if (!acc[action]) acc[action] = 0;
        acc[action]++;
        return acc;
      }, {});

      const reportId = `RPR-AUDIT-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const reportData = {
        title: 'Denetim Kayıtları - Detaylı Rapor',
        reportId,
        filters: {
          'Rapor Dönemi': filters.dateRange?.from && filters.dateRange?.to
            ? `${format(filters.dateRange.from, 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange.to, 'dd.MM.yyyy', { locale: tr })}`
            : 'Tüm Zamanlar',
          'Kullanıcı Filtresi': filters.user === 'all' ? 'Tümü' : filters.user,
          'Eylem Filtresi': filters.action === 'all' ? 'Tümü' : filters.action,
          'Arama Terimi': filters.searchTerm || 'Yok',
          'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr })
        },
        kpiCards: [
          { title: 'Toplam Aktivite', value: filteredData.length.toString() },
          { title: 'Farklı Kullanıcı', value: Object.keys(byUser).length.toString() },
          { title: 'Farklı Eylem Tipi', value: Object.keys(byAction).length.toString() },
          { title: 'Oluşturma İşlemleri', value: filteredData.filter(l => l.action.includes('CREATE')).length.toString() },
          { title: 'Güncelleme İşlemleri', value: filteredData.filter(l => l.action.includes('UPDATE')).length.toString() },
          { title: 'Silme İşlemleri', value: filteredData.filter(l => l.action.includes('DELETE')).length.toString() }
        ],
        tableData: {
          headers: ['Tarih/Saat', 'Kullanıcı', 'Eylem', 'Detay'],
          rows: filteredData.map(log => [
            new Date(log.created_at).toLocaleString('tr-TR'),
            log.user_name || 'Bilinmeyen',
            log.action || '-',
            log.details || '-'
          ])
        },
        signatureFields: [
          { title: 'Hazırlayan', name: 'Sistem Kullanıcısı', role: ' ' },
          { title: 'Kontrol Eden', name: '', role: '..................' },
          { title: 'Onaylayan', name: '', role: '..................' }
        ]
      };

      // Kullanıcı bazlı özet ekle
      if (Object.keys(byUser).length > 0) {
        reportData.tableData.rows.push(
          ['---', '---', '---', '---'],
          ...Object.entries(byUser)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([userName, data]) => [
              'ÖZET',
              userName,
              `Toplam: ${data.total}, Oluştur: ${data.create}, Güncelle: ${data.update}, Sil: ${data.delete}`,
              'Kullanıcı Özeti'
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <ShieldCheck className="h-6 w-6" />
                <span>Denetim Kayıtları</span>
              </CardTitle>
              <CardDescription>Sistemde gerçekleştirilen tüm kritik işlemleri ve değişiklikleri takip edin.</CardDescription>
            </div>
            <Button variant="outline" onClick={handleGenerateDetailedReport}>
              <Download className="h-4 w-4 mr-2" />
              Detaylı Rapor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="data" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Kayıtlar
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Detaylı Analiz
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data">
              <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input placeholder="Kullanıcı, eylem veya detay ara..." value={filters.searchTerm} onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })} className="pl-10" />
                </div>
                <Select value={filters.user} onValueChange={(value) => setFilters({ ...filters, user: value })}>
                  <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Kullanıcı" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Kullanıcılar</SelectItem>
                    {uniqueUsers.map(user => <SelectItem key={user} value={user}>{user}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
                  <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Eylem" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Eylemler</SelectItem>
                    {uniqueActions.map(action => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateRange?.from && filters.dateRange?.to
                        ? `${format(filters.dateRange.from, 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange.to, 'dd.MM.yyyy', { locale: tr })}`
                        : 'Tarih Aralığı'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="range" selected={filters.dateRange} onSelect={(range) => setFilters({ ...filters, dateRange: range })} numberOfMonths={2} locale={tr} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kullanıcı</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eylem</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detay</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.length > 0 ? filteredLogs.map(log => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.created_at).toLocaleString('tr-TR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.user_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            log.action?.includes('CREATE') ? 'bg-green-100 text-green-800' :
                            log.action?.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                            log.action?.includes('DELETE') ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{log.details}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="text-center py-10 text-gray-500">Filtrelerle eşleşen kayıt bulunamadı.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="analysis">
              {analysisData ? (
                <div className="space-y-6">
                  {/* KPI Kartları */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600">Toplam Aktivite</p>
                            <p className="text-2xl font-bold text-blue-900">{analysisData.total}</p>
                          </div>
                          <Activity className="h-6 w-6 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">Oluşturma</p>
                            <p className="text-2xl font-bold text-green-900">{analysisData.creates}</p>
                          </div>
                          <Plus className="h-6 w-6 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-indigo-600">Güncelleme</p>
                            <p className="text-2xl font-bold text-indigo-900">{analysisData.updates}</p>
                          </div>
                          <RefreshCw className="h-6 w-6 text-indigo-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-600">Silme</p>
                            <p className="text-2xl font-bold text-red-900">{analysisData.deletes}</p>
                          </div>
                          <Trash2 className="h-6 w-6 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-600">Kullanıcı</p>
                            <p className="text-2xl font-bold text-purple-900">{analysisData.uniqueUsers}</p>
                          </div>
                          <User className="h-6 w-6 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-yellow-600">Bugün</p>
                            <p className="text-2xl font-bold text-yellow-900">{analysisData.todayCount}</p>
                          </div>
                          <Clock className="h-6 w-6 text-yellow-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Grafikler - İlk Satır */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Eylem Tipi Dağılımı */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Activity className="h-5 w-5" /> Eylem Tipi Dağılımı
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={analysisData.actionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={3}
                              dataKey="value"
                              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            >
                              {analysisData.actionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value + ' aktivite', '']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Modül Bazlı Aktivite */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" /> Modül Bazlı Aktivite
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analysisData.moduleData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={11} />
                            <YAxis fontSize={12} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8B5CF6" name="Aktivite" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Grafikler - İkinci Satır */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Günlük Trend */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" /> Günlük Aktivite Trendi
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={analysisData.dailyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" fontSize={10} />
                            <YAxis fontSize={12} />
                            <Tooltip />
                            <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Aktivite" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Kullanıcı Bazlı Aktivite */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5" /> Kullanıcı Bazlı Aktivite
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analysisData.userData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" fontSize={12} />
                            <YAxis dataKey="name" type="category" fontSize={10} width={100} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="create" stackId="a" fill="#10B981" name="Oluşturma" />
                            <Bar dataKey="update" stackId="a" fill="#3B82F6" name="Güncelleme" />
                            <Bar dataKey="delete" stackId="a" fill="#EF4444" name="Silme" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Saatlik Aktivite */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" /> Saatlik Aktivite Dağılımı
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={analysisData.hourlyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" fontSize={10} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#06B6D4" name="Aktivite" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-20 text-gray-500">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p>Analiz için yeterli veri bulunmuyor.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLog;