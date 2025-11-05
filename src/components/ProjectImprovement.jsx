import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Plus, Edit, Trash2, Save, FileText, Search, Upload, X, Paperclip } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatCurrency, logAction, openPrintWindow } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const initialFormState = {
  improvement_date: new Date().toISOString().split('T')[0],
  subject: '',
  description: '',
  previous_cost: '',
  current_cost: '',
  improvement_cost: '',
  attachments: []
};

const ProjectImprovement = () => {
  const [improvements, setImprovements] = useState([]);
  const [filteredImprovements, setFilteredImprovements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchData = async () => {
    const { data, error } = await supabase.from('project_improvements').select('*').order('improvement_date', { ascending: false });
    if (error) {
      toast({ title: "Veri Yüklenemedi", description: error.message, variant: "destructive" });
    } else {
      setImprovements(data);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const results = improvements.filter(item =>
      item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredImprovements(results);
  }, [searchTerm, improvements]);

  const annualImpact = useMemo(() => {
    const prev = parseFloat(formState.previous_cost) || 0;
    const curr = parseFloat(formState.current_cost) || 0;
    return prev - curr;
  }, [formState.previous_cost, formState.current_cost]);

  const roi = useMemo(() => {
    const improvementCost = parseFloat(formState.improvement_cost) || 0;
    if (improvementCost === 0) return Infinity;
    return (annualImpact / improvementCost) * 100;
  }, [annualImpact, formState.improvement_cost]);

  const handleSave = async () => {
    const dataToSave = { ...formState, annual_impact: annualImpact };
    let response;

    if (editingItem) {
      response = await supabase.from('project_improvements').update(dataToSave).eq('id', editingItem.id).select();
    } else {
      response = await supabase.from('project_improvements').insert(dataToSave).select();
    }

    if (response.error) {
      toast({ title: "Kayıt Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: "Başarılı", description: "Proje bazlı iyileştirme başarıyla kaydedildi." });
      logAction(editingItem ? 'UPDATE' : 'CREATE', `ProjectImprovement: ${response.data[0].id}`, user);
      setShowDialog(false);
      setEditingItem(null);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('project_improvements').delete().eq('id', deleteConfirm.id);

    if (error) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Silindi", description: "İyileştirme başarıyla silindi.", variant: "destructive" });
      logAction('DELETE', `ProjectImprovement: ${deleteConfirm.id}`, user);
      fetchData();
    }
    setDeleteConfirm(null);
    setViewingItem(null);
  };
  
  const handleFileChange = async (event) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setUploading(true);
    
    const file = event.target.files[0];
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('attachments').upload(`project_improvements/${fileName}`, file);
    
    if (error) {
      toast({ title: "Dosya Yüklenemedi", description: error.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
      setFormState(prev => ({ ...prev, attachments: [...(prev.attachments || []), { name: file.name, url: publicUrl, size: file.size, type: file.type }] }));
      toast({ title: "Dosya Yüklendi", description: file.name });
    }
    setUploading(false);
  };

  const removeAttachment = (indexToRemove) => {
    const fileToRemove = formState.attachments[indexToRemove];
    setFormState(prev => ({ ...prev, attachments: prev.attachments.filter((_, index) => index !== indexToRemove) }));
    toast({ title: "Ek Kaldırıldı", description: fileToRemove.name, variant: "default" });
  };
  
  const handlePrint = async (item) => {
    const reportId = `RPR-PBI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reportData = {
        title: 'Proje Bazlı İyileştirme Raporu',
        reportId,
        signatureFields: [
            { title: 'Hazırlayan', name: 'Tuğçe MAVİ BATTAL', role: ' ' },
            { title: 'Kontrol Eden', name: '', role: '..................' },
            { title: 'Onaylayan', name: '', role: '..................' }
        ]
    };

    if (item) {
        reportData.singleItemData = {
            'Proje Konusu': item.subject,
            'Proje Açıklaması': item.description,
            'İyileştirme Tarihi': format(new Date(item.improvement_date), 'dd.MM.yyyy'),
            'Önceki Maliyet (Yıllık)': formatCurrency(item.previous_cost),
            'Mevcut Maliyet (Yıllık)': formatCurrency(item.current_cost),
            'İyileştirme Maliyeti': formatCurrency(item.improvement_cost),
            'Yıllık Kazanç': formatCurrency(item.annual_impact),
        };
        reportData.attachments = item.attachments;

    } else {
        const totalAnnualImpact = filteredImprovements.reduce((sum, item) => sum + item.annual_impact, 0);
        reportData.kpiCards = [{ title: 'Toplam Yıllık Kazanç', value: formatCurrency(totalAnnualImpact) }];
        reportData.tableData = {
            headers: ['Tarih', 'Konu', 'Önceki Maliyet', 'Mevcut Maliyet', 'Yıllık Kazanç'],
            rows: filteredImprovements.map(s => [
                format(new Date(s.improvement_date), 'dd.MM.yyyy'),
                s.subject,
                formatCurrency(s.previous_cost),
                formatCurrency(s.current_cost),
                formatCurrency(s.annual_impact)
            ])
        };
    }
    
    await openPrintWindow(reportData, toast);
};


  const openDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormState({ ...item, improvement_date: format(new Date(item.improvement_date), 'yyyy-MM-dd') });
    } else {
      setEditingItem(null);
      setFormState(initialFormState);
    }
    setShowDialog(true);
  };
  
  const totalAnnualImpact = useMemo(() => filteredImprovements.reduce((sum, item) => sum + item.annual_impact, 0), [filteredImprovements]);

  const renderForm = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Tarih</Label><Input type="date" value={formState.improvement_date} onChange={(e) => setFormState({ ...formState, improvement_date: e.target.value })} /></div>
        <div className="space-y-2 md:col-span-2"><Label>Proje Konusu</Label><Input placeholder="Örn: X hattında otomasyon projesi" value={formState.subject} onChange={(e) => setFormState({ ...formState, subject: e.target.value })} /></div>
        <div className="space-y-2 md:col-span-2"><Label>Açıklama</Label><Textarea placeholder="Projenin detaylarını ve amacını açıklayın" value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} /></div>
        <div className="space-y-2"><Label>Önceki Yıllık Maliyet (₺)</Label><Input type="number" placeholder="150000" value={formState.previous_cost} onChange={(e) => setFormState({ ...formState, previous_cost: e.target.value })} /></div>
        <div className="space-y-2"><Label>Mevcut Yıllık Maliyet (₺)</Label><Input type="number" placeholder="90000" value={formState.current_cost} onChange={(e) => setFormState({ ...formState, current_cost: e.target.value })} /></div>
        <div className="space-y-2 md:col-span-2"><Label>İyileştirme Maliyeti (₺)</Label><Input type="number" placeholder="25000" value={formState.improvement_cost} onChange={(e) => setFormState({ ...formState, improvement_cost: e.target.value })} /></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4 text-center"><Label>Yıllık Kazanç</Label><p className="text-xl font-bold text-green-600">{formatCurrency(annualImpact)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><Label>ROI</Label><p className={`text-xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{isFinite(roi) ? `${roi.toFixed(2)}%` : 'N/A'}</p></CardContent></Card>
      </div>
      <div className="space-y-2 mt-4">
        <Label>Kanıt Dokümanları</Label>
        <div className="p-4 border-2 border-dashed rounded-lg text-center">
            <Button asChild variant="outline" size="sm">
                <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Dosya Yükle
                </label>
            </Button>
            <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.gif,.xls,.xlsx"/>
            {uploading && <p className="text-sm text-gray-500 mt-2">Yükleniyor...</p>}
        </div>
        {(formState.attachments && formState.attachments.length > 0) && (
            <div className="mt-2 space-y-2">
                {formState.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded-md">
                         <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate" title={file.name}>
                                {file.name}
                            </a>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeAttachment(index)}><X className="h-4 w-4" /></Button>
                    </div>
                ))}
            </div>
        )}
      </div>
    </>
  );
  
  const renderDetailView = () => (
     <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2"><p className="font-semibold text-gray-500">Proje Konusu:</p><p className="font-medium text-lg">{viewingItem.subject}</p></div>
            <div className="col-span-2"><p className="font-semibold text-gray-500">Açıklama:</p><p>{viewingItem.description}</p></div>
            <div><p className="font-semibold text-gray-500">Tarih:</p><p>{format(new Date(viewingItem.improvement_date), 'dd.MM.yyyy')}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4">
             <Card><CardHeader className="p-4"><CardTitle className="text-base">Önceki Maliyet</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{formatCurrency(viewingItem.previous_cost)}</p></CardContent></Card>
             <Card><CardHeader className="p-4"><CardTitle className="text-base">Mevcut Maliyet</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-2xl font-bold">{formatCurrency(viewingItem.current_cost)}</p></CardContent></Card>
        </div>
        <Card className="bg-green-50 border-green-200"><CardHeader className="p-4"><CardTitle className="text-base text-green-800">Yıllık Kazanç</CardTitle></CardHeader><CardContent className="p-4 pt-0"><p className="text-3xl font-bold text-green-600">{formatCurrency(viewingItem.annual_impact)}</p></CardContent></Card>
        {viewingItem.attachments && viewingItem.attachments.length > 0 && (
          <div>
            <h4 className="text-md font-semibold mb-2">Kanıt Dokümanları</h4>
            <div className="space-y-2">
              {viewingItem.attachments.map((file, index) => (
                <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-gray-100 rounded-md hover:bg-gray-200">
                  <Paperclip className="h-4 w-4" />
                  <span className="text-sm font-medium text-blue-600 hover:underline">{file.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2"><Lightbulb className="h-5 w-5 text-yellow-500" /><span>Proje Bazlı İyileştirmeler</span></CardTitle>
              <CardDescription>Büyük ölçekli iyileştirme projelerini ve finansal etkilerini takip edin.</CardDescription>
            </div>
             <div className="flex space-x-2">
                <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2"/>Yeni Proje</Button>
                <Button variant="outline" onClick={() => handlePrint()}><FileText className="h-4 w-4 mr-2"/>Yazdır</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input placeholder="Proje konusu veya açıklamada ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
            <div className="text-right">
                <p className="text-sm text-gray-500">Toplam Yıllık Kazanç</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAnnualImpact)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImprovements.map(item => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col" onClick={() => setViewingItem(item)}>
                <CardHeader>
                  <CardTitle className="text-lg">{item.subject}</CardTitle>
                  <CardDescription>{format(new Date(item.improvement_date), 'dd MMMM yyyy', { locale: tr })}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <p className="text-sm text-gray-600 line-clamp-3">{item.description}</p>
                </CardContent>
                <CardFooter className="flex justify-between items-center bg-gray-50 p-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Yıllık Kazanç</p>
                    <p className="font-bold text-green-600">{formatCurrency(item.annual_impact)}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePrint(item); }}><FileText className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDialog(item); }}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
          {filteredImprovements.length === 0 && <div className="text-center py-10 text-gray-500"><p>Proje bulunamadı.</p></div>}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>{editingItem ? 'Projeyi Düzenle' : 'Yeni Proje Ekle'}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 modal-body-scroll">{renderForm()}</div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button><Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />{editingItem ? 'Güncelle' : 'Kaydet'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!viewingItem} onOpenChange={setViewingItem}>
         <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>Proje Detayı</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 modal-body-scroll">{viewingItem && renderDetailView()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePrint(viewingItem)}>Yazdır</Button>
            <Button onClick={() => { openDialog(viewingItem); setViewingItem(null); }}>Düzenle</Button>
            <Button variant="destructive" onClick={() => setDeleteConfirm(viewingItem)}>Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Silme Onayı</DialogTitle><DialogDescription>"{deleteConfirm?.subject}" projesini kalıcı olarak silmek istediğinizden emin misiniz?</DialogDescription></DialogHeader>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button><Button variant="destructive" onClick={handleDelete}>Sil</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ProjectImprovement;