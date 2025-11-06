import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Save, Edit, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';

const TrainingPlan = () => {
  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [formState, setFormState] = useState(getInitialFormState());
  const [uploadingFile, setUploadingFile] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const employeeOptions = useMemo(() => employees.map(emp => ({
    value: emp.id,
    label: `${emp.registration_number} - ${emp.first_name} ${emp.last_name}`
  })).sort((a, b) => a.label.localeCompare(b.label)), [employees]);

  function getInitialFormState() {
    return {
      planned_date: new Date().toISOString().split('T')[0],
      actual_date: null,
      name: '',
      description: '',
      location: '',
      status: 'Planlandı',
      trainer_id: null,
      passing_grade: 80,
    };
  }

  const fetchData = useCallback(async () => {
    const { data: trainingsData, error: trainingsError } = await supabase.from('trainings').select('*, trainer:employees(first_name, last_name, registration_number)').order('planned_date', { ascending: false });
    const { data: employeesData, error: employeesError } = await supabase.from('employees').select('*').eq('is_active', true);

    if (trainingsError || employeesError) {
      toast({ title: "Veri Yüklenemedi", description: (trainingsError || employeesError).message, variant: "destructive" });
    } else {
      setTrainings(trainingsData.map(t => ({...t, trainer_name: t.trainer ? `${t.trainer.first_name} ${t.trainer.last_name}` : 'Belirtilmemiş'})));
      setEmployees(employeesData);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!formState.name || !formState.planned_date) {
      toast({ title: "Eksik Bilgi", description: "Eğitim adı ve planlanan tarih zorunludur.", variant: "destructive" });
      return;
    }

    const { trainer_name, trainer, ...saveData } = formState;
    let response;
    if (editingTraining) {
      response = await supabase.from('trainings').update(saveData).eq('id', editingTraining.id).select();
    } else {
      response = await supabase.from('trainings').insert(saveData).select();
    }

    if (response.error) {
      toast({ title: "Kayıt Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: editingTraining ? "Eğitim Güncellendi" : "Eğitim Eklendi" });
      logAction(editingTraining ? 'UPDATE_TRAINING' : 'CREATE_TRAINING', `Eğitim: ${response.data[0].name}`, user);
      fetchData();
      setShowFormDialog(false);
      setEditingTraining(null);
    }
  };

  const openForm = (training = null) => {
    if (training) {
      setEditingTraining(training);
      setFormState({
        ...training,
        planned_date: new Date(training.planned_date).toISOString().split('T')[0],
        actual_date: training.actual_date ? new Date(training.actual_date).toISOString().split('T')[0] : null
      });
    } else {
      setEditingTraining(null);
      setFormState(getInitialFormState());
    }
    setShowFormDialog(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Planlandı': return 'bg-yellow-100 text-yellow-800';
      case 'Devam Ediyor': return 'bg-blue-100 text-blue-800';
      case 'Tamamlandı': return 'bg-green-100 text-green-800';
      case 'İptal Edildi': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRowClick = (trainingId) => {
    navigate(`/trainings/${trainingId}`);
  };

  const handleEditClick = (e, training) => {
    e.stopPropagation();
    openForm(training);
  };

  const handleFileUpload = async (e, trainingId) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    // Dosya tipini kontrol et
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({ 
        title: "Geçersiz Dosya Tipi", 
        description: "Sadece PDF, Excel, Word ve resim dosyaları (JPEG, PNG, GIF) yüklenebilir.", 
        variant: "destructive" 
      });
      return;
    }

    // Dosya boyutunu kontrol et (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ 
        title: "Dosya Çok Büyük", 
        description: "Dosya boyutu 10MB'dan küçük olmalıdır.", 
        variant: "destructive" 
      });
      return;
    }

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${trainingId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('training-documents')
        .upload(fileName, file);

      if (uploadError) {
        // Bucket yoksa oluşturmayı dene (bu genellikle Supabase Dashboard'dan yapılır)
        if (uploadError.message.includes('Bucket') || uploadError.message.includes('not found')) {
          toast({ 
            title: "Bucket Bulunamadı", 
            description: "Lütfen Supabase Dashboard'dan 'training-documents' adında public bir bucket oluşturun.", 
            variant: "destructive" 
          });
          return;
        }
        throw uploadError;
      }

      // Dosya URL'ini al
      const { data: { publicUrl } } = supabase.storage
        .from('training-documents')
        .getPublicUrl(fileName);

      // Eğitim kaydına doküman URL'ini ekle
      const { data: trainingData, error: fetchError } = await supabase
        .from('trainings')
        .select('documents')
        .eq('id', trainingId)
        .single();

      if (fetchError) throw fetchError;

      const documents = trainingData?.documents || [];
      documents.push({
        name: file.name,
        url: publicUrl,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.id
      });

      const { error: updateError } = await supabase
        .from('trainings')
        .update({ documents })
        .eq('id', trainingId);

      if (updateError) {
        throw updateError;
      }

      toast({ title: "Başarılı", description: "Doküman başarıyla yüklendi." });
      logAction('UPLOAD_TRAINING_DOCUMENT', `Eğitim: ${trainingId} - Dosya: ${file.name}`, user);
      fetchData();
    } catch (error) {
      toast({ 
        title: "Yükleme Başarısız", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setUploadingFile(false);
      e.target.value = ''; // Input'u temizle
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center space-x-2"><BookOpen className="h-5 w-5" /><span>Personel Eğitim Yönetimi</span></CardTitle>
                <CardDescription>Planlanan ve tamamlanan personel eğitimlerini, dokümanlarını ve sınavlarını yönetin.</CardDescription>
              </div>
              <Button onClick={() => openForm()}><Plus className="h-4 w-4 mr-2" />Yeni Eğitim Planla</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eğitim Adı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planlanan Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gerçekleşen Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eğitmen</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {trainings.map((training) => (
                    <tr key={training.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRowClick(training.id)}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{training.name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(training.planned_date).toLocaleDateString('tr-TR')}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {training.actual_date ? new Date(training.actual_date).toLocaleDateString('tr-TR') : <span className="text-gray-400 italic">Henüz gerçekleşmedi</span>}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm"><span className={`inline-flex px-2 py-1 font-semibold rounded-full ${getStatusColor(training.status)}`}>{training.status}</span></td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{training.trainer_name}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => handleEditClick(e, training)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.gif"
                              onChange={(e) => handleFileUpload(e, training.id)}
                              disabled={uploadingFile}
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              disabled={uploadingFile}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {trainings.length === 0 && <div className="text-center py-8 text-gray-500"><BookOpen className="h-8 w-8 mx-auto mb-2" /><p>Henüz planlanmış eğitim bulunmuyor.</p></div>}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingTraining ? 'Eğitimi Düzenle' : 'Yeni Eğitim Planla'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 grid grid-cols-2 gap-4 modal-body-scroll px-6">
            <div className="col-span-2 space-y-2"><Label>Eğitim Adı *</Label><Input placeholder="Örn: MAG Kaynakçılığı Temelleri" value={formState.name} onChange={(e) => setFormState({ ...formState, name: e.target.value })} /></div>
            <div className="col-span-2 space-y-2"><Label>Açıklama</Label><Input placeholder="Eğitimin amacı ve içeriği" value={formState.description} onChange={(e) => setFormState({ ...formState, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Planlanan Tarih *</Label><Input type="date" value={formState.planned_date} onChange={(e) => setFormState({ ...formState, planned_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Gerçekleşen Tarih</Label><Input type="date" value={formState.actual_date || ''} onChange={(e) => setFormState({ ...formState, actual_date: e.target.value || null })} /></div>
            <div className="space-y-2"><Label>Eğitim Yeri</Label><Input placeholder="Örn: Konferans Salonu" value={formState.location} onChange={(e) => setFormState({ ...formState, location: e.target.value })} /></div>
            <div className="space-y-2"><Label>Eğitmen</Label><Combobox options={employeeOptions} value={formState.trainer_id} onSelect={(value) => setFormState({...formState, trainer_id: value})} placeholder="Eğitmen Seç" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı."/></div>
            <div className="space-y-2"><Label>Durum</Label><Select value={formState.status} onValueChange={status => setFormState({...formState, status})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Planlandı">Planlandı</SelectItem><SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem><SelectItem value="Tamamlandı">Tamamlandı</SelectItem><SelectItem value="İptal Edildi">İptal Edildi</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Geçme Notu (%)</Label><Input type="number" placeholder="80" value={formState.passing_grade} onChange={(e) => setFormState({ ...formState, passing_grade: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>İptal</Button>
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />{editingTraining ? 'Güncelle' : 'Kaydet'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrainingPlan;