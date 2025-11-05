import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { Factory, Plus, Clock, Trash2 } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { logAction } from '@/lib/utils';

    const shiftOptions = [
        { value: '1', label: 'Vardiya 1 (Gündüz)' },
        { value: '2', label: 'Vardiya 2 (Akşam)' },
        { value: '3', label: 'Vardiya 3 (Gece)' },
    ];
    
    const getShiftLabel = (value) => {
        const option = shiftOptions.find(o => o.value === value);
        return option ? option.label : 'Bilinmeyen';
    };

    const ProductionTracking = () => {
      const [productionRecords, setProductionRecords] = useState([]);
      const [filteredRecords, setFilteredRecords] = useState([]);
      const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', partCode: '', robotId: 'all', operatorId: 'all' });
      const [showAddDialog, setShowAddDialog] = useState(false);
      const [newRecord, setNewRecord] = useState({
        record_date: new Date().toISOString().split('T')[0],
        record_time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        shift: '1',
        part_code: '',
        quantity: '',
        robot_id: '',
        fixture_id: '',
        program_no: '',
        operator_id: '',
        wps_id: '',
        notes: ''
      });
      const { toast } = useToast();
      const { user } = useAuth();

      const [robots, setRobots] = useState([]);
      const [fixtures, setFixtures] = useState([]);
      const [operators, setOperators] = useState([]);
      const [wpsList, setWpsList] = useState([]);

      const fetchData = async () => {
        setRobots((await supabase.from('robots').select('*')).data || []);
        setFixtures((await supabase.from('fixtures').select('*')).data || []);
        setOperators((await supabase.from('employees').select('*')).data || []);
        setWpsList((await supabase.from('wps').select('*')).data || []);
        const { data, error } = await supabase.from('production_records').select('*, robots(name), employees(first_name, last_name), wps(wps_code)');
        if (error) console.error("Error fetching production records:", error);
        else setProductionRecords(data);
      };

      useEffect(() => {
        fetchData();
      }, []);

      useEffect(() => {
        let filtered = productionRecords;
        if (filters.dateFrom) filtered = filtered.filter(r => r.record_date >= filters.dateFrom);
        if (filters.dateTo) filtered = filtered.filter(r => r.record_date <= filters.dateTo);
        if (filters.partCode) filtered = filtered.filter(r => r.part_code.toLowerCase().includes(filters.partCode.toLowerCase()));
        if (filters.robotId !== 'all') filtered = filtered.filter(r => r.robot_id === filters.robotId);
        if (filters.operatorId !== 'all') filtered = filtered.filter(r => r.operator_id === filters.operatorId);
        setFilteredRecords(filtered);
      }, [filters, productionRecords]);

      const handleAddRecord = async () => {
        if (!newRecord.part_code || !newRecord.quantity || !newRecord.robot_id || !newRecord.operator_id) {
          toast({ title: "Eksik Bilgi", description: "Parça kodu, adet, robot ve operatör bilgileri zorunludur.", variant: "destructive" });
          return;
        }
        const { error } = await supabase.from('production_records').insert(newRecord);
        if (error) {
          toast({ title: "Kayıt Başarısız", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Üretim Kaydı Eklendi" });
          logAction('CREATE_PRODUCTION_RECORD', `Üretim kaydı eklendi: ${newRecord.part_code}`, user);
          setShowAddDialog(false);
          fetchData();
          setNewRecord({ record_date: new Date().toISOString().split('T')[0], record_time: new Date().toTimeString().split(' ')[0].slice(0, 5), shift: '1', part_code: '', quantity: '', robot_id: '', fixture_id: '', program_no: '', operator_id: '', wps_id: '', notes: '' });
        }
      };

      const handleDeleteRecord = async (id) => {
        const { error } = await supabase.from('production_records').delete().eq('id', id);
        if (error) {
          toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Kayıt Silindi", variant: "destructive" });
          logAction('DELETE_PRODUCTION_RECORD', `Üretim kaydı silindi: ID ${id}`, user);
          fetchData();
        }
      };

      return (
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader><div className="flex justify-between items-center"><div><CardTitle className="flex items-center space-x-2"><Factory className="h-5 w-5" /><span>Üretim Kaydı & İzlenebilirlik</span></CardTitle><CardDescription>Üretim kayıtlarını takip edin ve parça bazlı izlenebilirlik sağlayın</CardDescription></div><Dialog open={showAddDialog} onOpenChange={setShowAddDialog}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Yeni Kayıt</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Yeni Üretim Kaydı</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2"><Label>Tarih *</Label><Input type="date" value={newRecord.record_date} onChange={(e) => setNewRecord({...newRecord, record_date: e.target.value})} /></div>
                <div className="space-y-2"><Label>Saat *</Label><Input type="time" value={newRecord.record_time} onChange={(e) => setNewRecord({...newRecord, record_time: e.target.value})} /></div>
                <div className="space-y-2"><Label>Vardiya</Label><Select value={newRecord.shift} onValueChange={(v) => setNewRecord({...newRecord, shift: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{shiftOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Parça Kodu *</Label><Input placeholder="PRT-1001" value={newRecord.part_code} onChange={(e) => setNewRecord({...newRecord, part_code: e.target.value})} /></div>
                <div className="space-y-2"><Label>Adet *</Label><Input type="number" placeholder="45" value={newRecord.quantity} onChange={(e) => setNewRecord({...newRecord, quantity: e.target.value})} /></div>
                <div className="space-y-2"><Label>Robot *</Label><Select value={newRecord.robot_id} onValueChange={(v) => setNewRecord({...newRecord, robot_id: v})}><SelectTrigger><SelectValue placeholder="Robot seçin" /></SelectTrigger><SelectContent>{robots.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Fikstür</Label><Select value={newRecord.fixture_id} onValueChange={(v) => setNewRecord({...newRecord, fixture_id: v})}><SelectTrigger><SelectValue placeholder="Fikstür seçin" /></SelectTrigger><SelectContent>{fixtures.filter(f => !newRecord.robot_id || f.robot_id === newRecord.robot_id).map((f) => <SelectItem key={f.id} value={f.id}>{f.code}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Program No</Label><Input placeholder="PRG-001" value={newRecord.program_no} onChange={(e) => setNewRecord({...newRecord, program_no: e.target.value})} /></div>
                <div className="space-y-2"><Label>Operatör *</Label><Select value={newRecord.operator_id} onValueChange={(v) => setNewRecord({...newRecord, operator_id: v})}><SelectTrigger><SelectValue placeholder="Operatör seçin" /></SelectTrigger><SelectContent>{operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.first_name} {o.last_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>WPS</Label><Select value={newRecord.wps_id} onValueChange={(v) => setNewRecord({...newRecord, wps_id: v})}><SelectTrigger><SelectValue placeholder="WPS seçin" /></SelectTrigger><SelectContent>{wpsList.filter(w => !newRecord.part_code || w.part_code === newRecord.part_code).map((w) => <SelectItem key={w.id} value={w.id}>{w.wps_code}</SelectItem>)}</SelectContent></Select></div>
                <div className="col-span-2 space-y-2"><Label>Notlar</Label><Input placeholder="Özel notlar..." value={newRecord.notes} onChange={(e) => setNewRecord({...newRecord, notes: e.target.value})} /></div>
              </div><div className="flex justify-end space-x-2 mt-4"><Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button><Button onClick={handleAddRecord}>Kaydet</Button></div></DialogContent></Dialog></div></CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-gray-50 rounded-lg"><div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="space-y-2"><Label>Başlangıç</Label><Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Bitiş</Label><Input type="date" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Parça Kodu</Label><Input placeholder="Ara..." value={filters.partCode} onChange={(e) => setFilters({...filters, partCode: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Robot</Label><Select value={filters.robotId} onValueChange={(v) => setFilters({...filters, robotId: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tümü</SelectItem>{robots.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Operatör</Label><Select value={filters.operatorId} onValueChange={(v) => setFilters({...filters, operatorId: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tümü</SelectItem>{operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.first_name} {o.last_name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="flex items-end"><Button variant="outline" onClick={() => setFilters({ dateFrom: '', dateTo: '', partCode: '', robotId: 'all', operatorId: 'all' })} className="w-full">Temizle</Button></div>
                </div></div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih/Saat</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parça Kodu</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adet</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Robot</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operatör</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WPS</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{new Date(record.record_date).toLocaleDateString('tr-TR')}</div><div className="text-sm text-gray-500 flex items-center"><Clock className="h-3 w-3 mr-1" />{record.record_time} ({getShiftLabel(record.shift)})</div></td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.part_code}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{record.quantity}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{record.robots?.name || 'N/A'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{record.employees ? `${record.employees.first_name} ${record.employees.last_name}` : 'N/A'}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{record.wps?.wps_code || 'N/A'}</td>
                          <td className="px-4 py-4 whitespace-nowrap"><Button variant="ghost" size="sm" onClick={() => handleDeleteRecord(record.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRecords.length === 0 && <div className="text-center py-8 text-gray-500"><Factory className="h-8 w-8 mx-auto mb-2" /><p>Kayıt bulunamadı</p></div>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    };

    export default ProductionTracking;