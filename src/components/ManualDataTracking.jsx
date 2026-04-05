import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookUser, Plus, Eye, Trash2, Save, Calendar as CalendarIcon, Calendar, FileText, Edit, Search, Factory, TrendingUp, Activity, Check, ListOrdered } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker, CLOSE_DATE_PICKERS_EVENT } from '@/components/ui/date-range-picker';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatCurrency, logAction, openPrintWindow } from '@/lib/utils';
import { addMonths, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const shiftOptions = [
    { value: '1', label: '1. Vardiya' },
    { value: '2', label: '2. Vardiya' },
    { value: '3', label: '3. Vardiya' },
];

const toSafeNumber = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
};

const getDateKey = (value) => String(value || '').slice(0, 10);

const getMonthKey = (value) => String(value || '').slice(0, 7);

const getNormalizedDateKey = (value, fallback) => {
    const dateValue = value ? new Date(value) : fallback;
    if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
        return format(fallback || new Date(), 'yyyy-MM-dd');
    }
    return format(dateValue, 'yyyy-MM-dd');
};

const getMonthKeysBetween = (fromDate, toDate) => {
    const keys = [];
    let cursor = startOfMonth(fromDate);
    const endCursor = startOfMonth(toDate);

    while (cursor <= endCursor) {
        keys.push(format(cursor, 'yyyy-MM'));
        cursor = addMonths(cursor, 1);
    }

    return keys;
};

