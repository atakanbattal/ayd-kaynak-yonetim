import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Calendar, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [filters, setFilters] = useState({
    searchTerm: '',
    user: 'all',
    action: 'all',
    dateRange: 'all'
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
    // Date filtering logic would be here
    setFilteredLogs(tempLogs);
  }, [filters, logs]);

  const uniqueUsers = [...new Set(logs.map(log => log.user_name).filter(Boolean))];
  const uniqueActions = [...new Set(logs.map(log => log.action).filter(Boolean))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6" />
            <span>Denetim Kayıtları</span>
          </CardTitle>
          <CardDescription>Sistemde gerçekleştirilen tüm kritik işlemleri ve değişiklikleri takip edin.</CardDescription>
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
            <Button variant="outline" disabled>
              <Calendar className="mr-2 h-4 w-4" />
              Tarih Aralığı
            </Button>
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