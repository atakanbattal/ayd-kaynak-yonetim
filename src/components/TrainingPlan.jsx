import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Save, Edit, Upload, Download, BarChart3, TrendingUp, Users, Award, Target, CheckCircle, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction, openPrintWindow, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const TrainingPlan = () => {
  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [formState, setFormState] = useState(getInitialFormState());
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState('data');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Analiz verileri
  const analysisData = useMemo(() => {
    if (!trainings.length) return null;

    // Durum bazlı analiz
    const byStatus = {};
    trainings.forEach(t => {
      const status = t.status || 'Belirtilmemiş';
      if (!byStatus[status]) byStatus[status] = 0;
      byStatus[status]++;
    });

    const statusColors = {
      'Planlandı': '#F59E0B',
      'Devam Ediyor': '#3B82F6',
      'Tamamlandı': '#10B981',
      'İptal Edildi': '#EF4444'
    };

    const statusData = Object.entries(byStatus)
      .map(([name, value]) => ({ name, value, color: statusColors[name] || '#9CA3AF' }))
      .sort((a, b) => b.value - a.value);

    // Aylık trend
    const byMonth = {};
    trainings.forEach(t => {
      if (!t.planned_date) return;
      const month = format(new Date(t.planned_date), 'MMM yyyy', { locale: tr });
      if (!byMonth[month]) byMonth[month] = { planned: 0, completed: 0 };
      byMonth[month].planned++;
      if (t.status === 'Tamamlandı') byMonth[month].completed++;
    });

    const monthlyData = Object.entries(byMonth)
      .map(([month, data]) => ({ month, ...data }))
      .slice(-12);

    // Eğitmen bazlı analiz
    const byTrainer = {};
    trainings.forEach(t => {
      const trainer = t.trainer_name || 'Belirtilmemiş';
      if (!byTrainer[trainer]) byTrainer[trainer] = { total: 0, completed: 0 };
      byTrainer[trainer].total++;
      if (t.status === 'Tamamlandı') byTrainer[trainer].completed++;
    });

    const trainerData = Object.entries(byTrainer)
      .map(([name, data]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Katılımcı istatistikleri
    const totalParticipants = participants.length;
    const attendedParticipants = participants.filter(p => p.participation_status === 'Katıldı').length;
    const successfulParticipants = participants.filter(p => p.exam_passed).length;
    const totalCertificates = certificates.length;

    // Katılım oranı
    const attendanceRate = totalParticipants > 0 ? Math.round((attendedParticipants / totalParticipants) * 100) : 0;
    const successRate = attendedParticipants > 0 ? Math.round((successfulParticipants / attendedParticipants) * 100) : 0;

    // Katılım durumu pasta grafiği
    const participationData = [
      { name: 'Katıldı', value: attendedParticipants, color: '#10B981' },
      { name: 'Katılmadı', value: totalParticipants - attendedParticipants, color: '#EF4444' },
    ].filter(d => d.value > 0);

    return {
      total: trainings.length,
      planned: byStatus['Planlandı'] || 0,
      inProgress: byStatus['Devam Ediyor'] || 0,
      completed: byStatus['Tamamlandı'] || 0,
      totalParticipants,
      attendedParticipants,
      totalCertificates,
      attendanceRate,
      successRate,
      statusData,
      monthlyData,
      trainerData,
      participationData,
    };
  }, [trainings, participants, certificates]);

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
    const [trainingsRes, employeesRes, participantsRes, certificatesRes] = await Promise.all([
      supabase.from('trainings').select('*, trainer:employees(first_name, last_name, registration_number)').order('planned_date', { ascending: false }),
      supabase.from('employees').select('*').eq('is_active', true),
      supabase.from('training_participants').select('*, employee:employees(first_name, last_name)'),
      supabase.from('training_certificates').select('*'),
    ]);

    if (trainingsRes.error || employeesRes.error) {
      toast({ title: "Veri Yüklenemedi", description: (trainingsRes.error || employeesRes.error).message, variant: "destructive" });
    } else {
      setTrainings(trainingsRes.data.map(t => ({...t, trainer_name: t.trainer ? `${t.trainer.first_name} ${t.trainer.last_name}` : 'Belirtilmemiş'})));
      setEmployees(employeesRes.data);
      setParticipants(participantsRes.data || []);
      setCertificates(certificatesRes.data || []);
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

  const handleGenerateDetailedReport = async () => {
    try {
      toast({ title: "Detaylı eğitim raporu hazırlanıyor...", description: "Tüm eğitim verileri toplanıyor." });

      const { data: allTrainings, error: trainingsError } = await supabase
        .from('trainings')
        .select('*, trainer:employees(first_name, last_name)')
        .order('planned_date', { ascending: false });

      if (trainingsError) throw trainingsError;

      const { data: allParticipants, error: participantsError } = await supabase
        .from('training_participants')
        .select('*, employee:employees(first_name, last_name, registration_number)');

      if (participantsError) throw participantsError;

      const { data: allCertificates, error: certificatesError } = await supabase
        .from('training_certificates')
        .select('*, participant:training_participants(employee:employees(first_name, last_name))');

      if (certificatesError) throw certificatesError;

      const filteredData = trainings.filter(t => {
        const searchMatch = !searchTerm || 
          (t.name && t.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const statusMatch = filterStatus === 'all' || t.status === filterStatus;
        return searchMatch && statusMatch;
      });

      const trainingsByStatus = filteredData.reduce((acc, t) => {
        const status = t.status || 'Belirtilmemiş';
        if (!acc[status]) acc[status] = 0;
        acc[status]++;
        return acc;
      }, {});

      const participantsByTraining = filteredData.reduce((acc, t) => {
        const participants = allParticipants.filter(p => p.training_id === t.id);
        acc[t.id] = {
          total: participants.length,
          attended: participants.filter(p => p.participation_status === 'Katıldı').length,
          certificates: allCertificates.filter(c => {
            const participant = allParticipants.find(p => p.id === c.participant_id);
            return participant && participant.training_id === t.id;
          }).length
        };
        return acc;
      }, {});

      const totalParticipants = allParticipants.length;
      const totalAttended = allParticipants.filter(p => p.participation_status === 'Katıldı').length;
      const totalCertificates = allCertificates.length;

      const reportId = `RPR-TRAINING-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const reportData = {
        title: 'Eğitim Planlama - Detaylı Rapor',
        reportId,
        filters: {
          'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
          'Arama Terimi': searchTerm || 'Yok',
          'Durum Filtresi': filterStatus === 'all' ? 'Tümü' : filterStatus
        },
        kpiCards: [
          { title: 'Toplam Eğitim', value: filteredData.length.toString() },
          { title: 'Planlanan Eğitimler', value: (trainingsByStatus['Planlandı'] || 0).toString() },
          { title: 'Devam Eden Eğitimler', value: (trainingsByStatus['Devam Ediyor'] || 0).toString() },
          { title: 'Tamamlanan Eğitimler', value: (trainingsByStatus['Tamamlandı'] || 0).toString() },
          { title: 'Toplam Katılımcı', value: totalParticipants.toString() },
          { title: 'Katılan Katılımcı', value: totalAttended.toString() },
          { title: 'Verilen Sertifika', value: totalCertificates.toString() },
          { title: 'Katılım Oranı', value: totalParticipants > 0 ? `${Math.round((totalAttended / totalParticipants) * 100)}%` : '0%' }
        ],
        tableData: {
          headers: ['Eğitim Adı', 'Eğitmen', 'Planlanan Tarih', 'Gerçekleşen Tarih', 'Durum', 'Katılımcı Sayısı', 'Katılan', 'Sertifika'],
          rows: filteredData.map(t => {
            const participants = participantsByTraining[t.id] || { total: 0, attended: 0, certificates: 0 };
            return [
              t.name || '-',
              t.trainer ? `${t.trainer.first_name} ${t.trainer.last_name}` : 'N/A',
              t.planned_date ? format(new Date(t.planned_date), 'dd.MM.yyyy', { locale: tr }) : '-',
              t.actual_date ? format(new Date(t.actual_date), 'dd.MM.yyyy', { locale: tr }) : '-',
              t.status || 'Belirtilmemiş',
              participants.total.toString(),
              participants.attended.toString(),
              participants.certificates.toString()
            ];
          })
        },
        signatureFields: [
          { title: 'Hazırlayan', name: user?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
          { title: 'Kontrol Eden', name: '', role: '..................' },
          { title: 'Onaylayan', name: '', role: '..................' }
        ]
      };

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

  // Filtrelenmiş eğitimler
  const filteredTrainings = useMemo(() => {
    return trainings.filter(t => {
      const searchMatch = !searchTerm || 
        (t.name && t.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const statusMatch = filterStatus === 'all' || t.status === filterStatus;
      return searchMatch && statusMatch;
    });
  }, [trainings, searchTerm, filterStatus]);

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
              <div className="flex space-x-2">
                <Button onClick={() => openForm()}><Plus className="h-4 w-4 mr-2" />Yeni Eğitim Planla</Button>
                <Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="data" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Eğitim Listesi
                </TabsTrigger>
                <TabsTrigger value="analysis" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Detaylı Analiz
                </TabsTrigger>
              </TabsList>

              <TabsContent value="data">
                {/* Filtreler */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Eğitim ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Durum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="Planlandı">Planlandı</SelectItem>
                      <SelectItem value="Devam Ediyor">Devam Ediyor</SelectItem>
                      <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                      <SelectItem value="İptal Edildi">İptal Edildi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                      {filteredTrainings.map((training) => (
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
                              <Button variant="outline" size="sm" onClick={(e) => handleEditClick(e, training)} className="h-8 w-8 p-0"><Edit className="h-4 w-4" /></Button>
                              <label className="cursor-pointer">
                                <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png,.gif" onChange={(e) => handleFileUpload(e, training.id)} disabled={uploadingFile} />
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={uploadingFile}><Upload className="h-4 w-4" /></Button>
                              </label>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredTrainings.length === 0 && <div className="text-center py-8 text-gray-500"><BookOpen className="h-8 w-8 mx-auto mb-2" /><p>Eğitim bulunamadı.</p></div>}
                </div>
              </TabsContent>

              <TabsContent value="analysis">
                {analysisData ? (
                  <div className="space-y-6">
                    {/* KPI Kartları */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-600">Toplam Eğitim</p>
                              <p className="text-3xl font-bold text-blue-900">{analysisData.total}</p>
                            </div>
                            <BookOpen className="h-8 w-8 text-blue-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-green-50 to-green-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-green-600">Tamamlanan</p>
                              <p className="text-3xl font-bold text-green-900">{analysisData.completed}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-purple-600">Toplam Katılımcı</p>
                              <p className="text-3xl font-bold text-purple-900">{analysisData.totalParticipants}</p>
                            </div>
                            <Users className="h-8 w-8 text-purple-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-yellow-600">Verilen Sertifika</p>
                              <p className="text-3xl font-bold text-yellow-900">{analysisData.totalCertificates}</p>
                            </div>
                            <Award className="h-8 w-8 text-yellow-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* İkinci Satır KPI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-indigo-600">Katılım Oranı</p>
                              <p className="text-3xl font-bold text-indigo-900">%{analysisData.attendanceRate}</p>
                            </div>
                            <Target className="h-8 w-8 text-indigo-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-emerald-600">Başarı Oranı</p>
                              <p className="text-3xl font-bold text-emerald-900">%{analysisData.successRate}</p>
                            </div>
                            <TrendingUp className="h-8 w-8 text-emerald-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-orange-600">Planlanan</p>
                              <p className="text-3xl font-bold text-orange-900">{analysisData.planned}</p>
                            </div>
                            <BookOpen className="h-8 w-8 text-orange-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-cyan-600">Devam Eden</p>
                              <p className="text-3xl font-bold text-cyan-900">{analysisData.inProgress}</p>
                            </div>
                            <BookOpen className="h-8 w-8 text-cyan-500" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Grafikler */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Durum Dağılımı */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="h-5 w-5" /> Eğitim Durumu Dağılımı
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={analysisData.statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={3}
                                dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                              >
                                {analysisData.statusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [value + ' eğitim', '']} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Aylık Trend */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" /> Aylık Eğitim Trendi
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={analysisData.monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" fontSize={11} />
                              <YAxis fontSize={12} />
                              <Tooltip />
                              <Legend />
                              <Area type="monotone" dataKey="planned" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Planlanan" />
                              <Area type="monotone" dataKey="completed" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Tamamlanan" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Eğitmen ve Katılım */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Eğitmen Bazlı */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5" /> Eğitmen Bazlı Analiz
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analysisData.trainerData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" fontSize={12} />
                              <YAxis dataKey="name" type="category" fontSize={10} width={100} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="completed" stackId="a" fill="#10B981" name="Tamamlandı" />
                              <Bar dataKey="total" fill="#3B82F6" name="Toplam" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Katılım Durumu */}
                      {analysisData.participationData.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <CheckCircle className="h-5 w-5" /> Katılım Durumu
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={analysisData.participationData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={3}
                                  dataKey="value"
                                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                  {analysisData.participationData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value) => [value + ' kişi', '']} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-gray-500">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Analiz için yeterli veri bulunmuyor.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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