const truncateText = (value, maxLength = 48) => {
    if (!value) return '-';
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
};

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
        <div className="flex flex-col h-full">
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 border border-indigo-100 rounded-xl bg-indigo-50/50">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-indigo-600" /> Tarih *
                        </Label>
                        <Input
                            type="date"
                            value={recordDate}
                            onChange={e => setRecordDate(e.target.value)}
                            className="h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Factory className="w-4 h-4 text-indigo-600" /> Vardiya *
                        </Label>
                        <Select value={shift} onValueChange={setShift}>
                            <SelectTrigger className="h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {shiftOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100 p-1 rounded-xl">
                        <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm text-base font-medium">Manuel Hat Kayıtları</TabsTrigger>
                        <TabsTrigger value="repair" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm text-base font-medium">Tamir Hattı Kayıtları</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            {manualRows.map((row, index) => (
                                <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all">
                                    <div className="md:col-span-3 space-y-1">
                                        <Label className="text-xs text-gray-500">Operatör</Label>
                                        <Combobox options={employeeOptions} value={row.operator_id} onSelect={v => handleRowChange(setManualRows, index, 'operator_id', v)} placeholder="Seçiniz..." searchPlaceholder="Ara..." emptyPlaceholder="Yok" className="h-10" />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs text-gray-500">Parça Kodu</Label>
                                        <Input className="h-10 border-gray-200 focus:border-indigo-500 rounded-lg" placeholder="Kod" value={row.part_code} onChange={e => handleRowChange(setManualRows, index, 'part_code', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs text-gray-500">Hat</Label>
                                        <Select value={row.line_id || ''} onValueChange={v => handleRowChange(setManualRows, index, 'line_id', v)}>
                                            <SelectTrigger className="h-10 border-gray-200 focus:border-indigo-500 rounded-lg">
                                                <SelectValue placeholder="Seç" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lines.filter(l => l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-1 space-y-1">
                                        <Label className="text-xs text-gray-500">Adet</Label>
                                        <Input className="h-10 border-gray-200 focus:border-indigo-500 rounded-lg text-center" type="number" placeholder="0" value={row.quantity} onChange={e => handleRowChange(setManualRows, index, 'quantity', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-1 space-y-1">
                                        <Label className="text-xs text-gray-500">Süre(s)</Label>
                                        <Input className="h-10 border-gray-200 focus:border-indigo-500 rounded-lg text-center" type="number" placeholder="0" value={row.duration_seconds} onChange={e => handleRowChange(setManualRows, index, 'duration_seconds', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs text-gray-500">Açıklama</Label>
                                        <Input className="h-10 border-gray-200 focus:border-indigo-500 rounded-lg" placeholder="Opsiyonel" value={row.description} onChange={e => handleRowChange(setManualRows, index, 'description', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-1 flex justify-center pb-1">
                                        <Button variant="ghost" size="icon" onClick={() => removeRow(setManualRows, index)} className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="h-5 w-5" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="lg" onClick={() => addRow(setManualRows)} className="w-full border-dashed border-2 border-gray-300 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 h-12 rounded-xl text-gray-500 transition-all">
                            <Plus className="h-5 w-5 mr-2" /> Yeni Satır Ekle
                        </Button>
                    </TabsContent>

                    <TabsContent value="repair" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            {repairRows.map((row, index) => (
                                <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-orange-200 hover:shadow-md transition-all">
                                    <div className="md:col-span-3 space-y-1">
                                        <Label className="text-xs text-gray-500">Operatör</Label>
                                        <Combobox options={employeeOptions} value={row.operator_id} onSelect={v => handleRowChange(setRepairRows, index, 'operator_id', v)} placeholder="Seçiniz..." searchPlaceholder="Ara..." emptyPlaceholder="Yok" className="h-10" />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs text-gray-500">Tamir Hattı</Label>
                                        <Select value={row.repair_line_id || ''} onValueChange={v => handleRowChange(setRepairRows, index, 'repair_line_id', v)}>
                                            <SelectTrigger className="h-10 border-gray-200 focus:border-orange-500 rounded-lg">
                                                <SelectValue placeholder="Seç" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lines.filter(l => l.type === 'repair' || l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs text-gray-500">Kaynak Hat</Label>
                                        <Select value={row.source_line_id || ''} onValueChange={v => handleRowChange(setRepairRows, index, 'source_line_id', v)}>
                                            <SelectTrigger className="h-10 border-gray-200 focus:border-orange-500 rounded-lg">
                                                <SelectValue placeholder="Seç" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-1 space-y-1">
                                        <Label className="text-xs text-gray-500">Adet</Label>
                                        <Input className="h-10 border-gray-200 focus:border-orange-500 rounded-lg text-center" type="number" placeholder="0" value={row.quantity} onChange={e => handleRowChange(setRepairRows, index, 'quantity', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-1 space-y-1">
                                        <Label className="text-xs text-gray-500">Süre(s)</Label>
                                        <Input className="h-10 border-gray-200 focus:border-orange-500 rounded-lg text-center" type="number" placeholder="0" value={row.duration_seconds} onChange={e => handleRowChange(setRepairRows, index, 'duration_seconds', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <Label className="text-xs text-gray-500">Açıklama</Label>
                                        <Input className="h-10 border-gray-200 focus:border-orange-500 rounded-lg" placeholder="Opsiyonel" value={row.description} onChange={e => handleRowChange(setRepairRows, index, 'description', e.target.value)} />
                                    </div>
                                    <div className="md:col-span-1 flex justify-center pb-1">
                                        <Button variant="ghost" size="icon" onClick={() => removeRow(setRepairRows, index)} className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="h-5 w-5" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" size="lg" onClick={() => addRow(setRepairRows, true)} className="w-full border-dashed border-2 border-gray-300 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600 h-12 rounded-xl text-gray-500 transition-all">
                            <Plus className="h-5 w-5 mr-2" /> Yeni Tamir Satırı Ekle
                        </Button>
                    </TabsContent>
                </Tabs>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-xl">
                <Button size="lg" onClick={handleSaveClick} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200/50 transition-all h-12 px-8 rounded-xl font-semibold">
                    <Save className="mr-2 h-5 w-5" /> Tümünü Kaydet
                </Button>
            </div>
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
        <div className="flex flex-col h-full">
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Operatör</Label>
                        <Combobox
                            options={employeeOptions}
                            value={formData.operator_id}
                            onSelect={v => handleChange('operator_id', v)}
                            placeholder="Operatör seçin"
                            searchPlaceholder="Personel ara..."
                            className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Vardiya</Label>
                        <Select value={String(formData.shift)} onValueChange={v => handleChange('shift', v)}>
                            <SelectTrigger className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>{shiftOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>

                {recordType === 'manual' && (
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Parça Kodu</Label>
                        <Input
                            value={formData.part_code}
                            onChange={e => handleChange('part_code', e.target.value)}
                            className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg font-medium"
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Adet</Label>
                        <Input
                            type="number"
                            value={formData.quantity}
                            onChange={e => handleChange('quantity', Number(e.target.value))}
                            className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Süre (saniye)</Label>
                        <Input
                            type="number"
                            value={formData.duration_seconds || 0}
                            onChange={e => handleChange('duration_seconds', Number(e.target.value))}
                            className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"
                        />
                    </div>
                </div>

                {recordType === 'manual' ? (
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">Hat</Label>
                        <Select value={formData.line_id || ''} onValueChange={v => handleChange('line_id', v)}>
                            <SelectTrigger className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"><SelectValue placeholder="Hat seçin" /></SelectTrigger>
                            <SelectContent>{lines.filter(l => l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Tamir Hattı</Label>
                            <Select value={formData.repair_line_id || ''} onValueChange={v => handleChange('repair_line_id', v)}>
                                <SelectTrigger className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"><SelectValue placeholder="Tamir Hattı" /></SelectTrigger>
                                <SelectContent>{lines.filter(l => l.type === 'repair' || l.type === 'manual').map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Kaynak Hat</Label>
                            <Select value={formData.source_line_id || ''} onValueChange={v => handleChange('source_line_id', v)}>
                                <SelectTrigger className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"><SelectValue placeholder="Kaynak Hat" /></SelectTrigger>
                                <SelectContent>{lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700">Açıklama</Label>
                    <Input
                        value={formData.description || ''}
                        onChange={e => handleChange('description', e.target.value)}
                        className="h-11 border-gray-300 focus:border-indigo-500 rounded-lg"
                        placeholder="İsteğe bağlı açıklama..."
                    />
                </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end rounded-b-xl">
                <Button
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200/50 transition-all h-12 px-8 rounded-xl font-semibold"
                >
                    <Save className="mr-2 h-5 w-5" /> Kaydet
                </Button>
            </div>
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
    /** null | { type: 'daily', date: string } | { type: 'row', id: string, recordType: 'manual' | 'repair' } */
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
    const [dailyLineCounts, setDailyLineCounts] = useState({}); // { 'yyyy-MM-dd': [{ line_id, production_qty }] }
    const [dailyLineFormData, setDailyLineFormData] = useState([]); // [{ line_id, line_name, production_qty }]

    const [filters, setFilters] = useState({
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
        partCode: '',
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

    // Hat bazlı üretim adetleri
    const [productionCounts, setProductionCounts] = useState([]);
    const [showProductionCountsDialog, setShowProductionCountsDialog] = useState(false);
    const [prodCountsFormData, setProdCountsFormData] = useState({
        year: format(new Date(), 'yyyy'),
        month: format(new Date(), 'MM'),
        entries: [] // { line_id, production_qty }
    });

    const lineNameMap = useMemo(
        () => new Map(lines.map(line => [line.id, line.name || 'Belirtilmemiş'])),
        [lines]
    );

    const employeeDisplayMap = useMemo(
        () => new Map(
            employees.map(employee => [
                employee.id,
                `${employee.registration_number ? `${employee.registration_number} - ` : ''}${employee.first_name} ${employee.last_name}`.trim()
            ])
        ),
        [employees]
    );

    const analysisRange = useMemo(() => {
        const defaultFrom = startOfMonth(new Date());
        const defaultTo = endOfMonth(new Date());
        const fromDate = analysisFilters.dateRange?.from && !Number.isNaN(new Date(analysisFilters.dateRange.from).getTime())
            ? new Date(analysisFilters.dateRange.from)
            : defaultFrom;
        const toDate = analysisFilters.dateRange?.to && !Number.isNaN(new Date(analysisFilters.dateRange.to).getTime())
            ? new Date(analysisFilters.dateRange.to)
            : defaultTo;

        return {
            fromDate,
            toDate,
            from: getNormalizedDateKey(fromDate, defaultFrom),
            to: getNormalizedDateKey(toDate, defaultTo),
            monthKeys: getMonthKeysBetween(fromDate, toDate)
        };
    }, [analysisFilters.dateRange]);

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

            const [manualData, repairData, linesData, employeesData, monthlyData, dailyData, dailyLineData, productionCountsData] = await Promise.all([
                supabase.from('manual_production_records').select('*').gte('record_date', from).lte('record_date', to),
                supabase.from('repair_records').select('*').gte('record_date', from).lte('record_date', to),
                supabase.from('lines').select('*').eq('deleted', false),
                supabase.from('employees').select('*').eq('is_active', true),
                supabase.from('monthly_production_totals').select('*'), // Tüm aylık toplamları al (detaylı analiz için)
                supabase.from('daily_production_totals').select('*'),
                supabase.from('daily_production_counts').select('*'),
                supabase.from('production_counts').select('*')
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

            // Günlük hat bazlı üretim adetleri map'e dönüştür
            const dailyLineMap = {};
            if (dailyLineData && dailyLineData.data) {
                dailyLineData.data.forEach(d => {
                    if (!dailyLineMap[d.date]) dailyLineMap[d.date] = [];
                    dailyLineMap[d.date].push(d);
                });
            }
            setDailyLineCounts(dailyLineMap);
            setProductionCounts(productionCountsData?.data || []);

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

    // Detaylı Analiz Raporu fonksiyonu
    const handleGenerateDetailedAnalysisReport = async () => {
        try {
            toast({ title: "Birleşik rapor hazırlanıyor...", description: "Tüm veriler, oranlar ve grafikler güncelleniyor." });

            const fromDateFormatted = format(analysisRange.fromDate, 'dd.MM.yyyy', { locale: tr });
            const toDateFormatted = format(analysisRange.toDate, 'dd.MM.yyyy', { locale: tr });
            const reportDateFormatted = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr });
            const daysDiff = Math.ceil((analysisRange.toDate - analysisRange.fromDate) / (1000 * 60 * 60 * 24)) + 1;
            const productionReferenceTotal = analysisSummary.monthlyRows.reduce((sum, row) => sum + row.totalProduction, 0);
            const repairRateBase = productionReferenceTotal > 0
                ? (analysisSummary.totalRepairQuantity / productionReferenceTotal) * 100
                : 0;

            const sections = [];

            if (analysisSummary.monthlyChartData.length > 0) {
                sections.push({
                    type: 'chart',
                    title: 'Aylık Üretim Dağılımı',
                    chartType: 'bar',
                    data: analysisSummary.monthlyChartData,
                    config: {
                        xAxisKey: 'month',
                        yAxisWidth: 64,
                        xAxisAngle: -25,
                        xAxisHeight: 60,
                        bars: [
                            { key: 'manualQuantity', name: 'Manuel Adet', color: '#2563eb', format: 'number' },
                            { key: 'repairQuantity', name: 'Tamir Adedi', color: '#f97316', format: 'number' }
                        ]
                    }
                });

                sections.push({
                    type: 'chart',
                    title: 'Aylık Toplam Maliyet Trendi',
                    chartType: 'line',
                    data: analysisSummary.monthlyChartData,
                    config: {
                        xAxisKey: 'month',
                        yAxisWidth: 80,
                        xAxisAngle: -25,
                        xAxisHeight: 60,
                        yAxisFormat: 'currency',
                        lines: [
                            { key: 'manualCost', name: 'Manuel Maliyet', color: '#2563eb', format: 'currency' },
                            { key: 'repairCost', name: 'Tamir Maliyeti', color: '#f97316', format: 'currency' },
                            { key: 'totalCost', name: 'Toplam Maliyet', color: '#059669', format: 'currency' }
                        ]
                    }
                });
            }

            if (analysisSummary.qualityChartData.length > 0) {
                sections.push({
                    type: 'chart',
                    title: 'Hat Bazlı Tamir Oranı',
                    chartType: 'bar',
                    data: analysisSummary.qualityChartData,
                    config: {
                        xAxisKey: 'name',
                        yAxisWidth: 70,
                        yAxisFormat: 'percent',
                        xAxisAngle: -25,
                        xAxisHeight: 70,
                        bars: [
                            { key: 'repairRate', name: 'Tamir Oranı', color: '#dc2626', format: 'percent' }
                        ]
                    }
                });
            }

            if (analysisSummary.totalManualQuantity > 0 || analysisSummary.totalRepairQuantity > 0) {
                sections.push({
                    type: 'chart',
                    title: 'Genel Üretim Dağılımı',
                    chartType: 'pie',
                    data: [
                        { name: 'Manuel Üretim', value: analysisSummary.totalManualQuantity },
                        { name: 'Tamir İşlemi', value: analysisSummary.totalRepairQuantity }
                    ],
                    config: {
                        dataKey: 'value',
                        nameKey: 'name'
                    }
                });
            }

            if (analysisSummary.monthlyRows.length > 0) {
                sections.push({
                    title: 'Aylık Üretim ve Maliyet Özeti',
                    tableData: {
                        headers: ['Ay', 'Manuel Adet', 'Tamir Adedi', 'Manuel Maliyet', 'Tamir Maliyeti', 'Toplam Maliyet', 'Aylık Üretim', 'Manuel Oran', 'Tamir Oranı', 'Personel'],
                        rows: analysisSummary.monthlyRows.map(row => [
                            row.monthName,
                            row.manualQuantity.toLocaleString('tr-TR'),
                            row.repairQuantity.toLocaleString('tr-TR'),
                            formatCurrency(row.manualCost),
                            formatCurrency(row.repairCost),
                            formatCurrency(row.totalCost),
                            row.totalProduction > 0 ? row.totalProduction.toLocaleString('tr-TR') : 'Girilmemiş',
                            row.totalProduction > 0 ? `%${row.manualRate.toFixed(2)}` : '-',
                            row.totalProduction > 0 ? `%${row.repairRate.toFixed(2)}` : '-',
                            row.employeeCount.toString()
                        ]),
                        options: {
                            columnWidths: ['15%', '9%', '9%', '11%', '11%', '11%', '10%', '8%', '8%', '8%'],
                            rightAlignColumns: [1, 2, 3, 4, 5, 6, 7, 8]
                        }
                    }
                });
            }

            if (analysisSummary.dailyRows.length > 0) {
                sections.push({
                    title: 'Günlük Operasyon Özeti',
                    tableData: {
                        headers: ['Tarih', 'Manuel Adet', 'Tamir Adedi', 'Manuel Maliyet', 'Tamir Maliyeti', 'Toplam Üretim', 'Tamir Oranı', 'Oran Kaynağı'],
                        rows: analysisSummary.dailyRows.map(row => [
                            format(new Date(row.date), 'dd.MM.yyyy', { locale: tr }),
                            row.manualQuantity.toLocaleString('tr-TR'),
                            row.repairQuantity.toLocaleString('tr-TR'),
                            formatCurrency(row.manualCost),
                            formatCurrency(row.repairCost),
                            row.totalProduction > 0 ? row.totalProduction.toLocaleString('tr-TR') : '-',
                            row.totalProduction > 0 ? `%${row.repairRate.toFixed(2)}` : '-',
                            row.ratioSource === 'daily' ? 'Günlük üretim' : row.ratioSource === 'monthly' ? 'Aylık üretim' : 'Kayıt toplamı'
                        ]),
                        options: {
                            columnWidths: ['13%', '11%', '11%', '13%', '13%', '12%', '10%', '17%'],
                            rightAlignColumns: [1, 2, 3, 4, 5, 6]
                        }
                    }
                });
            }

            if (analysisSummary.qualityAnalysis.length > 0) {
                sections.push({
                    title: 'Hat Bazlı Kalite Analizi (Tamir Oranları)',
                    tableData: {
                        headers: ['Sıra', 'Hat', 'Hat Toplam Üretim', 'Manuel Adet', 'Tamir Adedi', 'Manuel Oranı', 'Tamir Oranı', 'Veri Kaynağı'],
                        rows: analysisSummary.qualityAnalysis.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.totalProduction.toLocaleString('tr-TR'),
                            row.manual.toLocaleString('tr-TR'),
                            row.repair.toLocaleString('tr-TR'),
                            `%${row.manualRate.toFixed(2)}`,
                            `%${row.repairRate.toFixed(2)}`,
                            row.productionSource === 'monthly' ? 'Aylık hat üretimi' : row.productionSource === 'daily' ? 'Günlük hat üretimi' : 'Kayıt toplamı'
                        ]),
                        options: {
                            columnWidths: ['6%', '22%', '14%', '12%', '12%', '11%', '11%', '12%'],
                            rightAlignColumns: [2, 3, 4, 5, 6],
                            wrapColumns: [1, 7]
                        }
                    }
                });
            }

            if (analysisSummary.topManualLines.length > 0) {
                sections.push({
                    title: 'En Çok Manuele Gönderen Hatlar (Adet)',
                    tableData: {
                        headers: ['Sıra', 'Hat', 'Adet', 'Maliyet', 'Kayıt', 'Ort. Süre (sn)'],
                        rows: analysisSummary.topManualLines.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.quantity.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            row.records.toString(),
                            Math.round(row.duration / Math.max(1, row.records)).toString()
                        ]),
                        options: {
                            columnWidths: ['8%', '32%', '15%', '18%', '12%', '15%'],
                            rightAlignColumns: [2, 3, 4, 5]
                        }
                    }
                });
            }

            if (analysisSummary.topManualLinesByCost.length > 0) {
                sections.push({
                    title: 'Hat Bazlı Maliyet Analizi (Manuel)',
                    tableData: {
                        headers: ['Sıra', 'Hat', 'Adet', 'Maliyet', 'Kayıt', 'Ort. Süre (sn)'],
                        rows: analysisSummary.topManualLinesByCost.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.quantity.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            row.records.toString(),
                            Math.round(row.duration / Math.max(1, row.records)).toString()
                        ]),
                        options: {
                            columnWidths: ['8%', '32%', '15%', '18%', '12%', '15%'],
                            rightAlignColumns: [2, 3, 4, 5]
                        }
                    }
                });
            }

            if (analysisSummary.topRepairSourceLines.length > 0) {
                sections.push({
                    title: 'En Çok Tamire Gönderen Kaynak Hatlar (Adet)',
                    tableData: {
                        headers: ['Sıra', 'Kaynak Hat', 'Tamir Adedi', 'Tamir Maliyeti', 'Kayıt', 'Ort. Süre (sn)'],
                        rows: analysisSummary.topRepairSourceLines.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.quantity.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            row.records.toString(),
                            Math.round(row.duration / Math.max(1, row.records)).toString()
                        ]),
                        options: {
                            columnWidths: ['8%', '32%', '15%', '18%', '12%', '15%'],
                            rightAlignColumns: [2, 3, 4, 5]
                        }
                    }
                });
            }

            if (analysisSummary.topRepairSourceLinesByCost.length > 0) {
                sections.push({
                    title: 'Hat Bazlı Maliyet Analizi (Tamir)',
                    tableData: {
                        headers: ['Sıra', 'Kaynak Hat', 'Tamir Adedi', 'Tamir Maliyeti', 'Kayıt', 'Ort. Süre (sn)'],
                        rows: analysisSummary.topRepairSourceLinesByCost.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.quantity.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            row.records.toString(),
                            Math.round(row.duration / Math.max(1, row.records)).toString()
                        ]),
                        options: {
                            columnWidths: ['8%', '32%', '15%', '18%', '12%', '15%'],
                            rightAlignColumns: [2, 3, 4, 5]
                        }
                    }
                });
            }

            sections.push({
                title: 'Vardiya Bazlı Analiz',
                tableData: {
                    headers: ['Vardiya', 'Manuel Adet', 'Tamir Adedi', 'Manuel Maliyet', 'Tamir Maliyeti', 'Toplam Kayıt'],
                    rows: [1, 2, 3].map(shift => {
                        const shiftRow = analysisSummary.shiftStats[shift];
                        return [
                            getShiftLabel(shift),
                            shiftRow.manualQuantity.toLocaleString('tr-TR'),
                            shiftRow.repairQuantity.toLocaleString('tr-TR'),
                            formatCurrency(shiftRow.manualCost),
                            formatCurrency(shiftRow.repairCost),
                            (shiftRow.manualRecords + shiftRow.repairRecords).toString()
                        ];
                    }),
                    options: {
                        columnWidths: ['18%', '16%', '16%', '16%', '16%', '18%'],
                        rightAlignColumns: [1, 2, 3, 4, 5]
                    }
                }
            });

            if (analysisSummary.topEmployees.length > 0) {
                sections.push({
                    title: 'Top 10 Personel (En Yüksek Üretim)',
                    tableData: {
                        headers: ['Sıra', 'Personel', 'Toplam Adet', 'Manuel', 'Tamir', 'Maliyet', 'Kayıt'],
                        rows: analysisSummary.topEmployees.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.quantity.toLocaleString('tr-TR'),
                            row.manualQuantity.toLocaleString('tr-TR'),
                            row.repairQuantity.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            row.records.toString()
                        ]),
                        options: {
                            columnWidths: ['7%', '35%', '12%', '12%', '12%', '14%', '8%'],
                            rightAlignColumns: [2, 3, 4, 5, 6],
                            wrapColumns: [1]
                        }
                    }
                });
            }

            if (analysisSummary.bottomEmployees.length > 0) {
                sections.push({
                    title: 'Bottom 10 Personel (En Düşük Üretim)',
                    tableData: {
                        headers: ['Sıra', 'Personel', 'Toplam Adet', 'Manuel', 'Tamir', 'Maliyet', 'Kayıt'],
                        rows: analysisSummary.bottomEmployees.map((row, index) => [
                            (index + 1).toString(),
                            row.name,
                            row.quantity.toLocaleString('tr-TR'),
                            row.manualQuantity.toLocaleString('tr-TR'),
                            row.repairQuantity.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            row.records.toString()
                        ]),
                        options: {
                            columnWidths: ['7%', '35%', '12%', '12%', '12%', '14%', '8%'],
                            rightAlignColumns: [2, 3, 4, 5, 6],
                            wrapColumns: [1]
                        }
                    }
                });
            }

            if (analysisSummary.employeeRows.length > 0) {
                sections.push({
                    title: 'Tüm Personel Performans Özeti',
                    tableData: {
                        headers: ['Sıra', 'Personel', 'Toplam Adet', 'Manuel', 'Tamir', 'Toplam Maliyet', 'Kayıt', 'Ort. Süre (sn)'],
                        rows: [...analysisSummary.employeeRows]
                            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                            .map((row, index) => [
                                (index + 1).toString(),
                                row.name,
                                row.quantity.toLocaleString('tr-TR'),
                                row.manualQuantity.toLocaleString('tr-TR'),
                                row.repairQuantity.toLocaleString('tr-TR'),
                                formatCurrency(row.cost),
                                row.records.toString(),
                                Math.round(row.duration / Math.max(1, row.records)).toString()
                            ]),
                        options: {
                            columnWidths: ['6%', '30%', '11%', '10%', '10%', '13%', '8%', '12%'],
                            rightAlignColumns: [2, 3, 4, 5, 6, 7],
                            wrapColumns: [1]
                        }
                    }
                });
            }

            if (analysisSummary.partEfficiencyRows.length > 0) {
                sections.push({
                    title: 'Parça Bazlı Verimlilik',
                    tableData: {
                        headers: ['Sıra', 'Parça Kodu', 'Toplam Adet', 'Ort. Süre (sn/adet)', 'Toplam Süre (sn)', 'Kayıt', 'Personel'],
                        rows: analysisSummary.partEfficiencyRows.map((row, index) => [
                            (index + 1).toString(),
                            row.code,
                            row.quantity.toLocaleString('tr-TR'),
                            row.averageDuration.toFixed(1),
                            row.duration.toLocaleString('tr-TR'),
                            row.records.toString(),
                            row.employeeCount.toString()
                        ]),
                        options: {
                            columnWidths: ['6%', '24%', '13%', '15%', '15%', '11%', '16%'],
                            rightAlignColumns: [2, 3, 4, 5, 6],
                            wrapColumns: [1]
                        }
                    }
                });
            }

            if (analysisSummary.bhTopParts.length > 0) {
                sections.push({
                    title: 'BH Kodu ile Başlayan Top 20 Parça',
                    tableData: {
                        headers: ['Sıra', 'Parça Kodu', 'Adet', 'Kayıt', 'Personel'],
                        rows: analysisSummary.bhTopParts.map((row, index) => [
                            (index + 1).toString(),
                            row.code,
                            row.quantity.toLocaleString('tr-TR'),
                            row.records.toString(),
                            row.employeeCount.toString()
                        ]),
                        options: {
                            columnWidths: ['8%', '38%', '18%', '18%', '18%'],
                            rightAlignColumns: [2, 3, 4]
                        }
                    }
                });
            }

            if (analysisSummary.recordDetailRows.length > 0) {
                sections.push({
                    title: 'Kayıt Detay Listesi',
                    tableData: {
                        headers: ['Tarih', 'Tip', 'Vardiya', 'Operatör', 'Hat', 'Parça', 'Adet', 'Süre (sn)', 'Maliyet', 'Açıklama'],
                        rows: analysisSummary.recordDetailRows.map(row => [
                            format(new Date(row.date), 'dd.MM.yyyy', { locale: tr }),
                            row.type,
                            row.shift,
                            row.operator,
                            row.line,
                            row.partCode,
                            row.quantity.toLocaleString('tr-TR'),
                            row.duration.toLocaleString('tr-TR'),
                            formatCurrency(row.cost),
                            truncateText(row.description)
                        ]),
                        options: {
                            compact: true,
                            columnWidths: ['9%', '7%', '9%', '16%', '20%', '10%', '8%', '8%', '10%', '13%'],
                            rightAlignColumns: [6, 7, 8],
                            wrapColumns: [3, 4, 9]
                        }
                    }
                });
            }

            const reportId = `RPR-MANUAL-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
            const reportData = {
                title: 'Manuel Veri Takibi - Birleşik Analiz Raporu',
                reportId,
                landscape: true,
                filters: {
                    'Rapor Tarihi': reportDateFormatted,
                    'Rapor Dönemi': `${fromDateFormatted} - ${toDateFormatted}`,
                    'Seçili Vardiya': analysisFilters.shift !== 'all' ? getShiftLabel(analysisFilters.shift) : 'Tümü',
                    'Seçili Personel': analysisFilters.employee !== 'all' ? (employeeDisplayMap.get(analysisFilters.employee) || 'Seçili personel') : 'Tümü',
                    'Toplam Gün': `${daysDiff} gün`
                },
                kpiCards: [
                    { title: 'Toplam Manuel Üretim', value: `${analysisSummary.totalManualQuantity.toLocaleString('tr-TR')} adet` },
                    { title: 'Toplam Tamir Adedi', value: `${analysisSummary.totalRepairQuantity.toLocaleString('tr-TR')} adet` },
                    { title: 'Toplam Maliyet', value: formatCurrency(analysisSummary.totalCost) },
                    { title: 'Girilen Toplam Üretim', value: productionReferenceTotal > 0 ? `${productionReferenceTotal.toLocaleString('tr-TR')} adet` : 'Girilmemiş' },
                    { title: 'Tamir Oranı', value: productionReferenceTotal > 0 ? `%${repairRateBase.toFixed(2)}` : '-' },
                    { title: 'Ortalama Günlük Üretim', value: `${analysisSummary.averageDailyProduction.toLocaleString('tr-TR')} adet` },
                    { title: 'Aylık Ort. Maliyet', value: formatCurrency(analysisSummary.averageMonthlyCost) },
                    { title: 'Toplam Süre', value: `${Math.floor(analysisSummary.totalDuration / 3600)} saat ${Math.floor((analysisSummary.totalDuration % 3600) / 60)} dk` },
                    { title: 'Toplam Kayıt', value: analysisSummary.totalRecords.toLocaleString('tr-TR') },
                    { title: 'Toplam Personel', value: analysisSummary.totalEmployees.toString() }
                ],
                sections,
                signatureFields: [
                    { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
                    { title: 'Kontrol Eden', name: '', role: '..................' },
                    { title: 'Onaylayan', name: '', role: '..................' }
                ]
            };

            await openPrintWindow(reportData, toast);
            toast({ title: "Rapor Hazır", description: "Birleşik analiz raporu başarıyla oluşturuldu." });
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

        if (deleteConfirm.type === 'row') {
            const tableName = deleteConfirm.recordType === 'manual' ? 'manual_production_records' : 'repair_records';
            const { error } = await supabase.from(tableName).delete().eq('id', deleteConfirm.id);

            if (error) {
                toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
                return;
            }

            toast({
                title: "Silindi",
                description: deleteConfirm.recordType === 'manual' ? "Manuel kayıt silindi." : "Tamir kaydı silindi.",
                variant: "destructive"
            });
            logAction(
                'DELETE_SINGLE_MANUAL_REPAIR_RECORD',
                `${deleteConfirm.recordType === 'manual' ? 'Manuel' : 'Tamir'} kayıt ${deleteConfirm.id} silindi.`,
                user
            );

            if (editingRecord?.id === deleteConfirm.id) {
                setEditingRecord(null);
            }

            if (viewingDetails) {
                if (deleteConfirm.recordType === 'manual') {
                    setViewingDetails({
                        ...viewingDetails,
                        manuals: viewingDetails.manuals.filter(r => r.id !== deleteConfirm.id)
                    });
                } else {
                    setViewingDetails({
                        ...viewingDetails,
                        repairs: viewingDetails.repairs.filter(r => r.id !== deleteConfirm.id)
                    });
                }
            }

            if (deleteConfirm.recordType === 'manual') {
                setManualRecords(prev => prev.filter(r => r.id !== deleteConfirm.id));
            } else {
                setRepairRecords(prev => prev.filter(r => r.id !== deleteConfirm.id));
            }

            setDeleteConfirm(null);
            fetchData();
            return;
        }

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

    // Maliyet hesaplama fonksiyonu (süre bazlı, eski kayıt maliyetlerini de korur)
    const calculateCost = useCallback((quantity, lineId, durationSeconds = 0, fallbackCost = 0) => {
        const line = lines.find(l => l.id === lineId);
        const lineCost = Array.isArray(line?.costs)
            ? [...line.costs].sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom))[0]
            : line?.costs;

        const quantityValue = toSafeNumber(quantity);
        const durationValue = toSafeNumber(durationSeconds);
        const fallbackValue = toSafeNumber(fallbackCost);
        const totalCostPerSecond = toSafeNumber(lineCost?.totalCostPerSecond);

        if (quantityValue > 0 && durationValue > 0 && totalCostPerSecond > 0) {
            return quantityValue * durationValue * totalCostPerSecond;
        }

        return fallbackValue;
    }, [lines]);

    const getManualRecordCost = useCallback(
        (record) => calculateCost(
            record?.quantity,
            record?.line_id,
            record?.duration_seconds,
            record?.manual_cost ?? record?.total_cost ?? 0
        ),
        [calculateCost]
    );

    const getRepairRecordCost = useCallback(
        (record) => calculateCost(
            record?.quantity,
            record?.repair_line_id,
            record?.duration_seconds,
            record?.repair_cost ?? record?.total_cost ?? 0
        ),
        [calculateCost]
    );

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

    // Günlük toplam kaydetme (hat bazlı üretim adetleri ile)
    const handleSaveDailyTotal = async () => {
        try {
            const { date } = dailyFormData;

            if (!date) {
                toast({ title: "Hata", description: "Lütfen tarihi seçin", variant: "destructive" });
                return;
            }

            // Hat bazlı üretim adetlerinden toplam hesapla
            const lineEntries = dailyLineFormData.filter(e => e.production_qty && Number(e.production_qty) > 0);
            const totalFromLines = lineEntries.reduce((sum, e) => sum + Number(e.production_qty), 0);

            // Eğer hat bazlı giriş yapılmadıysa ve manuel total_production da yoksa hata ver
            const total_production = totalFromLines > 0 ? totalFromLines : Number(dailyFormData.total_production) || 0;

            if (total_production <= 0) {
                toast({ title: "Hata", description: "Lütfen en az bir hat için üretim adedi girin", variant: "destructive" });
                return;
            }

            // Bu gün için manuel ve tamir kayıtlarını hesapla
            const dayManuals = manualRecords.filter(r => r.record_date === date);
            const dayRepairs = repairRecords.filter(r => r.record_date === date);

            const totalManual = dayManuals.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalRepair = dayRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);

            // 1) daily_production_totals tablosuna toplam kaydet
            const { data: existing } = await supabase
                .from('daily_production_totals')
                .select('*')
                .eq('date', date)
                .single();

            let result;
            if (existing) {
                result = await supabase
                    .from('daily_production_totals')
                    .update({
                        total_production: total_production,
                        total_manual: totalManual,
                        total_repair: totalRepair,
                        updated_at: new Date().toISOString()
                    })
                    .eq('date', date);
            } else {
                result = await supabase
                    .from('daily_production_totals')
                    .insert({
                        date,
                        total_production: total_production,
                        total_manual: totalManual,
                        total_repair: totalRepair
                    });
            }

            if (result.error) throw result.error;

            // 2) daily_production_counts tablosuna hat bazlı kaydet
            if (lineEntries.length > 0) {
                for (const entry of lineEntries) {
                    const { data: existingLine } = await supabase
                        .from('daily_production_counts')
                        .select('id')
                        .eq('date', date)
                        .eq('line_id', entry.line_id)
                        .single();

                    if (existingLine) {
                        await supabase
                            .from('daily_production_counts')
                            .update({ production_qty: Number(entry.production_qty), updated_at: new Date().toISOString() })
                            .eq('id', existingLine.id);
                    } else {
                        await supabase
                            .from('daily_production_counts')
                            .insert({
                                date,
                                line_id: entry.line_id,
                                production_qty: Number(entry.production_qty)
                            });
                    }
                }
            }

            toast({ title: "Başarılı", description: `${format(new Date(date), 'dd.MM.yyyy')}: ${total_production} adet üretim kaydedildi (${lineEntries.length} hat)` });
            logAction('SAVE_DAILY_TOTAL', `${date}: Üretim ${total_production}, ${lineEntries.length} hat`, user);
            setShowDailyDialog(false);
            fetchData();
        } catch (error) {
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        }
    };

    // Hat bazlı üretim adetleri dialog aç
    const openProductionCountsDialog = async () => {
        const yearMonth = `${format(new Date(), 'yyyy')}-${format(new Date(), 'MM')}`;
        try {
            const { data: existing } = await supabase
                .from('production_counts')
                .select('*')
                .eq('year_month', yearMonth);

            const entries = lines.map(l => {
                const found = (existing || []).find(e => e.line_id === l.id);
                return { line_id: l.id, line_name: l.name, production_qty: found ? String(found.production_qty) : '' };
            });

            setProdCountsFormData({
                year: format(new Date(), 'yyyy'),
                month: format(new Date(), 'MM'),
                entries
            });
            setShowProductionCountsDialog(true);
        } catch (error) {
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        }
    };

    // Hat bazlı üretim adetleri dialog (ay değişince)
    const updateProductionCountsMonth = async (year, month) => {
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        try {
            const { data: existing } = await supabase
                .from('production_counts')
                .select('*')
                .eq('year_month', yearMonth);

            const entries = lines.map(l => {
                const found = (existing || []).find(e => e.line_id === l.id);
                return { line_id: l.id, line_name: l.name, production_qty: found ? String(found.production_qty) : '' };
            });

            setProdCountsFormData(prev => ({ ...prev, year, month, entries }));
        } catch (error) {
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        }
    };

    // Hat bazlı üretim adetlerini kaydet
    const handleSaveProductionCounts = async () => {
        try {
            const yearMonth = `${prodCountsFormData.year}-${String(prodCountsFormData.month).padStart(2, '0')}`;
            const entriesToSave = prodCountsFormData.entries
                .filter(e => e.production_qty && Number(e.production_qty) > 0)
                .map(e => ({
                    year_month: yearMonth,
                    line_id: e.line_id,
                    production_qty: Number(e.production_qty),
                    updated_at: new Date().toISOString()
                }));

            if (entriesToSave.length === 0) {
                toast({ title: "Uyarı", description: "En az bir hat için üretim adedi girin.", variant: "destructive" });
                return;
            }

            // Upsert - her hat için
            for (const entry of entriesToSave) {
                const { data: existing } = await supabase
                    .from('production_counts')
                    .select('id')
                    .eq('year_month', entry.year_month)
                    .eq('line_id', entry.line_id)
                    .single();

                if (existing) {
                    await supabase
                        .from('production_counts')
                        .update({ production_qty: entry.production_qty, updated_at: entry.updated_at })
                        .eq('id', existing.id);
                } else {
                    await supabase
                        .from('production_counts')
                        .insert(entry);
                }
            }

            toast({ title: "Başarılı", description: `${yearMonth}: ${entriesToSave.length} hat için üretim adetleri kaydedildi.` });
            logAction('SAVE_PRODUCTION_COUNTS', `${yearMonth}: ${entriesToSave.length} hat`, user);
            setShowProductionCountsDialog(false);
            fetchData();
        } catch (error) {
            toast({ title: "Hata", description: error.message, variant: "destructive" });
        }
    };

    // Analiz sekmesi için filtrelenmiş veriler
    const analysisData = useMemo(() => {
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
                const recordDate = getDateKey(r.record_date);
                return recordDate >= analysisRange.from && recordDate <= analysisRange.to;
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
                const recordDate = getDateKey(r.record_date);
                return recordDate >= analysisRange.from && recordDate <= analysisRange.to;
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

        let employeeFilteredManual = allManualWithShift;
        let employeeFilteredRepair = allRepairWithShift;

        if (analysisFilters.employee !== 'all') {
            employeeFilteredManual = employeeFilteredManual.filter(r => r.operator_id === analysisFilters.employee);
            employeeFilteredRepair = employeeFilteredRepair.filter(r => r.operator_id === analysisFilters.employee);
        }

        let filteredManual = employeeFilteredManual;
        let filteredRepair = employeeFilteredRepair;

        if (analysisFilters.shift !== 'all') {
            const shiftNum = parseInt(analysisFilters.shift, 10);
            filteredManual = filteredManual.filter(r => r.calculatedShift === shiftNum);
            filteredRepair = filteredRepair.filter(r => r.calculatedShift === shiftNum);
        }

        return {
            manual: filteredManual,
            repair: filteredRepair,
            // Vardiya analizi için tarih ve personel filtresi uygulanmış veriler
            allManualWithShift: employeeFilteredManual,
            allRepairWithShift: employeeFilteredRepair
        };
    }, [allManualRecords, allRepairRecords, analysisFilters, analysisRange]);

    const analysisSummary = useMemo(() => {
        const manualRecords = analysisData.manual || [];
        const repairRecords = analysisData.repair || [];
        const shiftManualRecords = analysisData.allManualWithShift || [];
        const shiftRepairRecords = analysisData.allRepairWithShift || [];
        const allSelectedRecords = [...manualRecords, ...repairRecords];

        const totalManualQuantity = manualRecords.reduce((sum, record) => sum + toSafeNumber(record.quantity), 0);
        const totalRepairQuantity = repairRecords.reduce((sum, record) => sum + toSafeNumber(record.quantity), 0);
        const totalManualCost = manualRecords.reduce((sum, record) => sum + getManualRecordCost(record), 0);
        const totalRepairCost = repairRecords.reduce((sum, record) => sum + getRepairRecordCost(record), 0);
        const totalDuration = allSelectedRecords.reduce((sum, record) => sum + toSafeNumber(record.duration_seconds), 0);

        const uniqueEmployees = new Set(
            allSelectedRecords
                .map(record => record.operator_id)
                .filter(operatorId => operatorId && operatorId !== 'unknown')
        );
        const uniqueDays = new Set(allSelectedRecords.map(record => getDateKey(record.record_date)).filter(Boolean)).size;
        const uniqueMonths = new Set(allSelectedRecords.map(record => getMonthKey(record.record_date)).filter(Boolean)).size;

        const monthlyStatsMap = {};
        const ensureMonthlyEntry = (yearMonth) => {
            if (!yearMonth) return null;
            if (!monthlyStatsMap[yearMonth]) {
                monthlyStatsMap[yearMonth] = {
                    yearMonth,
                    monthLabel: format(new Date(`${yearMonth}-01`), 'MMM yyyy', { locale: tr }),
                    monthName: format(new Date(`${yearMonth}-01`), 'MMMM yyyy', { locale: tr }),
                    manualQuantity: 0,
                    manualCost: 0,
                    repairQuantity: 0,
                    repairCost: 0,
                    employees: new Set()
                };
            }
            return monthlyStatsMap[yearMonth];
        };

        analysisRange.monthKeys.forEach(ensureMonthlyEntry);

        manualRecords.forEach(record => {
            const monthKey = getMonthKey(record.record_date);
            const monthEntry = ensureMonthlyEntry(monthKey);
            if (!monthEntry) return;

            monthEntry.manualQuantity += toSafeNumber(record.quantity);
            monthEntry.manualCost += getManualRecordCost(record);
            if (record.operator_id && record.operator_id !== 'unknown') {
                monthEntry.employees.add(record.operator_id);
            }
        });

        repairRecords.forEach(record => {
            const monthKey = getMonthKey(record.record_date);
            const monthEntry = ensureMonthlyEntry(monthKey);
            if (!monthEntry) return;

            monthEntry.repairQuantity += toSafeNumber(record.quantity);
            monthEntry.repairCost += getRepairRecordCost(record);
            if (record.operator_id && record.operator_id !== 'unknown') {
                monthEntry.employees.add(record.operator_id);
            }
        });

        const monthlyRows = Object.values(monthlyStatsMap)
            .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
            .filter(entry => {
                const hasRecords = entry.manualQuantity > 0 || entry.repairQuantity > 0;
                const hasProduction = toSafeNumber(monthlyTotals[entry.yearMonth]?.total_production) > 0;
                return hasRecords || hasProduction;
            })
            .map(entry => {
                const totalProduction = toSafeNumber(monthlyTotals[entry.yearMonth]?.total_production);
                const totalCost = entry.manualCost + entry.repairCost;
                return {
                    ...entry,
                    totalProduction,
                    totalCost,
                    manualRate: totalProduction > 0 ? (entry.manualQuantity / totalProduction) * 100 : 0,
                    repairRate: totalProduction > 0 ? (entry.repairQuantity / totalProduction) * 100 : 0,
                    employeeCount: entry.employees.size
                };
            });

        const dailyStatsMap = {};
        const ensureDailyEntry = (dateKey) => {
            if (!dateKey) return null;
            if (!dailyStatsMap[dateKey]) {
                dailyStatsMap[dateKey] = {
                    date: dateKey,
                    manualQuantity: 0,
                    manualCost: 0,
                    manualRecords: 0,
                    repairQuantity: 0,
                    repairCost: 0,
                    repairRecords: 0
                };
            }
            return dailyStatsMap[dateKey];
        };

        manualRecords.forEach(record => {
            const dateKey = getDateKey(record.record_date);
            const dayEntry = ensureDailyEntry(dateKey);
            if (!dayEntry) return;

            dayEntry.manualQuantity += toSafeNumber(record.quantity);
            dayEntry.manualCost += getManualRecordCost(record);
            dayEntry.manualRecords += 1;
        });

        repairRecords.forEach(record => {
            const dateKey = getDateKey(record.record_date);
            const dayEntry = ensureDailyEntry(dateKey);
            if (!dayEntry) return;

            dayEntry.repairQuantity += toSafeNumber(record.quantity);
            dayEntry.repairCost += getRepairRecordCost(record);
            dayEntry.repairRecords += 1;
        });

        Object.keys(dailyTotals)
            .filter(dateKey => dateKey >= analysisRange.from && dateKey <= analysisRange.to)
            .forEach(ensureDailyEntry);

        const dailyRows = Object.values(dailyStatsMap)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(entry => {
                const dayTotal = dailyTotals[entry.date];
                const monthTotal = monthlyTotals[getMonthKey(entry.date)];
                const dailyProduction = toSafeNumber(dayTotal?.total_production);
                const monthlyProduction = toSafeNumber(monthTotal?.total_production);
                const recordProduction = entry.manualQuantity + entry.repairQuantity;
                const denominator = dailyProduction || monthlyProduction || recordProduction;
                const ratioSource = dailyProduction > 0 ? 'daily' : monthlyProduction > 0 ? 'monthly' : 'record';

                return {
                    ...entry,
                    totalProduction: denominator,
                    totalCost: entry.manualCost + entry.repairCost,
                    manualRate: denominator > 0 ? (entry.manualQuantity / denominator) * 100 : 0,
                    repairRate: denominator > 0 ? (entry.repairQuantity / denominator) * 100 : 0,
                    ratioSource
                };
            })
            .filter(entry =>
                entry.manualQuantity > 0 ||
                entry.repairQuantity > 0 ||
                entry.totalProduction > 0
            );

        const manualByLine = manualRecords.reduce((accumulator, record) => {
            const lineName = lineNameMap.get(record.line_id) || 'Belirtilmemiş';
            if (!accumulator[lineName]) {
                accumulator[lineName] = { name: lineName, quantity: 0, cost: 0, records: 0, duration: 0 };
            }
            accumulator[lineName].quantity += toSafeNumber(record.quantity);
            accumulator[lineName].cost += getManualRecordCost(record);
            accumulator[lineName].records += 1;
            accumulator[lineName].duration += toSafeNumber(record.duration_seconds);
            return accumulator;
        }, {});

        const repairBySourceLine = repairRecords.reduce((accumulator, record) => {
            const lineName = lineNameMap.get(record.source_line_id) || 'Belirtilmemiş';
            if (!accumulator[lineName]) {
                accumulator[lineName] = { name: lineName, quantity: 0, cost: 0, records: 0, duration: 0 };
            }
            accumulator[lineName].quantity += toSafeNumber(record.quantity);
            accumulator[lineName].cost += getRepairRecordCost(record);
            accumulator[lineName].records += 1;
            accumulator[lineName].duration += toSafeNumber(record.duration_seconds);
            return accumulator;
        }, {});

        const topManualLines = Object.values(manualByLine).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        const topManualLinesByCost = Object.values(manualByLine).sort((a, b) => b.cost - a.cost).slice(0, 10);
        const topRepairSourceLines = Object.values(repairBySourceLine).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        const topRepairSourceLinesByCost = Object.values(repairBySourceLine).sort((a, b) => b.cost - a.cost).slice(0, 10);

        const productionFromMonthlyCounts = {};
        productionCounts
            .filter(entry => analysisRange.monthKeys.includes(entry.year_month))
            .forEach(entry => {
                const lineName = lineNameMap.get(entry.line_id) || 'Belirtilmemiş';
                productionFromMonthlyCounts[lineName] = (productionFromMonthlyCounts[lineName] || 0) + toSafeNumber(entry.production_qty);
            });

        const productionFromDailyCounts = {};
        Object.entries(dailyLineCounts)
            .filter(([dateKey]) => dateKey >= analysisRange.from && dateKey <= analysisRange.to)
            .forEach(([, entries]) => {
                entries.forEach(entry => {
                    const lineName = lineNameMap.get(entry.line_id) || 'Belirtilmemiş';
                    productionFromDailyCounts[lineName] = (productionFromDailyCounts[lineName] || 0) + toSafeNumber(entry.production_qty);
                });
            });

        const lineQualityStats = {};
        manualRecords.forEach(record => {
            const lineName = lineNameMap.get(record.line_id) || 'Belirtilmemiş';
            if (!lineQualityStats[lineName]) {
                lineQualityStats[lineName] = { name: lineName, manual: 0, repair: 0 };
            }
            lineQualityStats[lineName].manual += toSafeNumber(record.quantity);
        });
        repairRecords.forEach(record => {
            const lineName = lineNameMap.get(record.source_line_id) || 'Belirtilmemiş';
            if (!lineQualityStats[lineName]) {
                lineQualityStats[lineName] = { name: lineName, manual: 0, repair: 0 };
            }
            lineQualityStats[lineName].repair += toSafeNumber(record.quantity);
        });

        const qualityAnalysis = Object.values(lineQualityStats)
            .map(entry => {
                const monthlyProduction = productionFromMonthlyCounts[entry.name] || 0;
                const dailyProduction = productionFromDailyCounts[entry.name] || 0;
                const totalProduction = monthlyProduction || dailyProduction || (entry.manual + entry.repair);
                const productionSource = monthlyProduction > 0 ? 'monthly' : dailyProduction > 0 ? 'daily' : 'record';

                return {
                    ...entry,
                    totalProduction,
                    productionSource,
                    manualRate: totalProduction > 0 ? (entry.manual / totalProduction) * 100 : 0,
                    repairRate: totalProduction > 0 ? (entry.repair / totalProduction) * 100 : 0
                };
            })
            .sort((a, b) => b.repairRate - a.repairRate);

        const shiftStats = {
            1: { manualQuantity: 0, manualCost: 0, manualRecords: 0, repairQuantity: 0, repairCost: 0, repairRecords: 0 },
            2: { manualQuantity: 0, manualCost: 0, manualRecords: 0, repairQuantity: 0, repairCost: 0, repairRecords: 0 },
            3: { manualQuantity: 0, manualCost: 0, manualRecords: 0, repairQuantity: 0, repairCost: 0, repairRecords: 0 }
        };

        shiftManualRecords.forEach(record => {
            const shiftKey = toSafeNumber(record.calculatedShift);
            if (!shiftStats[shiftKey]) return;
            shiftStats[shiftKey].manualQuantity += toSafeNumber(record.quantity);
            shiftStats[shiftKey].manualCost += getManualRecordCost(record);
            shiftStats[shiftKey].manualRecords += 1;
        });

        shiftRepairRecords.forEach(record => {
            const shiftKey = toSafeNumber(record.calculatedShift);
            if (!shiftStats[shiftKey]) return;
            shiftStats[shiftKey].repairQuantity += toSafeNumber(record.quantity);
            shiftStats[shiftKey].repairCost += getRepairRecordCost(record);
            shiftStats[shiftKey].repairRecords += 1;
        });

        const shiftChartData = [1, 2, 3].map(shiftKey => ({
            vardiya: `${shiftKey}. Vardiya`,
            manuel: shiftStats[shiftKey].manualQuantity,
            tamir: shiftStats[shiftKey].repairQuantity,
            toplam: shiftStats[shiftKey].manualQuantity + shiftStats[shiftKey].repairQuantity,
            kayit: shiftStats[shiftKey].manualRecords + shiftStats[shiftKey].repairRecords
        }));

        const employeeStats = {};
        allSelectedRecords.forEach(record => {
            const employeeId = record.operator_id || 'unknown';
            const employeeName = employeeDisplayMap.get(employeeId) || 'Bilinmeyen';

            if (employeeId === 'unknown' || employeeName === 'Bilinmeyen') {
                return;
            }

            if (!employeeStats[employeeId]) {
                employeeStats[employeeId] = {
                    id: employeeId,
                    name: employeeName,
                    quantity: 0,
                    records: 0,
                    manualQuantity: 0,
                    repairQuantity: 0,
                    cost: 0,
                    duration: 0
                };
            }

            employeeStats[employeeId].quantity += toSafeNumber(record.quantity);
            employeeStats[employeeId].records += 1;
            employeeStats[employeeId].duration += toSafeNumber(record.duration_seconds);

            if (record.line_id) {
                employeeStats[employeeId].manualQuantity += toSafeNumber(record.quantity);
                employeeStats[employeeId].cost += getManualRecordCost(record);
            } else {
                employeeStats[employeeId].repairQuantity += toSafeNumber(record.quantity);
                employeeStats[employeeId].cost += getRepairRecordCost(record);
            }
        });

        const employeeRows = Object.values(employeeStats).sort((a, b) => b.quantity - a.quantity);
        const topEmployees = employeeRows.slice(0, 10);
        const bottomEmployees = [...employeeRows]
            .filter(employee => employee.cost > 5000)
            .sort((a, b) => a.quantity - b.quantity)
            .slice(0, 10);

        const partStats = {};
        manualRecords.forEach(record => {
            const partCode = record.part_code || 'Belirtilmemiş';
            if (!partStats[partCode]) {
                partStats[partCode] = {
                    code: partCode,
                    quantity: 0,
                    records: 0,
                    duration: 0,
                    employees: new Set()
                };
            }
            partStats[partCode].quantity += toSafeNumber(record.quantity);
            partStats[partCode].records += 1;
            partStats[partCode].duration += toSafeNumber(record.duration_seconds);
            if (record.operator_id) {
                partStats[partCode].employees.add(record.operator_id);
            }
        });

        const partEfficiencyRows = Object.values(partStats)
            .map(entry => ({
                ...entry,
                averageDuration: entry.quantity > 0 ? entry.duration / entry.quantity : 0,
                employeeCount: entry.employees.size
            }))
            .sort((a, b) => b.averageDuration - a.averageDuration)
            .slice(0, 20);

        const bhTopParts = Object.values(partStats)
            .filter(entry => {
                const partCode = (entry.code || '').toUpperCase();
                return partCode.startsWith('BH') && !partCode.startsWith('BT') && !partCode.startsWith('YK');
            })
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 20)
            .map(entry => ({
                ...entry,
                employeeCount: entry.employees.size
            }));

        const recordDetailRows = [
            ...manualRecords.map(record => ({
                type: 'Manuel',
                date: getDateKey(record.record_date),
                createdAt: record.created_at,
                shift: getShiftLabel(record.shift || record.calculatedShift || '1'),
                operator: employeeDisplayMap.get(record.operator_id) || 'N/A',
                line: lineNameMap.get(record.line_id) || 'N/A',
                partCode: record.part_code || '-',
                quantity: toSafeNumber(record.quantity),
                duration: toSafeNumber(record.duration_seconds),
                cost: getManualRecordCost(record),
                description: record.description || '-'
            })),
            ...repairRecords.map(record => ({
                type: 'Tamir',
                date: getDateKey(record.record_date),
                createdAt: record.created_at,
                shift: getShiftLabel(record.shift || record.calculatedShift || '1'),
                operator: employeeDisplayMap.get(record.operator_id) || 'N/A',
                line: `${lineNameMap.get(record.source_line_id) || 'N/A'} -> ${lineNameMap.get(record.repair_line_id) || 'N/A'}`,
                partCode: record.part_code || '-',
                quantity: toSafeNumber(record.quantity),
                duration: toSafeNumber(record.duration_seconds),
                cost: getRepairRecordCost(record),
                description: record.description || '-'
            }))
        ].sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        const monthlyChartData = monthlyRows.map(entry => ({
            month: entry.monthLabel,
            manualCost: Math.round(entry.manualCost),
            repairCost: Math.round(entry.repairCost),
            totalCost: Math.round(entry.totalCost),
            manualQuantity: entry.manualQuantity,
            repairQuantity: entry.repairQuantity,
            totalProduction: entry.totalProduction,
            manualRate: Number(entry.manualRate.toFixed(2)),
            repairRate: Number(entry.repairRate.toFixed(2))
        }));

        const qualityChartData = qualityAnalysis.slice(0, 8).map(entry => ({
            name: entry.name,
            repairRate: Number(entry.repairRate.toFixed(2)),
            totalProduction: entry.totalProduction,
            repairQuantity: entry.repair
        }));

        return {
            manualRecords,
            repairRecords,
            totalManualQuantity,
            totalRepairQuantity,
            totalManualCost,
            totalRepairCost,
            totalDuration,
            totalCost: totalManualCost + totalRepairCost,
            totalRecords: allSelectedRecords.length,
            totalEmployees: uniqueEmployees.size,
            averageDailyProduction: uniqueDays > 0 ? Math.round((totalManualQuantity + totalRepairQuantity) / uniqueDays) : 0,
            averageMonthlyCost: uniqueMonths > 0 ? (totalManualCost + totalRepairCost) / uniqueMonths : 0,
            monthlyRows,
            dailyRows,
            topManualLines,
            topManualLinesByCost,
            topRepairSourceLines,
            topRepairSourceLinesByCost,
            qualityAnalysis,
            shiftStats,
            shiftChartData,
            employeeRows,
            topEmployees,
            bottomEmployees,
            partEfficiencyRows,
            bhTopParts,
            recordDetailRows,
            monthlyChartData,
            qualityChartData
        };
    }, [
        analysisData,
        analysisRange,
        dailyLineCounts,
        dailyTotals,
        employeeDisplayMap,
        getManualRecordCost,
        getRepairRecordCost,
        lineNameMap,
        monthlyTotals,
        productionCounts
    ]);

    const aggregatedRecords = useMemo(() => {
        const dailyData = {};
        const partFilter = (filters.partCode || '').trim().toUpperCase();

        const filteredManuals = partFilter
            ? manualRecords.filter(r => (r.part_code || '').toUpperCase().includes(partFilter))
            : manualRecords;
        const filteredRepairs = partFilter
            ? repairRecords.filter(r =>
                (r.part_code || '').toUpperCase().includes(partFilter) ||
                (r.description || '').toUpperCase().includes(partFilter)
            )
            : repairRecords;

        filteredManuals.forEach(rec => {
            const date = rec.record_date;
            if (!dailyData[date]) {
                dailyData[date] = { manual_count: 0, manual_quantity: 0, manual_cost: 0, repair_count: 0, repair_quantity: 0, repair_cost: 0 };
            }
            dailyData[date].manual_count += 1;
            dailyData[date].manual_quantity += toSafeNumber(rec.quantity);
            dailyData[date].manual_cost += getManualRecordCost(rec);
        });

        filteredRepairs.forEach(rec => {
            const date = rec.record_date;
            if (!dailyData[date]) {
                dailyData[date] = { manual_count: 0, manual_quantity: 0, manual_cost: 0, repair_count: 0, repair_quantity: 0, repair_cost: 0 };
            }
            dailyData[date].repair_count += 1;
            dailyData[date].repair_quantity += toSafeNumber(rec.quantity);
            dailyData[date].repair_cost += getRepairRecordCost(rec);
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
    }, [dailyTotals, filters.partCode, getManualRecordCost, getRepairRecordCost, manualRecords, monthlyTotals, repairRecords]);

    const handleViewDetails = (date) => {
        const partFilter = (filters.partCode || '').trim().toUpperCase();
        const manualFilter = (r) => r.record_date === date && (!partFilter || (r.part_code || '').toUpperCase().includes(partFilter));
        const repairFilter = (r) => r.record_date === date && (!partFilter || (r.part_code || '').toUpperCase().includes(partFilter) || (r.description || '').toUpperCase().includes(partFilter));
        const details = {
            date,
            manuals: manualRecords.filter(manualFilter),
            repairs: repairRecords.filter(repairFilter),
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
                return {
                    ...r,
                    recordType: 'manual',
                    line,
                    operator,
                    cost: getManualRecordCost(r),
                    durationSeconds: toSafeNumber(r.duration_seconds)
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
                return {
                    ...r,
                    recordType: 'repair',
                    repairLine,
                    sourceLine,
                    operator,
                    cost: getRepairRecordCost(r),
                    durationSeconds: toSafeNumber(r.duration_seconds)
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
    }, [allManualRecords, allRepairRecords, employees, getManualRecordCost, getRepairRecordCost, lines, partCodeSearch, toast]);

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

        const manualPeriodRecords = allManualRecords.filter(r => r.record_date >= from && r.record_date <= to);
        const repairPeriodRecords = allRepairRecords.filter(r => r.record_date >= from && r.record_date <= to);
        const periodRecords = [
            ...manualPeriodRecords.map(record => ({ ...record, recordType: 'manual' })),
            ...repairPeriodRecords.map(record => ({ ...record, recordType: 'repair' }))
        ];

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

            if (record.recordType === 'manual') {
                employeeStats[empId].manualQuantity += record.quantity || 0;
            } else {
                employeeStats[empId].repairQuantity += record.quantity || 0;
            }

            employeeStats[empId].cost += record.recordType === 'manual'
                ? getManualRecordCost(record)
                : getRepairRecordCost(record);
        });

        // Bilinmeyen personelleri (unknown ID veya Bilinmeyen ismi) hariç tut
        const employeeArray = Object.values(employeeStats).filter(e =>
            e.id !== 'unknown' && e.name !== 'Bilinmeyen' && !e.name.includes('Bilinmeyen')
        );
        const top10 = [...employeeArray].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        const bottom10 = [...employeeArray].sort((a, b) => a.quantity - b.quantity).slice(0, 10);

        return { top10, bottom10, period: employeeAnalysisPeriod };
    }, [allManualRecords, allRepairRecords, analysisFilters.dateRange, employeeAnalysisPeriod, employees, getManualRecordCost, getRepairRecordCost]);

    // Aylık bazda tamir ve manuel maliyet grafik verisi
    const monthlyCostChartData = useMemo(() => analysisSummary.monthlyChartData, [analysisSummary.monthlyChartData]);

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

            <Tabs defaultValue="data" className="w-full" onValueChange={() => window.dispatchEvent(new CustomEvent(CLOSE_DATE_PICKERS_EVENT))}>
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
                                    <Button variant="secondary" onClick={openProductionCountsDialog}><Factory className="mr-2 h-4 w-4" />Hat Bazlı Üretim</Button>
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
                                        const yesterday = new Date(today);
                                        yesterday.setDate(yesterday.getDate() - 1);
                                        setFilters({ ...filters, dateRange: { from: yesterday, to: yesterday } });
                                    }}>Dün</Button>
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
                                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg items-center">
                                    <DateRangePicker
                                        value={filters.dateRange}
                                        onChange={(range) => setFilters({ ...filters, dateRange: range || { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } })}
                                        placeholder="Özel Tarih Aralığı Seç"
                                        className="min-w-[200px] flex-1"
                                    />
                                </div>

                                {/* Parça Kodu ile Filtreleme */}
                                <div className="p-2 bg-indigo-50/80 rounded-lg border border-indigo-100">
                                    <Label className="text-sm font-medium text-indigo-800 mb-2 flex items-center gap-2">
                                        <Search className="h-4 w-4" />
                                        Parça Kodu ile Ara / Filtrele
                                    </Label>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <Input
                                            placeholder="Parça kodu yazın (örn: BH123)..."
                                            value={filters.partCode || ''}
                                            onChange={(e) => setFilters({ ...filters, partCode: e.target.value })}
                                            className="h-10 border-indigo-200 bg-white max-w-xs focus:ring-indigo-500 focus:border-indigo-500"
                                        />
                                        {filters.partCode && (
                                            <Button variant="outline" size="sm" onClick={() => setFilters({ ...filters, partCode: '' })} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                                Filtreyi Temizle
                                            </Button>
                                        )}
                                    </div>
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
                                                    onClick={async () => {
                                                        const existing = dailyTotals[rec.date];
                                                        setDailyFormData({
                                                            date: rec.date,
                                                            total_production: existing?.total_production || ''
                                                        });
                                                        // Hat bazlı üretim adetlerini yükle
                                                        const existingLineCounts = dailyLineCounts[rec.date] || [];
                                                        // Eğer bellekte yoksa DB'den çek
                                                        let lineCountsData = existingLineCounts;
                                                        if (lineCountsData.length === 0) {
                                                            const { data } = await supabase
                                                                .from('daily_production_counts')
                                                                .select('*')
                                                                .eq('date', rec.date);
                                                            lineCountsData = data || [];
                                                        }
                                                        const lineFormEntries = lines.map(l => {
                                                            const found = lineCountsData.find(e => e.line_id === l.id);
                                                            return { line_id: l.id, line_name: l.name, production_qty: found ? String(found.production_qty) : '' };
                                                        });
                                                        setDailyLineFormData(lineFormEntries);
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
                                                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ type: 'daily', date: rec.date })}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

                    {/* Add Record Dialog */}
                    <Dialog open={showDialog} onOpenChange={setShowDialog}>
                        <DialogContent className="max-w-7xl p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0">
                            <DialogHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                        <Plus className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-2xl font-bold text-white">Toplu Kayıt Ekle</DialogTitle>
                                        <DialogDescription className="text-blue-100 text-sm mt-1">
                                            Manuel veya tamir hattı için yeni üretim kayıtları oluşturun (Tarih ve vardiya seçimi zorunludur).
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="p-1 bg-gray-50 h-[650px]">
                                <MultiRowForm onSave={handleMultiSave} lines={lines} employees={employees} />
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* View Details Dialog */}
                    <Dialog open={!!viewingDetails} onOpenChange={() => setViewingDetails(null)}>
                        <DialogContent className="max-w-7xl p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0 h-[85vh] flex flex-col">
                            <DialogHeader className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-6 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                                        <Eye className="w-6 h-6 text-blue-300" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-white">
                                            {viewingDetails ? `${format(new Date(viewingDetails.date), 'dd MMMM yyyy', { locale: tr })} Kayıt Detayları` : 'Detaylar'}
                                        </DialogTitle>
                                        <DialogDescription className="text-slate-400 text-sm mt-1">
                                            Seçili tarihe ait tüm manuel ve tamir kayıtlarını inceleyin veya düzenleyin.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-hidden p-6 bg-gray-50/50">
                                {viewingDetails && (
                                    <Tabs defaultValue="manual" className="h-full flex flex-col">
                                        <TabsList className="grid w-full grid-cols-2 h-12 bg-white border border-gray-200 p-1 rounded-xl mb-6 shadow-sm shrink-0">
                                            <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold text-gray-500 font-medium transition-all">
                                                Manuel Hat Kayıtları ({viewingDetails.manuals.length})
                                            </TabsTrigger>
                                            <TabsTrigger value="repair" className="rounded-lg data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:font-semibold text-gray-500 font-medium transition-all">
                                                Tamir Hattı Kayıtları ({viewingDetails.repairs.length})
                                            </TabsTrigger>
                                        </TabsList>

                                        <div className="flex-1 overflow-hidden">
                                            <TabsContent value="manual" className="h-full overflow-hidden mt-0 data-[state=inactive]:hidden">
                                                <div className="h-full overflow-auto border border-gray-200 rounded-xl bg-white shadow-sm">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-gray-100">
                                                            <tr>{['Tarih/Saat', 'Vardiya', 'Operatör', 'Hat', 'Parça Kodu', 'Adet', 'Süre (sn)', 'Maliyet', 'İşlem'].map(h =>
                                                                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                                            )}</tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {viewingDetails.manuals.length === 0 ? (
                                                                <tr><td colSpan="9" className="text-center py-10 text-gray-400">Kayıt bulunamadı.</td></tr>
                                                            ) : (
                                                                viewingDetails.manuals.map((rec, idx) => {
                                                                    const cost = getManualRecordCost(rec);
                                                                    return (
                                                                        <tr key={rec.id} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                                            <td className="px-5 py-3">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-medium text-gray-900">{format(new Date(rec.record_date), 'dd.MM.yyyy')}</span>
                                                                                    <span className="text-xs text-gray-500 font-mono">{rec.created_at ? format(new Date(rec.created_at), 'HH:mm') : '-'}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-5 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{getShiftLabel(rec.shift)}</span></td>
                                                                            <td className="px-5 py-3 text-gray-700 font-medium">{rec.operator_name}</td>
                                                                            <td className="px-5 py-3 text-gray-600">{rec.line_name}</td>
                                                                            <td className="px-5 py-3 font-semibold text-indigo-600 font-mono">{rec.part_code || '-'}</td>
                                                                            <td className="px-5 py-3 font-medium text-gray-900">{rec.quantity}</td>
                                                                            <td className="px-5 py-3 text-gray-500">{toSafeNumber(rec.duration_seconds)}s</td>
                                                                            <td className="px-5 py-3 font-bold text-gray-900">{formatCurrency(cost)}</td>
                                                                            <td className="px-5 py-3">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Button variant="ghost" size="sm" onClick={() => setEditingRecord({ ...rec, recordType: 'manual' })} className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors" title="Düzenle">
                                                                                        <Edit className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'row', id: rec.id, recordType: 'manual' })} className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors" title="Sil">
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="repair" className="h-full overflow-hidden mt-0 data-[state=inactive]:hidden">
                                                <div className="h-full overflow-auto border border-gray-200 rounded-xl bg-white shadow-sm">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-gray-100">
                                                            <tr>{['Tarih/Saat', 'Vardiya', 'Operatör', 'Kaynak Hat', 'Tamir Hattı', 'Adet', 'Süre (sn)', 'Maliyet', 'İşlem'].map(h =>
                                                                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                                                            )}</tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {viewingDetails.repairs.length === 0 ? (
                                                                <tr><td colSpan="9" className="text-center py-10 text-gray-400">Kayıt bulunamadı.</td></tr>
                                                            ) : (
                                                                viewingDetails.repairs.map((rec, idx) => {
                                                                    const cost = getRepairRecordCost(rec);
                                                                    return (
                                                                        <tr key={rec.id} className={`hover:bg-orange-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                                            <td className="px-5 py-3">
                                                                                <div className="flex flex-col">
                                                                                    <span className="font-medium text-gray-900">{format(new Date(rec.record_date), 'dd.MM.yyyy')}</span>
                                                                                    <span className="text-xs text-gray-500 font-mono">{rec.created_at ? format(new Date(rec.created_at), 'HH:mm') : '-'}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-5 py-3"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{getShiftLabel(rec.shift)}</span></td>
                                                                            <td className="px-5 py-3 text-gray-700 font-medium">{rec.operator_name}</td>
                                                                            <td className="px-5 py-3 text-gray-600">{rec.source_line_name}</td>
                                                                            <td className="px-5 py-3 text-orange-600 font-medium">{rec.repair_line_name}</td>
                                                                            <td className="px-5 py-3 font-medium text-gray-900">{rec.quantity}</td>
                                                                            <td className="px-5 py-3 text-gray-500">{toSafeNumber(rec.duration_seconds)}s</td>
                                                                            <td className="px-5 py-3 font-bold text-gray-900">{formatCurrency(cost)}</td>
                                                                            <td className="px-5 py-3">
                                                                                <div className="flex items-center gap-1">
                                                                                    <Button variant="ghost" size="sm" onClick={() => setEditingRecord({ ...rec, recordType: 'repair' })} className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-400 hover:text-orange-600 transition-colors" title="Düzenle">
                                                                                        <Edit className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ type: 'row', id: rec.id, recordType: 'repair' })} className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors" title="Sil">
                                                                                        <Trash2 className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Record Dialog */}
                    <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
                        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0 h-[600px] flex flex-col">
                            <DialogHeader className="bg-gradient-to-r from-teal-600 to-emerald-600 px-8 py-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                        <Edit className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-white">Kaydı Düzenle</DialogTitle>
                                        <DialogDescription className="text-teal-100 text-sm mt-0.5">
                                            {editingRecord?.recordType === 'manual' ? 'Manuel üretim' : 'Tamir hattı'} kaydı için bilgileri güncelleyin.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden bg-gray-50/50">
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
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Delete Confirmation Dialog */}
                    <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 rounded-2xl shadow-2xl bg-white">
                            <DialogHeader className="bg-red-50 p-6 border-b border-red-100">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                        <Trash2 className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-red-900">Silme Onayı</DialogTitle>
                                        <DialogDescription className="text-red-700/80 mt-1">Bu işlem geri alınamaz!</DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>
                            <div className="p-6 space-y-6">
                                <div className="text-base text-gray-600 leading-relaxed">
                                    {deleteConfirm?.type === 'daily' && (
                                        <>
                                            <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded mr-1">{format(new Date(deleteConfirm.date), 'dd MMMM yyyy', { locale: tr })}</span>
                                            tarihli tüm manuel ve tamir kayıtlarını kalıcı olarak silmek üzeresiniz.
                                            <br /><br />
                                            Devam etmek istediğinizden emin misiniz?
                                        </>
                                    )}
                                    {deleteConfirm?.type === 'row' && (
                                        <>
                                            Bu {deleteConfirm.recordType === 'manual' ? 'manuel üretim' : 'tamir hattı'} kaydını kalıcı olarak silmek üzeresiniz.
                                            <br /><br />
                                            Devam etmek istediğinizden emin misiniz?
                                        </>
                                    )}
                                </div>

                                <DialogFooter className="gap-3 sm:justify-between w-full">
                                    <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1 h-12 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium text-base rounded-xl transition-all">
                                        İptal
                                    </Button>
                                    <Button variant="destructive" onClick={handleDelete} className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-red-200 hover:shadow-red-300 transition-all">
                                        Evet, Sil
                                    </Button>
                                </DialogFooter>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Monthly Total Dialog */}
                    <Dialog open={showMonthlyDialog} onOpenChange={setShowMonthlyDialog}>
                        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0 h-[85vh] flex flex-col">
                            <DialogHeader className="bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                        <TrendingUp className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-white">Aylık Toplam Üretim</DialogTitle>
                                        <DialogDescription className="text-emerald-100/90 text-sm mt-0.5">
                                            Fabrika genelindeki aylık toplam üretim verilerini girin ve analiz edin.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/50">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2.5">
                                        <Label className="text-base font-semibold text-gray-700">Yıl</Label>
                                        <Select value={monthlyFormData.year} onValueChange={(value) => setMonthlyFormData({ ...monthlyFormData, year: value })}>
                                            <SelectTrigger className="h-12 border-gray-300 focus:border-emerald-500 rounded-xl bg-white shadow-sm text-base">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026].map(y => (
                                                    <SelectItem key={y} value={String(y)} className="text-base py-2.5">{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-base font-semibold text-gray-700">Ay</Label>
                                        <Select value={monthlyFormData.month} onValueChange={(value) => setMonthlyFormData({ ...monthlyFormData, month: value })}>
                                            <SelectTrigger className="h-12 border-gray-300 focus:border-emerald-500 rounded-xl bg-white shadow-sm text-base">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                                                    <SelectItem key={m} value={m} className="text-base py-2.5">{format(new Date(2000, Number(m) - 1, 1), 'MMMM', { locale: tr })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-3 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <Label className="text-base font-semibold text-gray-800 flex items-center justify-between">
                                        <span>Aylık Toplam Üretim Adedi</span>
                                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Manuel + Robot + Diğer</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder="Örn: 50000"
                                            className="h-16 text-2xl font-bold border-gray-200 focus:border-emerald-500 focus:ring-emerald-100 rounded-xl pl-6 pr-12 shadow-inner"
                                            value={monthlyFormData.total_production}
                                            onChange={(e) => setMonthlyFormData({ ...monthlyFormData, total_production: e.target.value })}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">Adet</div>
                                    </div>
                                </div>

                                {(() => {
                                    const yearMonth = `${monthlyFormData.year}-${String(monthlyFormData.month).padStart(2, '0')}`;
                                    const monthRecords = allManualRecords.filter(r => r.record_date && r.record_date.startsWith(yearMonth));
                                    const monthRepairs = allRepairRecords.filter(r => r.record_date && r.record_date.startsWith(yearMonth));
                                    const totalManual = monthRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const totalRepair = monthRepairs.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const existing = monthlyTotals[yearMonth];

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 hover:border-blue-200 transition-colors">
                                                <p className="text-sm font-medium text-blue-600 mb-1">Manuel Üretim</p>
                                                <p className="text-2xl font-bold text-blue-700">{totalManual.toLocaleString('tr-TR')}</p>
                                                <p className="text-xs text-blue-400 mt-2 font-medium">Sistem Kayıtları</p>
                                            </div>
                                            <div className="bg-orange-50/50 p-5 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors">
                                                <p className="text-sm font-medium text-orange-600 mb-1">Tamir</p>
                                                <p className="text-2xl font-bold text-orange-700">{totalRepair.toLocaleString('tr-TR')}</p>
                                                <p className="text-xs text-orange-400 mt-2 font-medium">Sistem Kayıtları</p>
                                            </div>
                                            <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 hover:border-purple-200 transition-colors">
                                                <p className="text-sm font-medium text-purple-600 mb-1">Toplam (M+T)</p>
                                                <p className="text-2xl font-bold text-purple-700">{(totalManual + totalRepair).toLocaleString('tr-TR')}</p>
                                                <p className="text-xs text-purple-400 mt-2 font-medium">Sistem Kayıtları</p>
                                            </div>
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
                                            <div className="p-6 bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl shadow-sm">
                                                <p className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-emerald-600" />
                                                    Hesaplanan Oranlar
                                                </p>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-sm text-gray-600 font-medium">Manuel Oran</span>
                                                            <span className="text-2xl font-bold text-indigo-600">%{manualPercent}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                            <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${Math.min(manualPercent, 100)}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-gray-400 text-right">{totalManual} / {inputProduction}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-sm text-gray-600 font-medium">Tamir Oran</span>
                                                            <span className="text-2xl font-bold text-orange-600">%{repairPercent}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${Math.min(repairPercent, 100)}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-gray-400 text-right">{totalRepair} / {inputProduction}</p>
                                                    </div>
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
                                        <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                                            <div className="bg-emerald-100 p-2 rounded-full">
                                                <Check className="w-5 h-5 text-emerald-700" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-emerald-900">Mevcut Kayıt Bulundu</p>
                                                <p className="text-sm text-emerald-700/80">
                                                    Bu ay için daha önce <span className="font-bold">{existing.total_production}</span> adet üretim girilmiş.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="p-6 bg-white border-t border-gray-100 shrink-0 flex gap-3 justify-end">
                                <Button variant="outline" size="lg" onClick={() => setShowMonthlyDialog(false)} className="h-12 px-6 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">İptal</Button>
                                <Button size="lg" onClick={handleSaveMonthlyTotal} className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all">
                                    <Save className="mr-2 h-5 w-5" />
                                    Kaydet
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Daily Total Dialog */}
                    <Dialog open={showDailyDialog} onOpenChange={setShowDailyDialog}>
                        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0 h-[80vh] flex flex-col">
                            <DialogHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                        <Calendar className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-white">Günlük Toplam Üretim</DialogTitle>
                                        <DialogDescription className="text-violet-100/90 text-sm mt-0.5">
                                            {selectedDailyRecord && format(new Date(selectedDailyRecord.date), 'dd MMMM yyyy', { locale: tr })} için toplam üretim verilerini girin.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gray-50/50">
                                {/* Hat Bazlı Üretim Adetleri */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                    <Label className="text-base font-semibold text-gray-800 flex items-center justify-between">
                                        <span className="flex items-center gap-2"><Factory className="w-4 h-4 text-violet-600" /> Hat Bazlı Günlük Üretim Adetleri</span>
                                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            Toplam: {dailyLineFormData.reduce((sum, e) => sum + (Number(e.production_qty) || 0), 0).toLocaleString('tr-TR')} adet
                                        </span>
                                    </Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {dailyLineFormData.map((entry, index) => (
                                            <div key={entry.line_id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-violet-200 transition-colors">
                                                <span className="text-sm font-semibold text-gray-700 min-w-[100px]">{entry.line_name}</span>
                                                <div className="relative flex-1">
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        className="h-10 text-right font-bold border-gray-200 focus:border-violet-500 focus:ring-violet-100 rounded-lg pr-12"
                                                        value={entry.production_qty}
                                                        onChange={(e) => {
                                                            const newEntries = [...dailyLineFormData];
                                                            newEntries[index] = { ...newEntries[index], production_qty: e.target.value };
                                                            setDailyLineFormData(newEntries);
                                                        }}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium select-none">adet</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedDailyRecord && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 hover:border-blue-200 transition-colors">
                                            <p className="text-sm font-medium text-blue-600 mb-1">Manuel Üretim</p>
                                            <p className="text-2xl font-bold text-blue-700">{selectedDailyRecord.manual_quantity}</p>
                                            <p className="text-xs text-blue-400 mt-2 font-medium">{selectedDailyRecord.manual_count} kayıt</p>
                                        </div>
                                        <div className="bg-orange-50/50 p-5 rounded-xl border border-orange-100 hover:border-orange-200 transition-colors">
                                            <p className="text-sm font-medium text-orange-600 mb-1">Tamir</p>
                                            <p className="text-2xl font-bold text-orange-700">{selectedDailyRecord.repair_quantity}</p>
                                            <p className="text-xs text-orange-400 mt-2 font-medium">{selectedDailyRecord.repair_count} kayıt</p>
                                        </div>
                                        <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100 hover:border-purple-200 transition-colors">
                                            <p className="text-sm font-medium text-purple-600 mb-1">Toplam (M+T)</p>
                                            <p className="text-2xl font-bold text-purple-700">{selectedDailyRecord.manual_quantity + selectedDailyRecord.repair_quantity}</p>
                                            <p className="text-xs text-purple-400 mt-2 font-medium">Sistem Kayıtları</p>
                                        </div>
                                    </div>
                                )}

                                {/* Oran Kartları */}
                                {selectedDailyRecord && (() => {
                                    const inputProduction = dailyLineFormData.reduce((sum, e) => sum + (Number(e.production_qty) || 0), 0);

                                    if (inputProduction > 0) {
                                        const totalManual = selectedDailyRecord.manual_quantity;
                                        const totalRepair = selectedDailyRecord.repair_quantity;
                                        const manualPercent = ((totalManual / inputProduction) * 100).toFixed(1);
                                        const repairPercent = ((totalRepair / inputProduction) * 100).toFixed(1);

                                        return (
                                            <div className="p-6 bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl shadow-sm">
                                                <p className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-violet-600" />
                                                    Hesaplanan Oranlar (Toplam: {inputProduction.toLocaleString('tr-TR')} adet)
                                                </p>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-sm text-gray-600 font-medium">Manuel Oran</span>
                                                            <span className="text-2xl font-bold text-indigo-600">%{manualPercent}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                            <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${Math.min(manualPercent, 100)}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-gray-400 text-right">{totalManual} / {inputProduction.toLocaleString('tr-TR')}</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-sm text-gray-600 font-medium">Tamir Oran</span>
                                                            <span className="text-2xl font-bold text-orange-600">%{repairPercent}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${Math.min(repairPercent, 100)}%` }}></div>
                                                        </div>
                                                        <p className="text-xs text-gray-400 text-right">{totalRepair} / {inputProduction.toLocaleString('tr-TR')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {selectedDailyRecord?.daily_total && (
                                    <div className="flex items-center gap-4 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                                        <div className="bg-violet-100 p-2 rounded-full">
                                            <Check className="w-5 h-5 text-violet-700" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-violet-900">Mevcut Kayıt Bulundu</p>
                                            <p className="text-sm text-violet-700/80">
                                                Bu gün için daha önce <span className="font-bold">{selectedDailyRecord.daily_total.total_production}</span> adet üretim girilmiş.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 bg-white border-t border-gray-100 shrink-0 flex gap-3 justify-end">
                                <Button variant="outline" size="lg" onClick={() => setShowDailyDialog(false)} className="h-12 px-6 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">İptal</Button>
                                <Button size="lg" onClick={handleSaveDailyTotal} className="h-12 px-8 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold shadow-lg shadow-violet-200 hover:shadow-violet-300 transition-all">
                                    <Save className="mr-2 h-5 w-5" />
                                    Kaydet
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Hat Bazlı Üretim Adetleri Dialog */}
                    <Dialog open={showProductionCountsDialog} onOpenChange={setShowProductionCountsDialog}>
                        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-white rounded-2xl shadow-xl border-0 h-[85vh] flex flex-col">
                            <DialogHeader className="bg-gradient-to-r from-orange-600 to-amber-600 px-8 py-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                        <Factory className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-xl font-bold text-white">Hat Bazlı Üretim Adetleri</DialogTitle>
                                        <DialogDescription className="text-orange-100/90 text-sm mt-0.5">
                                            Her hat için aylık toplam üretim verilerini girin. Sistem otomatik olarak dağılım oranlarını hesaplayacaktır.
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gray-50/50">
                                <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="space-y-2.5">
                                        <Label className="text-base font-semibold text-gray-700">Yıl</Label>
                                        <Select value={prodCountsFormData.year} onValueChange={(value) => {
                                            setProdCountsFormData(prev => ({ ...prev, year: value }));
                                            updateProductionCountsMonth(value, prodCountsFormData.month);
                                        }}>
                                            <SelectTrigger className="h-12 border-gray-300 focus:border-orange-500 rounded-xl bg-white shadow-sm text-base">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[2024, 2025, 2026].map(y => (
                                                    <SelectItem key={y} value={String(y)} className="text-base py-2.5">{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label className="text-base font-semibold text-gray-700">Ay</Label>
                                        <Select value={prodCountsFormData.month} onValueChange={(value) => {
                                            setProdCountsFormData(prev => ({ ...prev, month: value }));
                                            updateProductionCountsMonth(prodCountsFormData.year, value);
                                        }}>
                                            <SelectTrigger className="h-12 border-gray-300 focus:border-orange-500 rounded-xl bg-white shadow-sm text-base">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                                                    <SelectItem key={m} value={m} className="text-base py-2.5">{format(new Date(2000, Number(m) - 1, 1), 'MMMM', { locale: tr })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <ListOrdered className="w-5 h-5 text-gray-500" />
                                        Hat Listesi ve Üretim Girişi
                                    </Label>
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50/80 sticky top-0 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-left font-semibold text-gray-600 w-1/2">Hat Adı</th>
                                                    <th className="px-6 py-4 text-left font-semibold text-gray-600 w-1/2">Üretim Adedi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(prodCountsFormData.entries || []).map((entry, idx) => (
                                                    <tr key={entry.line_id} className="hover:bg-gray-50/50 transition-colors group">
                                                        <td className="px-6 py-3 font-medium text-gray-800 text-base">{entry.line_name}</td>
                                                        <td className="px-6 py-3">
                                                            <div className="relative">
                                                                <Input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    className="h-11 border-gray-200 focus:border-orange-500 focus:ring-orange-100 rounded-lg text-right font-semibold pr-10 hover:border-orange-300 transition-colors"
                                                                    value={entry.production_qty}
                                                                    onChange={(e) => {
                                                                        const newEntries = [...prodCountsFormData.entries];
                                                                        newEntries[idx] = { ...newEntries[idx], production_qty: e.target.value };
                                                                        setProdCountsFormData(prev => ({ ...prev, entries: newEntries }));
                                                                    }}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">Adet</div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
                                                <tr>
                                                    <td className="px-6 py-4 text-right text-gray-600">Toplam:</td>
                                                    <td className="px-6 py-4 text-right text-orange-600 text-lg">
                                                        {(prodCountsFormData.entries || []).reduce((sum, e) => sum + (Number(e.production_qty) || 0), 0).toLocaleString('tr-TR')}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-white border-t border-gray-100 shrink-0 flex gap-3 justify-end">
                                <Button variant="outline" size="lg" onClick={() => setShowProductionCountsDialog(false)} className="h-12 px-6 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">İptal</Button>
                                <Button size="lg" onClick={handleSaveProductionCounts} className="h-12 px-8 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all">
                                    <Save className="mr-2 h-5 w-5" />
                                    Kaydet
                                </Button>
                            </div>
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
                                    <FileText className="h-4 w-4 mr-2" />Tek Rapor Oluştur
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
                                <Button size="sm" variant={analysisFilters.dateRange?.from && format(analysisFilters.dateRange.from, 'yyyy-MM-dd') === format(subDays(new Date(), 1), 'yyyy-MM-dd') ? "default" : "outline"} onClick={() => {
                                    const yesterday = subDays(new Date(), 1);
                                    setAnalysisFilters({ ...analysisFilters, dateRange: { from: yesterday, to: yesterday } });
                                }}>Dün</Button>
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
                                    <DateRangePicker
                                        value={analysisFilters.dateRange}
                                        onChange={(range) => setAnalysisFilters({ ...analysisFilters, dateRange: range || { from: startOfYear(new Date()), to: endOfMonth(new Date()) } })}
                                        placeholder="Tarih Seçin"
                                        className="w-full"
                                    />
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
                                    {(analysisSummary.totalManualQuantity + analysisSummary.totalRepairQuantity).toLocaleString('tr-TR')}
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
                                    {formatCurrency(analysisSummary.totalCost)}
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
                                    {analysisSummary.averageDailyProduction.toLocaleString('tr-TR')}
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
                                    {analysisSummary.totalEmployees}
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
                                    {formatCurrency(analysisSummary.averageMonthlyCost)}
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
                                    {analysisSummary.totalRecords.toLocaleString('tr-TR')}
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
                                    const shiftRow = analysisSummary.shiftChartData.find(row => row.vardiya === `${shift}. Vardiya`);
                                    const shiftStats = analysisSummary.shiftStats[shift];
                                    return (
                                        <div key={shift} className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-semibold text-lg">{shift}. Vardiya</h4>
                                                    <p className="text-sm text-muted-foreground">{shiftRow?.kayit || 0} kayıt</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-blue-600">{shiftRow?.toplam || 0} adet</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Manuel: {shiftStats.manualQuantity.toLocaleString('tr-TR')} |
                                                        Tamir: {shiftStats.repairQuantity.toLocaleString('tr-TR')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Vardiya Bazlı Grafik */}
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={analysisSummary.shiftChartData}>
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
                                                        <td className="px-3 py-2 text-right">{toSafeNumber(r.duration_seconds ?? r.durationSeconds)}</td>
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
                    {analysisSummary.bhTopParts.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>BH Kodu ile Başlayan Top 20 Parça</CardTitle>
                                <CardDescription>Seçili filtrelere göre BT ve YK hariç BH kodlu parçalar</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {analysisSummary.bhTopParts.map((part, index) => (
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
                    {monthlyCostChartData.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Aylık Bazda Tamir ve Manuel Maliyet Analizi</CardTitle>
                                <CardDescription>
                                    {`${format(analysisRange.fromDate, 'dd.MM.yyyy', { locale: tr })} - ${format(analysisRange.toDate, 'dd.MM.yyyy', { locale: tr })} aralığında aylık maliyet ve üretim dağılımı`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={monthlyCostChartData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" angle={-25} textAnchor="end" interval={0} height={70} />
                                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" width={85} tickFormatter={(value) => `${Number(value).toLocaleString('tr-TR')} ₺`} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" width={55} tickFormatter={(value) => Number(value).toLocaleString('tr-TR')} />
                                        <Tooltip
                                            formatter={(value, name) => {
                                                if (name === 'manualCost' || name === 'repairCost') {
                                                    return formatCurrency(value);
                                                }
                                                return value.toLocaleString('tr-TR');
                                            }}
                                            labelFormatter={(label) => label}
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
