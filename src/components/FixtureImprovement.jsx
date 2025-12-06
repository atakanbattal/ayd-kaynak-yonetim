import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Plus, Edit, Trash2, Save, FileText, Search, Upload, X, Image as ImageIcon, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction, openPrintWindow } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const initialFormState = {
  improvement_date: new Date().toISOString().split('T')[0],
  created_at: new Date().toISOString(),
  part_code: '',
  before_image: null,
  after_image: null,
  improvement_reason: '',
  result: '',
  responsible: '',
};

const FixtureImprovement = () => {
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
    const { data, error } = await supabase.from('fixture_improvements').select('*').order('improvement_date', { ascending: false });
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
      (item.part_code && item.part_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.improvement_reason && item.improvement_reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.result && item.result.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredImprovements(results);
  }, [searchTerm, improvements]);

  const handleImageUpload = async (event, imageType) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setUploading(true);
    
    const file = event.target.files[0];
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('attachments').upload(`fixture_improvements/${fileName}`, file);
    
    if (error) {
      toast({ title: "Resim Yüklenemedi", description: error.message, variant: "destructive" });
    } else {
      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
      setFormState(prev => ({ ...prev, [imageType]: publicUrl }));
      toast({ title: "Resim Yüklendi", description: file.name });
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!formState.part_code || !formState.improvement_reason) {
      toast({ title: "Eksik Bilgi", description: "Parça kodu ve iyileştirme sebebi zorunludur.", variant: "destructive" });
      return;
    }

    const dataToSave = {
      ...formState,
      created_at: editingItem ? formState.created_at : new Date().toISOString()
    };

    let response;
    if (editingItem) {
      const { id, ...updateData } = dataToSave;
      response = await supabase.from('fixture_improvements').update(updateData).eq('id', editingItem.id).select();
    } else {
      response = await supabase.from('fixture_improvements').insert(dataToSave).select();
    }

    if (response.error) {
      toast({ title: "Kayıt Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: "Başarılı", description: "Fikstür iyileştirmesi başarıyla kaydedildi." });
      logAction(editingItem ? 'UPDATE' : 'CREATE', `FixtureImprovement: ${response.data[0].id}`, user);
      setShowDialog(false);
      setEditingItem(null);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('fixture_improvements').delete().eq('id', deleteConfirm.id);

    if (error) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Silindi", description: "İyileştirme başarıyla silindi.", variant: "destructive" });
      logAction('DELETE', `FixtureImprovement: ${deleteConfirm.id}`, user);
      fetchData();
    }
    setDeleteConfirm(null);
    setViewingItem(null);
  };

  const handleGenerateDetailedReport = async () => {
    try {
      toast({ title: "Detaylı fikstür iyileştirme raporu hazırlanıyor...", description: "Tüm fikstür verileri toplanıyor." });

      const { data: allImprovements, error } = await supabase
        .from('fixture_improvements')
        .select('*')
        .order('improvement_date', { ascending: false });

      if (error) throw error;

      const filteredData = allImprovements.filter(f => {
        const searchMatch = !searchTerm || 
          (f.part_code && f.part_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (f.improvement_reason && f.improvement_reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (f.result && f.result.toLowerCase().includes(searchTerm.toLowerCase()));
        return searchMatch;
      });

      const byPartCode = filteredData.reduce((acc, f) => {
        const partCode = f.part_code || 'Belirtilmemiş';
        if (!acc[partCode]) acc[partCode] = 0;
        acc[partCode]++;
        return acc;
      }, {});

      const withImages = filteredData.filter(f => f.before_image || f.after_image).length;
      const withoutImages = filteredData.length - withImages;

      const reportId = `RPR-FIXTURE-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const reportData = {
        title: 'Fikstür İyileştirme - Detaylı Rapor',
        reportId,
        filters: {
          'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
          'Arama Terimi': searchTerm || 'Yok'
        },
        kpiCards: [
          { title: 'Toplam İyileştirme', value: filteredData.length.toString() },
          { title: 'Farklı Parça Kodu', value: Object.keys(byPartCode).length.toString() },
          { title: 'Resimli Kayıt', value: withImages.toString() },
          { title: 'Resimsiz Kayıt', value: withoutImages.toString() }
        ],
        tableData: {
          headers: ['Kayıt Tarihi', 'İyileştirme Tarihi', 'Parça Kodu', 'İyileştirme Sebebi', 'Sonuç', 'Önce Resim', 'Sonra Resim'],
          rows: filteredData.map(f => [
            f.created_at ? format(new Date(f.created_at), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-',
            format(new Date(f.improvement_date), 'dd.MM.yyyy', { locale: tr }),
            f.part_code || 'N/A',
            f.improvement_reason ? (f.improvement_reason.length > 50 ? f.improvement_reason.substring(0, 50) + '...' : f.improvement_reason) : '-',
            f.result ? (f.result.length > 50 ? f.result.substring(0, 50) + '...' : f.result) : '-',
            f.before_image ? 'Var' : 'Yok',
            f.after_image ? 'Var' : 'Yok'
          ])
        },
        signatureFields: [
          { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
          { title: 'Kontrol Eden', name: '', role: '..................' },
          { title: 'Onaylayan', name: '', role: '..................' }
        ]
      };

      // Parça bazlı özet ekle
      if (Object.keys(byPartCode).length > 0) {
        reportData.tableData.rows.push(
          ['---', '---', '---', '---', '---', '---', '---'],
          ...Object.entries(byPartCode)
            .sort((a, b) => b[1] - a[1])
            .map(([partCode, count]) => [
              'ÖZET',
              '-',
              partCode,
              `${count} iyileştirme`,
              '-',
              '-',
              '-'
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

  const handlePrint = async (item) => {
    const reportId = `RPR-FI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const reportData = {
        title: 'Fikstür İyileştirme Raporu',
        reportId,
        signatureFields: [
            { title: 'Hazırlayan', name: 'Atakan Battal', role: ' ' },
            { title: 'Kontrol Eden', name: '', role: '..................' },
            { title: 'Onaylayan', name: '', role: '..................' }
        ]
    };

    if (item) {
        reportData.singleItemData = {
            'Parça Kodu': item.part_code,
            'İyileştirme Tarihi': format(new Date(item.improvement_date), 'dd.MM.yyyy'),
            'Kayıt Tarihi': item.created_at ? format(new Date(item.created_at), 'dd.MM.yyyy HH:mm:ss') : '-',
            'Sorumlu': item.responsible || 'Belirtilmemiş',
            'İyileştirme Sebebi': item.improvement_reason,
            'Sonuç': item.result || '-',
        };
    } else {
        reportData.kpiCards = [
          { title: 'Toplam İyileştirme', value: filteredImprovements.length },
        ];
        reportData.tableData = {
            headers: ['Tarih', 'Parça Kodu', 'İyileştirme Sebebi', 'Sonuç'],
            rows: filteredImprovements.map(s => [
                format(new Date(s.improvement_date), 'dd.MM.yyyy'),
                s.part_code,
                s.improvement_reason,
                s.result || '-'
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

  const renderForm = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Tarih *</Label><Input type="date" value={formState.improvement_date} onChange={(e) => setFormState({ ...formState, improvement_date: e.target.value })} /></div>
        <div className="space-y-2"><Label>Parça Kodu *</Label><Input placeholder="Örn: FK-12345" value={formState.part_code} onChange={(e) => setFormState({ ...formState, part_code: e.target.value })} /></div>
        <div className="md:col-span-2 space-y-2"><Label>Sorumlu</Label><Input placeholder="Sorumlu kişi adı" value={formState.responsible} onChange={(e) => setFormState({ ...formState, responsible: e.target.value })} /></div>
        <div className="md:col-span-2 space-y-2"><Label>İyileştirme Sebebi *</Label><Textarea placeholder="İyileştirmenin nedenini açıklayın" value={formState.improvement_reason} onChange={(e) => setFormState({ ...formState, improvement_reason: e.target.value })} rows={3} /></div>
        <div className="md:col-span-2 space-y-2"><Label>Sonuç</Label><Textarea placeholder="İyileştirmenin sonuçlarını açıklayın" value={formState.result} onChange={(e) => setFormState({ ...formState, result: e.target.value })} rows={3} /></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="space-y-2">
          <Label>Önceki Durum Resmi</Label>
          <div className="p-4 border-2 border-dashed rounded-lg text-center">
            {formState.before_image ? (
              <div className="space-y-2">
                <img src={formState.before_image} alt="Önceki durum" className="w-full h-40 object-cover rounded" />
                <Button variant="outline" size="sm" onClick={() => setFormState(prev => ({ ...prev, before_image: null }))}>
                  <X className="h-4 w-4 mr-2" />Kaldır
                </Button>
              </div>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label htmlFor="before-image-fixture" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />Resim Yükle
                  </label>
                </Button>
                <Input id="before-image-fixture" type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'before_image')} disabled={uploading} accept="image/*" />
              </>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Sonraki Durum Resmi</Label>
          <div className="p-4 border-2 border-dashed rounded-lg text-center">
            {formState.after_image ? (
              <div className="space-y-2">
                <img src={formState.after_image} alt="Sonraki durum" className="w-full h-40 object-cover rounded" />
                <Button variant="outline" size="sm" onClick={() => setFormState(prev => ({ ...prev, after_image: null }))}>
                  <X className="h-4 w-4 mr-2" />Kaldır
                </Button>
              </div>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label htmlFor="after-image-fixture" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />Resim Yükle
                  </label>
                </Button>
                <Input id="after-image-fixture" type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'after_image')} disabled={uploading} accept="image/*" />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderDetailView = () => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="font-semibold text-gray-500">Parça Kodu:</p><p className="font-semibold text-lg">{viewingItem.part_code}</p></div>
            <div><p className="font-semibold text-gray-500">İyileştirme Tarihi:</p><p>{format(new Date(viewingItem.improvement_date), 'dd.MM.yyyy')}</p></div>
            <div><p className="font-semibold text-gray-500">Kayıt Tarihi/Saat:</p><p>{viewingItem.created_at ? format(new Date(viewingItem.created_at), 'dd.MM.yyyy HH:mm:ss') : '-'}</p></div>
            <div><p className="font-semibold text-gray-500">Sorumlu:</p><p>{viewingItem.responsible || 'Belirtilmemiş'}</p></div>
            <div className="col-span-2"><p className="font-semibold text-gray-500 mb-1">İyileştirme Sebebi:</p><p className="text-gray-700">{viewingItem.improvement_reason}</p></div>
            <div className="col-span-2"><p className="font-semibold text-gray-500 mb-1">Sonuç:</p><p className="text-gray-700">{viewingItem.result || 'Belirtilmemiş'}</p></div>
        </div>
        {(viewingItem.before_image || viewingItem.after_image) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {viewingItem.before_image && (
              <div>
                <p className="font-semibold text-gray-500 mb-2">Önceki Durum</p>
                <img src={viewingItem.before_image} alt="Önceki durum" className="w-full h-60 object-cover rounded-lg border" />
              </div>
            )}
            {viewingItem.after_image && (
              <div>
                <p className="font-semibold text-gray-500 mb-2">Sonraki Durum</p>
                <img src={viewingItem.after_image} alt="Sonraki durum" className="w-full h-60 object-cover rounded-lg border" />
              </div>
            )}
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
              <CardTitle className="flex items-center space-x-2"><Wrench className="h-5 w-5 text-orange-500" /><span>Fikstür İyileştirme</span></CardTitle>
              <CardDescription>Fikstür iyileştirmelerini takip edin ve dokümante edin.</CardDescription>
            </div>
             <div className="flex space-x-2">
                <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2"/>Yeni İyileştirme</Button>
                <Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button>
                <Button variant="outline" onClick={() => handlePrint()}><FileText className="h-4 w-4 mr-2"/>Yazdır</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input placeholder="Parça kodu, sebep veya sonuçta ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
            <div className="text-right">
                <p className="text-sm text-gray-500">Toplam İyileştirme</p>
                <p className="text-2xl font-bold text-blue-600">{filteredImprovements.length}</p>
            </div>
          </div>
          
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Kayıt Tarihi/Saat', 'İyileştirme Tarihi', 'Parça Kodu', 'İyileştirme Sebebi', 'Sonuç', 'Resimler', ''].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 uppercase">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {filteredImprovements.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewingItem(item)}>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{item.created_at ? format(new Date(item.created_at), 'dd.MM.yyyy') : '-'}</span>
                        <span className="text-xs text-gray-500">{item.created_at ? format(new Date(item.created_at), 'HH:mm:ss') : '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{format(new Date(item.improvement_date), 'dd.MM.yyyy')}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-semibold">{item.part_code}</td>
                    <td className="px-4 py-2 max-w-xs truncate" title={item.improvement_reason}>{item.improvement_reason}</td>
                    <td className="px-4 py-2 max-w-xs truncate" title={item.result}>{item.result || '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex gap-1">
                        {item.before_image && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">Önce</span>}
                        {item.after_image && <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Sonra</span>}
                        {!item.before_image && !item.after_image && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePrint(item); }}><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDialog(item); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredImprovements.length === 0 && <div className="text-center py-10 text-gray-500"><p>İyileştirme kaydı bulunamadı.</p></div>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>{editingItem ? 'İyileştirmeyi Düzenle' : 'Yeni İyileştirme Ekle'}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 modal-body-scroll max-h-[70vh]">{renderForm()}</div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button><Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />{editingItem ? 'Güncelle' : 'Kaydet'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!viewingItem} onOpenChange={setViewingItem}>
         <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>İyileştirme Detayı</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 modal-body-scroll max-h-[70vh]">{viewingItem && renderDetailView()}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePrint(viewingItem)}>Yazdır</Button>
            <Button onClick={() => { openDialog(viewingItem); setViewingItem(null); }}>Düzenle</Button>
            <Button variant="destructive" onClick={() => setDeleteConfirm(viewingItem)}>Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Silme Onayı</DialogTitle><DialogDescription>"{deleteConfirm?.part_code}" parçasının iyileştirmesini kalıcı olarak silmek istediğinizden emin misiniz?</DialogDescription></DialogHeader>
          <DialogFooter className="mt-4"><Button variant="outline" onClick={() => setDeleteConfirm(null)}>İptal</Button><Button variant="destructive" onClick={handleDelete}>Sil</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default FixtureImprovement;


