import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Search, Factory, Settings, Wrench, Save, DollarSign, Undo, AlertTriangle, Wrench as Tool, Users, BarChart3, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, logAction } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Switch } from '@/components/ui/switch';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const MasterData = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('lines');
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({});
  const [showDeleted, setShowDeleted] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  const initialLineCosts = { gas: 0, wire: 0, labor: 0, energy: 0 };
  const initialLineState = { name: '', location: '', type: 'robot', costs: [{ validFrom: new Date().toISOString().split('T')[0], ...initialLineCosts, totalCostPerSecond: 0 }], active: true, deleted: false };
  const initialRevisedFixtureState = { revision_date: new Date().toISOString().split('T')[0], fixture_id: '', part_no: '', description: '', result: 'Tamamlanmadı' };
  const initialEmployeeState = { first_name: '', last_name: '', registration_number: '', department: '', position: '', is_active: true };

  const [lines, setLines] = useState([]);
  const [robots, setRobots] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [costItems, setCostItems] = useState([]);
  const [revisedFixtures, setRevisedFixtures] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Özet istatistikler
  const stats = useMemo(() => {
    const activeLines = lines.filter(l => !l.deleted && l.active);
    const activeRobots = robots.filter(r => !r.deleted && r.active);
    const activeFixtures = fixtures.filter(f => !f.deleted && f.active);
    const activeEmployees = employees.filter(e => e.is_active);

    // Hat tipleri dağılımı
    const lineTypes = {};
    activeLines.forEach(l => {
      const type = l.type || 'other';
      if (!lineTypes[type]) lineTypes[type] = 0;
      lineTypes[type]++;
    });

    const lineTypeData = Object.entries(lineTypes).map(([name, value]) => ({
      name: name === 'robot' ? 'Robot' : name === 'manual' ? 'Manuel' : name === 'repair' ? 'Tamir' : 'Diğer',
      value
    }));

    // Departman bazlı personel
    const departments = {};
    activeEmployees.forEach(e => {
      const dept = e.department || 'Belirtilmemiş';
      if (!departments[dept]) departments[dept] = 0;
      departments[dept]++;
    });

    const deptData = Object.entries(departments)
      .map(([name, value]) => ({ name: name.length > 12 ? name.substring(0, 12) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Hat başına robot dağılımı
    const robotsByLine = {};
    activeRobots.forEach(r => {
      const line = activeLines.find(l => l.id === r.line_id);
      const lineName = line?.name || 'Bağlı Değil';
      if (!robotsByLine[lineName]) robotsByLine[lineName] = 0;
      robotsByLine[lineName]++;
    });

    const robotLineData = Object.entries(robotsByLine)
      .map(([name, value]) => ({ name: name.length > 12 ? name.substring(0, 12) + '...' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      totalLines: activeLines.length,
      totalRobots: activeRobots.length,
      totalFixtures: activeFixtures.length,
      totalEmployees: activeEmployees.length,
      totalCostItems: costItems.filter(c => !c.deleted && c.active).length,
      revisedFixturesCompleted: revisedFixtures.filter(rf => rf.result === 'Tamamlandı').length,
      revisedFixturesTotal: revisedFixtures.length,
      lineTypeData,
      deptData,
      robotLineData,
    };
  }, [lines, robots, fixtures, employees, costItems, revisedFixtures]);

  const dataMap = {
    lines: { state: lines, setState: setLines, initial: initialLineState, table: 'lines' },
    robots: { state: robots, setState: setRobots, initial: { name: '', brand: '', model: '', line_id: '', active: true, deleted: false }, table: 'robots' },
    fixtures: { state: fixtures, setState: setFixtures, initial: { code: '', name: '', line_id: '', robot_id: '', active: true, deleted: false }, table: 'fixtures' },
    employees: { state: employees, setState: setEmployees, initial: initialEmployeeState, table: 'employees' },
    'cost-items': { state: costItems, setState: setCostItems, initial: { name: '', type: 'labor', value: '', unit: '₺/saat', active: true, deleted: false }, table: 'cost_items' },
    'revised-fixtures': { state: revisedFixtures, setState: setRevisedFixtures, initial: initialRevisedFixtureState, table: 'revised_fixtures' },
  };

  const tabs = [
    { id: 'lines', name: 'Hatlar', icon: Factory, data: lines },
    { id: 'robots', name: 'Robotlar', icon: Settings, data: robots },
    { id: 'fixtures', name: 'Fikstürler', icon: Wrench, data: fixtures },
    { id: 'employees', name: 'Personel', icon: Users, data: employees },
    { id: 'revised-fixtures', name: 'Revize Fikstürler', icon: Tool, data: revisedFixtures },
    { id: 'cost-items', name: 'Maliyetler', icon: DollarSign, data: costItems },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    for (const key of Object.keys(dataMap)) {
      const { data, error } = await supabase.from(dataMap[key].table).select('*');
      if (error) {
        console.error(`Error fetching ${key}:`, error);
        toast({ title: `Veri Yüklenemedi: ${key}`, description: error.message, variant: 'destructive' });
      } else {
        dataMap[key].setState(data);
      }
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (itemToSave, isEditing) => {
    const { table } = dataMap[selectedTab];
    let response;
    const { id, ...saveData } = itemToSave;

    if (isEditing) {
      response = await supabase.from(table).update(saveData).eq('id', id).select();
    } else {
      response = await supabase.from(table).insert(saveData).select();
    }

    const { data, error } = response;
    if (error) {
      toast({ title: "Kayıt Başarısız", description: error.message, variant: "destructive" });
    } else {
      const savedItem = data[0];
      toast({ title: "Kayıt Başarılı", description: `Veri başarıyla ${isEditing ? 'güncellendi' : 'eklendi'}.` });
      logAction(isEditing ? 'UPDATE' : 'CREATE', `MasterData ${selectedTab}: ${savedItem.name || savedItem.code || savedItem.id || savedItem.first_name}`, user);
      
      fetchData();
      setShowAddDialog(false);
      setShowEditDialog(false);
      setEditingItem(null);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async (isPermanent) => {
    const { table } = dataMap[selectedTab];
    let response;
    if (isPermanent) {
      response = await supabase.from(table).delete().eq('id', itemToDelete.id);
    } else {
      response = await supabase.from(table).update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', itemToDelete.id);
    }

    const { error } = response;
    if (error) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Silme Başarılı", description: `Kayıt başarıyla ${isPermanent ? 'kalıcı olarak' : ''} silindi.`, variant: isPermanent ? "destructive" : "default" });
      logAction(isPermanent ? 'HARD_DELETE' : 'SOFT_DELETE', `MasterData ${selectedTab}: ${itemToDelete.name || itemToDelete.code || itemToDelete.id}`, user);
      fetchData();
    }
    setShowConfirmDelete(false);
    setItemToDelete(null);
  };

  const handleRestore = async (id) => {
    const { table } = dataMap[selectedTab];
    const { error } = await supabase.from(table).update({ deleted: false, deleted_at: null }).eq('id', id);
    if (error) {
      toast({ title: "Geri Yükleme Başarısız", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Geri Yüklendi", description: "Kayıt başarıyla geri yüklendi." });
      logAction('RESTORE', `MasterData ${selectedTab}: ID ${id}`, user);
      fetchData();
    }
  };

  const getActiveCost = (line) => {
    if (!line.costs || line.costs.length === 0) return { ...initialLineCosts, totalCostPerSecond: 0, validFrom: new Date().toISOString() };
    return [...line.costs].sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom))[0];
  };

  const calculateTotalCost = (costs) => {
    const { gas, wire, labor, energy } = costs;
    const total = parseFloat(gas || 0) + parseFloat(wire || 0) + parseFloat(labor || 0) + parseFloat(energy || 0);
    return total;
  };

  const handleCostChange = (item, setItem, field, value) => {
    const currentCosts = getActiveCost(item);
    const newCosts = { ...currentCosts, [field]: value };
    const totalCostPerSecond = calculateTotalCost(newCosts);
    const updatedCostEntry = { ...newCosts, totalCostPerSecond };
    
    const otherCosts = (item.costs || []).filter(c => c.validFrom !== currentCosts.validFrom);
    setItem({ ...item, costs: [...otherCosts, updatedCostEntry] });
  };

  const renderForm = (item, setItem) => {
    if (!item) return null;
    switch (selectedTab) {
      case 'lines':
        const activeCost = getActiveCost(item);
        const totalCost = activeCost.totalCostPerSecond || 0;
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Hat Adı</Label><Input value={item.name || ''} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Lokasyon</Label><Input value={item.location || ''} onChange={(e) => setItem({ ...item, location: e.target.value })} /></div>
              <div className="space-y-2"><Label>Hat Tipi</Label><Select value={item.type || ''} onValueChange={(value) => setItem({ ...item, type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="robot">Robot</SelectItem><SelectItem value="manual">Manuel</SelectItem><SelectItem value="repair">Tamir</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Maliyet Geçerlilik Tarihi</Label><Input type="date" value={activeCost.validFrom.split('T')[0]} disabled /></div>
            </div>
            <Card className="mt-4"><CardHeader><CardTitle className="text-base">Maliyet Girdileri (₺/saniye)</CardTitle></CardHeader>
              <CardContent className="px-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Gaz Maliyeti</Label><Input type="number" value={activeCost.gas || ''} onChange={(e) => handleCostChange(item, setItem, 'gas', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Tel Maliyeti</Label><Input type="number" value={activeCost.wire || ''} onChange={(e) => handleCostChange(item, setItem, 'wire', e.target.value)} /></div>
                  <div className="space-y-2"><Label>İşçilik Maliyeti</Label><Input type="number" value={activeCost.labor || ''} onChange={(e) => handleCostChange(item, setItem, 'labor', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Enerji Maliyeti</Label><Input type="number" value={activeCost.energy || ''} onChange={(e) => handleCostChange(item, setItem, 'energy', e.target.value)} /></div>
                </div>
                <div className="mt-4 p-3 bg-gray-100 rounded-lg text-center">
                  <Label>Toplam Saniye Maliyeti</Label>
                  <p className="text-2xl font-bold text-blue-600">{totalCost.toFixed(5)} ₺</p>
                </div>
              </CardContent>
            </Card>
          </>
        );
      case 'robots':
        return (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Robot Adı</Label><Input value={item.name || ''} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Marka</Label><Input value={item.brand || ''} onChange={(e) => setItem({ ...item, brand: e.target.value })} /></div>
              <div className="space-y-2"><Label>Model</Label><Input value={item.model || ''} onChange={(e) => setItem({ ...item, model: e.target.value })} /></div>
              <div className="space-y-2"><Label>Bağlı Olduğu Hat</Label><Select value={item.line_id || ''} onValueChange={(value) => setItem({ ...item, line_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{lines.filter(l => !l.deleted).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
        );
      case 'fixtures':
        return (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Fikstür Kodu</Label><Input value={item.code || ''} onChange={(e) => setItem({ ...item, code: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fikstür Adı</Label><Input value={item.name || ''} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Bağlı Olduğu Hat</Label><Select value={item.line_id || ''} onValueChange={(value) => setItem({ ...item, line_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{lines.filter(l => !l.deleted).map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Bağlı Olduğu Robot</Label><Select value={item.robot_id || ''} onValueChange={(value) => setItem({ ...item, robot_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{robots.filter(r => !r.deleted).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
        );
      case 'employees':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Ad</Label><Input value={item.first_name || ''} onChange={(e) => setItem({ ...item, first_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Soyad</Label><Input value={item.last_name || ''} onChange={(e) => setItem({ ...item, last_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Sicil Numarası</Label><Input value={item.registration_number || ''} onChange={(e) => setItem({ ...item, registration_number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Departman</Label><Input value={item.department || ''} onChange={(e) => setItem({ ...item, department: e.target.value })} /></div>
            <div className="space-y-2"><Label>Pozisyon</Label><Input value={item.position || ''} onChange={(e) => setItem({ ...item, position: e.target.value })} /></div>
            <div className="flex items-center space-x-2"><Switch id="is_active" checked={item.is_active} onCheckedChange={(checked) => setItem({ ...item, is_active: checked })} /><Label htmlFor="is_active">Aktif</Label></div>
          </div>
        );
      case 'revised-fixtures':
        return (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Revizyon Tarihi</Label><Input type="date" value={item.revision_date || ''} onChange={(e) => setItem({ ...item, revision_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Revize Edilecek Fikstür</Label><Select value={item.fixture_id || ''} onValueChange={(value) => setItem({ ...item, fixture_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fixtures.filter(f => !f.deleted).map(f => <SelectItem key={f.id} value={f.id}>{f.name} ({f.code})</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Parça No</Label><Input value={item.part_no || ''} onChange={(e) => setItem({ ...item, part_no: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sonuç</Label><Select value={item.result || ''} onValueChange={(value) => setItem({ ...item, result: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Tamamlandı">Tamamlandı</SelectItem><SelectItem value="Tamamlanmadı">Tamamlanmadı</SelectItem></SelectContent></Select></div>
              <div className="col-span-2 space-y-2"><Label>Açıklama</Label><Input value={item.description || ''} onChange={(e) => setItem({ ...item, description: e.target.value })} /></div>
            </div>
        );
      case 'cost-items':
        return (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Maliyet Kalemi Adı</Label><Input value={item.name || ''} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Değer</Label><Input type="number" value={item.value || ''} onChange={(e) => setItem({ ...item, value: e.target.value })} /></div>
              <div className="space-y-2"><Label>Birim</Label><Select value={item.unit || ''} onValueChange={(value) => setItem({ ...item, unit: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="₺/saat">₺/saat</SelectItem><SelectItem value="₺/kg">₺/kg</SelectItem><SelectItem value="₺/m">₺/m</SelectItem><SelectItem value="₺/kWh">₺/kWh</SelectItem><SelectItem value="₺/saniye">₺/saniye</SelectItem></SelectContent></Select></div>
            </div>
        );
      default:
        return <p>Bu kategori için form henüz yapılandırılmadı.</p>;
    }
  };

  const renderTable = (type, data) => {
    const filteredData = data.filter(item => 
      (!item.deleted || (type === 'employees' && !item.is_active && showDeleted) || (item.deleted && showDeleted)) &&
      Object.values(item).some(value => 
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    const headers = {
      lines: ['Hat Adı', 'Tip', 'Saniye Maliyeti (₺)', 'Maliyet Dağılımı', 'Durum', 'İşlemler'],
      robots: ['Robot Adı', 'Marka', 'Hat', 'Durum', 'İşlemler'],
      fixtures: ['Fikstür Kodu', 'Robot', 'Durum', 'İşlemler'],
      employees: ['Ad Soyad', 'Sicil No', 'Departman', 'Pozisyon', 'Durum', 'İşlemler'],
      'revised-fixtures': ['Tarih', 'Fikstür', 'Parça No', 'Açıklama', 'Sonuç', 'İşlemler'],
      'cost-items': ['Maliyet Kalemi', 'Değer', 'Birim', 'Durum', 'İşlemler'],
    };

    const renderRow = (item) => {
      switch (type) {
        case 'lines':
          const activeCost = getActiveCost(item);
          const totalCost = activeCost.totalCostPerSecond || 0;
          const costDistribution = totalCost > 0 ? [
            { label: 'G', value: (activeCost.gas / totalCost * 100), color: 'bg-red-500' },
            { label: 'T', value: (activeCost.wire / totalCost * 100), color: 'bg-yellow-500' },
            { label: 'İ', value: (activeCost.labor / totalCost * 100), color: 'bg-blue-500' },
            { label: 'E', value: (activeCost.energy / totalCost * 100), color: 'bg-green-500' },
          ] : [];
          return (
            <>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{item.type}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{totalCost.toFixed(5)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex items-center w-24 h-4 rounded overflow-hidden" title={`Gaz: ${costDistribution[0]?.value.toFixed(1)}%, Tel: ${costDistribution[1]?.value.toFixed(1)}%, İşçilik: ${costDistribution[2]?.value.toFixed(1)}%, Enerji: ${costDistribution[3]?.value.toFixed(1)}%`}>
                  {costDistribution.map(d => d.value > 0 && <div key={d.label} className={d.color} style={{ width: `${d.value}%` }}></div>)}
                </div>
              </td>
            </>
          );
        case 'robots':
            const lineName = lines.find(l => l.id === item.line_id)?.name || 'N/A';
            return (
                <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.brand}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lineName}</td>
                </>
            );
        case 'fixtures':
            const robotName = robots.find(r => r.id === item.robot_id)?.name || 'N/A';
            return (
                <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{robotName}</td>
                </>
            );
        case 'employees':
          return (
            <>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{`${item.first_name} ${item.last_name}`}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.registration_number}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.department}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.position}</td>
            </>
          );
        case 'revised-fixtures':
            const fixtureName = fixtures.find(f => f.id === item.fixture_id)?.name || 'N/A';
            return (
                <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{new Date(item.revision_date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fixtureName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.part_no}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{item.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${item.result === 'Tamamlandı' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{item.result}</span></td>
                </>
            );
        case 'cost-items':
            return (
                <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.value}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                </>
            );
        default:
          return <td colSpan={headers[type]?.length - 2} className="px-6 py-4 text-sm text-gray-500">Bu görünüm güncelleniyor...</td>;
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-64" /></div>
            {selectedTab !== 'revised-fixtures' && <Button variant="outline" onClick={() => setShowDeleted(!showDeleted)} className={cn(showDeleted && "bg-yellow-100")}><Trash2 className="h-4 w-4 mr-2" /> {selectedTab === 'employees' ? 'Pasifleri' : 'Silinmişleri'} Göster</Button>}
          </div>
          <Button onClick={() => { setNewItem(dataMap[selectedTab].initial); setShowAddDialog(true); }}><Plus className="h-4 w-4 mr-2" />Yeni Ekle</Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50"><tr>{headers[type].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item) => (
                <tr key={item.id} className={cn("hover:bg-gray-50", item.deleted && "bg-red-50 opacity-60", type === 'employees' && !item.is_active && "bg-gray-100 opacity-70")}>
                  {renderRow(item)}
                  {type !== 'revised-fixtures' && (
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${(type === 'employees' ? item.is_active : item.active) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{ (type === 'employees' ? item.is_active : item.active) ? 'Aktif' : 'Pasif'}</span></td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      {item.deleted ? (
                        <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}><Undo className="h-4 w-4 text-green-600" /></Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(JSON.parse(JSON.stringify(item))); setShowEditDialog(true); }}><Edit className="h-4 w-4" /></Button>
                          {selectedTab !== 'employees' && <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(item)}><Trash2 className="h-4 w-4 text-red-500" /></Button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && <div className="text-center py-8 text-gray-500"><p>Veri bulunamadı.</p></div>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Özet İstatistik Kartları */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600">Aktif Hat</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalLines}</p>
                </div>
                <Factory className="h-6 w-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600">Aktif Robot</p>
                  <p className="text-2xl font-bold text-green-900">{stats.totalRobots}</p>
                </div>
                <Settings className="h-6 w-6 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">Aktif Fikstür</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.totalFixtures}</p>
                </div>
                <Wrench className="h-6 w-6 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600">Aktif Personel</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.totalEmployees}</p>
                </div>
                <Users className="h-6 w-6 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-yellow-600">Maliyet Kalemi</p>
                  <p className="text-2xl font-bold text-yellow-900">{stats.totalCostItems}</p>
                </div>
                <DollarSign className="h-6 w-6 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-cyan-600">Revize Fikstür</p>
                  <p className="text-2xl font-bold text-cyan-900">{stats.revisedFixturesCompleted}/{stats.revisedFixturesTotal}</p>
                </div>
                <Tool className="h-6 w-6 text-cyan-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Grafikler */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hat Tipi Dağılımı */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Factory className="h-4 w-4" /> Hat Tipi Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.lineTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.lineTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.lineTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value + ' hat', '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">Veri yok</div>
              )}
            </CardContent>
          </Card>

          {/* Departman Dağılımı */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Departman Dağılımı
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.deptData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="name" type="category" fontSize={9} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8B5CF6" name="Personel" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">Veri yok</div>
              )}
            </CardContent>
          </Card>

          {/* Hat Başına Robot */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" /> Hat Başına Robot
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.robotLineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.robotLineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={9} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10B981" name="Robot" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">Veri yok</div>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader><CardTitle>Veri Yönetimi</CardTitle><CardDescription>Sistem genelinde kullanılan referans verilerini yönetin.</CardDescription></CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={(tab) => { setSearchTerm(''); setSelectedTab(tab); }}>
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
                {tabs.map((tab) => { const Icon = tab.icon; return (<TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2"><Icon className="h-4 w-4" /><span className="hidden sm:inline">{tab.name}</span></TabsTrigger>);})}
              </TabsList>
              {tabs.map((tab) => (<TabsContent key={tab.id} value={tab.id} className="mt-6">{renderTable(tab.id, tab.data)}</TabsContent>))}
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Yeni {tabs.find(t => t.id === selectedTab)?.name} Ekle</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 modal-body-scroll">{renderForm(newItem, setNewItem)}</div>
          <DialogFooter><Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button><Button onClick={() => handleSave(newItem, false)}><Save className="h-4 w-4 mr-2" />Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{tabs.find(t => t.id === selectedTab)?.name} Düzenle</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 modal-body-scroll">{editingItem && renderForm(editingItem, setEditingItem)}</div>
          <DialogFooter><Button variant="outline" onClick={() => setShowEditDialog(false)}>İptal</Button><Button onClick={() => handleSave(editingItem, true)}><Save className="h-4 w-4 mr-2" />Güncelle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-red-500"/>Silme Onayı</DialogTitle></DialogHeader>
          <DialogDescription>Bu kaydı silmek istediğinizden emin misiniz?</DialogDescription>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setShowConfirmDelete(false)}>İptal</Button><Button variant="outline" onClick={() => handleConfirmDelete(false)}>Geçici Sil</Button><Button variant="destructive" onClick={() => handleConfirmDelete(true)}>Kalıcı Sil</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MasterData;