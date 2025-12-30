import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookUser, Plus, Eye, Trash2, Save, Calendar as CalendarIcon, FileText, Edit, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatCurrency, logAction, openPrintWindow } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const shiftOptions = [
    { value: '1', label: '1. Vardiya' },
    { value: '2', label: '2. Vardiya' },
    { value: '3', label: '3. Vardiya' },
];

const getShiftLabel = (value) => {
    const option = shiftOptions.find(o => o.value === String(value));
    return option ? option.label : 'Bilinmeyen';
};

const MultiRowForm = ({ onSave, lines, employees }) => {
    const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
    const [shift, setShift] = useState('1');

    const [manualRows, setManualRows] = useState([{ id: 1, part_code: '', quantity: '', duration_seconds: '', line_id: null, description: '', operator_id: null }]);
    const [repairRows, setRepairRows] = useState([{ id: 1, quantity: '', duration_seconds: '', repair_line_id: null, source_line_id: null, description: '', operator_id: null }]);

    const employeeOptions = useMemo(() => employees.map(emp => ({
        value: emp.id,
        label: `${emp.registration_number} - ${emp.first_name} ${emp.last_name}`
    })), [employees]);

    const handleRowChange = (setter, index, field, value) => {
        setter(prev => {
            const newRows = [...prev];
            newRows[index][field] = value;
            return newRows;
        });
    };

    const addRow = (setter, isRepair = false) => {
        const newRow = isRepair
            ? { id: Date.now(), quantity: '', duration_seconds: '', repair_line_id: null, source_line_id: null, description: '', operator_id: null }
            : { id: Date.now(), part_code: '', quantity: '', duration_seconds: '', line_id: null, description: '', operator_id: null };
        setter(prev => [...prev, newRow]);
    };

    const removeRow = (setter, index) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveClick = () => {
        if (!recordDate || !shift) {
            alert("Lütfen Tarih ve Vardiya bilgilerini eksiksiz girin.");
            return;
        }
        onSave({ recordDate, shift, manualRows, repairRows });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                <div className="space-y-2"><Label>Tarih *</Label><Input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} /></div>
                <div className="space-y-2"><Label>Vardiya *</Label><Select value={shift} onValueChange={setShift}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{shiftOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <Tabs defaultValue="manual">
                <TabsList>
                    <TabsTrigger value="manual">Manuel Hat Kayıtları</TabsTrigger>
                    <TabsTrigger value="repair">Tamir Hattı Kayıtları</TabsTrigger>
                </TabsList>
                <TabsContent value="manual" className="space-y-2 max-h-[40vh] overflow-y-auto p-2 border rounded-lg">
                    {manualRows.map((row, index) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md bg-white shadow-sm">
                            <div className="col-span-2"><Combobox options={employeeOptions} value={row.operator_id} onSelect={v => handleRowChange(setManualRows, index, 'operator_id', v)} placeholder="Operatör *" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı." /></div>
                            <Input className="col-span-2" placeholder="Parça Kodu" value={row.part_code} onChange={e => handleRowChange(setManualRows, index, 'part_code', e.target.value)} />
                            <Select value={row.line_id || ''} onValueChange={v => handleRowChange(setManualRows, index, 'line_id', v)}><SelectTrigger className="col-span-2"><SelectValue placeholder="Hat" /></SelectTrigger><SelectContent>{lines.filter(l => l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
                            <Input className="col-span-2" type="number" placeholder="Adet" value={row.quantity} onChange={e => handleRowChange(setManualRows, index, 'quantity', e.target.value)} />
                            <Input className="col-span-2" type="number" placeholder="Süre (sn)" value={row.duration_seconds} onChange={e => handleRowChange(setManualRows, index, 'duration_seconds', e.target.value)} />
                            <Input className="col-span-1" placeholder="Açıklama" value={row.description} onChange={e => handleRowChange(setManualRows, index, 'description', e.target.value)} />
                            <Button variant="ghost" size="icon" onClick={() => removeRow(setManualRows, index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addRow(setManualRows)} className="mt-2"><Plus className="h-4 w-4 mr-2" />Manuel Satır Ekle</Button>
                </TabsContent>
                <TabsContent value="repair" className="space-y-2 max-h-[40vh] overflow-y-auto p-2 border rounded-lg">
                    {repairRows.map((row, index) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md bg-white shadow-sm">
                            <div className="col-span-2"><Combobox options={employeeOptions} value={row.operator_id} onSelect={v => handleRowChange(setRepairRows, index, 'operator_id', v)} placeholder="Operatör *" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı." /></div>
                            <Select value={row.repair_line_id || ''} onValueChange={v => handleRowChange(setRepairRows, index, 'repair_line_id', v)}><SelectTrigger className="col-span-2"><SelectValue placeholder="Tamir Hattı" /></SelectTrigger><SelectContent>{lines.filter(l => l.type === 'repair' || l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
                            <Select value={row.source_line_id || ''} onValueChange={v => handleRowChange(setRepairRows, index, 'source_line_id', v)}><SelectTrigger className="col-span-2"><SelectValue placeholder="Kaynak Hat" /></SelectTrigger><SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
                            <Input className="col-span-2" type="number" placeholder="Adet" value={row.quantity} onChange={e => handleRowChange(setRepairRows, index, 'quantity', e.target.value)} />
                            <Input className="col-span-2" type="number" placeholder="Süre (sn)" value={row.duration_seconds} onChange={e => handleRowChange(setRepairRows, index, 'duration_seconds', e.target.value)} />
                            <Input className="col-span-1" placeholder="Açıklama" value={row.description} onChange={e => handleRowChange(setRepairRows, index, 'description', e.target.value)} />
                            <Button variant="ghost" size="icon" onClick={() => removeRow(setRepairRows, index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addRow(setRepairRows, true)} className="mt-2"><Plus className="h-4 w-4 mr-2" />Tamir Satırı Ekle</Button>
                </TabsContent>
            </Tabs>
            <DialogFooter>
                <Button onClick={handleSaveClick}><Save className="mr-2 h-4 w-4" />Tümünü Kaydet</Button>
            </DialogFooter>
        </div>
    );
};

const EditRecordForm = ({ record, recordType, onSave, lines, employees }) => {
    const [formData, setFormData] = useState({ ...record });
    const employeeOptions = useMemo(() => employees.map(emp => ({
        value: emp.id,
        label: `${emp.registration_number} - ${emp.first_name} ${emp.last_name}`
    })), [employees]);

    // record prop'u değiştiğinde form state'ini güncelle
    useEffect(() => {
        if (record) {
            setFormData({ ...record });
        }
    }, [record]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Operatör</Label>
                    <Combobox options={employeeOptions} value={formData.operator_id} onSelect={v => handleChange('operator_id', v)} placeholder="Operatör seçin" searchPlaceholder="Personel ara..." />
                </div>
                <div className="space-y-1">
                    <Label>Vardiya</Label>
                    <Select value={String(formData.shift)} onValueChange={v => handleChange('shift', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{shiftOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            {recordType === 'manual' && (
                <div className="space-y-1">
                    <Label>Parça Kodu</Label>
                    <Input value={formData.part_code} onChange={e => handleChange('part_code', e.target.value)} />
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Adet</Label>
                    <Input type="number" value={formData.quantity} onChange={e => handleChange('quantity', Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                    <Label>Süre (saniye)</Label>
                    <Input type="number" value={formData.duration_seconds || 0} onChange={e => handleChange('duration_seconds', Number(e.target.value))} />
                </div>
            </div>
            {recordType === 'manual' ? (
                <div className="space-y-1">
                    <Label>Hat</Label>
                    <Select value={formData.line_id || ''} onValueChange={v => handleChange('line_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Hat seçin" /></SelectTrigger>
                        <SelectContent>{lines.filter(l => l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label>Tamir Hattı</Label>
                        <Select value={formData.repair_line_id || ''} onValueChange={v => handleChange('repair_line_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Tamir Hattı" /></SelectTrigger>
                            <SelectContent>{lines.filter(l => l.type === 'repair' || l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Kaynak Hat</Label>
                        <Select value={formData.source_line_id || ''} onValueChange={v => handleChange('source_line_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Kaynak Hat" /></SelectTrigger>
                            <SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
            )}
            <div className="space-y-1">
                <Label>Açıklama</Label>
                <Input value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} />
            </div>

            <DialogFooter>
                <Button onClick={handleSave}>Kaydet</Button>
            </DialogFooter>
        </div>
    );
};

const ManualDataTracking = () => {
    const [manualRecords, setManualRecords] = useState([]);
    const [repairRecords, setRepairRecords] = useState([]);
    const [lines, setLines] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useAuth();

    const [showDialog, setShowDialog] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [viewingDetails, setViewingDetails] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null);
    const [showMonthlyDialog, setShowMonthlyDialog] = useState(false);
    const [showDailyDialog, setShowDailyDialog] = useState(false);
    const [selectedDailyRecord, setSelectedDailyRecord] = useState(null);
    const [monthlyTotals, setMonthlyTotals] = useState({});
    const [dailyTotals, setDailyTotals] = useState({});
    const [allManualRecords, setAllManualRecords] = useState([]); // Tüm manuel kayıtlar (modal için)
    const [allRepairRecords, setAllRepairRecords] = useState([]); // Tüm tamir kayıtları (modal için)
    const [monthlyFormData, setMonthlyFormData] = useState({
        year: format(new Date(), 'yyyy'),
        month: format(new Date(), 'MM'),
        total_production: ''
    });
    const [dailyFormData, setDailyFormData] = useState({
        date: '',
        total_production: ''
    });

    const [filters, setFilters] = useState({
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    });

    const [analysisFilters, setAnalysisFilters] = useState({
        dateRange: { from: new Date(new Date().getFullYear(), 0, 1), to: endOfMonth(new Date()) }, // Yıl başından bugüne
        shift: 'all',
        employee: 'all'
    });

    // Yeni state'ler
    const [partCodeSearch, setPartCodeSearch] = useState('');
    const [partCodeSearchResults, setPartCodeSearchResults] = useState(null);
    const [showPartCodeSearch, setShowPartCodeSearch] = useState(false);
    const [employeeAnalysisPeriod, setEmployeeAnalysisPeriod] = useState('monthly'); // 'monthly' veya 'yearly'

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const from = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
            const to = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

            // Aylık toplam verileri için ay listesi oluştur
            const fromMonth = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM') : '2000-01';
            const toMonth = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM') : format(new Date(), 'yyyy-MM');

            // Tüm kayıtları almak için pagination ile fetch (Supabase max 1000 satır limiti var)
            const fetchAllRecords = async (table, orderBy = 'record_date') => {
                const pageSize = 1000;
                let allData = [];
                let page = 0;
                let hasMore = true;

                while (hasMore) {
                    const { data, error } = await supabase
                        .from(table)
                        .select('*')
                        .order(orderBy, { ascending: false })
                        .range(page * pageSize, (page + 1) * pageSize - 1);

                    if (error) throw error;
                    if (data.length === 0) {
                        hasMore = false;
                    } else {
                        allData = [...allData, ...data];
                        hasMore = data.length === pageSize;
                        page++;
                    }
                }
                return { data: allData, error: null };
            };

            const [manualData, repairData, linesData, employeesData, monthlyData, dailyData] = await Promise.all([
                supabase.from('manual_production_records').select('*').gte('record_date', from).lte('record_date', to),
                supabase.from('repair_records').select('*').gte('record_date', from).lte('record_date', to),
                supabase.from('lines').select('*').eq('deleted', false),
                supabase.from('employees').select('*').eq('is_active', true),
                supabase.from('monthly_production_totals').select('*'), // Tüm aylık toplamları al (detaylı analiz için)
                supabase.from('daily_production_totals').select('*').gte('date', from).lte('date', to)
            ]);

            // Tüm kayıtları pagination ile al (detaylı analiz için)
            const [allManualData, allRepairData] = await Promise.all([
                fetchAllRecords('manual_production_records'),
                fetchAllRecords('repair_records')
            ]);

            if (manualData.error) throw manualData.error;
            if (repairData.error) throw repairData.error;
            if (allManualData.error) throw allManualData.error;
            if (allRepairData.error) throw allRepairData.error;
            if (linesData.error) throw linesData.error;
            if (employeesData.error) throw employeesData.error;
            // monthlyData ve dailyData error'ı kontrol etme - tablo yoksa oluşturulacak

            // Tüm kayıtları state'e kaydet (modal için)
            setAllManualRecords(allManualData.data || []);
            setAllRepairRecords(allRepairData.data || []);

            // Hat verilerini maliyet bilgileri ile formatla
            const linesWithCosts = linesData.data.map(line => {
                // Ana Veri modülünde costs bir array olarak tutuluyor, en güncel olanı al
                let activeCost = null;
                if (line.costs && Array.isArray(line.costs) && line.costs.length > 0) {
                    // En güncel maliyeti bul (validFrom'a göre sırala)
                    const sortedCosts = [...line.costs].sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom));
                    activeCost = sortedCosts[0];
                }

                return {
                    ...line,
                    costs: activeCost // En güncel maliyet objesi
                };
            });

            setLines(linesWithCosts);
            setEmployees(employeesData.data);

            // Aylık toplam verileri map'e dönüştür
            const monthlyMap = {};
            if (monthlyData && monthlyData.data) {
                monthlyData.data.forEach(m => {
                    monthlyMap[m.year_month] = m;
                });
            }
            setMonthlyTotals(monthlyMap);

            // Günlük toplam verileri map'e dönüştür
            const dailyMap = {};
            if (dailyData && dailyData.data) {
                dailyData.data.forEach(d => {
                    dailyMap[d.date] = d;
                });
            }
            setDailyTotals(dailyMap);

            const employeeMap = new Map(employeesData.data.map(e => [e.id, `${e.first_name} ${e.last_name}`]));
            const lineMap = new Map(linesData.data.map(l => [l.id, l.name]));

            setManualRecords(manualData.data.map(rec => ({ ...rec, operator_name: employeeMap.get(rec.operator_id) || 'N/A', line_name: lineMap.get(rec.line_id) || 'N/A' })));
            setRepairRecords(repairData.data.map(rec => ({ ...rec, operator_name: employeeMap.get(rec.operator_id) || 'N/A', source_line_name: lineMap.get(rec.source_line_id) || 'N/A', repair_line_name: lineMap.get(rec.repair_line_id) || 'N/A' })));

        } catch (error) {
            toast({ title: "Veri yüklenemedi", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast, filters.dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleMultiSave = async ({ recordDate, shift, manualRows, repairRows }) => {
        const now = new Date();
        const manualRecordsToSave = manualRows
            .filter(r => r.part_code && r.quantity > 0 && r.line_id && r.operator_id)
            .map(r => {
                return {
                    record_date: recordDate,
                    created_at: now.toISOString(),
                    shift,
                    operator_id: r.operator_id,
                    part_code: r.part_code,
                    quantity: Number(r.quantity),
                    duration_seconds: Number(r.duration_seconds) || 0,
                    line_id: r.line_id,
                    description: r.description,
                };
            });

        const repairRecordsToSave = repairRows
            .filter(r => r.quantity > 0 && r.repair_line_id && r.source_line_id && r.operator_id)
            .map(r => {
                return {
                    record_date: recordDate,
                    created_at: now.toISOString(),
                    shift,
                    operator_id: r.operator_id,
                    quantity: Number(r.quantity),
                    duration_seconds: Number(r.duration_seconds) || 0,
                    repair_line_id: r.repair_line_id,
                    source_line_id: r.source_line_id,
                    description: r.description,
                };
            });

        let successCount = 0;
        let errorCount = 0;
        let hasDataToSave = false;

        if (manualRecordsToSave.length > 0) {
            hasDataToSave = true;
            const { error } = await supabase.from('manual_production_records').insert(manualRecordsToSave);
            if (error) {
                toast({ title: "Manuel Kayıtlar Başarısız", description: error.message, variant: "destructive" });
                errorCount++;
            } else {
                successCount += manualRecordsToSave.length;
            }
        }

        if (repairRecordsToSave.length > 0) {
            hasDataToSave = true;
            const { error } = await supabase.from('repair_records').insert(repairRecordsToSave);
            if (error) {
                toast({ title: "Tamir Kayıtları Başarısız", description: error.message, variant: "destructive" });
                errorCount++;
            } else {
                successCount += repairRecordsToSave.length;
            }
        }

        if (!hasDataToSave) {
            toast({ title: "Kayıt Yapılmadı", description: "Kaydedilecek geçerli bir veri girilmedi.", variant: "default" });
            return;
        }

        if (successCount > 0) {
            toast({ title: "Başarılı", description: `${successCount} kayıt başarıyla eklendi.` });
            logAction('CREATE_MULTI_MANUAL_RECORDS', `${successCount} adet manuel/tamir kaydı eklendi.`, user);
        }

        if (errorCount === 0 && successCount > 0) {
            setShowDialog(false);
        }

        fetchData();
    };

    const handleGenerateReport = async () => {
        try {
            toast({ title: "Detaylı manuel veri raporu hazırlanıyor...", description: "Tüm veriler ve analizler toplanıyor, lütfen bekleyin." });

            const from = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd');
            const to = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd');

            const [manualData, repairData, linesData, employeesData] = await Promise.all([
                supabase.from('manual_production_records').select('*, line:lines(name), operator:employees(first_name, last_name, registration_number)').gte('record_date', from).lte('record_date', to),
                supabase.from('repair_records').select('*, repair_line:lines!repair_records_repair_line_id_fkey(name), source_line:lines!repair_records_source_line_id_fkey(name), operator:employees(first_name, last_name, registration_number)').gte('record_date', from).lte('record_date', to),
                supabase.from('lines').select('*').eq('deleted', false),
                supabase.from('employees').select('*').eq('is_active', true)
            ]);

            const manualRecords = manualData.data || [];
            const repairRecords = repairData.data || [];
            const allLines = linesData.data || [];
            const allEmployees = employeesData.data || [];

            const totalManualQuantity = manualRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalManualCost = manualRecords.reduce((sum, r) => sum + (r.manual_cost || 0), 0);
            const totalRepairQuantity = repairRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalRepairCost = repairRecords.reduce((sum, r) => sum + (r.repair_cost || 0), 0);
            const totalDuration = manualRecords.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) + repairRecords.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);

            // Gün sayısı hesaplama
            const daysDiff = Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
            const avgDailyManual = Math.round(totalManualQuantity / Math.max(1, daysDiff));
            const avgDailyRepair = Math.round(totalRepairQuantity / Math.max(1, daysDiff));

            // Hat bazlı analiz - Manuel
            const manualByLine = manualRecords.reduce((acc, r) => {
                const lineName = r.line?.name || 'Belirtilmemiş';
                if (!acc[lineName]) {
                    acc[lineName] = { quantity: 0, cost: 0, records: 0, duration: 0 };
                }
                acc[lineName].quantity += r.quantity || 0;
                acc[lineName].cost += r.manual_cost || 0;
                acc[lineName].records++;
                acc[lineName].duration += r.duration_seconds || 0;
                return acc;
            }, {});

            // Hat bazlı analiz - Tamir (kaynak hat)
            const repairBySourceLine = repairRecords.reduce((acc, r) => {
                const lineName = r.source_line?.name || 'Belirtilmemiş';
                if (!acc[lineName]) {
                    acc[lineName] = { quantity: 0, cost: 0, records: 0, duration: 0 };
                }
                acc[lineName].quantity += r.quantity || 0;
                acc[lineName].cost += r.repair_cost || 0;
                acc[lineName].records++;
                acc[lineName].duration += r.duration_seconds || 0;
                return acc;
            }, {});

            // Hat bazlı analiz - Tamir (tamir hat)
            const repairByRepairLine = repairRecords.reduce((acc, r) => {
                const lineName = r.repair_line?.name || 'Belirtilmemiş';
                if (!acc[lineName]) {
                    acc[lineName] = { quantity: 0, cost: 0, records: 0, duration: 0 };
                }
                acc[lineName].quantity += r.quantity || 0;
                acc[lineName].cost += r.repair_cost || 0;
                acc[lineName].records++;
                acc[lineName].duration += r.duration_seconds || 0;
                return acc;
            }, {});

            // Personel bazlı analiz
            const employeeStats = {};
            [...manualRecords, ...repairRecords].forEach(r => {
                const empId = r.operator_id;
                if (!empId) return;
                const emp = allEmployees.find(e => e.id === empId);
                const empName = emp ? `${emp.registration_number} - ${emp.first_name} ${emp.last_name}` : 'Bilinmeyen';

                if (!employeeStats[empId]) {
                    employeeStats[empId] = {
                        name: empName,
                        registrationNumber: emp?.registration_number || '',
                        quantity: 0,
                        cost: 0,
                        records: 0,
                        duration: 0,
                        manualQuantity: 0,
                        repairQuantity: 0,
                        parts: {}
                    };
                }
                employeeStats[empId].quantity += r.quantity || 0;
                employeeStats[empId].cost += (r.manual_cost || 0) + (r.repair_cost || 0);
                employeeStats[empId].records++;
                employeeStats[empId].duration += r.duration_seconds || 0;

                if (r.part_code) {
                    if (!employeeStats[empId].parts[r.part_code]) {
                        employeeStats[empId].parts[r.part_code] = 0;
                    }
                    employeeStats[empId].parts[r.part_code] += r.quantity || 0;
                }

                if (r.line_id) {
                    employeeStats[empId].manualQuantity += r.quantity || 0;
                } else if (r.repair_line_id) {
                    employeeStats[empId].repairQuantity += r.quantity || 0;
                }
            });

            // Vardiya bazlı analiz
            const shiftStats = {
                '1': { manual: { quantity: 0, cost: 0, records: 0 }, repair: { quantity: 0, cost: 0, records: 0 } },
                '2': { manual: { quantity: 0, cost: 0, records: 0 }, repair: { quantity: 0, cost: 0, records: 0 } },
                '3': { manual: { quantity: 0, cost: 0, records: 0 }, repair: { quantity: 0, cost: 0, records: 0 } }
            };

            manualRecords.forEach(r => {
                const shift = r.shift || '1';
                if (shiftStats[shift]) {
                    shiftStats[shift].manual.quantity += r.quantity || 0;
                    shiftStats[shift].manual.cost += r.manual_cost || 0;
                    shiftStats[shift].manual.records++;
                }
            });

            repairRecords.forEach(r => {
                const shift = r.shift || '1';
                if (shiftStats[shift]) {
                    shiftStats[shift].repair.quantity += r.quantity || 0;
                    shiftStats[shift].repair.cost += r.repair_cost || 0;
                    shiftStats[shift].repair.records++;
                }
            });

            // Parça bazlı analiz
            const partStats = {};
            manualRecords.forEach(r => {
                const partCode = r.part_code || 'Belirtilmemiş';
                if (!partStats[partCode]) {
                    partStats[partCode] = { quantity: 0, cost: 0, records: 0, employees: new Set() };
                }
                partStats[partCode].quantity += r.quantity || 0;
                partStats[partCode].cost += r.manual_cost || 0;
                partStats[partCode].records++;
                if (r.operator_id) partStats[partCode].employees.add(r.operator_id);
            });

            // Top 10 ve Bottom 10 personel
            const employeeArray = Object.entries(employeeStats).map(([id, stats]) => ({ id, ...stats }));
            const top10Employees = [...employeeArray].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
            const bottom10Employees = [...employeeArray].sort((a, b) => a.quantity - b.quantity).slice(0, 10);

            // En çok manuele gönderen hatlar (adet ve maliyet)
            const topManualLines = Object.entries(manualByLine)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);

            const topManualLinesByCost = Object.entries(manualByLine)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 10);

            // En çok tamire gönderen hatlar (kaynak hat - adet ve maliyet)
            const topRepairSourceLines = Object.entries(repairBySourceLine)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);

            const topRepairSourceLinesByCost = Object.entries(repairBySourceLine)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.cost - a.cost)
                .slice(0, 10);

            const reportId = `RPR-MANUAL-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
            const reportData = {
                title: 'Manuel Veri Takibi - Detaylı Yönetici Raporu',
                reportId,
                filters: {
                    'Rapor Dönemi': `${format(filters.dateRange?.from || startOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange?.to || endOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr })}`,
                    'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
                    'Toplam Gün': daysDiff + ' gün'
                },
                kpiCards: [
                    { title: 'Toplam Manuel Üretim', value: totalManualQuantity.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Toplam Manuel Maliyet', value: formatCurrency(totalManualCost) },
                    { title: 'Toplam Tamir Adedi', value: totalRepairQuantity.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Toplam Tamir Maliyeti', value: formatCurrency(totalRepairCost) },
                    { title: 'Toplam Süre', value: `${Math.floor(totalDuration / 3600)} saat ${Math.floor((totalDuration % 3600) / 60)} dakika` },
                    { title: 'Toplam Kayıt', value: (manualRecords.length + repairRecords.length).toString() },
                    { title: 'Ortalama Günlük Manuel', value: avgDailyManual.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Ortalama Günlük Tamir', value: avgDailyRepair.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Toplam Personel Sayısı', value: Object.keys(employeeStats).length.toString() },
                    { title: 'Farklı Parça Sayısı', value: Object.keys(partStats).length.toString() }
                ],
                tableData: {
                    headers: ['Tarih', 'Vardiya', 'Tip', 'Parça Kodu', 'Hat', 'Operatör', 'Adet', 'Süre (sn)', 'Maliyet', 'Açıklama'],
                    rows: [
                        ...manualRecords.map(r => [
                            format(new Date(r.record_date), 'dd.MM.yyyy', { locale: tr }),
                            getShiftLabel(r.shift),
                            'Manuel Üretim',
                            r.part_code || 'N/A',
                            r.line?.name || 'N/A',
                            r.operator ? `${r.operator.registration_number} - ${r.operator.first_name} ${r.operator.last_name}` : 'N/A',
                            (r.quantity || 0).toString(),
                            (r.duration_seconds || 0).toString(),
                            formatCurrency(r.manual_cost || 0),
                            r.description ? (r.description.length > 30 ? r.description.substring(0, 30) + '...' : r.description) : '-'
                        ]),
                        ...repairRecords.map(r => [
                            format(new Date(r.record_date), 'dd.MM.yyyy', { locale: tr }),
                            getShiftLabel(r.shift),
                            'Tamir',
                            '-',
                            `${r.source_line?.name || 'N/A'} → ${r.repair_line?.name || 'N/A'}`,
                            r.operator ? `${r.operator.registration_number} - ${r.operator.first_name} ${r.operator.last_name}` : 'N/A',
                            (r.quantity || 0).toString(),
                            (r.duration_seconds || 0).toString(),
                            formatCurrency(r.repair_cost || 0),
                            r.description ? (r.description.length > 30 ? r.description.substring(0, 30) + '...' : r.description) : '-'
                        ])
                    ]
                },
                signatureFields: [
                    { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
                    { title: 'Kontrol Eden', name: '', role: '..................' },
                    { title: 'Onaylayan', name: '', role: '..................' }
                ]
            };

            // En çok manuele gönderen hatlar (adet)
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['EN ÇOK MANUELE GÖNDEREN HATLAR (ADET)', '', '', '', '', '', '', '', '', ''],
                ['Sıra', 'Hat Adı', 'Adet', 'Maliyet', 'Kayıt Sayısı', 'Ortalama Süre (sn)', '', '', '', ''],
                ...topManualLines.map((line, index) => [
                    (index + 1).toString(),
                    line.name,
                    line.quantity.toLocaleString('tr-TR'),
                    formatCurrency(line.cost),
                    line.records.toString(),
                    Math.round(line.duration / Math.max(1, line.records)).toString(),
                    '', '', '', ''
                ])
            );

            // En çok manuele gönderen hatlar (maliyet)
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['EN ÇOK MANUELE GÖNDEREN HATLAR (MALİYET)', '', '', '', '', '', '', '', '', ''],
                ['Sıra', 'Hat Adı', 'Maliyet', 'Adet', 'Kayıt Sayısı', 'Ortalama Süre (sn)', '', '', '', ''],
                ...topManualLinesByCost.map((line, index) => [
                    (index + 1).toString(),
                    line.name,
                    formatCurrency(line.cost),
                    line.quantity.toLocaleString('tr-TR'),
                    line.records.toString(),
                    Math.round(line.duration / Math.max(1, line.records)).toString(),
                    '', '', '', ''
                ])
            );

            // En çok tamire gönderen hatlar (adet)
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['EN ÇOK TAMİRE GÖNDEREN HATLAR (ADET)', '', '', '', '', '', '', '', '', ''],
                ['Sıra', 'Kaynak Hat', 'Adet', 'Maliyet', 'Kayıt Sayısı', 'Ortalama Süre (sn)', '', '', '', ''],
                ...topRepairSourceLines.map((line, index) => [
                    (index + 1).toString(),
                    line.name,
                    line.quantity.toLocaleString('tr-TR'),
                    formatCurrency(line.cost),
                    line.records.toString(),
                    Math.round(line.duration / Math.max(1, line.records)).toString(),
                    '', '', '', ''
                ])
            );

            // En çok tamire gönderen hatlar (maliyet)
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['EN ÇOK TAMİRE GÖNDEREN HATLAR (MALİYET)', '', '', '', '', '', '', '', '', ''],
                ['Sıra', 'Kaynak Hat', 'Maliyet', 'Adet', 'Kayıt Sayısı', 'Ortalama Süre (sn)', '', '', '', ''],
                ...topRepairSourceLinesByCost.map((line, index) => [
                    (index + 1).toString(),
                    line.name,
                    formatCurrency(line.cost),
                    line.quantity.toLocaleString('tr-TR'),
                    line.records.toString(),
                    Math.round(line.duration / Math.max(1, line.records)).toString(),
                    '', '', '', ''
                ])
            );

            // Top 10 Personel
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['TOP 10 PERSONEL (EN YÜKSEK ÜRETİM)', '', '', '', '', '', '', '', '', ''],
                ['Sıra', 'Personel', 'Toplam Adet', 'Manuel Adet', 'Tamir Adet', 'Toplam Maliyet', 'Kayıt Sayısı', 'Toplam Süre (sn)', '', ''],
                ...top10Employees.map((emp, index) => [
                    (index + 1).toString(),
                    emp.name,
                    emp.quantity.toLocaleString('tr-TR'),
                    emp.manualQuantity.toLocaleString('tr-TR'),
                    emp.repairQuantity.toLocaleString('tr-TR'),
                    formatCurrency(emp.cost),
                    emp.records.toString(),
                    emp.duration.toString(),
                    '', ''
                ])
            );

            // Bottom 10 Personel
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['BOTTOM 10 PERSONEL (EN DÜŞÜK ÜRETİM)', '', '', '', '', '', '', '', '', ''],
                ['Sıra', 'Personel', 'Toplam Adet', 'Manuel Adet', 'Tamir Adet', 'Toplam Maliyet', 'Kayıt Sayısı', 'Toplam Süre (sn)', '', ''],
                ...bottom10Employees.map((emp, index) => [
                    (index + 1).toString(),
                    emp.name,
                    emp.quantity.toLocaleString('tr-TR'),
                    emp.manualQuantity.toLocaleString('tr-TR'),
                    emp.repairQuantity.toLocaleString('tr-TR'),
                    formatCurrency(emp.cost),
                    emp.records.toString(),
                    emp.duration.toString(),
                    '', ''
                ])
            );

            // Personel bazlı parça detayları
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['PERSONEL BAZLI PARÇA ADETLERİ', '', '', '', '', '', '', '', '', ''],
                ['Personel', 'Parça Kodu', 'Adet', '', '', '', '', '', '', '']
            );
            top10Employees.forEach(emp => {
                const partEntries = Object.entries(emp.parts).sort((a, b) => b[1] - a[1]);
                partEntries.forEach(([partCode, qty]) => {
                    reportData.tableData.rows.push([
                        emp.name,
                        partCode,
                        qty.toLocaleString('tr-TR'),
                        '', '', '', '', '', '', ''
                    ]);
                });
            });

            // Vardiya bazlı analiz
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['VARDIYA BAZLI ANALİZ', '', '', '', '', '', '', '', '', ''],
                ['Vardiya', 'Tip', 'Adet', 'Maliyet', 'Kayıt Sayısı', '', '', '', '', '']
            );
            Object.entries(shiftStats).forEach(([shift, data]) => {
                reportData.tableData.rows.push([
                    getShiftLabel(shift),
                    'Manuel Üretim',
                    data.manual.quantity.toLocaleString('tr-TR'),
                    formatCurrency(data.manual.cost),
                    data.manual.records.toString(),
                    '', '', '', '', ''
                ]);
                reportData.tableData.rows.push([
                    getShiftLabel(shift),
                    'Tamir',
                    data.repair.quantity.toLocaleString('tr-TR'),
                    formatCurrency(data.repair.cost),
                    data.repair.records.toString(),
                    '', '', '', '', ''
                ]);
            });

            // Parça bazlı analiz
            const topParts = Object.entries(partStats)
                .map(([code, data]) => ({ code, ...data, employeeCount: data.employees.size }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 20);

            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '===', '===', '===', '==='],
                ['PARÇA BAZLI ANALİZ (TOP 20)', '', '', '', '', '', '', '', '', ''],
                ['Parça Kodu', 'Toplam Adet', 'Toplam Maliyet', 'Kayıt Sayısı', 'Çalışan Personel Sayısı', '', '', '', '', '']
            );
            topParts.forEach(part => {
                reportData.tableData.rows.push([
                    part.code,
                    part.quantity.toLocaleString('tr-TR'),
                    formatCurrency(part.cost),
                    part.records.toString(),
                    part.employeeCount.toString(),
                    '', '', '', '', ''
                ]);
            });

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

    // Detaylı Analiz Raporu fonksiyonu
    const handleGenerateDetailedAnalysisReport = async () => {
        try {
            toast({ title: "Detaylı analiz raporu hazırlanıyor...", description: "Tüm veriler ve grafikler toplanıyor, lütfen bekleyin." });

            const from = analysisFilters.dateRange?.from ? format(analysisFilters.dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd');
            const to = analysisFilters.dateRange?.to ? format(analysisFilters.dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd');

            // Mevcut analysisData ve employeeAnalysisData'yı kullan
            const manualRecords = analysisData.manual || [];
            const repairRecords = analysisData.repair || [];

            const totalManualQuantity = manualRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalRepairQuantity = repairRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalDuration = manualRecords.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) + repairRecords.reduce((sum, r) => sum + (r.duration_seconds || 0), 0);

            // Maliyet hesaplaması - calculateCost fonksiyonu ile
            const totalManualCost = manualRecords.reduce((sum, r) => {
                const lineId = r.line_id;
                return sum + calculateCost(r.quantity || 0, lineId, r.duration_seconds || 0);
            }, 0);
            const totalRepairCost = repairRecords.reduce((sum, r) => {
                const lineId = r.repair_line_id;
                return sum + calculateCost(r.quantity || 0, lineId, r.duration_seconds || 0);
            }, 0);

            // Benzersiz personel sayısı (bilinmeyen hariç)
            const uniqueEmployees = new Set([...manualRecords, ...repairRecords].map(r => r.operator_id).filter(id => id && id !== 'unknown'));
            const totalEmployees = uniqueEmployees.size;

            // Gün sayısı hesaplama
            const daysDiff = Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1;
            const avgDailyManual = Math.round(totalManualQuantity / Math.max(1, daysDiff));
            const avgDailyRepair = Math.round(totalRepairQuantity / Math.max(1, daysDiff));

            // Aylık maliyet ve üretim özeti
            const monthlyStats = {};
            [...manualRecords, ...repairRecords].forEach(r => {
                const month = format(new Date(r.record_date), 'yyyy-MM');
                const monthName = format(new Date(r.record_date), 'MMMM yyyy', { locale: tr });
                if (!monthlyStats[month]) {
                    monthlyStats[month] = {
                        monthName,
                        manualQuantity: 0,
                        manualCost: 0,
                        repairQuantity: 0,
                        repairCost: 0,
                        employees: new Set()
                    };
                }
                if (r.line_id) {
                    monthlyStats[month].manualQuantity += r.quantity || 0;
                    monthlyStats[month].manualCost += calculateCost(r.quantity || 0, r.line_id, r.duration_seconds || 0);
                } else if (r.repair_line_id) {
                    monthlyStats[month].repairQuantity += r.quantity || 0;
                    monthlyStats[month].repairCost += calculateCost(r.quantity || 0, r.repair_line_id, r.duration_seconds || 0);
                }
                if (r.operator_id && r.operator_id !== 'unknown') {
                    monthlyStats[month].employees.add(r.operator_id);
                }
            });

            // Hat bazlı analiz - Manuel (lines array'inden hat adını bul)
            const manualByLine = manualRecords.reduce((acc, r) => {
                const lineId = r.line_id;
                const foundLine = lines.find(l => l.id === lineId);
                const lineName = foundLine?.name || 'Manuel Hat';
                if (!acc[lineName]) {
                    acc[lineName] = { quantity: 0, cost: 0, records: 0, duration: 0 };
                }
                acc[lineName].quantity += r.quantity || 0;
                acc[lineName].cost += calculateCost(r.quantity || 0, lineId, r.duration_seconds || 0);
                acc[lineName].records++;
                acc[lineName].duration += r.duration_seconds || 0;
                return acc;
            }, {});

            // Top 10 Manuel Hat (adet)
            const topManualLines = Object.entries(manualByLine)
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 10);

            // Tarih formatları - profesyonel görünüm için
            const fromDateFormatted = format(analysisFilters.dateRange?.from || startOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr });
            const toDateFormatted = format(analysisFilters.dateRange?.to || endOfMonth(new Date()), 'dd.MM.yyyy', { locale: tr });
            const reportDateFormatted = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr });

            const reportId = `RPR-ANALIZ-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
            const reportData = {
                title: 'Manuel Veri Takibi - Detaylı Analiz Raporu',
                reportId,
                filters: {
                    'Rapor Tarihi': reportDateFormatted,
                    'Rapor Dönemi': `${fromDateFormatted} - ${toDateFormatted}`,
                    'Seçili Vardiya': analysisFilters.shift !== 'all' ? getShiftLabel(analysisFilters.shift) : 'Tümü',
                    'Toplam Gün': daysDiff + ' gün'
                },
                kpiCards: [
                    { title: 'Toplam Manuel Üretim', value: totalManualQuantity.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Toplam Manuel Maliyet', value: formatCurrency(totalManualCost) },
                    { title: 'Toplam Tamir Adedi', value: totalRepairQuantity.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Toplam Tamir Maliyeti', value: formatCurrency(totalRepairCost) },
                    { title: 'Toplam Maliyet', value: formatCurrency(totalManualCost + totalRepairCost) },
                    { title: 'Toplam Süre', value: `${Math.floor(totalDuration / 3600)} saat ${Math.floor((totalDuration % 3600) / 60)} dakika` },
                    { title: 'Toplam Kayıt', value: (manualRecords.length + repairRecords.length).toString() },
                    { title: 'Ortalama Günlük Manuel', value: avgDailyManual.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Ortalama Günlük Tamir', value: avgDailyRepair.toLocaleString('tr-TR') + ' adet' },
                    { title: 'Toplam Personel Sayısı', value: totalEmployees.toString() }
                ],
                tableData: {
                    headers: ['Ay', 'Manuel Adet', 'Manuel Maliyet', 'Tamir Adet', 'Tamir Maliyet', 'Toplam Maliyet', 'Personel Sayısı'],
                    rows: Object.entries(monthlyStats)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([, data]) => [
                            data.monthName,
                            data.manualQuantity.toLocaleString('tr-TR'),
                            formatCurrency(data.manualCost),
                            data.repairQuantity.toLocaleString('tr-TR'),
                            formatCurrency(data.repairCost),
                            formatCurrency(data.manualCost + data.repairCost),
                            data.employees.size.toString()
                        ])
                },
                signatureFields: [
                    { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
                    { title: 'Kontrol Eden', name: '', role: '..................' },
                    { title: 'Onaylayan', name: '', role: '..................' }
                ]
            };

            // Rapor için seçili dönem personel analizi hesapla (bilinmeyen hariç)
            const reportEmployeeStats = {};
            [...manualRecords, ...repairRecords].forEach(record => {
                const empId = record.operator_id || 'unknown';
                if (empId === 'unknown') return; // Bilinmeyen personelleri hariç tut

                const emp = employees.find(e => e.id === empId);
                const empName = emp ? `${emp.registration_number} - ${emp.first_name} ${emp.last_name}` : 'Bilinmeyen';

                // Eğer personel bulunamadıysa (Bilinmeyen) atla
                if (empName === 'Bilinmeyen' || empName.includes('Bilinmeyen')) return;

                if (!reportEmployeeStats[empId]) {
                    reportEmployeeStats[empId] = {
                        id: empId,
                        name: empName,
                        quantity: 0,
                        records: 0,
                        manualQuantity: 0,
                        repairQuantity: 0,
                        cost: 0
                    };
                }

                reportEmployeeStats[empId].quantity += record.quantity || 0;
                reportEmployeeStats[empId].records += 1;

                const isManual = !!record.line_id;
                if (isManual) {
                    reportEmployeeStats[empId].manualQuantity += record.quantity || 0;
                    reportEmployeeStats[empId].cost += calculateCost(record.quantity || 0, record.line_id, record.duration_seconds || 0);
                } else {
                    reportEmployeeStats[empId].repairQuantity += record.quantity || 0;
                    reportEmployeeStats[empId].cost += calculateCost(record.quantity || 0, record.repair_line_id, record.duration_seconds || 0);
                }
            });

            const reportEmployeeArray = Object.values(reportEmployeeStats).filter(e =>
                e.id !== 'unknown' &&
                e.name !== 'Bilinmeyen' &&
                !e.name.includes('Bilinmeyen')
            );
            const reportTop10 = [...reportEmployeeArray].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
            const reportBottom10 = [...reportEmployeeArray].sort((a, b) => a.quantity - b.quantity).slice(0, 10);

            // Top 10 Personel (bilinmeyen hariç)
            if (reportTop10.length > 0) {
                reportData.tableData.rows.push(
                    ['===', '===', '===', '===', '===', '===', '==='],
                    ['TOP 10 PERSONEL (EN YÜKSEK ÜRETİM)', '', '', '', '', '', ''],
                    ['Sıra', 'Personel', 'Toplam Adet', 'Manuel', 'Tamir', 'Maliyet', 'Kayıt'],
                    ...reportTop10.map((emp, index) => [
                        (index + 1).toString(),
                        emp.name,
                        emp.quantity.toLocaleString('tr-TR'),
                        emp.manualQuantity.toLocaleString('tr-TR'),
                        emp.repairQuantity.toLocaleString('tr-TR'),
                        formatCurrency(emp.cost),
                        emp.records.toString()
                    ])
                );
            }

            // Bottom 10 Personel (bilinmeyen hariç)
            if (reportBottom10.length > 0) {
                reportData.tableData.rows.push(
                    ['===', '===', '===', '===', '===', '===', '==='],
                    ['BOTTOM 10 PERSONEL (EN DÜŞÜK ÜRETİM)', '', '', '', '', '', ''],
                    ['Sıra', 'Personel', 'Toplam Adet', 'Manuel', 'Tamir', 'Maliyet', 'Kayıt'],
                    ...reportBottom10.map((emp, index) => [
                        (index + 1).toString(),
                        emp.name,
                        emp.quantity.toLocaleString('tr-TR'),
                        emp.manualQuantity.toLocaleString('tr-TR'),
                        emp.repairQuantity.toLocaleString('tr-TR'),
                        formatCurrency(emp.cost),
                        emp.records.toString()
                    ])
                );
            }

            // En çok manuele gönderen hatlar
            reportData.tableData.rows.push(
                ['===', '===', '===', '===', '===', '===', '==='],
                ['EN ÇOK MANUELE GÖNDEREN HATLAR (TOP 10)', '', '', '', '', '', ''],
                ['Sıra', 'Hat Adı', 'Adet', 'Maliyet', 'Kayıt Sayısı', 'Ort. Süre (sn)', ''],
                ...topManualLines.map((line, index) => [
                    (index + 1).toString(),
                    line.name,
                    line.quantity.toLocaleString('tr-TR'),
                    formatCurrency(line.cost),
                    line.records.toString(),
                    Math.round(line.duration / Math.max(1, line.records)).toString(),
                    ''
                ])
            );

            // BH Kodu ile başlayan parçalar
            if (bhTop10Parts.length > 0) {
                reportData.tableData.rows.push(
                    ['===', '===', '===', '===', '===', '===', '==='],
                    ['BH KODU İLE BAŞLAYAN TOP 20 PARÇA', '', '', '', '', '', ''],
                    ['Sıra', 'Parça Kodu', 'Adet', 'Kayıt Sayısı', 'Personel Sayısı', '', ''],
                    ...bhTop10Parts.map((part, index) => [
                        (index + 1).toString(),
                        part.code,
                        part.quantity.toLocaleString('tr-TR'),
                        part.records.toString(),
                        part.employeeCount.toString(),
                        '',
                        ''
                    ])
                );
            }

            // Yıllık Grafik Verileri Hazırlama
            const yearlyStats = {};
            [...manualRecords, ...repairRecords].forEach(r => {
                const year = format(new Date(r.record_date), 'yyyy');
                if (!yearlyStats[year]) {
                    yearlyStats[year] = {
                        year,
                        manualQuantity: 0,
                        manualCost: 0,
                        repairQuantity: 0,
                        repairCost: 0
                    };
                }
                if (r.line_id) {
                    yearlyStats[year].manualQuantity += r.quantity || 0;
                    yearlyStats[year].manualCost += calculateCost(r.quantity || 0, r.line_id, r.duration_seconds || 0);
                } else if (r.repair_line_id) {
                    yearlyStats[year].repairQuantity += r.quantity || 0;
                    yearlyStats[year].repairCost += calculateCost(r.quantity || 0, r.repair_line_id, r.duration_seconds || 0);
                }
            });

            const yearlyChartData = Object.values(yearlyStats).sort((a, b) => a.year.localeCompare(b.year));

            // Aylık Grafik Verileri (Mevcut monthlyStats kullanılarak)
            const monthlyChartData = Object.entries(monthlyStats)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, data]) => ({
                    name: format(new Date(date), 'MMM yyyy', { locale: tr }), // Örn: Oca 2025
                    Maliyet: Math.round(data.manualCost + data.repairCost),
                    originalDate: date
                }));

            // Grafik Veri Setleri
            const productionBarData = yearlyChartData.map(d => ({
                name: d.year,
                Manuel: d.manualQuantity,
                Tamir: d.repairQuantity
            }));

            // const costLineData = yearlyChartData.map(d => ({
            //     name: d.year,
            //     Maliyet: Math.round(d.manualCost + d.repairCost)
            // }));

            const distributionPieData = [
                { name: 'Manuel Üretim', value: totalManualQuantity },
                { name: 'Tamir İşlemi', value: totalRepairQuantity }
            ];

            // Rapor bölümlerine grafikleri ekle
            if (!reportData.sections) reportData.sections = [];

            // 1. Yıllık Üretim Karşılaştırması (Bar Chart)
            if (productionBarData.length > 0) {
                reportData.sections.push({
                    type: 'chart',
                    title: 'Yıllık Üretim Karşılaştırması (Manuel vs Tamir)',
                    chartType: 'bar',
                    data: productionBarData,
                    config: {
                        bars: [
                            { key: 'Manuel', name: 'Manuel Üretim', color: '#3B82F6' },
                            { key: 'Tamir', name: 'Tamir İşlemi', color: '#EF4444' }
                        ]
                    }
                });
            }

            // 2. Aylık Maliyet Trendi (Line Chart)
            if (monthlyChartData.length > 0) {
                reportData.sections.push({
                    type: 'chart',
                    title: 'Aylık Toplam Maliyet Trendi',
                    chartType: 'line',
                    data: monthlyChartData,
                    config: {
                        xAxisKey: 'name',
                        lines: [
                            { key: 'Maliyet', name: 'Toplam Maliyet (TL)', color: '#10B981' }
                        ]
                    }
                });
            }

            // 3. Genel Dağılım (Pie Chart)
            if (totalManualQuantity > 0 || totalRepairQuantity > 0) {
                reportData.sections.push({
                    type: 'chart',
                    title: 'Genel Üretim Dağılımı',
                    chartType: 'pie',
                    data: distributionPieData,
                    config: {
                        dataKey: 'value',
                        nameKey: 'name',
                        colors: ['#3B82F6', '#EF4444']
                    }
                });
            }

            await openPrintWindow(reportData, toast);
            toast({ title: "Rapor Hazır", description: "Detaylı analiz raporu başarıyla oluşturuldu." });
        } catch (error) {
            console.error('Detaylı analiz raporu hatası:', error);
            toast({
                title: "Rapor Oluşturulamadı",
                description: error.message || "Rapor oluşturulurken bir hata oluştu.",
                variant: "destructive"
            });
        }
    };

    const handleEditSave = async (updatedRecord) => {
        const { recordType, ...dataToSave } = updatedRecord;
        const tableName = recordType === 'manual' ? 'manual_production_records' : 'repair_records';

        delete dataToSave.operator_name;
        delete dataToSave.line_name;
        delete dataToSave.source_line_name;
        delete dataToSave.repair_line_name;
        delete dataToSave.total_cost;
        // duration_seconds alanını koruyoruz - düzenlenebilir olmalı
        // duration_seconds değerini sayıya dönüştür (null/undefined ise 0)
        if (dataToSave.duration_seconds !== undefined && dataToSave.duration_seconds !== null) {
            dataToSave.duration_seconds = Number(dataToSave.duration_seconds) || 0;
        } else {
            dataToSave.duration_seconds = 0;
        }

        // updated_at alanını güncelle
        dataToSave.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from(tableName)
            .update(dataToSave)
            .eq('id', dataToSave.id);

        if (error) {
            toast({ title: "Güncelleme Başarısız", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Başarılı", description: "Kayıt güncellendi." });
            logAction('UPDATE_MANUAL_RECORD', `Kayıt ${dataToSave.id} güncellendi.`, user);
            setEditingRecord(null);

            // viewingDetails açıksa ve düzenlenen kayıt o tarihe aitse, viewingDetails'i güncelle
            if (viewingDetails && viewingDetails.date === dataToSave.record_date) {
                // operator_name ve line_name'leri ekle
                const employee = employees.find(emp => emp.id === dataToSave.operator_id);
                const operator_name = employee ? `${employee.first_name} ${employee.last_name}` : 'N/A';

                if (recordType === 'manual') {
                    const line = lines.find(l => l.id === dataToSave.line_id);
                    const line_name = line ? line.name : 'N/A';
                    const updatedRecordWithNames = {
                        ...dataToSave,
                        operator_name,
                        line_name
                    };
                    setViewingDetails({
                        ...viewingDetails,
                        manuals: viewingDetails.manuals.map(rec =>
                            rec.id === dataToSave.id ? updatedRecordWithNames : rec
                        )
                    });
                } else {
                    const repairLine = lines.find(l => l.id === dataToSave.repair_line_id);
                    const sourceLine = lines.find(l => l.id === dataToSave.source_line_id);
                    const repair_line_name = repairLine ? repairLine.name : 'N/A';
                    const source_line_name = sourceLine ? sourceLine.name : 'N/A';
                    const updatedRecordWithNames = {
                        ...dataToSave,
                        operator_name,
                        repair_line_name,
                        source_line_name
                    };
                    setViewingDetails({
                        ...viewingDetails,
                        repairs: viewingDetails.repairs.map(rec =>
                            rec.id === dataToSave.id ? updatedRecordWithNames : rec
                        )
                    });
                }
            }

            // State'leri güncelle - operator_name ve line_name'leri ekle
            const employee = employees.find(emp => emp.id === dataToSave.operator_id);
            const operator_name = employee ? `${employee.first_name} ${employee.last_name}` : 'N/A';

            if (recordType === 'manual') {
                const line = lines.find(l => l.id === dataToSave.line_id);
                const line_name = line ? line.name : 'N/A';
                const updatedRecordWithNames = {
                    ...dataToSave,
                    operator_name,
                    line_name
                };
                setManualRecords(prev => prev.map(rec =>
                    rec.id === dataToSave.id ? updatedRecordWithNames : rec
                ));
            } else {
                const repairLine = lines.find(l => l.id === dataToSave.repair_line_id);
                const sourceLine = lines.find(l => l.id === dataToSave.source_line_id);
                const repair_line_name = repairLine ? repairLine.name : 'N/A';
                const source_line_name = sourceLine ? sourceLine.name : 'N/A';
                const updatedRecordWithNames = {
                    ...dataToSave,
                    operator_name,
                    repair_line_name,
                    source_line_name
                };
                setRepairRecords(prev => prev.map(rec =>
                    rec.id === dataToSave.id ? updatedRecordWithNames : rec
                ));
            }

            fetchData();
        }
    };


    const handleDelete = async () => {
        if (!deleteConfirm) return;

        const { error: manualError } = await supabase.from('manual_production_records').delete().eq('record_date', deleteConfirm.date);
        const { error: repairError } = await supabase.from('repair_records').delete().eq('record_date', deleteConfirm.date);

        if (manualError || repairError) {
            toast({ title: "Silme Başarısız", description: manualError?.message || repairError?.message, variant: "destructive" });
        } else {
            toast({ title: "Silindi", description: `${format(new Date(deleteConfirm.date), 'dd.MM.yyyy')} tarihli kayıtlar başarıyla silindi.`, variant: "destructive" });
            logAction('DELETE_DAILY_MANUAL_RECORDS', `${deleteConfirm.date} tarihli tüm manuel/tamir kayıtları silindi.`, user);
        }
        setDeleteConfirm(null);
        fetchData();
    };

    // Maliyet hesaplama fonksiyonu (süre bazlı)
    const calculateCost = useCallback((quantity, lineId, durationSeconds = 0) => {
        const line = lines.find(l => l.id === lineId);

        if (!line || !line.costs) {
            // Hat bulunamadı veya maliyet tanımlanmamış - Ana Veri'den tanımlanması gerekiyor
            return 0;
        }

        const costData = line.costs;

        // Eğer süre varsa ve totalCostPerSecond varsa, süre bazlı hesapla
        if (durationSeconds > 0 && costData.totalCostPerSecond) {
            const cost = quantity * durationSeconds * costData.totalCostPerSecond;
            return cost;
        }

        // Maliyet bilgisi tanımlanmamış - kullanıcı Ana Veri modülünden tanımlamalı
        return 0;
    }, [lines]);

    // Aylık toplam kaydetme
    const handleSaveMonthlyTotal = async () => {
        try {
            const { year, month, total_production } = monthlyFormData;
            const year_month = `${year}-${month}`;

            if (!total_production) {
                toast({ title: "Hata", description: "Lütfen aylık toplam üretim adedini girin", variant: "destructive" });
                return;
            }

            // Bu ay için manuel ve tamir kayıtlarını hesapla (TÜM kayıtlardan)
            const monthRecords = allManualRecords.filter(r => r.record_date && r.record_date.startsWith(year_month));
            const monthRepairs = allRepairRecords.filter(r => r.record_date && r.record_date.startsWith(year_month));

            const totalManual = monthRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalRepair = monthRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);

            // Mevcut kaydı kontrol et
            const { data: existing } = await supabase
                .from('monthly_production_totals')
                .select('*')
                .eq('year_month', year_month)
                .single();

            let result;
            if (existing) {
                // Güncelle
                result = await supabase
                    .from('monthly_production_totals')
                    .update({
                        total_production: Number(total_production),
                        total_manual: totalManual,
                        total_repair: totalRepair,
                        updated_at: new Date().toISOString()
                    })
                    .eq('year_month', year_month);
            } else {
                // Yeni kayıt
                result = await supabase
                    .from('monthly_production_totals')
                    .insert({
                        year_month,
                        total_production: Number(total_production),
                        total_manual: totalManual,
                        total_repair: totalRepair
                    });
            }

            if (result.error) throw result.error;

            toast({ title: "Başarılı", description: `${year_month}: ${total_production} adet üretim kaydedildi` });
            logAction('SAVE_MONTHLY_TOTAL', `${year_month}: Üretim ${total_production}`, user);
            setShowMonthlyDialog(false);
            fetchData();
        } catch (error) {
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        }
    };

    // Günlük toplam kaydetme
    const handleSaveDailyTotal = async () => {
        try {
            const { date, total_production } = dailyFormData;

            if (!date || !total_production) {
                toast({ title: "Hata", description: "Lütfen tüm alanları doldurun", variant: "destructive" });
                return;
            }

            // Bu gün için manuel ve tamir kayıtlarını hesapla
            const dayManuals = manualRecords.filter(r => r.record_date === date);
            const dayRepairs = repairRecords.filter(r => r.record_date === date);

            const totalManual = dayManuals.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalRepair = dayRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);

            // Mevcut kaydı kontrol et
            const { data: existing } = await supabase
                .from('daily_production_totals')
                .select('*')
                .eq('date', date)
                .single();

            let result;
            if (existing) {
                // Güncelle
                result = await supabase
                    .from('daily_production_totals')
                    .update({
                        total_production: Number(total_production),
                        total_manual: totalManual,
                        total_repair: totalRepair,
                        updated_at: new Date().toISOString()
                    })
                    .eq('date', date);
            } else {
                // Yeni kayıt
                result = await supabase
                    .from('daily_production_totals')
                    .insert({
                        date,
                        total_production: Number(total_production),
                        total_manual: totalManual,
                        total_repair: totalRepair
                    });
            }

            if (result.error) throw result.error;

            toast({ title: "Başarılı", description: `${format(new Date(date), 'dd.MM.yyyy')}: ${total_production} adet üretim kaydedildi` });
            logAction('SAVE_DAILY_TOTAL', `${date}: Üretim ${total_production}`, user);
            setShowDailyDialog(false);
            fetchData();
        } catch (error) {
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        }
    };

    // Analiz sekmesi için filtrelenmiş veriler
    const analysisData = useMemo(() => {
        // Tarih aralığını güvenli bir şekilde al - UTC kullanarak saat dilimi sorunlarını önle
        let from = '2000-01-01';
        let to = format(new Date(), 'yyyy-MM-dd');

        if (analysisFilters.dateRange?.from) {
            const fromDate = new Date(analysisFilters.dateRange.from);
            if (!isNaN(fromDate.getTime())) {
                // Yerel tarihi YYYY-MM-DD formatına dönüştür (saat dilimi etkisi olmadan)
                const year = fromDate.getFullYear();
                const month = String(fromDate.getMonth() + 1).padStart(2, '0');
                const day = String(fromDate.getDate()).padStart(2, '0');
                from = `${year}-${month}-${day}`;
            }
        }
        if (analysisFilters.dateRange?.to) {
            const toDate = new Date(analysisFilters.dateRange.to);
            if (!isNaN(toDate.getTime())) {
                // Yerel tarihi YYYY-MM-DD formatına dönüştür (saat dilimi etkisi olmadan)
                const year = toDate.getFullYear();
                const month = String(toDate.getMonth() + 1).padStart(2, '0');
                const day = String(toDate.getDate()).padStart(2, '0');
                to = `${year}-${month}-${day}`;
            }
        }

        // Debug log - production'da kaldırılacak
        console.log('Analiz Filtre Debug:', { from, to, allManualRecordsCount: allManualRecords.length, sampleDate: allManualRecords[0]?.record_date });


        // Vardiya otomatik hesaplama fonksiyonu (saat bazlı)
        const getShiftFromTime = (recordDatetime) => {
            if (!recordDatetime) return null;
            try {
                const date = new Date(recordDatetime);
                // Geçerli bir tarih mi kontrol et
                if (isNaN(date.getTime())) return null;

                const hour = date.getHours();

                // 1. Vardiya: 08:00-16:00
                if (hour >= 8 && hour < 16) return 1;
                // 2. Vardiya: 16:00-24:00 (gece yarısına kadar)
                if (hour >= 16 && hour < 24) return 2;
                // 3. Vardiya: 00:00-08:00
                if (hour >= 0 && hour < 8) return 3;

                return null;
            } catch (e) {
                console.error('Vardiya hesaplama hatası:', e, recordDatetime);
                return null;
            }
        };

        // Önce tüm kayıtları map'le ve calculatedShift ekle
        const allManualWithShift = allManualRecords
            .filter(r => {
                if (!r.record_date) return false;
                const recordDate = String(r.record_date).substring(0, 10); // YYYY-MM-DD formatına dönüştür
                return recordDate >= from && recordDate <= to;
            })
            .map(r => {
                // Shift değerini number'a dönüştür
                let shiftValue = null;
                if (r.shift !== null && r.shift !== undefined) {
                    shiftValue = typeof r.shift === 'string' ? parseInt(r.shift, 10) : Number(r.shift);
                    // Geçerli bir vardiya numarası mı kontrol et (1, 2, veya 3)
                    if (isNaN(shiftValue) || shiftValue < 1 || shiftValue > 3) {
                        shiftValue = null;
                    }
                }
                return {
                    ...r,
                    calculatedShift: shiftValue || getShiftFromTime(r.created_at)
                };
            });

        const allRepairWithShift = allRepairRecords
            .filter(r => {
                if (!r.record_date) return false;
                const recordDate = String(r.record_date).substring(0, 10); // YYYY-MM-DD formatına dönüştür
                return recordDate >= from && recordDate <= to;
            })
            .map(r => {
                // Shift değerini number'a dönüştür
                let shiftValue = null;
                if (r.shift !== null && r.shift !== undefined) {
                    shiftValue = typeof r.shift === 'string' ? parseInt(r.shift, 10) : Number(r.shift);
                    // Geçerli bir vardiya numarası mı kontrol et (1, 2, veya 3)
                    if (isNaN(shiftValue) || shiftValue < 1 || shiftValue > 3) {
                        shiftValue = null;
                    }
                }
                return {
                    ...r,
                    calculatedShift: shiftValue || getShiftFromTime(r.created_at)
                };
            });

        // Sonra filtreleri uygula
        let filteredManual = allManualWithShift;
        let filteredRepair = allRepairWithShift;

        if (analysisFilters.shift !== 'all') {
            const shiftNum = parseInt(analysisFilters.shift);
            filteredManual = filteredManual.filter(r => r.calculatedShift === shiftNum);
            filteredRepair = filteredRepair.filter(r => r.calculatedShift === shiftNum);
        }

        if (analysisFilters.employee !== 'all') {
            filteredManual = filteredManual.filter(r => r.operator_id === analysisFilters.employee);
            filteredRepair = filteredRepair.filter(r => r.operator_id === analysisFilters.employee);
        }


        return {
            manual: filteredManual,
            repair: filteredRepair,
            // Vardiya analizi için filtrelenmemiş veriler
            allManualWithShift,
            allRepairWithShift
        };
    }, [allManualRecords, allRepairRecords, analysisFilters]);

    const aggregatedRecords = useMemo(() => {
        const dailyData = {};

        manualRecords.forEach(rec => {
            const date = rec.record_date;
            // Süre bilgisini kullan (eğer yoksa 0)
            const durationSeconds = rec.duration_seconds || 0;
            const cost = calculateCost(rec.quantity, rec.line_id, durationSeconds);
            if (!dailyData[date]) {
                dailyData[date] = { manual_count: 0, manual_quantity: 0, manual_cost: 0, repair_count: 0, repair_quantity: 0, repair_cost: 0 };
            }
            dailyData[date].manual_count += 1;
            dailyData[date].manual_quantity += rec.quantity || 0;
            dailyData[date].manual_cost += cost;
        });

        repairRecords.forEach(rec => {
            const date = rec.record_date;
            // Süre bilgisini kullan (eğer yoksa 0)
            const durationSeconds = rec.duration_seconds || 0;
            const cost = calculateCost(rec.quantity, rec.repair_line_id, durationSeconds);
            if (!dailyData[date]) {
                dailyData[date] = { manual_count: 0, manual_quantity: 0, manual_cost: 0, repair_count: 0, repair_quantity: 0, repair_cost: 0 };
            }
            dailyData[date].repair_count += 1;
            dailyData[date].repair_quantity += rec.quantity || 0;
            dailyData[date].repair_cost += cost;
        });

        // Oranları hesapla
        return Object.entries(dailyData)
            .map(([date, data]) => {
                const yearMonth = date.substring(0, 7); // yyyy-MM
                const monthlyTotal = monthlyTotals[yearMonth];
                const dailyTotal = dailyTotals[date];

                // Manuel + tamir toplam (kayıtlardan)
                const recordTotal = data.manual_quantity + data.repair_quantity;

                // Oran hesaplama önceliği: 1) Günlük toplam, 2) Aylık toplam, 3) Kayıt toplamı
                let manualPercentage, repairPercentage;
                let ratioSource = 'none'; // none, daily, monthly, record

                if (dailyTotal && dailyTotal.total_production > 0) {
                    // Öncelik: Günlük toplam üretim adedi
                    manualPercentage = (data.manual_quantity / dailyTotal.total_production) * 100;
                    repairPercentage = (data.repair_quantity / dailyTotal.total_production) * 100;
                    ratioSource = 'daily';
                } else if (monthlyTotal && monthlyTotal.total_production > 0) {
                    // İkinci öncelik: Aylık toplam üretim adedi
                    manualPercentage = (data.manual_quantity / monthlyTotal.total_production) * 100;
                    repairPercentage = (data.repair_quantity / monthlyTotal.total_production) * 100;
                    ratioSource = 'monthly';
                } else if (recordTotal > 0) {
                    // Son seçenek: Kayıt toplamına göre
                    manualPercentage = (data.manual_quantity / recordTotal) * 100;
                    repairPercentage = (data.repair_quantity / recordTotal) * 100;
                    ratioSource = 'record';
                } else {
                    manualPercentage = 0;
                    repairPercentage = 0;
                }

                return {
                    date,
                    ...data,
                    manual_percentage: manualPercentage,
                    repair_percentage: repairPercentage,
                    monthly_total: monthlyTotal,
                    daily_total: dailyTotal,
                    ratio_source: ratioSource
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [manualRecords, repairRecords, calculateCost, monthlyTotals, dailyTotals]);

    const handleViewDetails = (date) => {
        const details = {
            date,
            manuals: manualRecords.filter(rec => rec.record_date === date),
            repairs: repairRecords.filter(rec => rec.record_date === date),
        };
        setViewingDetails(details);
    };

    // Parça kodu ile arama fonksiyonu - Tüm detayları içeren gelişmiş arama
    const handlePartCodeSearch = useCallback(() => {
        if (!partCodeSearch.trim()) {
            toast({ title: "Uyarı", description: "Lütfen bir parça kodu girin.", variant: "default" });
            return;
        }

        const searchTerm = partCodeSearch.trim().toUpperCase();

        // Manuel kayıtları bul
        const manualResults = [...allManualRecords]
            .filter(r => r.part_code && r.part_code.toUpperCase().includes(searchTerm))
            .map(r => {
                const line = lines.find(l => l.id === r.line_id);
                const operator = employees.find(e => e.id === r.operator_id);
                const durationSeconds = r.duration_seconds || 0;
                const cost = calculateCost(r.quantity, r.line_id, durationSeconds);
                return {
                    ...r,
                    recordType: 'manual',
                    line,
                    operator,
                    cost,
                    durationSeconds
                };
            });

        // Tamir kayıtlarını bul (parça kodu olmayabilir ama kontrol edelim)
        const repairResults = [...allRepairRecords]
            .filter(r => {
                // Tamir kayıtlarında part_code genelde yok ama description'da olabilir
                return (r.part_code && r.part_code.toUpperCase().includes(searchTerm)) ||
                    (r.description && r.description.toUpperCase().includes(searchTerm));
            })
            .map(r => {
                const repairLine = lines.find(l => l.id === r.repair_line_id);
                const sourceLine = lines.find(l => l.id === r.source_line_id);
                const operator = employees.find(e => e.id === r.operator_id);
                const durationSeconds = r.duration_seconds || 0;
                const cost = calculateCost(r.quantity, r.repair_line_id, durationSeconds);
                return {
                    ...r,
                    recordType: 'repair',
                    repairLine,
                    sourceLine,
                    operator,
                    cost,
                    durationSeconds
                };
            });

        const allResults = [...manualResults, ...repairResults]
            .sort((a, b) => new Date(b.record_date) - new Date(a.record_date));

        // İstatistikler hesapla
        const stats = {
            totalRecords: allResults.length,
            totalQuantity: allResults.reduce((sum, r) => sum + (r.quantity || 0), 0),
            totalCost: allResults.reduce((sum, r) => sum + (r.cost || 0), 0),
            manualCount: manualResults.length,
            repairCount: repairResults.length,
            uniqueDates: new Set(allResults.map(r => r.record_date)).size,
            uniqueOperators: new Set(allResults.map(r => r.operator_id).filter(Boolean)).size,
            uniqueLines: new Set([...manualResults.map(r => r.line_id), ...repairResults.map(r => r.repair_line_id)].filter(Boolean)).size
        };

        if (allResults.length > 0) {
            setPartCodeSearchResults({ results: allResults, stats });
            setShowPartCodeSearch(true);
        } else {
            setPartCodeSearchResults(null);
            toast({ title: "Sonuç Bulunamadı", description: "Arama kriterinize uygun kayıt bulunamadı.", variant: "default" });
        }
    }, [partCodeSearch, allManualRecords, allRepairRecords, lines, employees, calculateCost, toast]);

    // Aylık/yıllık personel analizi
    const employeeAnalysisData = useMemo(() => {
        const periodStart = employeeAnalysisPeriod === 'monthly'
            ? startOfMonth(analysisFilters.dateRange?.from || new Date())
            : startOfYear(analysisFilters.dateRange?.from || new Date());
        const periodEnd = employeeAnalysisPeriod === 'monthly'
            ? endOfMonth(analysisFilters.dateRange?.from || new Date())
            : endOfYear(analysisFilters.dateRange?.from || new Date());

        const from = format(periodStart, 'yyyy-MM-dd');
        const to = format(periodEnd, 'yyyy-MM-dd');

        const periodRecords = [...allManualRecords, ...allRepairRecords]
            .filter(r => r.record_date >= from && r.record_date <= to);

        const employeeStats = {};
        periodRecords.forEach(record => {
            const empId = record.operator_id || 'unknown';
            const emp = employees.find(e => e.id === empId);
            const empName = emp ? `${emp.registration_number} - ${emp.first_name} ${emp.last_name}` : 'Bilinmeyen';

            if (!employeeStats[empId]) {
                employeeStats[empId] = {
                    id: empId,
                    name: empName,
                    quantity: 0,
                    records: 0,
                    manualQuantity: 0,
                    repairQuantity: 0,
                    cost: 0
                };
            }

            employeeStats[empId].quantity += record.quantity || 0;
            employeeStats[empId].records += 1;

            if (allManualRecords.includes(record)) {
                employeeStats[empId].manualQuantity += record.quantity || 0;
            } else {
                employeeStats[empId].repairQuantity += record.quantity || 0;
            }

            // Maliyet hesapla
            const durationSeconds = record.duration_seconds || 0;
            const lineId = record.line_id || record.repair_line_id;
            if (lineId) {
                const cost = calculateCost(record.quantity, lineId, durationSeconds);
                employeeStats[empId].cost += cost;
            }
        });

        // Bilinmeyen personelleri (unknown ID veya Bilinmeyen ismi) hariç tut
        const employeeArray = Object.values(employeeStats).filter(e =>
            e.id !== 'unknown' && e.name !== 'Bilinmeyen' && !e.name.includes('Bilinmeyen')
        );
        const top10 = [...employeeArray].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        const bottom10 = [...employeeArray].sort((a, b) => a.quantity - b.quantity).slice(0, 10);

        return { top10, bottom10, period: employeeAnalysisPeriod };
    }, [employeeAnalysisPeriod, analysisFilters.dateRange, allManualRecords, allRepairRecords, employees, calculateCost]);

    // BH kodu ile başlayan top20 parça (BT ve YK hariç)
    const bhTop10Parts = useMemo(() => {
        const bhParts = allManualRecords
            .filter(r => {
                const partCode = (r.part_code || '').toUpperCase();
                return partCode.startsWith('BH') && !partCode.startsWith('BT') && !partCode.startsWith('YK');
            })
            .reduce((acc, r) => {
                const code = r.part_code || 'N/A';
                if (!acc[code]) {
                    acc[code] = {
                        code,
                        quantity: 0,
                        records: 0,
                        employees: new Set()
                    };
                }
                acc[code].quantity += r.quantity || 0;
                acc[code].records += 1;
                if (r.operator_id) acc[code].employees.add(r.operator_id);
                return acc;
            }, {});

        return Object.values(bhParts)
            .map(p => ({ ...p, employeeCount: p.employees.size }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 20);
    }, [allManualRecords]);


    // Aylık bazda tamir ve manuel maliyet grafik verisi
    const monthlyCostChartData = useMemo(() => {
        // Analiz filtresinden tarih aralığını al
        const from = analysisFilters.dateRange?.from ? format(analysisFilters.dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
        const to = analysisFilters.dateRange?.to ? format(analysisFilters.dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

        // Tüm kayıtlardan yılları bul (filtrelenmiş verilerden)
        const allYears = new Set();

        // Manuel kayıtlardan yılları çıkar (filtrelenmiş)
        allManualRecords.forEach(r => {
            if (r.record_date && r.record_date >= from && r.record_date <= to) {
                const year = r.record_date.substring(0, 4);
                if (year && year.length === 4) {
                    allYears.add(year);
                }
            }
        });

        // Tamir kayıtlarından yılları çıkar (filtrelenmiş)
        allRepairRecords.forEach(r => {
            if (r.record_date && r.record_date >= from && r.record_date <= to) {
                const year = r.record_date.substring(0, 4);
                if (year && year.length === 4) {
                    allYears.add(year);
                }
            }
        });

        // monthlyTotals'tan yılları çıkar (filtrelenmiş)
        Object.keys(monthlyTotals).forEach(yearMonth => {
            if (yearMonth && yearMonth.length >= 7) {
                const yearMonthDate = yearMonth + '-01';
                if (yearMonthDate >= from.substring(0, 7) + '-01' && yearMonthDate <= to.substring(0, 7) + '-31') {
                    allYears.add(yearMonth.substring(0, 4));
                }
            }
        });

        const yearsArray = Array.from(allYears).sort();
        const hasMultipleYears = yearsArray.length > 1;

        const months = [];

        // Her ay için tüm yılların verilerini birleştir
        for (let i = 0; i < 12; i++) {
            const monthIndex = i + 1; // Ay numarası (1-12)
            const monthName = format(new Date(2020, i, 1), 'MMM', { locale: tr });

            let manualCost = 0;
            let repairCost = 0;
            let manualQuantity = 0;
            let repairQuantity = 0;
            let totalProduction = 0;

            // Tüm yıllar için bu ayın verilerini topla
            yearsArray.forEach(year => {
                const yearMonth = `${year}-${String(monthIndex).padStart(2, '0')}`;

                // Manuel kayıtları filtrele - tüm kayıtları kontrol et (filtreleme yapmadan)
                const monthManuals = allManualRecords.filter(r => {
                    if (!r.record_date) return false;

                    // record_date formatını kontrol et ve ayı çıkar
                    let recordYearMonth = '';
                    if (r.record_date.length >= 7) {
                        // yyyy-MM-dd veya yyyy-MM formatında
                        recordYearMonth = r.record_date.substring(0, 7);
                    } else {
                        return false;
                    }

                    // Ay eşleşmesi kontrolü
                    return recordYearMonth === yearMonth;
                });

                // Tamir kayıtlarını filtrele
                const monthRepairs = allRepairRecords.filter(r => {
                    if (!r.record_date) return false;

                    // record_date formatını kontrol et ve ayı çıkar
                    let recordYearMonth = '';
                    if (r.record_date.length >= 7) {
                        // yyyy-MM-dd veya yyyy-MM formatında
                        recordYearMonth = r.record_date.substring(0, 7);
                    } else {
                        return false;
                    }

                    // Ay eşleşmesi kontrolü
                    return recordYearMonth === yearMonth;
                });

                // Maliyetleri hesapla
                manualCost += monthManuals.reduce((sum, r) => {
                    const durationSeconds = r.duration_seconds || 0;
                    return sum + calculateCost(r.quantity, r.line_id, durationSeconds);
                }, 0);

                repairCost += monthRepairs.reduce((sum, r) => {
                    const durationSeconds = r.duration_seconds || 0;
                    return sum + calculateCost(r.quantity, r.repair_line_id, durationSeconds);
                }, 0);

                // Miktarları hesapla
                manualQuantity += monthManuals.reduce((sum, r) => sum + (r.quantity || 0), 0);
                repairQuantity += monthRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);

                // Aylık toplam üretim
                const monthlyTotal = monthlyTotals[yearMonth];
                if (monthlyTotal?.total_production) {
                    totalProduction += monthlyTotal.total_production;
                }
            });

            months.push({
                month: monthName,
                yearMonth: `${yearsArray[0] || format(new Date(), 'yyyy')}-${String(monthIndex).padStart(2, '0')}`,
                year: hasMultipleYears ? `${yearsArray[0]}-${yearsArray[yearsArray.length - 1]}` : (yearsArray[0] || format(new Date(), 'yyyy')),
                manualCost,
                repairCost,
                manualQuantity,
                repairQuantity,
                totalProduction,
                manualCostRatio: totalProduction > 0 ? (manualCost / totalProduction) * 100 : 0,
                repairCostRatio: totalProduction > 0 ? (repairCost / totalProduction) * 100 : 0
            });
        }

        return months;
    }, [allManualRecords, allRepairRecords, monthlyTotals, calculateCost, analysisFilters]);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center"><BookUser className="mr-2 h-5 w-5" />Manuel Veri Takip</CardTitle>
                            <CardDescription>Manuel ve tamir hatlarındaki üretim verilerini ve maliyetlerini takip edin.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="data" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="data">Ana Veri Takip</TabsTrigger>
                    <TabsTrigger value="analysis">Detaylı Analiz</TabsTrigger>
                </TabsList>

                <TabsContent value="data" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                    <Button onClick={() => setShowDialog(true)}><Plus className="mr-2 h-4 w-4" />Yeni Kayıt Ekle</Button>
                                    <Button variant="secondary" onClick={() => {
                                        const currentYear = format(new Date(), 'yyyy');
                                        const currentMonth = format(new Date(), 'MM');
                                        const yearMonth = `${currentYear}-${currentMonth}`;
                                        const existing = monthlyTotals[yearMonth];
                                        setMonthlyFormData({
                                            year: currentYear,
                                            month: currentMonth,
                                            total_production: existing?.total_production || ''
                                        });
                                        setShowMonthlyDialog(true);
                                    }}><CalendarIcon className="mr-2 h-4 w-4" />Aylık Toplam Gir</Button>
                                    <Button variant="outline" onClick={handleGenerateReport}><FileText className="h-4 w-4 mr-2" />Raporla</Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 mb-4">
                                {/* Hızlı Filtre Butonları */}
                                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg">
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const today = new Date();
                                        setFilters({ ...filters, dateRange: { from: today, to: today } });
                                    }}>Bugün</Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const today = new Date();
                                        setFilters({ ...filters, dateRange: { from: startOfMonth(today), to: endOfMonth(today) } });
                                    }}>Bu Ay</Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const today = new Date();
                                        const start = new Date(today.getFullYear(), 0, 1);
                                        const end = new Date(today.getFullYear(), 11, 31);
                                        setFilters({ ...filters, dateRange: { from: start, to: end } });
                                    }}>Bu Yıl</Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const today = new Date();
                                        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                                        setFilters({ ...filters, dateRange: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) } });
                                    }}>Geçen Ay</Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const today = new Date();
                                        const start = new Date(today.getFullYear() - 10, 0, 1);
                                        setFilters({ ...filters, dateRange: { from: start, to: today } });
                                    }}>Tüm Zamanlar</Button>
                                </div>

                                {/* Tarih Aralığı Seçici */}
                                <div className="flex gap-2 p-2 bg-gray-50 rounded-lg">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.dateRange?.from ? (
                                                    filters.dateRange.to ? (
                                                        <>
                                                            {format(filters.dateRange.from, "dd LLL, y", { locale: tr })} -{" "}
                                                            {format(filters.dateRange.to, "dd LLL, y", { locale: tr })}
                                                        </>
                                                    ) : (
                                                        format(filters.dateRange.from, "dd LLL, y", { locale: tr })
                                                    )
                                                ) : (
                                                    <span>Özel Tarih Aralığı Seç</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={filters.dateRange?.from}
                                                selected={filters.dateRange}
                                                onSelect={(range) => setFilters({ ...filters, dateRange: range })}
                                                numberOfMonths={2}
                                                locale={tr}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            {/* Seçili Dönem Özet Kartları */}
                            {(() => {
                                // Seçili dönemdeki TÜM kayıtları topla
                                const totalManual = aggregatedRecords.reduce((sum, r) => sum + r.manual_quantity, 0);
                                const totalRepair = aggregatedRecords.reduce((sum, r) => sum + r.repair_quantity, 0);

                                // Tarih aralığı metni oluştur
                                let periodText = '';
                                if (filters.dateRange?.from && filters.dateRange?.to) {
                                    const from = filters.dateRange.from;
                                    const to = filters.dateRange.to;
                                    const isSameMonth = format(from, 'yyyy-MM') === format(to, 'yyyy-MM');
                                    const isSameYear = format(from, 'yyyy') === format(to, 'yyyy');

                                    if (isSameMonth) {
                                        periodText = format(from, 'MMMM yyyy', { locale: tr });
                                    } else if (isSameYear) {
                                        periodText = `${format(from, 'MMM', { locale: tr })} - ${format(to, 'MMM yyyy', { locale: tr })}`;
                                    } else {
                                        periodText = `${format(from, 'MMM yyyy', { locale: tr })} - ${format(to, 'MMM yyyy', { locale: tr })}`;
                                    }
                                } else {
                                    periodText = 'Seçili dönem';
                                }

                                // Aylık toplam için ilk ayı kontrol et
                                const firstMonth = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM') : format(new Date(), 'yyyy-MM');
                                const monthTotal = monthlyTotals[firstMonth];

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-blue-900">Toplam Manuel Üretim</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-blue-700">{totalManual} adet</div>
                                                <p className="text-xs text-blue-600 mt-1">{periodText}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-orange-900">Toplam Tamir</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-orange-700">{totalRepair} adet</div>
                                                <p className="text-xs text-orange-600 mt-1">{periodText}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-green-900">Aylık Toplam Üretim</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-green-700">
                                                    {monthTotal ? `${monthTotal.total_production} adet` : 'Girilmemiş'}
                                                </div>
                                                {monthTotal && (
                                                    <p className="text-xs text-green-600 mt-1">
                                                        Manuel: %{((totalManual / monthTotal.total_production) * 100).toFixed(1)} |
                                                        Tamir: %{((totalRepair / monthTotal.total_production) * 100).toFixed(1)}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-medium text-purple-900">Toplam (M+T)</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-2xl font-bold text-purple-700">{totalManual + totalRepair} adet</div>
                                                <p className="text-xs text-purple-600 mt-1">
                                                    {monthTotal ? `Kalan: ${monthTotal.total_production - (totalManual + totalRepair)} adet` : 'Aylık toplam girilmemiş'}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                );
                            })()}

                            <div className="border rounded-lg overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50"><tr>{['Tarih', 'Manuel (Kayıt/Adet)', 'Manuel Maliyet', 'Tamir (Kayıt/Adet)', 'Tamir Maliyet', 'Manuel Oran %', 'Tamir Oran %', 'İşlemler'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                                    <tbody className="divide-y">
                                        {aggregatedRecords.map(rec => {
                                            // Yeni hesaplama: aylık toplam varsa onu kullan, yoksa günlük toplam
                                            const manualPercent = rec.manual_percentage.toFixed(1);
                                            const repairPercent = rec.repair_percentage.toFixed(1);
                                            const hasDailyTotal = rec.daily_total && rec.daily_total.total_production > 0;
                                            const hasMonthlyTotal = rec.monthly_total && rec.monthly_total.total_production > 0;

                                            const ratioLabel = rec.ratio_source === 'daily' ? '✓ Günlük oran'
                                                : rec.ratio_source === 'monthly' ? '✓ Aylık oran'
                                                    : '⚠ Kayıt oranı';

                                            return (
                                                <tr key={rec.date} className="hover:bg-blue-50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        const existing = dailyTotals[rec.date];
                                                        setDailyFormData({
                                                            date: rec.date,
                                                            total_production: existing?.total_production || ''
                                                        });
                                                        setSelectedDailyRecord(rec);
                                                        setShowDailyDialog(true);
                                                    }}>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{format(new Date(rec.date), 'dd.MM.yyyy')}</span>
                                                            <span className={`text-xs ${rec.ratio_source === 'daily' ? 'text-green-600' :
                                                                rec.ratio_source === 'monthly' ? 'text-blue-600' :
                                                                    'text-orange-600'
                                                                }`}>{ratioLabel}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-blue-600">{rec.manual_count} kayıt</span>
                                                            <span className="text-xs text-gray-600">{rec.manual_quantity} adet</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="font-semibold text-blue-700">{formatCurrency(rec.manual_cost)}</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-orange-600">{rec.repair_count} kayıt</span>
                                                            <span className="text-xs text-gray-600">{rec.repair_quantity} adet</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="font-semibold text-orange-700">{formatCurrency(rec.repair_cost)}</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">%{manualPercent}</span>
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-medium">%{repairPercent}</span>
                                                    </td>
                                                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}><div className="flex gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => handleViewDetails(rec.date)}><Eye className="h-4 w-4 mr-1" />Detay</Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(rec)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                    </div></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {aggregatedRecords.length === 0 && !loading && <p className="text-center p-8 text-gray-500">Seçili tarih aralığında kayıt bulunamadı.</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <Dialog open={showDialog} onOpenChange={setShowDialog}>
                        <DialogContent className="max-w-6xl">
                            <DialogHeader><DialogTitle>Toplu Kayıt Ekle</DialogTitle></DialogHeader>
                            <MultiRowForm onSave={handleMultiSave} lines={lines} employees={employees} />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!viewingDetails} onOpenChange={() => setViewingDetails(null)}>
                        <DialogContent className="max-w-7xl">
                            <DialogHeader>
                                <DialogTitle>{viewingDetails ? `${format(new Date(viewingDetails.date), 'dd MMMM yyyy', { locale: tr })} Tarihli Kayıt Detayları` : 'Detaylar'}</DialogTitle>
                            </DialogHeader>
                            {viewingDetails && (
                                <Tabs defaultValue="manual">
                                    <TabsList>
                                        <TabsTrigger value="manual">Manuel Hat Kayıtları ({viewingDetails.manuals.length})</TabsTrigger>
                                        <TabsTrigger value="repair">Tamir Hattı Kayıtları ({viewingDetails.repairs.length})</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="manual" className="mt-4 max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0"><tr>{['Tarih/Saat', 'Vardiya', 'Operatör', 'Hat', 'Parça Kodu', 'Adet', 'Süre (sn)', 'Maliyet', 'İşlem'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                                            <tbody className="divide-y">
                                                {viewingDetails.manuals.map(rec => {
                                                    const durationSeconds = rec.duration_seconds || 0;
                                                    const cost = calculateCost(rec.quantity, rec.line_id, durationSeconds);
                                                    return (
                                                        <tr key={rec.id}>
                                                            <td className="px-4 py-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{format(new Date(rec.record_date), 'dd.MM.yyyy')}</span>
                                                                    <span className="text-xs text-gray-500">{rec.created_at ? format(new Date(rec.created_at), 'HH:mm:ss') : '-'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">{getShiftLabel(rec.shift)}</td>
                                                            <td className="px-4 py-2">{rec.operator_name}</td>
                                                            <td className="px-4 py-2">{rec.line_name}</td>
                                                            <td className="px-4 py-2 font-semibold">{rec.part_code}</td>
                                                            <td className="px-4 py-2"><span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">{rec.quantity}</span></td>
                                                            <td className="px-4 py-2"><span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">{durationSeconds || 0}</span></td>
                                                            <td className="px-4 py-2"><span className="font-semibold text-blue-700">{formatCurrency(cost)}</span></td>
                                                            <td className="px-4 py-2"><Button variant="outline" size="sm" onClick={() => setEditingRecord({ ...rec, recordType: 'manual' })}><Edit className="h-4 w-4" /></Button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </TabsContent>
                                    <TabsContent value="repair" className="mt-4 max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0"><tr>{['Tarih/Saat', 'Vardiya', 'Operatör', 'Kaynak Hat', 'Tamir Hattı', 'Adet', 'Süre (sn)', 'Maliyet', 'İşlem'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                                            <tbody className="divide-y">
                                                {viewingDetails.repairs.map(rec => {
                                                    const durationSeconds = rec.duration_seconds || 0;
                                                    const cost = calculateCost(rec.quantity, rec.repair_line_id, durationSeconds);
                                                    return (
                                                        <tr key={rec.id}>
                                                            <td className="px-4 py-2">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{format(new Date(rec.record_date), 'dd.MM.yyyy')}</span>
                                                                    <span className="text-xs text-gray-500">{rec.created_at ? format(new Date(rec.created_at), 'HH:mm:ss') : '-'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2">{getShiftLabel(rec.shift)}</td>
                                                            <td className="px-4 py-2">{rec.operator_name}</td>
                                                            <td className="px-4 py-2">{rec.source_line_name}</td>
                                                            <td className="px-4 py-2">{rec.repair_line_name}</td>
                                                            <td className="px-4 py-2"><span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">{rec.quantity}</span></td>
                                                            <td className="px-4 py-2"><span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">{durationSeconds || 0}</span></td>
                                                            <td className="px-4 py-2"><span className="font-semibold text-orange-700">{formatCurrency(cost)}</span></td>
                                                            <td className="px-4 py-2"><Button variant="outline" size="sm" onClick={() => setEditingRecord({ ...rec, recordType: 'repair' })}><Edit className="h-4 w-4" /></Button></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Kaydı Düzenle</DialogTitle>
                            </DialogHeader>
                            {editingRecord && (
                                <EditRecordForm
                                    key={editingRecord.id}
                                    record={editingRecord}
                                    recordType={editingRecord.recordType}
                                    onSave={handleEditSave}
                                    lines={lines}
                                    employees={employees}
                                />
                            )}
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader><DialogTitle>Silme Onayı</DialogTitle></DialogHeader>
                            <DialogDescription>{deleteConfirm && `${format(new Date(deleteConfirm.date), 'dd.MM.yyyy')} tarihli tüm manuel ve tamir kayıtlarını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}</DialogDescription>
                            <DialogFooter className="mt-4">
                                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button>
                                <Button variant="destructive" onClick={handleDelete}>Sil</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Aylık Toplam Dialog */}
                    <Dialog open={showMonthlyDialog} onOpenChange={setShowMonthlyDialog}>
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="px-6">
                                <DialogTitle className="text-2xl font-bold">Aylık Toplam Üretim</DialogTitle>
                                <DialogDescription className="text-base">
                                    Fabrika genelindeki aylık toplam üretim adedini girin. Manuel ve tamir adetleri otomatik hesaplanacaktır.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-6 px-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-base font-semibold">Yıl</Label>
                                        <Select value={monthlyFormData.year} onValueChange={(value) => setMonthlyFormData({ ...monthlyFormData, year: value })}>
                                            <SelectTrigger className="h-12">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026].map(y => (
                                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-base font-semibold">Ay</Label>
                                        <Select value={monthlyFormData.month} onValueChange={(value) => setMonthlyFormData({ ...monthlyFormData, month: value })}>
                                            <SelectTrigger className="h-12">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                                                    <SelectItem key={m} value={m}>{format(new Date(2000, Number(m) - 1, 1), 'MMMM', { locale: tr })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-base font-semibold">Aylık Toplam Üretim Adedi</Label>
                                    <Input
                                        type="number"
                                        placeholder="Örn: 50000"
                                        className="h-14 text-lg"
                                        value={monthlyFormData.total_production}
                                        onChange={(e) => setMonthlyFormData({ ...monthlyFormData, total_production: e.target.value })}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Bu aydaki tüm üretim (manuel + robot + diğer sistemler) toplamı
                                    </p>
                                </div>

                                {(() => {
                                    const yearMonth = `${monthlyFormData.year}-${String(monthlyFormData.month).padStart(2, '0')}`;
                                    const monthRecords = allManualRecords.filter(r => r.record_date && r.record_date.startsWith(yearMonth));
                                    const monthRepairs = allRepairRecords.filter(r => r.record_date && r.record_date.startsWith(yearMonth));
                                    const totalManual = monthRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const totalRepair = monthRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const existing = monthlyTotals[yearMonth];

                                    return (
                                        <div className="grid grid-cols-3 gap-4">
                                            <Card className="bg-blue-50 border-blue-200">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">Manuel Üretim</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-2xl font-bold text-blue-700">{totalManual}</p>
                                                    <p className="text-xs text-muted-foreground">Kayıtlardan</p>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-orange-50 border-orange-200">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">Tamir</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-2xl font-bold text-orange-700">{totalRepair}</p>
                                                    <p className="text-xs text-muted-foreground">Kayıtlardan</p>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-purple-50 border-purple-200">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm">Toplam (M+T)</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-2xl font-bold text-purple-700">{totalManual + totalRepair}</p>
                                                    <p className="text-xs text-muted-foreground">Kayıtlardan</p>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    );
                                })()}

                                {/* Oran Kartları */}
                                {(() => {
                                    const yearMonth = `${monthlyFormData.year}-${String(monthlyFormData.month).padStart(2, '0')}`;

                                    const monthRecords = allManualRecords.filter(r => r.record_date && r.record_date.startsWith(yearMonth));
                                    const monthRepairs = allRepairRecords.filter(r => r.record_date && r.record_date.startsWith(yearMonth));

                                    const totalManual = monthRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const totalRepair = monthRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const inputProduction = Number(monthlyFormData.total_production) || 0;

                                    if (inputProduction > 0) {
                                        const manualPercent = ((totalManual / inputProduction) * 100).toFixed(1);
                                        const repairPercent = ((totalRepair / inputProduction) * 100).toFixed(1);

                                        return (
                                            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                                                <p className="font-semibold text-indigo-900 mb-3">Aylık Oranlar</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Card className="bg-white border-indigo-200">
                                                        <CardHeader className="pb-2">
                                                            <CardTitle className="text-sm text-indigo-900">Manuel Oran %</CardTitle>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <p className="text-3xl font-bold text-indigo-600">%{manualPercent}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{totalManual} / {inputProduction} adet</p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="bg-white border-purple-200">
                                                        <CardHeader className="pb-2">
                                                            <CardTitle className="text-sm text-purple-900">Tamir Oran %</CardTitle>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <p className="text-3xl font-bold text-purple-600">%{repairPercent}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{totalRepair} / {inputProduction} adet</p>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {(() => {
                                    const yearMonth = `${monthlyFormData.year}-${monthlyFormData.month}`;
                                    const existing = monthlyTotals[yearMonth];
                                    return existing && (
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="font-semibold text-green-900 mb-2">✓ Mevcut Kayıt</p>
                                            <div className="grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <p className="text-muted-foreground">Toplam Üretim</p>
                                                    <p className="text-lg font-bold text-green-700">{existing.total_production}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Manuel</p>
                                                    <p className="text-lg font-bold text-green-700">{existing.total_manual || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-muted-foreground">Tamir</p>
                                                    <p className="text-lg font-bold text-green-700">{existing.total_repair || 0}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" size="lg" onClick={() => setShowMonthlyDialog(false)}>İptal</Button>
                                <Button size="lg" onClick={handleSaveMonthlyTotal}><Save className="mr-2 h-5 w-5" />Kaydet</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Günlük Toplam Dialog */}
                    <Dialog open={showDailyDialog} onOpenChange={setShowDailyDialog}>
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="px-6">
                                <DialogTitle className="text-2xl font-bold">Günlük Toplam Üretim</DialogTitle>
                                <DialogDescription className="text-base">
                                    {selectedDailyRecord && format(new Date(selectedDailyRecord.date), 'dd MMMM yyyy', { locale: tr })} için toplam üretim adedini girin
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-6 px-6">
                                <div className="space-y-2">
                                    <Label className="text-base font-semibold">Günlük Toplam Üretim Adedi</Label>
                                    <Input
                                        type="number"
                                        placeholder="Örn: 2500"
                                        className="h-14 text-lg"
                                        value={dailyFormData.total_production}
                                        onChange={(e) => setDailyFormData({ ...dailyFormData, total_production: e.target.value })}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Bu gün tüm üretim (manuel + robot + diğer) toplamı
                                    </p>
                                </div>

                                {selectedDailyRecord && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <Card className="bg-blue-50 border-blue-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Manuel Üretim</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-2xl font-bold text-blue-700">{selectedDailyRecord.manual_quantity}</p>
                                                <p className="text-xs text-muted-foreground">{selectedDailyRecord.manual_count} kayıt</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-orange-50 border-orange-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Tamir</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-2xl font-bold text-orange-700">{selectedDailyRecord.repair_quantity}</p>
                                                <p className="text-xs text-muted-foreground">{selectedDailyRecord.repair_count} kayıt</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-purple-50 border-purple-200">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm">Toplam (M+T)</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-2xl font-bold text-purple-700">{selectedDailyRecord.manual_quantity + selectedDailyRecord.repair_quantity}</p>
                                                <p className="text-xs text-muted-foreground">Kayıtlardan</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* Oran Kartları */}
                                {selectedDailyRecord && (() => {
                                    const inputProduction = Number(dailyFormData.total_production) || 0;

                                    if (inputProduction > 0) {
                                        const totalManual = selectedDailyRecord.manual_quantity;
                                        const totalRepair = selectedDailyRecord.repair_quantity;
                                        const manualPercent = ((totalManual / inputProduction) * 100).toFixed(1);
                                        const repairPercent = ((totalRepair / inputProduction) * 100).toFixed(1);

                                        return (
                                            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                                                <p className="font-semibold text-indigo-900 mb-3">Günlük Oranlar</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <Card className="bg-white border-indigo-200">
                                                        <CardHeader className="pb-2">
                                                            <CardTitle className="text-sm text-indigo-900">Manuel Oran %</CardTitle>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <p className="text-3xl font-bold text-indigo-600">%{manualPercent}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{totalManual} / {inputProduction} adet</p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="bg-white border-purple-200">
                                                        <CardHeader className="pb-2">
                                                            <CardTitle className="text-sm text-purple-900">Tamir Oran %</CardTitle>
                                                        </CardHeader>
                                                        <CardContent>
                                                            <p className="text-3xl font-bold text-purple-600">%{repairPercent}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">{totalRepair} / {inputProduction} adet</p>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {selectedDailyRecord?.daily_total && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="font-semibold text-green-900 mb-2">✓ Mevcut Kayıt</p>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground">Toplam Üretim</p>
                                                <p className="text-lg font-bold text-green-700">{selectedDailyRecord.daily_total.total_production}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Manuel</p>
                                                <p className="text-lg font-bold text-green-700">{selectedDailyRecord.daily_total.total_manual || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Tamir</p>
                                                <p className="text-lg font-bold text-green-700">{selectedDailyRecord.daily_total.total_repair || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" size="lg" onClick={() => setShowDailyDialog(false)}>İptal</Button>
                                <Button size="lg" onClick={handleSaveDailyTotal}><Save className="mr-2 h-5 w-5" />Kaydet</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </TabsContent>

                {/* Detaylı Analiz Sekmesi */}
                <TabsContent value="analysis" className="space-y-4">
                    {/* Filtre ve Personel Seçimi */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Filtreleme ve Arama</CardTitle>
                                    <CardDescription>Hızlı filtreler veya özel tarih aralığı seçin</CardDescription>
                                </div>
                                <Button variant="outline" onClick={handleGenerateDetailedAnalysisReport}>
                                    <FileText className="h-4 w-4 mr-2" />Detaylı Analiz Raporu
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Hızlı Filtre Butonları */}
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant={analysisFilters.dateRange?.from && format(analysisFilters.dateRange.from, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? "default" : "outline"} onClick={() => {
                                    const today = new Date();
                                    setAnalysisFilters({ ...analysisFilters, dateRange: { from: today, to: today } });
                                }}>Bugün</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const today = new Date();
                                    setAnalysisFilters({ ...analysisFilters, dateRange: { from: startOfMonth(today), to: endOfMonth(today) } });
                                }}>Bu Ay</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const today = new Date();
                                    const start = new Date(today.getFullYear(), 0, 1);
                                    const end = new Date(today.getFullYear(), 11, 31);
                                    setAnalysisFilters({ ...analysisFilters, dateRange: { from: start, to: end } });
                                }}>Bu Yıl</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const today = new Date();
                                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                                    setAnalysisFilters({ ...analysisFilters, dateRange: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) } });
                                }}>Geçen Ay</Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                    const today = new Date();
                                    const start = new Date(today.getFullYear() - 10, 0, 1);
                                    setAnalysisFilters({ ...analysisFilters, dateRange: { from: start, to: today } });
                                }}>Tüm Zamanlar</Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Vardiya Seç</Label>
                                    <Select value={analysisFilters.shift} onValueChange={(value) => setAnalysisFilters({ ...analysisFilters, shift: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Vardiyalar</SelectItem>
                                            <SelectItem value="1">1. Vardiya</SelectItem>
                                            <SelectItem value="2">2. Vardiya</SelectItem>
                                            <SelectItem value="3">3. Vardiya</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Personel Seç</Label>
                                    <Select value={analysisFilters.employee} onValueChange={(value) => setAnalysisFilters({ ...analysisFilters, employee: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tüm Personel</SelectItem>
                                            {employees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Özel Tarih Aralığı</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {analysisFilters.dateRange?.from ? (
                                                    analysisFilters.dateRange.to ? (
                                                        <>
                                                            {format(analysisFilters.dateRange.from, "dd MMM yyyy", { locale: tr })} - {format(analysisFilters.dateRange.to, "dd MMM yyyy", { locale: tr })}
                                                        </>
                                                    ) : (
                                                        format(analysisFilters.dateRange.from, "dd MMM yyyy", { locale: tr })
                                                    )
                                                ) : (
                                                    <span>Tarih Seçin</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={analysisFilters.dateRange?.from}
                                                selected={analysisFilters.dateRange}
                                                onSelect={(range) => setAnalysisFilters({ ...analysisFilters, dateRange: range })}
                                                numberOfMonths={2}
                                                locale={tr}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Yönetici Özeti - Ana KPI Kartları */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden">
                            <CardHeader className="pb-1 pt-3">
                                <CardTitle className="text-xs text-blue-600">Toplam Üretim</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-lg md:text-xl font-bold text-blue-700 break-words leading-tight">
                                    {(() => {
                                        const allManual = analysisData.allManualWithShift || [];
                                        const allRepair = analysisData.allRepairWithShift || [];
                                        return (allManual.reduce((sum, r) => sum + (r.quantity || 0), 0) +
                                            allRepair.reduce((sum, r) => sum + (r.quantity || 0), 0)).toLocaleString('tr-TR');
                                    })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">adet</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-50 to-green-100 overflow-hidden">
                            <CardHeader className="pb-1 pt-3">
                                <CardTitle className="text-xs text-green-600">Toplam Maliyet</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-lg md:text-xl font-bold text-green-700 break-words leading-tight">
                                    {(() => {
                                        const manual = analysisData.manual || [];
                                        const repair = analysisData.repair || [];
                                        // calculateCost fonksiyonunu kullanarak maliyet hesapla
                                        const manualCost = manual.reduce((sum, r) => {
                                            const durationSeconds = r.duration_seconds || 0;
                                            return sum + calculateCost(r.quantity || 0, r.line_id, durationSeconds);
                                        }, 0);
                                        const repairCost = repair.reduce((sum, r) => {
                                            const durationSeconds = r.duration_seconds || 0;
                                            return sum + calculateCost(r.quantity || 0, r.repair_line_id, durationSeconds);
                                        }, 0);
                                        return formatCurrency(manualCost + repairCost);
                                    })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Manuel + Tamir</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden">
                            <CardHeader className="pb-1 pt-3">
                                <CardTitle className="text-xs text-orange-600">Günlük Ortalama</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-lg md:text-xl font-bold text-orange-700 break-words leading-tight">
                                    {(() => {
                                        const allManual = analysisData.allManualWithShift || [];
                                        const allRepair = analysisData.allRepairWithShift || [];
                                        const uniqueDays = new Set([...allManual.map(r => r.record_date), ...allRepair.map(r => r.record_date)]).size;
                                        const totalQty = allManual.reduce((sum, r) => sum + (r.quantity || 0), 0) + allRepair.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                        return uniqueDays > 0 ? Math.round(totalQty / uniqueDays).toLocaleString('tr-TR') : 0;
                                    })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">adet/gün</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 overflow-hidden">
                            <CardHeader className="pb-1 pt-3">
                                <CardTitle className="text-xs text-purple-600">Aktif Personel</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-lg md:text-xl font-bold text-purple-700 break-words leading-tight">
                                    {(() => {
                                        const allManual = analysisData.allManualWithShift || [];
                                        const allRepair = analysisData.allRepairWithShift || [];
                                        const uniqueEmployees = new Set([...allManual, ...allRepair]
                                            .filter(r => r.operator_id && r.operator_id !== 'unknown')
                                            .map(r => r.operator_id));
                                        return uniqueEmployees.size;
                                    })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">kişi</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 overflow-hidden">
                            <CardHeader className="pb-1 pt-3">
                                <CardTitle className="text-xs text-cyan-600">Aylık Ort. Maliyet</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-lg md:text-xl font-bold text-cyan-700 break-words leading-tight">
                                    {(() => {
                                        const manual = analysisData.manual || [];
                                        const repair = analysisData.repair || [];
                                        const allRecords = [...manual, ...repair];
                                        const uniqueMonths = new Set(allRecords.map(r => r.record_date?.substring(0, 7))).size;
                                        // calculateCost fonksiyonunu kullanarak maliyet hesapla
                                        const manualCost = manual.reduce((sum, r) => {
                                            const durationSeconds = r.duration_seconds || 0;
                                            return sum + calculateCost(r.quantity || 0, r.line_id, durationSeconds);
                                        }, 0);
                                        const repairCost = repair.reduce((sum, r) => {
                                            const durationSeconds = r.duration_seconds || 0;
                                            return sum + calculateCost(r.quantity || 0, r.repair_line_id, durationSeconds);
                                        }, 0);
                                        const totalCost = manualCost + repairCost;
                                        return uniqueMonths > 0 ? formatCurrency(totalCost / uniqueMonths) : '₺0';
                                    })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">aylık ortalama</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 overflow-hidden">
                            <CardHeader className="pb-1 pt-3">
                                <CardTitle className="text-xs text-rose-600">Toplam Kayıt</CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="text-lg md:text-xl font-bold text-rose-700 break-words leading-tight">
                                    {(() => {
                                        const allManual = analysisData.allManualWithShift || [];
                                        const allRepair = analysisData.allRepairWithShift || [];
                                        return (allManual.length + allRepair.length).toLocaleString('tr-TR');
                                    })()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">kayıt</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Vardiya Analizi */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Vardiya Bazlı Üretim Analizi</CardTitle>
                            <CardDescription>Her vardiya için üretim miktarları ve kayıt sayıları (tüm veriler)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 mb-6">
                                {[1, 2, 3].map(shift => {
                                    // FİLTRELENMEMİŞ verileri kullan - calculatedShift değerlerini number olarak karşılaştır
                                    const shiftManual = (analysisData.allManualWithShift || []).filter(r => {
                                        const calcShift = typeof r.calculatedShift === 'string' ? parseInt(r.calculatedShift, 10) : Number(r.calculatedShift);
                                        return calcShift === shift;
                                    });
                                    const shiftRepair = (analysisData.allRepairWithShift || []).filter(r => {
                                        const calcShift = typeof r.calculatedShift === 'string' ? parseInt(r.calculatedShift, 10) : Number(r.calculatedShift);
                                        return calcShift === shift;
                                    });
                                    const totalQty = shiftManual.reduce((sum, r) => sum + (r.quantity || 0), 0) +
                                        shiftRepair.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const totalRecords = shiftManual.length + shiftRepair.length;

                                    return (
                                        <div key={shift} className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-semibold text-lg">{shift}. Vardiya</h4>
                                                    <p className="text-sm text-muted-foreground">{totalRecords} kayıt</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-blue-600">{totalQty} adet</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Manuel: {shiftManual.reduce((sum, r) => sum + (r.quantity || 0), 0)} |
                                                        Tamir: {shiftRepair.reduce((sum, r) => sum + (r.quantity || 0), 0)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Vardiya Bazlı Grafik */}
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={(() => {
                                    return [1, 2, 3].map(shift => {
                                        // calculatedShift değerlerini number olarak karşılaştır
                                        const shiftManual = (analysisData.allManualWithShift || []).filter(r => {
                                            const calcShift = typeof r.calculatedShift === 'string' ? parseInt(r.calculatedShift, 10) : Number(r.calculatedShift);
                                            return calcShift === shift;
                                        });
                                        const shiftRepair = (analysisData.allRepairWithShift || []).filter(r => {
                                            const calcShift = typeof r.calculatedShift === 'string' ? parseInt(r.calculatedShift, 10) : Number(r.calculatedShift);
                                            return calcShift === shift;
                                        });
                                        const manuelQty = shiftManual.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                        const repairQty = shiftRepair.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                        return {
                                            vardiya: `${shift}. Vardiya`,
                                            manuel: manuelQty,
                                            tamir: repairQty,
                                            toplam: manuelQty + repairQty
                                        };
                                    });
                                })()}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="vardiya" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="manuel" fill="#3b82f6" name="Manuel Üretim" />
                                    <Bar dataKey="tamir" fill="#f97316" name="Tamir" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Parça Kodu Arama */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Parça Kodu ile Arama</CardTitle>
                            <CardDescription>Bir parça kodunun ne zaman üretildiğini bulun</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Parça kodu girin (örn: BH123)"
                                    value={partCodeSearch}
                                    onChange={(e) => setPartCodeSearch(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handlePartCodeSearch()}
                                    className="flex-1"
                                />
                                <Button onClick={handlePartCodeSearch}><Search className="h-4 w-4 mr-2" />Ara</Button>
                            </div>
                            {partCodeSearchResults && partCodeSearchResults.results && partCodeSearchResults.results.length > 0 && (
                                <div className="mt-4 space-y-4">
                                    {/* İstatistikler */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <Card className="bg-blue-50">
                                            <CardContent className="p-4">
                                                <p className="text-xs text-gray-600">Toplam Kayıt</p>
                                                <p className="text-2xl font-bold text-blue-700">{partCodeSearchResults?.stats?.totalRecords || 0}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-green-50">
                                            <CardContent className="p-4">
                                                <p className="text-xs text-gray-600">Toplam Adet</p>
                                                <p className="text-2xl font-bold text-green-700">{(partCodeSearchResults?.stats?.totalQuantity || 0).toLocaleString('tr-TR')}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-purple-50">
                                            <CardContent className="p-4">
                                                <p className="text-xs text-gray-600">Toplam Maliyet</p>
                                                <p className="text-2xl font-bold text-purple-700">{formatCurrency(partCodeSearchResults?.stats?.totalCost || 0)}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-orange-50">
                                            <CardContent className="p-4">
                                                <p className="text-xs text-gray-600">Farklı Tarih</p>
                                                <p className="text-2xl font-bold text-orange-700">{partCodeSearchResults?.stats?.uniqueDates || 0}</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Detaylı Tablo */}
                                    <div className="max-h-96 overflow-y-auto border rounded-lg">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Tarih/Saat</th>
                                                    <th className="px-3 py-2 text-left">Tip</th>
                                                    <th className="px-3 py-2 text-left">Vardiya</th>
                                                    <th className="px-3 py-2 text-left">Operatör</th>
                                                    <th className="px-3 py-2 text-left">Hat</th>
                                                    <th className="px-3 py-2 text-right">Adet</th>
                                                    <th className="px-3 py-2 text-right">Süre (sn)</th>
                                                    <th className="px-3 py-2 text-right">Maliyet</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(partCodeSearchResults?.results || []).map((r, idx) => (
                                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                                        <td className="px-3 py-2">
                                                            <div className="flex flex-col">
                                                                <span>{format(new Date(r.record_date), 'dd.MM.yyyy', { locale: tr })}</span>
                                                                {r.created_at && (
                                                                    <span className="text-xs text-gray-500">{format(new Date(r.created_at), 'HH:mm:ss')}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-1 rounded text-xs ${r.recordType === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                                                }`}>
                                                                {r.recordType === 'manual' ? 'Manuel' : 'Tamir'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">{getShiftLabel(r.shift)}</td>
                                                        <td className="px-3 py-2">
                                                            {r.operator ? `${r.operator.first_name} ${r.operator.last_name}` : 'N/A'}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {r.recordType === 'manual'
                                                                ? (r.line?.name || 'N/A')
                                                                : (r.repairLine?.name ? `${r.sourceLine?.name || 'N/A'} → ${r.repairLine.name}` : 'N/A')
                                                            }
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-semibold">{r.quantity}</td>
                                                        <td className="px-3 py-2 text-right">{r.durationSeconds || 0}</td>
                                                        <td className="px-3 py-2 text-right font-semibold text-green-600">{formatCurrency(r.cost || 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* BH Kodu ile Başlayan Top20 Parça */}
                    {bhTop10Parts.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>BH Kodu ile Başlayan Top 20 Parça</CardTitle>
                                <CardDescription>BT ve YK kodları hariç, manuel yazılan BH kodlu parçalar</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {bhTop10Parts.map((part, index) => (
                                        <div key={part.code} className="flex justify-between items-center p-3 bg-blue-50 rounded border-l-4 border-blue-500">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl font-bold text-blue-700">#{index + 1}</span>
                                                <div>
                                                    <p className="font-semibold">{part.code}</p>
                                                    <p className="text-xs text-muted-foreground">{part.records} kayıt, {part.employeeCount} personel</p>
                                                </div>
                                            </div>
                                            <span className="text-lg font-bold text-blue-600">{part.quantity.toLocaleString('tr-TR')} adet</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}


                    {/* Aylık Bazda Tamir ve Manuel Maliyet Grafiği */}
                    {monthlyCostChartData.length > 0 && monthlyCostChartData[0]?.year && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Aylık Bazda Tamir ve Manuel Maliyet Analizi</CardTitle>
                                <CardDescription>
                                    {monthlyCostChartData[0].year} yılı içinde aylık maliyetler ve üretim adedine göre oranlar
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={monthlyCostChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                        <Tooltip
                                            formatter={(value, name) => {
                                                if (name === 'manualCost' || name === 'repairCost') {
                                                    return formatCurrency(value);
                                                }
                                                return value.toLocaleString('tr-TR');
                                            }}
                                            labelFormatter={(label) => `${label} ${monthlyCostChartData[0]?.year || ''}`}
                                        />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="manualCost" fill="#3b82f6" name="Manuel Maliyet (₺)" />
                                        <Bar yAxisId="left" dataKey="repairCost" fill="#f97316" name="Tamir Maliyeti (₺)" />
                                        <Line yAxisId="right" type="monotone" dataKey="manualQuantity" stroke="#10b981" strokeWidth={2} name="Manuel Adet" />
                                        <Line yAxisId="right" type="monotone" dataKey="repairQuantity" stroke="#ef4444" strokeWidth={2} name="Tamir Adet" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {/* Aylık/Yıllık Top 10 ve Bottom 10 Personel */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Aylık/Yıllık Personel Analizi</CardTitle>
                                    <CardDescription>Seçili dönem için en başarılı ve en düşük performanslı personeller</CardDescription>
                                </div>
                                <Select value={employeeAnalysisPeriod} onValueChange={setEmployeeAnalysisPeriod}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Aylık</SelectItem>
                                        <SelectItem value="yearly">Yıllık</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-semibold text-green-700 mb-3">🏆 Top 10 Personel</h4>
                                    <div className="space-y-2">
                                        {employeeAnalysisData.top10.map((emp, index) => (
                                            <div key={emp.id} className="flex justify-between items-center p-3 bg-green-50 rounded border-l-4 border-green-500">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl font-bold text-green-700">#{index + 1}</span>
                                                    <div>
                                                        <p className="font-semibold">{emp.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {emp.records} kayıt | M: {emp.manualQuantity} T: {emp.repairQuantity}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-lg font-bold text-green-600">{emp.quantity.toLocaleString('tr-TR')} adet</span>
                                                    <p className="text-xs text-muted-foreground">{formatCurrency(emp.cost)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-red-700 mb-3">⚠️ Bottom 10 Personel</h4>
                                    <div className="space-y-2">
                                        {employeeAnalysisData.bottom10.map((emp, index) => (
                                            <div key={emp.id} className="flex justify-between items-center p-3 bg-red-50 rounded border-l-4 border-red-500">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl font-bold text-red-700">#{index + 1}</span>
                                                    <div>
                                                        <p className="font-semibold">{emp.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {emp.records} kayıt | M: {emp.manualQuantity} T: {emp.repairQuantity}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-lg font-bold text-red-600">{emp.quantity.toLocaleString('tr-TR')} adet</span>
                                                    <p className="text-xs text-muted-foreground">{formatCurrency(emp.cost)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top 10 ve Bottom 10 Personel (Seçili Dönem) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-green-700">🏆 Top 10 Personel (Seçili Dönem)</CardTitle>
                                <CardDescription>En yüksek üretim yapan personeller</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(() => {
                                        const employeeStats = {};
                                        [...analysisData.manual, ...analysisData.repair].forEach(record => {
                                            // operator_id kullanarak personeli bul
                                            const empId = record.operator_id || 'unknown';
                                            const emp = employees.find(e => e.id === empId);
                                            const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Bilinmeyen';

                                            if (!employeeStats[empId]) {
                                                employeeStats[empId] = {
                                                    name: empName,
                                                    quantity: 0,
                                                    records: 0
                                                };
                                            }
                                            employeeStats[empId].quantity += record.quantity || 0;
                                            employeeStats[empId].records += 1;
                                        });

                                        return Object.entries(employeeStats)
                                            .filter(([empId, stats]) =>
                                                empId !== 'unknown' &&
                                                stats.name !== 'Bilinmeyen' &&
                                                !stats.name.includes('Bilinmeyen')
                                            ) // Bilinmeyen personelleri hariç tut
                                            .sort((a, b) => b[1].quantity - a[1].quantity)
                                            .slice(0, 10)
                                            .map(([empId, stats], index) => (
                                                <div key={empId} className="flex justify-between items-center p-3 bg-green-50 rounded border-l-4 border-green-500">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl font-bold text-green-700">#{index + 1}</span>
                                                        <div>
                                                            <p className="font-semibold">{stats.name}</p>
                                                            <p className="text-xs text-muted-foreground">{stats.records} kayıt</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-lg font-bold text-green-600">{stats.quantity} adet</span>
                                                </div>
                                            ));
                                    })()}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-red-700">⚠️ Bottom 10 Personel (Seçili Dönem)</CardTitle>
                                <CardDescription>En düşük üretim yapan personeller</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(() => {
                                        const employeeStats = {};
                                        [...analysisData.manual, ...analysisData.repair].forEach(record => {
                                            // operator_id kullanarak personeli bul
                                            const empId = record.operator_id || 'unknown';
                                            const emp = employees.find(e => e.id === empId);
                                            const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Bilinmeyen';

                                            if (!employeeStats[empId]) {
                                                employeeStats[empId] = {
                                                    name: empName,
                                                    quantity: 0,
                                                    records: 0
                                                };
                                            }
                                            employeeStats[empId].quantity += record.quantity || 0;
                                            employeeStats[empId].records += 1;
                                        });

                                        return Object.entries(employeeStats)
                                            .filter(([empId, stats]) =>
                                                empId !== 'unknown' &&
                                                stats.name !== 'Bilinmeyen' &&
                                                !stats.name.includes('Bilinmeyen')
                                            ) // Bilinmeyen personelleri hariç tut
                                            .sort((a, b) => a[1].quantity - b[1].quantity)
                                            .slice(0, 10)
                                            .map(([empId, stats], index) => (
                                                <div key={empId} className="flex justify-between items-center p-3 bg-red-50 rounded border-l-4 border-red-500">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl font-bold text-red-700">#{index + 1}</span>
                                                        <div>
                                                            <p className="font-semibold">{stats.name}</p>
                                                            <p className="text-xs text-muted-foreground">{stats.records} kayıt</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-lg font-bold text-red-600">{stats.quantity} adet</span>
                                                </div>
                                            ));
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tüm Personel Detaylı Tablo */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Tüm Personel Detaylı Performans</CardTitle>
                            <CardDescription>Her personelin üretim detayları ve istatistikleri</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-3 text-left font-semibold">Sıra</th>
                                            <th className="p-3 text-left font-semibold">Personel Adı</th>
                                            <th className="p-3 text-center font-semibold">Toplam Üretim</th>
                                            <th className="p-3 text-center font-semibold">Kayıt Sayısı</th>
                                            <th className="p-3 text-center font-semibold">Ortalama/Kayıt</th>
                                            <th className="p-3 text-center font-semibold">Manuel</th>
                                            <th className="p-3 text-center font-semibold">Tamir</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const employeeStats = {};
                                            [...analysisData.manual, ...analysisData.repair].forEach(record => {
                                                // operator_id kullanarak personeli bul
                                                const empId = record.operator_id || 'unknown';
                                                const emp = employees.find(e => e.id === empId);
                                                const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Bilinmeyen';

                                                if (!employeeStats[empId]) {
                                                    employeeStats[empId] = {
                                                        name: empName,
                                                        total: 0,
                                                        records: 0,
                                                        manual: 0,
                                                        repair: 0
                                                    };
                                                }
                                                employeeStats[empId].total += record.quantity || 0;
                                                employeeStats[empId].records += 1;
                                                if (analysisData.manual.includes(record)) {
                                                    employeeStats[empId].manual += record.quantity || 0;
                                                } else {
                                                    employeeStats[empId].repair += record.quantity || 0;
                                                }
                                            });

                                            return Object.entries(employeeStats)
                                                .filter(([empId, stats]) =>
                                                    empId !== 'unknown' &&
                                                    stats.name !== 'Bilinmeyen' &&
                                                    !stats.name.includes('Bilinmeyen')
                                                ) // Bilinmeyen personelleri hariç tut
                                                .sort((a, b) => b[1].total - a[1].total)
                                                .map(([empId, stats], index) => (
                                                    <tr key={empId} className="border-b hover:bg-gray-50">
                                                        <td className="p-3">
                                                            <span className="font-bold text-blue-600">#{index + 1}</span>
                                                        </td>
                                                        <td className="p-3 font-medium">{stats.name}</td>
                                                        <td className="p-3 text-center font-bold text-blue-600">{stats.total}</td>
                                                        <td className="p-3 text-center">{stats.records}</td>
                                                        <td className="p-3 text-center text-green-600 font-semibold">
                                                            {Math.round(stats.total / stats.records)}
                                                        </td>
                                                        <td className="p-3 text-center text-blue-500">{stats.manual}</td>
                                                        <td className="p-3 text-center text-orange-500">{stats.repair}</td>
                                                    </tr>
                                                ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>

        </motion.div>
    );
};

export default ManualDataTracking;