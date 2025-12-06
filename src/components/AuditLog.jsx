import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Calendar, User, Download, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { openPrintWindow } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filters, setFilters] = useState({
    searchTerm: '',
    user: 'all',
    action: 'all',
    dateRange: null
  });
  const { toast } = useToast();

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
          <CardTitle className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6" />
            <span>Denetim Kayıtları</span>
          </CardTitle>
          <CardDescription>Sistemde gerçekleştirilen tüm kritik işlemleri ve değişiklikleri takip edin.</CardDescription>
          <div className="mt-4">
            <Button variant="outline" onClick={handleGenerateDetailedReport}>
              <Download className="h-4 w-4 mr-2" />
              Detaylı Rapor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Kullanıcı, eylem veya detay ara..."
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="pl-10"
              />
            </div>
            <Select value={filters.user} onValueChange={(value) => setFilters({ ...filters, user: value })}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Kullanıcı" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Kullanıcılar</SelectItem>
                {uniqueUsers.map(user => <SelectItem key={user} value={user}>{user}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Eylem" />
              </SelectTrigger>
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
                <CalendarComponent
                  mode="range"
                  selected={filters.dateRange}
                  onSelect={(range) => setFilters({ ...filters, dateRange: range })}
                  numberOfMonths={2}
                  locale={tr}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
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
                        log.action.includes('CREATE') ? 'bg-green-100 text-green-800' :
                        log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-800' :
                        log.action.includes('DELETE') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{log.details}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="text-center py-10 text-gray-500">Filtrelerle eşleşen kayıt bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLog;