import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookUser, Plus, Eye, Trash2, Save, Calendar as CalendarIcon, FileText, Edit } from 'lucide-react';
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
import { formatCurrency, logAction } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';

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
                <div className="space-y-2"><Label>Vardiya *</Label><Select value={shift} onValueChange={setShift}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{shiftOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <Tabs defaultValue="manual">
                <TabsList>
                    <TabsTrigger value="manual">Manuel Hat Kayıtları</TabsTrigger>
                    <TabsTrigger value="repair">Tamir Hattı Kayıtları</TabsTrigger>
                </TabsList>
                <TabsContent value="manual" className="space-y-2 max-h-[40vh] overflow-y-auto p-2 border rounded-lg">
                    {manualRows.map((row, index) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md bg-white shadow-sm">
                            <div className="col-span-2"><Combobox options={employeeOptions} value={row.operator_id} onSelect={v => handleRowChange(setManualRows, index, 'operator_id', v)} placeholder="Operatör *" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı."/></div>
                            <Input className="col-span-2" placeholder="Parça Kodu" value={row.part_code} onChange={e => handleRowChange(setManualRows, index, 'part_code', e.target.value)} />
                            <Select value={row.line_id || ''} onValueChange={v => handleRowChange(setManualRows, index, 'line_id', v)}><SelectTrigger className="col-span-2"><SelectValue placeholder="Hat"/></SelectTrigger><SelectContent>{lines.filter(l => l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
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
                            <div className="col-span-2"><Combobox options={employeeOptions} value={row.operator_id} onSelect={v => handleRowChange(setRepairRows, index, 'operator_id', v)} placeholder="Operatör *" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı."/></div>
                            <Select value={row.repair_line_id || ''} onValueChange={v => handleRowChange(setRepairRows, index, 'repair_line_id', v)}><SelectTrigger className="col-span-2"><SelectValue placeholder="Tamir Hattı"/></SelectTrigger><SelectContent>{lines.filter(l => l.type === 'repair' || l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
                            <Select value={row.source_line_id || ''} onValueChange={v => handleRowChange(setRepairRows, index, 'source_line_id', v)}><SelectTrigger className="col-span-2"><SelectValue placeholder="Kaynak Hat"/></SelectTrigger><SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
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
                <Button onClick={handleSaveClick}><Save className="mr-2 h-4 w-4"/>Tümünü Kaydet</Button>
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
                        <SelectTrigger><SelectValue placeholder="Hat seçin"/></SelectTrigger>
                        <SelectContent>{lines.filter(l => l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <Label>Tamir Hattı</Label>
                        <Select value={formData.repair_line_id || ''} onValueChange={v => handleChange('repair_line_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Tamir Hattı"/></SelectTrigger>
                            <SelectContent>{lines.filter(l => l.type === 'repair' || l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Kaynak Hat</Label>
                        <Select value={formData.source_line_id || ''} onValueChange={v => handleChange('source_line_id', v)}>
                            <SelectTrigger><SelectValue placeholder="Kaynak Hat"/></SelectTrigger>
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
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
        shift: 'all',
        employee: 'all'
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const from = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
            const to = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

            // Aylık toplam verileri için ay listesi oluştur
            const fromMonth = filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM') : '2000-01';
            const toMonth = filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM') : format(new Date(), 'yyyy-MM');
            
            const [manualData, repairData, allManualData, allRepairData, linesData, employeesData, monthlyData, dailyData] = await Promise.all([
                supabase.from('manual_production_records').select('*').gte('record_date', from).lte('record_date', to),
                supabase.from('repair_records').select('*').gte('record_date', from).lte('record_date', to),
                supabase.from('manual_production_records').select('*').order('record_date', { ascending: false }),
                supabase.from('repair_records').select('*').order('record_date', { ascending: false }),
                supabase.from('lines').select('*').eq('deleted', false),
                supabase.from('employees').select('*').eq('is_active', true),
                supabase.from('monthly_production_totals').select('*').gte('year_month', fromMonth).lte('year_month', toMonth),
                supabase.from('daily_production_totals').select('*').gte('date', from).lte('date', to)
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

            setManualRecords(manualData.data.map(rec => ({...rec, operator_name: employeeMap.get(rec.operator_id) || 'N/A', line_name: lineMap.get(rec.line_id) || 'N/A'})));
            setRepairRecords(repairData.data.map(rec => ({...rec, operator_name: employeeMap.get(rec.operator_id) || 'N/A', source_line_name: lineMap.get(rec.source_line_id) || 'N/A', repair_line_name: lineMap.get(rec.repair_line_id) || 'N/A'})));

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

            // Bu ay için manuel ve tamir kayıtlarını hesapla
            const monthRecords = manualRecords.filter(r => r.record_date.startsWith(year_month));
            const monthRepairs = repairRecords.filter(r => r.record_date.startsWith(year_month));
            
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
        const from = analysisFilters.dateRange?.from ? format(analysisFilters.dateRange.from, 'yyyy-MM-dd') : '2000-01-01';
        const to = analysisFilters.dateRange?.to ? format(analysisFilters.dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        
        // Vardiya otomatik hesaplama fonksiyonu (saat bazlı)
        const getShiftFromTime = (recordDatetime) => {
            if (!recordDatetime) return null;
            const date = new Date(recordDatetime);
            const hour = date.getHours();
            
            // 1. Vardiya: 08:00-16:00
            if (hour >= 8 && hour < 16) return 1;
            // 2. Vardiya: 16:00-00:00
            if (hour >= 16 || hour < 0) return 2;
            // 3. Vardiya: 00:00-08:00
            if (hour >= 0 && hour < 8) return 3;
            
            return null;
        };
        
        // Önce tüm kayıtları map'le ve calculatedShift ekle
        const allManualWithShift = allManualRecords
            .filter(r => r.record_date >= from && r.record_date <= to)
            .map(r => ({
                ...r,
                calculatedShift: r.shift || getShiftFromTime(r.created_at)
            }));
        
        const allRepairWithShift = allRepairRecords
            .filter(r => r.record_date >= from && r.record_date <= to)
            .map(r => ({
                ...r,
                calculatedShift: r.shift || getShiftFromTime(r.created_at)
            }));
        
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
    
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center"><BookUser className="mr-2 h-5 w-5"/>Manuel Veri Takip</CardTitle>
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
                                    <Button onClick={() => setShowDialog(true)}><Plus className="mr-2 h-4 w-4"/>Yeni Kayıt Ekle</Button>
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
                            }}><CalendarIcon className="mr-2 h-4 w-4"/>Aylık Toplam Gir</Button>
                            <Button variant="outline"><FileText className="h-4 w-4 mr-2" />Raporla</Button>
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
                                                    <span className={`text-xs ${
                                                        rec.ratio_source === 'daily' ? 'text-green-600' :
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
                                                <Button size="sm" variant="outline" onClick={() => handleViewDetails(rec.date)}><Eye className="h-4 w-4 mr-1"/>Detay</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(rec)}><Trash2 className="h-4 w-4 text-red-500"/></Button>
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
                        <DialogTitle>{viewingDetails ? `${format(new Date(viewingDetails.date), 'dd MMMM yyyy', {locale: tr})} Tarihli Kayıt Detayları` : 'Detaylar'}</DialogTitle>
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
                                                <td className="px-4 py-2"><Button variant="outline" size="sm" onClick={() => setEditingRecord({ ...rec, recordType: 'manual' })}><Edit className="h-4 w-4"/></Button></td>
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
                                                <td className="px-4 py-2"><Button variant="outline" size="sm" onClick={() => setEditingRecord({ ...rec, recordType: 'repair' })}><Edit className="h-4 w-4"/></Button></td>
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
                                            <SelectItem key={m} value={m}>{format(new Date(2000, Number(m)-1, 1), 'MMMM', { locale: tr })}</SelectItem>
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
                        <Button size="lg" onClick={handleSaveMonthlyTotal}><Save className="mr-2 h-5 w-5"/>Kaydet</Button>
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
                        <Button size="lg" onClick={handleSaveDailyTotal}><Save className="mr-2 h-5 w-5"/>Kaydet</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            </TabsContent>
            
            {/* Detaylı Analiz Sekmesi */}
            <TabsContent value="analysis" className="space-y-4">
                {/* Filtre ve Personel Seçimi */}
                <Card>
                    <CardHeader>
                        <CardTitle>Filtreleme ve Arama</CardTitle>
                        <CardDescription>Hızlı filtreler veya özel tarih aralığı seçin</CardDescription>
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
                                                    {format(analysisFilters.dateRange.from, "dd MMM", { locale: tr })} - {format(analysisFilters.dateRange.to, "dd MMM", { locale: tr })}
                                                    </>
                                                ) : (
                                                    format(analysisFilters.dateRange.from, "dd MMM", { locale: tr })
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
                
                {/* Özet KPI Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Toplam Üretim</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-700">
                                {(() => {
                                    const allManual = analysisData.allManualWithShift || [];
                                    const allRepair = analysisData.allRepairWithShift || [];
                                    return allManual.reduce((sum, r) => sum + (r.quantity || 0), 0) + 
                                           allRepair.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                })()} adet
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Tüm veriler</p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Toplam Kayıt</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-700">
                                {(() => {
                                    const allManual = analysisData.allManualWithShift || [];
                                    const allRepair = analysisData.allRepairWithShift || [];
                                    return allManual.length + allRepair.length;
                                })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Manuel + Tamir</p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Ortalama Üretim/Gün</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-orange-700">
                                {(() => {
                                    const allManual = analysisData.allManualWithShift || [];
                                    const allRepair = analysisData.allRepairWithShift || [];
                                    const uniqueDays = new Set([...allManual.map(r => r.record_date), ...allRepair.map(r => r.record_date)]).size;
                                    const totalQty = allManual.reduce((sum, r) => sum + (r.quantity || 0), 0) + allRepair.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    return uniqueDays > 0 ? Math.round(totalQty / uniqueDays) : 0;
                                })()}  adet
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Günlük ortalama</p>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Aktif Personel</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-purple-700">
                                {(() => {
                                    const allManual = analysisData.allManualWithShift || [];
                                    const allRepair = analysisData.allRepairWithShift || [];
                                    return new Set([...allManual.map(r => r.operator_id), ...allRepair.map(r => r.operator_id)]).size;
                                })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Üretim yapan</p>
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
                        <div className="space-y-4">
                            {[1, 2, 3].map(shift => {
                                // FİLTRELENMEMİŞ verileri kullan
                                const shiftManual = (analysisData.allManualWithShift || []).filter(r => r.calculatedShift === shift);
                                const shiftRepair = (analysisData.allRepairWithShift || []).filter(r => r.calculatedShift === shift);
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
                    </CardContent>
                </Card>
                
                {/* Top 10 ve Bottom 10 Personel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-green-700">🏆 Top 10 Personel</CardTitle>
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
                            <CardTitle className="text-red-700">⚠️ Bottom 10 Personel</CardTitle>
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