import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Save, Calendar as CalendarIcon, FileText, Edit, Search, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const DailyTimeTracking = () => {
    const [records, setRecords] = useState([]);
    const [lines, setLines] = useState([]);
    const [robots, setRobots] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useAuth();

    const [showDialog, setShowDialog] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const [formState, setFormState] = useState({
        record_date: new Date().toISOString().split('T')[0],
        robot_no: '',
        station: '',
        line_id: '',
        part_code: '',
        part_duration: '',
        ifs_duration: '',
        description: '',
    });

    const [filters, setFilters] = useState({
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
        line_id: 'all',
        robot_no: '',
        part_code: '',
        station: 'all',
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const from = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
            const to = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

            const [recordsData, linesData, robotsData] = await Promise.all([
                supabase.from('daily_time_tracking').select('*').gte('record_date', from).lte('record_date', to).order('record_date', { ascending: false }),
                supabase.from('lines').select('*').eq('deleted', false),
                supabase.from('robots').select('*').eq('deleted', false).eq('active', true).order('name'),
            ]);

            if (recordsData.error) throw recordsData.error;
            if (linesData.error) throw linesData.error;

            setLines(linesData.data || []);
            setRobots(robotsData.data || []);

            const lineMap = new Map((linesData.data || []).map(l => [l.id, l.name]));
            setRecords((recordsData.data || []).map(r => ({
                ...r,
                line_name: lineMap.get(r.line_id) || 'N/A'
            })));
        } catch (error) {
            toast({ title: "Veri yüklenemedi", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast, filters.dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filtreleme
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filters.line_id !== 'all' && r.line_id !== filters.line_id) return false;
            if (filters.robot_no && !r.robot_no.toLowerCase().includes(filters.robot_no.toLowerCase())) return false;
            if (filters.part_code && !r.part_code.toLowerCase().includes(filters.part_code.toLowerCase())) return false;
            if (filters.station !== 'all' && r.station !== Number(filters.station)) return false;
            return true;
        });
    }, [records, filters]);

    // Toplamlar
    const totals = useMemo(() => {
        const partDurationTotal = filteredRecords.reduce((sum, r) => sum + (r.part_duration || 0), 0);
        const ifsDurationTotal = filteredRecords.reduce((sum, r) => sum + (r.ifs_duration || 0), 0);
        return { partDurationTotal, ifsDurationTotal };
    }, [filteredRecords]);

    const resetForm = () => {
        setFormState({
            record_date: new Date().toISOString().split('T')[0],
            robot_no: '',
            station: '',
            line_id: '',
            part_code: '',
            part_duration: '',
            ifs_duration: '',
            description: '',
        });
        setEditingRecord(null);
    };

    const openDialog = (record = null) => {
        if (record) {
            setEditingRecord(record);
            setFormState({
                record_date: record.record_date,
                robot_no: record.robot_no || '',
                station: String(record.station),
                line_id: record.line_id || '',
                part_code: record.part_code || '',
                part_duration: record.part_duration != null ? String(record.part_duration) : '',
                ifs_duration: record.ifs_duration != null ? String(record.ifs_duration) : '',
                description: record.description || '',
            });
        } else {
            resetForm();
        }
        setShowDialog(true);
    };

    const handleSave = async () => {
        // Validasyon
        if (!formState.record_date) {
            toast({ title: "Hata", description: "Tarih zorunludur.", variant: "destructive" });
            return;
        }
        if (!formState.robot_no.trim()) {
            toast({ title: "Hata", description: "Robot No zorunludur.", variant: "destructive" });
            return;
        }
        if (!formState.station || !['1', '2'].includes(formState.station)) {
            toast({ title: "Hata", description: "İstasyon zorunludur ve sadece 1 veya 2 olabilir.", variant: "destructive" });
            return;
        }
        if (!formState.line_id) {
            toast({ title: "Hata", description: "Hat Adı zorunludur.", variant: "destructive" });
            return;
        }
        if (!formState.part_code.trim()) {
            toast({ title: "Hata", description: "Parça Kodu zorunludur.", variant: "destructive" });
            return;
        }

        const partDur = formState.part_duration !== '' ? parseFloat(formState.part_duration) : null;
        const ifsDur = formState.ifs_duration !== '' ? parseFloat(formState.ifs_duration) : null;

        if (partDur !== null && partDur < 0) {
            toast({ title: "Hata", description: "Parça Süresi negatif olamaz.", variant: "destructive" });
            return;
        }
        if (ifsDur !== null && ifsDur < 0) {
            toast({ title: "Hata", description: "IFS Süre negatif olamaz.", variant: "destructive" });
            return;
        }

        const dataToSave = {
            record_date: formState.record_date,
            robot_no: formState.robot_no.trim(),
            station: Number(formState.station),
            line_id: formState.line_id,
            part_code: formState.part_code.trim(),
            part_duration: partDur,
            ifs_duration: ifsDur,
            description: formState.description.trim() || null,
            updated_at: new Date().toISOString(),
        };

        try {
            let result;
            if (editingRecord) {
                result = await supabase.from('daily_time_tracking').update(dataToSave).eq('id', editingRecord.id);
            } else {
                result = await supabase.from('daily_time_tracking').insert(dataToSave);
            }

            if (result.error) throw result.error;

            toast({ title: "Başarılı", description: editingRecord ? "Kayıt güncellendi." : "Kayıt eklendi." });
            logAction(editingRecord ? 'UPDATE_DAILY_TIME' : 'CREATE_DAILY_TIME', `Parça: ${dataToSave.part_code}, Robot: ${dataToSave.robot_no}`, user);
            setShowDialog(false);
            resetForm();
            fetchData();
        } catch (error) {
            toast({ title: "Kayıt Başarısız", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            const { error } = await supabase.from('daily_time_tracking').delete().eq('id', deleteConfirm.id);
            if (error) throw error;
            toast({ title: "Silindi", description: "Kayıt başarıyla silindi.", variant: "destructive" });
            logAction('DELETE_DAILY_TIME', `ID: ${deleteConfirm.id}`, user);
            fetchData();
        } catch (error) {
            toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
        }
        setDeleteConfirm(null);
    };

    // CSV Export
    const handleExport = () => {
        if (filteredRecords.length === 0) {
            toast({ title: "Uyarı", description: "Dışa aktarılacak veri bulunamadı." });
            return;
        }

        const lineMap = new Map(lines.map(l => [l.id, l.name]));
        const headers = ['Tarih', 'Robot No', 'İstasyon', 'Hat Adı', 'Parça Kodu', 'Parça Süresi (dk)', 'IFS Süre (dk)', 'Açıklama'];
        const rows = filteredRecords.map(r => [
            format(new Date(r.record_date), 'dd.MM.yyyy'),
            r.robot_no,
            r.station,
            lineMap.get(r.line_id) || 'N/A',
            r.part_code,
            r.part_duration != null ? r.part_duration : '',
            r.ifs_duration != null ? r.ifs_duration : '',
            r.description || ''
        ]);

        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gunluk_sure_takibi_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "İndirildi", description: `${filteredRecords.length} kayıt CSV olarak indirildi.` });
    };

    // Hızlı tarih butonları
    const setQuickDate = (type) => {
        const today = new Date();
        if (type === 'today') {
            setFilters(prev => ({ ...prev, dateRange: { from: today, to: today } }));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            setFilters(prev => ({ ...prev, dateRange: { from: yesterday, to: yesterday } }));
        } else if (type === 'thisMonth') {
            setFilters(prev => ({ ...prev, dateRange: { from: startOfMonth(today), to: endOfMonth(today) } }));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Günlük Süre Takibi</h1>
                        <p className="text-sm text-gray-500">Robot bazlı parça süre kayıt ve takip sistemi</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />CSV İndir
                    </Button>
                    <Button onClick={() => openDialog()}>
                        <Plus className="h-4 w-4 mr-2" />Yeni Kayıt
                    </Button>
                </div>
            </div>

            {/* Filtreler */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <DateRangePicker
                            value={filters.dateRange}
                            onChange={(range) => setFilters(prev => ({ ...prev, dateRange: range || { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } }))}
                            placeholder="Tarih Aralığı"
                            className="w-[280px]"
                        />
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setQuickDate('today')}>Bugün</Button>
                            <Button variant="outline" size="sm" onClick={() => setQuickDate('yesterday')}>Dün</Button>
                            <Button variant="outline" size="sm" onClick={() => setQuickDate('thisMonth')}>Bu Ay</Button>
                        </div>
                        <Select value={filters.line_id} onValueChange={v => setFilters(prev => ({ ...prev, line_id: v }))}>
                            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tüm Hatlar" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Hatlar</SelectItem>
                                {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filters.station} onValueChange={v => setFilters(prev => ({ ...prev, station: v }))}>
                            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tüm İst." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm İstasyonlar</SelectItem>
                                <SelectItem value="1">İstasyon 1</SelectItem>
                                <SelectItem value="2">İstasyon 2</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Robot No..."
                            value={filters.robot_no}
                            onChange={e => setFilters(prev => ({ ...prev, robot_no: e.target.value }))}
                            className="w-[140px]"
                        />
                        <Input
                            placeholder="Parça Kodu..."
                            value={filters.part_code}
                            onChange={e => setFilters(prev => ({ ...prev, part_code: e.target.value }))}
                            className="w-[160px]"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Toplam Kartlar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Kayıt</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredRecords.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Parça Süresi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.partDurationTotal.toFixed(2)} dk</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam IFS Süre</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.ifsDurationTotal.toFixed(2)} dk</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tablo */}
            <Card>
                <CardContent className="p-0">
                    <div className="border rounded-lg overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    {['Tarih', 'Robot No', 'İstasyon', 'Hat Adı', 'Parça Kodu', 'Parça Süresi (dk)', 'IFS Süre (dk)', 'Açıklama', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredRecords.map(record => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{format(new Date(record.record_date), 'dd.MM.yyyy')}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{record.robot_no}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${record.station === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                İst. {record.station}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{record.line_name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">{record.part_code}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            {record.part_duration != null ? (
                                                <span className="font-medium">{record.part_duration}</span>
                                            ) : (
                                                <span className="text-gray-400 italic">Boş</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            {record.ifs_duration != null ? (
                                                <span className="font-medium">{record.ifs_duration}</span>
                                            ) : (
                                                <span className="text-gray-400 italic">Boş</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-sm max-w-xs truncate" title={record.description}>{record.description || '-'}</td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <Button variant="ghost" size="sm" onClick={() => openDialog(record)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(record)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredRecords.length === 0 && (
                            <p className="text-center py-8 text-gray-500">Kayıt bulunamadı.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Kayıt Ekleme/Düzenleme Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-2xl p-0 overflow-hidden border-0">
                    <DialogHeader className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-6 text-white">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            {editingRecord ? <Edit className="h-6 w-6 text-white/80" /> : <Plus className="h-6 w-6 text-white/80" />}
                            {editingRecord ? 'Kayıt Düzenle' : 'Yeni Kayıt Ekle'}
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100 opacity-90">
                            Günlük süre takibi için gerekli bilgileri aşağıdan yönetebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" /> Tarih <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="date"
                                    value={formState.record_date}
                                    onChange={e => setFormState(prev => ({ ...prev, record_date: e.target.value }))}
                                    className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 flex items-center justify-center text-[8px] font-bold text-indigo-500">R</span> Robot No <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formState.robot_no} onValueChange={v => setFormState(prev => ({ ...prev, robot_no: v }))}>
                                    <SelectTrigger className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                        <SelectValue placeholder="Robot seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {robots.map(r => (
                                            <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="w-3.5 h-3.5 rounded-sm bg-indigo-100 border border-indigo-300"></span> İstasyon <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formState.station} onValueChange={v => setFormState(prev => ({ ...prev, station: v }))}>
                                    <SelectTrigger className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                        <SelectValue placeholder="İstasyon seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">İstasyon 1</SelectItem>
                                        <SelectItem value="2">İstasyon 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-indigo-500" /> Hat Adı <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formState.line_id} onValueChange={v => setFormState(prev => ({ ...prev, line_id: v }))}>
                                    <SelectTrigger className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                        <SelectValue placeholder="Hat seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                <Search className="w-3.5 h-3.5 text-indigo-500" /> Parça Kodu <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                placeholder="Parça kodu giriniz"
                                value={formState.part_code}
                                onChange={e => setFormState(prev => ({ ...prev, part_code: e.target.value }))}
                                className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" /> Parça Süresi (dk)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={formState.part_duration}
                                    onChange={e => setFormState(prev => ({ ...prev, part_duration: e.target.value }))}
                                    className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-purple-500" /> IFS Süre (dk)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={formState.ifs_duration}
                                    onChange={e => setFormState(prev => ({ ...prev, ifs_duration: e.target.value }))}
                                    className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Açıklama</Label>
                            <Input
                                placeholder="Açıklama (opsiyonel)"
                                value={formState.description}
                                onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
                                className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowDialog(false)}
                            className="rounded-lg border-gray-300 hover:bg-gray-100 hover:text-gray-900 transition-colors px-6"
                        >
                            İptal
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200 transition-all px-6"
                        >
                            <Save className="mr-2 h-4 w-4" />{editingRecord ? 'Değişiklikleri Kaydet' : 'Kaydı Tamamla'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Silme Onayı */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-2xl border-0 overflow-hidden">
                    <DialogHeader className="bg-red-50 p-6 border-b border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-red-900">Kaydı Sil</DialogTitle>
                                <DialogDescription className="text-red-700 mt-1">
                                    Bu işlem geri alınamaz.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-6">
                        <p className="text-gray-600">
                            Bu kaydı silmek istediğinize emin misiniz? Silinen veriler kalıcı olarak kaldırılacaktır.
                        </p>
                    </div>
                    <DialogFooter className="p-6 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg border-gray-300 hover:bg-gray-100 hover:text-gray-900 px-6 font-medium"
                        >
                            İptal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md shadow-red-200 px-6 font-medium"
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DailyTimeTracking;
