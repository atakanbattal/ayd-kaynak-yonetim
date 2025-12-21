import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { FileText, Plus, Save, AlertCircle, Info, Search, Edit, Trash2, Eye, Download, Upload, Paperclip, X, BarChart3 } from 'lucide-react';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
    import { Textarea } from '@/components/ui/textarea';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { openPrintWindow, logAction } from '@/lib/utils';
    import { materialGroups, weldingProcesses, positions, gasTypes, wireTypes, jointTypes, getSuggestions, validateWPS, jointDesigns, calculateRobotSpeed, calculateHeatInput } from '@/lib/wpsUtils';
    import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
    import { format, parseISO } from 'date-fns';
    import { tr } from 'date-fns/locale';
    
    const initialPartState = { material_type: '', thickness: '', pipe_od: '', pipe_wt: '' };
    const initialFormState = {
      id: null, part_code: '', joint_type: 'Plaka/Plaka', position: 'PA', part1: initialPartState, part2: initialPartState,
      joint_design: 'Küt (I) Kaynağı', root_gap: '', welding_process: 'MAG (135)', wire_type: '', wire_diameter: '',
      wire_feed_speed: '', gas_type: '', gas_flow: '', current_range: '', voltage_range: '', robot_speed: '',
      heat_input: '', pre_heat: '', inter_pass: '', arc_length: '0', dynamic_correction: '0', notes: '', attachments: []
    };
    
    const PartInput = ({ part, partName, isPipe, onInputChange }) => (
      <div className="p-4 border rounded-lg space-y-4">
        <h4 className="font-semibold text-md">{partName}</h4>
        <div className="space-y-2">
          <Label>Malzeme Kalitesi *</Label>
          <Select value={part.material_type} onValueChange={v => onInputChange('material_type', v)}>
            <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
            <SelectContent>{Object.entries(materialGroups).map(([groupName, materials]) => (
              <SelectGroup key={groupName}><SelectLabel>{groupName}</SelectLabel>{materials.map(m => <SelectItem key={m.name} value={m.name}>{m.name} <span className="text-xs text-gray-500 ml-2">({m.standard})</span></SelectItem>)}</SelectGroup>
            ))}</SelectContent>
          </Select>
        </div>
        {isPipe ? (<>
          <div className="space-y-2"><Label>Boru Dış Çap (mm) *</Label><Input type="number" placeholder="örn: 88.9" value={part.pipe_od} onChange={e => onInputChange('pipe_od', e.target.value)} /></div>
          <div className="space-y-2"><Label>Boru Et Kalınlığı (mm) *</Label><Input type="number" placeholder="örn: 3.2" value={part.pipe_wt} onChange={e => onInputChange('pipe_wt', e.target.value)} /></div>
        </>) : (
          <div className="space-y-2"><Label>Kalınlık (mm) *</Label><Input type="number" placeholder="örn: 10" value={part.thickness} onChange={e => onInputChange('thickness', e.target.value)} /></div>
        )}
      </div>
    );
    
    const WPSForm = ({ formData, setFormData, suggestions, applySuggestions, onFileChange, onRemoveAttachment, uploading }) => {
      const handleInputChange = useCallback((field, value) => {
        setFormData(prev => {
          const newForm = { ...prev, [field]: value };
          if (field === 'wire_feed_speed') {
            const newRobotSpeed = calculateRobotSpeed(value);
            newForm.robot_speed = newRobotSpeed;
            newForm.heat_input = calculateHeatInput(newForm.voltage_range, newForm.current_range, newRobotSpeed, newForm.welding_process);
          } else if (['voltage_range', 'current_range', 'robot_speed', 'welding_process'].includes(field)) {
            const speed = field === 'robot_speed' ? value : newForm.robot_speed;
            newForm.heat_input = calculateHeatInput(newForm.voltage_range, newForm.current_range, speed, newForm.welding_process);
          }
          return newForm;
        });
      }, [setFormData]);
    
      const handlePartInputChange = useCallback((part, field, value) => {
        setFormData(prev => ({ ...prev, [part]: { ...prev[part], [field]: value } }));
      }, [setFormData]);
    
      const { isPart1Pipe, isPart2Pipe, part1Name, part2Name } = useMemo(() => {
        switch (formData.joint_type) {
          case 'Plaka/Plaka': return { isPart1Pipe: false, isPart2Pipe: false, part1Name: 'Plaka 1', part2Name: 'Plaka 2' };
          case 'Boru/Plaka': return { isPart1Pipe: true, isPart2Pipe: false, part1Name: 'Boru', part2Name: 'Plaka' };
          case 'Boru/Boru': return { isPart1Pipe: true, isPart2Pipe: true, part1Name: 'Boru 1', part2Name: 'Boru 2' };
          default: return { isPart1Pipe: false, isPart2Pipe: false, part1Name: 'Parça 1', part2Name: 'Parça 2' };
        }
      }, [formData.joint_type]);
    
      return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Temel Bilgiler</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-2"><Label>Parça Kodu</Label><Input placeholder="Parça kodunu girin" value={formData.part_code} onChange={e => handleInputChange('part_code', e.target.value)} /></div>
                <div className="space-y-2"><Label>Birleştirme Tipi *</Label><Select value={formData.joint_type} onValueChange={v => handleInputChange('joint_type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{jointTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Kaynak Pozisyonu (ISO 6947) *</Label><Select value={formData.position} onValueChange={v => handleInputChange('position', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(positions).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <PartInput part={formData.part1} partName={part1Name} isPipe={isPart1Pipe} onInputChange={(f, v) => handlePartInputChange('part1', f, v)} />
                <PartInput part={formData.part2} partName={part2Name} isPipe={isPart2Pipe} onInputChange={(f, v) => handlePartInputChange('part2', f, v)} />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Birleştirme Hazırlığı (ISO 9692-1)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Kaynak Ağzı Tasarımı</Label><Select value={formData.joint_design} onValueChange={v => handleInputChange('joint_design', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{jointDesigns.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Kök Açıklığı (mm)</Label><Input type="text" placeholder="örn: 1.5 veya 1-2" value={formData.root_gap} onChange={e => handleInputChange('root_gap', e.target.value)} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Sarf Malzemeler</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Kaynak Prosesi (ISO 4063) *</Label><Select value={formData.welding_process} onValueChange={v => handleInputChange('welding_process', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(weldingProcesses).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Tel Tipi (ISO 14341/14343) *</Label><Select value={formData.wire_type} onValueChange={v => handleInputChange('wire_type', v)}><SelectTrigger><SelectValue placeholder="Tel tipi seçin" /></SelectTrigger><SelectContent>{wireTypes.map(w => <SelectItem key={w.name} value={w.name}>{w.name} <span className="text-xs text-gray-500 ml-2">({w.desc})</span></SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Tel Çapı (mm) *</Label><Select value={formData.wire_diameter} onValueChange={v => handleInputChange('wire_diameter', v)}><SelectTrigger><SelectValue placeholder="Tel çapı seçin" /></SelectTrigger><SelectContent>{['0.8', '0.9', '1.0', '1.2', '1.6'].map(d => <SelectItem key={d} value={d}>{d} mm</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Koruyucu Gaz (ISO 14175) *</Label><Select value={formData.gas_type} onValueChange={v => handleInputChange('gas_type', v)}><SelectTrigger><SelectValue placeholder="Gaz seçin" /></SelectTrigger><SelectContent>{gasTypes.map(g => <SelectItem key={g.name} value={g.name}>{g.name} <span className="text-xs text-gray-500 ml-2">({g.desc})</span></SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Gaz Debisi (L/min)</Label><Input placeholder="örn: 12-15" value={formData.gas_flow} onChange={e => handleInputChange('gas_flow', e.target.value)} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2 w-full">Kaynak Parametreleri</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tel Sürme Hızı (m/min)</Label><Input type="number" placeholder="örn: 8.5" value={formData.wire_feed_speed} onChange={e => handleInputChange('wire_feed_speed', e.target.value)} /></div>
                <div className="space-y-2"><Label>Robot Hızı (mm/sn)</Label><Input placeholder="Hesaplanır" value={formData.robot_speed} onChange={e => handleInputChange('robot_speed', e.target.value)} /></div>
                <div className="space-y-2"><Label>Akım Aralığı (A)</Label><Input placeholder="örn: 190-210" value={formData.current_range} onChange={e => handleInputChange('current_range', e.target.value)} /></div>
                <div className="space-y-2"><Label>Voltaj Aralığı (V)</Label><Input placeholder="örn: 20.5-21.5" value={formData.voltage_range} onChange={e => handleInputChange('voltage_range', e.target.value)} /></div>
                <div className="space-y-2"><Label>Ark Boyu Düzeltmesi</Label><Select value={formData.arc_length} onValueChange={v => handleInputChange('arc_length', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...Array(21)].map((_, i) => <SelectItem key={i-10} value={(i-10).toString()}>{i-10}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Dinamik Düzeltme</Label><Select value={formData.dynamic_correction} onValueChange={v => handleInputChange('dynamic_correction', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...Array(11)].map((_, i) => <SelectItem key={i} value={i.toString()}>{i}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Isı Girdisi (kJ/mm)</Label><Input placeholder="Hesaplanır" value={formData.heat_input} readOnly /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Isıl İşlem (EN 1011-2)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Ön Isıtma Sıcaklığı (°C)</Label><Input placeholder="Gerekliyse, örn: 100" value={formData.pre_heat} onChange={e => handleInputChange('pre_heat', e.target.value)} /></div>
                <div className="space-y-2"><Label>Pasolar Arası Sıcaklık (°C)</Label><Input placeholder="örn: max 250" value={formData.inter_pass} onChange={e => handleInputChange('inter_pass', e.target.value)} /></div>
              </div>
            </div>
             <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Eğitim Dokümanları</h3>
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                    <Button asChild variant="outline" size="sm">
                        <label htmlFor="file-upload-wps" className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-2" /> Dosya Yükle
                        </label>
                    </Button>
                    <Input id="file-upload-wps" type="file" className="hidden" onChange={onFileChange} disabled={uploading} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                    {uploading && <p className="text-sm text-gray-500 mt-2">Yükleniyor...</p>}
                </div>
                {(formData.attachments && formData.attachments.length > 0) && (
                    <div className="mt-2 space-y-2">
                        {formData.attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                                <div className="flex items-center gap-2">
                                    <Paperclip className="h-4 w-4" />
                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate" title={file.name}>{file.name}</a>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => onRemoveAttachment(index)}><X className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="space-y-2"><Label>Notlar</Label><Textarea placeholder="Özel talimatlar, ek bilgiler..." value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} /></div>
          </div>
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader><div className="flex justify-between items-center"><CardTitle className="text-lg flex items-center"><AlertCircle className="h-5 w-5 mr-2 text-blue-600" />AI Öneri Paneli</CardTitle><Button size="sm" onClick={applySuggestions} disabled={Object.keys(suggestions).length === 0}>Uygula</Button></div></CardHeader>
              <CardContent>{Object.keys(suggestions).length > 0 ? <div className="space-y-3">{Object.entries(suggestions).map(([key, value]) => value && key !== 'pre_heat_info' && <div key={key} className="flex justify-between text-sm"><span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span><span className="font-medium">{value.toString()}</span></div>)}</div> : <p className="text-sm text-center text-gray-600">Parametre önerileri için temel bilgileri girin.</p>}</CardContent>
            </Card>
            {suggestions.pre_heat_info && <Card><CardHeader><CardTitle className="text-base flex items-center"><Info className="h-4 w-4 mr-2" />Ön Isıtma Notu (EN 1011-2)</CardTitle></CardHeader><CardContent><p className="text-sm">{suggestions.pre_heat_info}</p></CardContent></Card>}
          </div>
        </div>
      );
    };
    
    const WPSCreator = () => {
      const [wpsList, setWpsList] = useState([]);
      const [filteredWpsList, setFilteredWpsList] = useState([]);
      const [searchTerm, setSearchTerm] = useState('');
      const [showFormDialog, setShowFormDialog] = useState(false);
      const [showViewDialog, setShowViewDialog] = useState(false);
      const [showDeleteDialog, setShowDeleteDialog] = useState(false);
      const [selectedWPS, setSelectedWPS] = useState(null);
      const [formData, setFormData] = useState(initialFormState);
      const [suggestions, setSuggestions] = useState({});
      const [isDirty, setIsDirty] = useState(false);
      const [uploading, setUploading] = useState(false);
      const { toast } = useToast();
      const { user } = useAuth();
    
      const fetchWPSList = async () => {
        const { data, error } = await supabase.from('wps').select('id, wps_code, part_code, part1, part2, welding_process, position, created_at').order('created_at', { ascending: false });
        if (error) {
          toast({ title: "WPS Listesi Yüklenemedi", description: error.message, variant: "destructive" });
        } else {
            const transformedData = data.map(item => ({
                ...item,
                part1_material: item.part1?.material_type,
                part1_thickness_display: item.part1?.thickness || item.part1?.pipe_wt ? `${item.part1?.thickness || item.part1?.pipe_wt}mm` : ''
            }));
          setWpsList(transformedData);
          setFilteredWpsList(transformedData);
        }
      };
    
      useEffect(() => { fetchWPSList(); }, []);
    
      useEffect(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        const filteredData = wpsList.filter(item =>
          Object.values(item).some(val =>
            String(val).toLowerCase().includes(lowercasedFilter)
          )
        );
        setFilteredWpsList(filteredData);
      }, [searchTerm, wpsList]);
      
      // Analiz verileri
      const analysisData = useMemo(() => {
        // Proses bazlı analiz
        const byProcess = {};
        wpsList.forEach(wps => {
          const process = wps.welding_process || 'Belirtilmemiş';
          if (!byProcess[process]) {
            byProcess[process] = { count: 0, processes: new Set() };
          }
          byProcess[process].count += 1;
        });
        
        // Pozisyon bazlı analiz
        const byPosition = {};
        wpsList.forEach(wps => {
          const position = wps.position || 'Belirtilmemiş';
          if (!byPosition[position]) {
            byPosition[position] = { count: 0 };
          }
          byPosition[position].count += 1;
        });
        
        // Birleştirme tipi bazlı analiz
        const byJointType = {};
        wpsList.forEach(wps => {
          const jointType = wps.joint_type || 'Belirtilmemiş';
          if (!byJointType[jointType]) {
            byJointType[jointType] = { count: 0 };
          }
          byJointType[jointType].count += 1;
        });
        
        // Malzeme bazlı analiz
        const byMaterial = {};
        wpsList.forEach(wps => {
          const material = wps.part1?.material_type || 'Belirtilmemiş';
          if (!byMaterial[material]) {
            byMaterial[material] = { count: 0 };
          }
          byMaterial[material].count += 1;
        });
        
        // Aylık trend
        const monthlyTrend = {};
        wpsList.forEach(wps => {
          if (!wps.created_at) return;
          const month = format(parseISO(wps.created_at), 'yyyy-MM');
          if (!monthlyTrend[month]) {
            monthlyTrend[month] = { month, count: 0 };
          }
          monthlyTrend[month].count += 1;
        });
        
        const monthlyTrendArray = Object.values(monthlyTrend)
          .sort((a, b) => a.month.localeCompare(b.month))
          .map(m => ({
            ...m,
            monthLabel: format(parseISO(m.month + '-01'), 'MMM yyyy', { locale: tr })
          }));
        
        return {
          byProcess,
          byPosition,
          byJointType,
          byMaterial,
          monthlyTrend: monthlyTrendArray,
          totalCount: wpsList.length
        };
      }, [wpsList]);
      
      const COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    
      useEffect(() => {
        if ((formData.part1.material_type && (formData.part1.thickness || formData.part1.pipe_wt)) || (formData.part2.material_type && (formData.part2.thickness || formData.part2.pipe_wt))) {
          const newSuggestions = getSuggestions(formData);
          setSuggestions(newSuggestions);
        }
      }, [formData]);
    
      const handleSetFormData = (data) => {
        setFormData(data);
        setIsDirty(true);
      };
    
      const applySuggestions = () => {
        const { pre_heat_info, ...paramsToApply } = suggestions;
        setFormData(prev => ({ ...prev, ...paramsToApply }));
        setIsDirty(true);
        toast({ title: "Öneriler Uygulandı", description: "Parametreler form alanlarına yüklendi." });
      };
    
      const handleSave = async () => {
        const validationErrors = validateWPS(formData);
        if (validationErrors.length > 0) {
          toast({ title: "Kayıt Başarısız", description: `Zorunlu alanları doldurun: ${validationErrors.join(', ')}`, variant: "destructive" });
          return;
        }
        const { id, ...saveData } = formData;
        let response;
        if (id) {
          response = await supabase.from('wps').update(saveData).eq('id', id).select().single();
        } else {
          const thickness = formData.part1.thickness || formData.part1.pipe_wt;
          const wpsCode = `WPS-${formData.part1.material_type}-${thickness}mm-${Date.now().toString().slice(-4)}`;
          const newWPS = { ...saveData, wps_code: wpsCode, revision: 1 };
          response = await supabase.from('wps').insert(newWPS).select().single();
        }
    
        if (response.error) {
          toast({ title: "İşlem Başarısız", description: response.error.message, variant: "destructive" });
        } else {
          toast({ title: "WPS Kaydedildi", description: `WPS kodu: ${response.data.wps_code}` });
          setShowFormDialog(false);
          fetchWPSList();
          logAction(id ? 'UPDATE_WPS' : 'CREATE_WPS', `WPS: ${response.data.wps_code}`, user);
        }
      };
    
      const handleDelete = async () => {
        if (!selectedWPS) return;
        const { error } = await supabase.from('wps').delete().eq('id', selectedWPS.id);
        if (error) {
          toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "WPS Silindi", description: `${selectedWPS.wps_code} başarıyla silindi.` });
          setShowDeleteDialog(false);
          fetchWPSList();
          logAction('DELETE_WPS', `WPS silindi: ${selectedWPS.wps_code}`, user);
        }
      };
    
      const openFormDialog = (wps = null) => {
        if (wps) {
          supabase.from('wps').select('*').eq('id', wps.id).single().then(({ data, error }) => {
            if (error) {
              toast({ title: "WPS Yüklenemedi", description: error.message, variant: "destructive" });
            } else {
              const loadedData = { ...initialFormState, ...data, arc_length: data.arc_length?.toString() || '0', dynamic_correction: data.dynamic_correction?.toString() || '0', attachments: data.attachments || [] };
              setFormData(loadedData);
              setShowFormDialog(true);
              setIsDirty(false);
            }
          });
        } else {
          setFormData(initialFormState);
          setShowFormDialog(true);
          setIsDirty(false);
        }
      };
    
      const openViewDialog = (wps) => {
        supabase.from('wps').select('*').eq('id', wps.id).single().then(({ data, error }) => {
          if (error) {
            toast({ title: "WPS Yüklenemedi", description: error.message, variant: "destructive" });
          } else {
            setSelectedWPS(data);
            setShowViewDialog(true);
          }
        });
      };
    
      const openDeleteDialog = (wps) => {
        setSelectedWPS(wps);
        setShowDeleteDialog(true);
      };

      const handleFileChange = async (event) => {
        if (!event.target.files || event.target.files.length === 0) return;
        setUploading(true);
        const file = event.target.files[0];
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('attachments').upload(`wps_documents/${fileName}`, file);
        if (error) {
          toast({ title: "Dosya Yüklenemedi", description: error.message, variant: "destructive" });
        } else {
          const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
          setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), { name: file.name, url: publicUrl, size: file.size, type: file.type }] }));
          toast({ title: "Dosya Yüklendi", description: file.name });
        }
        setUploading(false);
      };
    
      const removeAttachment = (indexToRemove) => {
        const fileToRemove = formData.attachments[indexToRemove];
        setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, index) => index !== indexToRemove) }));
        toast({ title: "Ek Kaldırıldı", description: fileToRemove.name });
      };
    
      const handleGeneratePDF = async (wpsId) => {
        const { data, error } = await supabase.from('wps').select('*').eq('id', wpsId).single();
        if (error || !data) {
          toast({ title: "Veri Hatası", description: "Yazdırma için WPS verisi alınamadı.", variant: "destructive" });
          return;
        }
        await openPrintWindow({ wpsData: data }, toast);
      };

      const handleGenerateDetailedReport = async () => {
        try {
          toast({ title: "WPS detaylı rapor hazırlanıyor...", description: "Tüm WPS verileri toplanıyor." });

          const { data: allWps, error } = await supabase
            .from('wps')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;

          const filteredWps = searchTerm 
            ? allWps.filter(item =>
                Object.values(item).some(val =>
                  String(val).toLowerCase().includes(searchTerm.toLowerCase())
                )
              )
            : allWps;

          // Proses bazlı analiz
          const byProcess = filteredWps.reduce((acc, w) => {
            const process = w.welding_process || 'Belirtilmemiş';
            if (!acc[process]) acc[process] = 0;
            acc[process]++;
            return acc;
          }, {});

          // Pozisyon bazlı analiz
          const byPosition = filteredWps.reduce((acc, w) => {
            const pos = w.position || 'Belirtilmemiş';
            if (!acc[pos]) acc[pos] = 0;
            acc[pos]++;
            return acc;
          }, {});

          // Malzeme bazlı analiz
          const byMaterial = filteredWps.reduce((acc, w) => {
            const material = w.part1?.material_type || 'Belirtilmemiş';
            if (!acc[material]) acc[material] = 0;
            acc[material]++;
            return acc;
          }, {});

          const reportId = `RPR-WPS-DET-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const reportData = {
            title: 'WPS Yönetimi - Detaylı Rapor',
            reportId,
            filters: {
              'Rapor Tarihi': new Date().toLocaleDateString('tr-TR'),
              'Toplam WPS': filteredWps.length.toString(),
              'Arama Terimi': searchTerm || 'Yok'
            },
            kpiCards: [
              { title: 'Toplam WPS', value: filteredWps.length.toString() },
              { title: 'Farklı Proses', value: Object.keys(byProcess).length.toString() },
              { title: 'Farklı Pozisyon', value: Object.keys(byPosition).length.toString() },
              { title: 'Farklı Malzeme', value: Object.keys(byMaterial).length.toString() }
            ],
            tableData: {
              headers: ['WPS Kodu', 'Parça Kodu', 'Malzeme', 'Kalınlık', 'Proses', 'Pozisyon', 'Birleştirme Tipi', 'Kaynak Ağzı', 'Oluşturulma Tarihi'],
              rows: filteredWps.map(w => [
                w.wps_code || '-',
                w.part_code || 'N/A',
                w.part1?.material_type || 'N/A',
                `${w.part1?.thickness || w.part1?.pipe_wt || 'N/A'} mm`,
                w.welding_process || 'N/A',
                w.position || 'N/A',
                w.joint_type || 'N/A',
                w.joint_design || 'N/A',
                new Date(w.created_at).toLocaleDateString('tr-TR')
              ])
            },
            signatureFields: [
              { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
              { title: 'Kontrol Eden', name: '', role: '..................' },
              { title: 'Onaylayan', name: '', role: '..................' }
            ]
          };

          await openPrintWindow(reportData, toast);
        } catch (error) {
          console.error('WPS detaylı rapor hatası:', error);
          toast({
            title: "Rapor Oluşturulamadı",
            description: error.message || "Rapor oluşturulurken bir hata oluştu.",
            variant: "destructive"
          });
        }
      };
    
      const renderRow = (label, value) => (
        <div className="flex justify-between py-1 border-b-2"><span className="text-sm text-gray-500">{label}</span><span className="text-sm font-medium">{value || 'N/A'}</span></div>
      );
    
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2"><FileText className="h-5 w-5" /><span>WPS Yönetimi</span></CardTitle>
                  <CardDescription>Mevcut Kaynak Prosedürü Spesifikasyonlarını (WPS) yönetin ve yenilerini oluşturun.</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={() => openFormDialog()}><Plus className="h-4 w-4 mr-2" />Yeni WPS Oluştur</Button>
                  <Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="data" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="data">Veri Takip</TabsTrigger>
                  <TabsTrigger value="analysis"><BarChart3 className="h-4 w-4 mr-2" />Detaylı Analiz</TabsTrigger>
                </TabsList>
                
                <TabsContent value="data" className="space-y-4">
                  <div className="mb-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="WPS kodu, parça kodu, malzeme veya prosese göre ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div></div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr>{['WPS Kodu', 'Parça Kodu', 'Malzeme', 'Kalınlık', 'Proses', 'Pozisyon', 'Oluşturulma', 'İşlemler'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredWpsList.map(wps => (
                          <tr key={wps.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{wps.wps_code}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{wps.part_code}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{wps.part1_material}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{wps.part1_thickness_display}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{wps.welding_process}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{wps.position}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">{new Date(wps.created_at).toLocaleDateString('tr-TR')}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm"><div className="flex items-center space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => openViewDialog(wps)}><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openFormDialog(wps)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleGeneratePDF(wps.id)}><Download className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(wps)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredWpsList.length === 0 && <p className="text-center text-gray-500 py-8">Kayıt bulunamadı.</p>}
                  </div>
                </TabsContent>
                
                <TabsContent value="analysis" className="space-y-6">
                  {/* Özet KPI */}
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardContent className="p-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-blue-700">{analysisData.totalCount}</div>
                        <p className="text-sm text-gray-600 mt-2">Toplam WPS Kaydı</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Proses Bazlı Analiz */}
                  {Object.keys(analysisData.byProcess).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle>Kaynak Prosesi Dağılımı</CardTitle>
                          <CardDescription>Proses bazında WPS sayıları</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Object.entries(analysisData.byProcess).map(([process, data]) => ({
                              proses: process.length > 15 ? process.substring(0, 15) + '...' : process,
                              sayi: data.count
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="proses" angle={-45} textAnchor="end" height={100} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="sayi" fill="#3b82f6" name="WPS Sayısı" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader>
                          <CardTitle>Kaynak Prosesi Yüzde Dağılımı</CardTitle>
                          <CardDescription>Proses bazında yüzde dağılımı</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={Object.entries(analysisData.byProcess).map(([process, data]) => ({
                                  name: process.length > 20 ? process.substring(0, 20) + '...' : process,
                                  value: data.count
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {Object.keys(analysisData.byProcess).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
                  {/* Pozisyon ve Birleştirme Tipi */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(analysisData.byPosition).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Kaynak Pozisyonu Analizi</CardTitle>
                          <CardDescription>Pozisyon bazında WPS sayıları</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Object.entries(analysisData.byPosition).map(([position, data]) => ({
                              pozisyon: position,
                              sayi: data.count
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="pozisyon" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="sayi" fill="#10b981" name="WPS Sayısı" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                    
                    {Object.keys(analysisData.byJointType).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Birleştirme Tipi Analizi</CardTitle>
                          <CardDescription>Birleştirme tipi bazında WPS sayıları</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={Object.entries(analysisData.byJointType).map(([jointType, data]) => ({
                              tip: jointType,
                              sayi: data.count
                            }))}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="tip" angle={-45} textAnchor="end" height={100} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="sayi" fill="#f97316" name="WPS Sayısı" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  
                  {/* Malzeme Bazlı Analiz */}
                  {Object.keys(analysisData.byMaterial).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Malzeme Bazlı Analiz</CardTitle>
                        <CardDescription>Malzeme tipi bazında WPS sayıları</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={Object.entries(analysisData.byMaterial)
                            .sort((a, b) => b[1].count - a[1].count)
                            .slice(0, 10)
                            .map(([material, data]) => ({
                              malzeme: material.length > 20 ? material.substring(0, 20) + '...' : material,
                              sayi: data.count
                            }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="malzeme" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="sayi" fill="#8b5cf6" name="WPS Sayısı" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Aylık Trend */}
                  {analysisData.monthlyTrend.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Aylık WPS Oluşturma Trendi</CardTitle>
                        <CardDescription>Zaman içinde WPS oluşturma sayıları</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={analysisData.monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="monthLabel" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#3b82f6" name="WPS Sayısı" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
    
          <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
            <DialogContent className="max-w-6xl">
              <DialogHeader><DialogTitle>{formData.id ? 'WPS Düzenle' : 'Yeni WPS Oluştur'}</DialogTitle><DialogDescription>Standartlara dayalı, akıllı öneriler ile WPS oluşturun.</DialogDescription></DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 modal-body-scroll">
                <WPSForm formData={formData} setFormData={handleSetFormData} suggestions={suggestions} applySuggestions={applySuggestions} onFileChange={handleFileChange} onRemoveAttachment={removeAttachment} uploading={uploading} />
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setShowFormDialog(false)}>İptal</Button><Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />{formData.id ? 'Güncelle' : 'Kaydet'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
    
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>{selectedWPS && <><DialogTitle>{selectedWPS.wps_code}</DialogTitle><DialogDescription>Oluşturulma: {new Date(selectedWPS.created_at).toLocaleString('tr-TR')}</DialogDescription></>}</DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-4 modal-body-scroll">
                {selectedWPS && <div className="space-y-4">
                    <Card><CardHeader><CardTitle className="text-base">Temel Bilgiler</CardTitle></CardHeader><CardContent>{[
                      { label: 'Parça Kodu', value: selectedWPS.part_code },
                      { label: 'Malzeme', value: `${selectedWPS.part1?.material_type} / ${selectedWPS.part2?.material_type}` },
                      { label: 'Kalınlık', value: `${selectedWPS.part1?.thickness || selectedWPS.part1?.pipe_wt} mm` },
                      { label: 'Kaynak Prosesi', value: selectedWPS.welding_process },
                      { label: 'Pozisyon', value: selectedWPS.position },
                      { label: 'Birleştirme Tipi', value: selectedWPS.joint_type },
                      { label: 'Kaynak Ağzı', value: selectedWPS.joint_design },
                    ].map(item => renderRow(item.label, item.value))}</CardContent></Card>
                    <Card><CardHeader><CardTitle className="text-base">Parametreler</CardTitle></CardHeader><CardContent>{[
                      { label: 'Akım Aralığı (A)', value: selectedWPS.current_range },
                      { label: 'Voltaj Aralığı (V)', value: selectedWPS.voltage_range },
                      { label: 'Tel Sürme Hızı (m/min)', value: selectedWPS.wire_feed_speed },
                      { label: 'Robot Hızı (mm/sn)', value: selectedWPS.robot_speed },
                      { label: 'Isı Girdisi (kJ/mm)', value: selectedWPS.heat_input },
                      { label: 'Tel Tipi / Çapı', value: `${selectedWPS.wire_type} / ${selectedWPS.wire_diameter} mm` },
                      { label: 'Gaz Tipi / Debi', value: `${selectedWPS.gas_type} / ${selectedWPS.gas_flow} l/min` },
                    ].map(item => renderRow(item.label, item.value))}</CardContent></Card>
                    {selectedWPS.attachments && selectedWPS.attachments.length > 0 && (
                        <Card><CardHeader><CardTitle className="text-base">Eğitim Dokümanları</CardTitle></CardHeader><CardContent>
                            <div className="space-y-2">
                                {selectedWPS.attachments.map((file, index) => (
                                    <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                                        <Paperclip className="h-4 w-4 text-gray-600"/>
                                        <span className="text-sm font-medium text-blue-600 hover:underline">{file.name}</span>
                                    </a>
                                ))}
                            </div>
                        </CardContent></Card>
                    )}
                  </div>}
              </div>
            </DialogContent>
          </Dialog>
    
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>WPS Silmeyi Onayla</DialogTitle><DialogDescription>"{selectedWPS?.wps_code}" kodlu WPS'i kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</DialogDescription></DialogHeader>
              <DialogFooter><Button variant="outline" onClick={() => setShowDeleteDialog(false)}>İptal</Button><Button variant="destructive" onClick={handleDelete}>Sil</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      );
    };
    export default WPSCreator;