import React, { useState, useEffect, useCallback } from 'react';
    import { useParams, Link } from 'react-router-dom';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Users, FileText, HelpCircle, Award, ArrowLeft, Loader2, Save } from 'lucide-react';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import ParticipantManager from '@/components/ParticipantManager';
    import DocumentManager from '@/components/DocumentManager';
    import QuestionManager from '@/components/QuestionManager';
    import ExamResults from '@/components/ExamResults';
    import CertificateSystem from '@/components/CertificateSystem';

    const LoadingSpinner = () => (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );

    const TrainingDetail = () => {
      const { trainingId } = useParams();
      const [training, setTraining] = useState(null);
      const [loading, setLoading] = useState(true);
      const [activeTab, setActiveTab] = useState('participants');
      const { toast } = useToast();

      const fetchTrainingData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('trainings')
          .select('*, trainer:employees(first_name, last_name)')
          .eq('id', trainingId)
          .single();

        if (error) {
          toast({ title: 'Hata', description: 'Eğitim bilgileri alınamadı.', variant: 'destructive' });
          console.error(error);
        } else {
          setTraining(data);
        }
        setLoading(false);
      }, [trainingId, toast]);

      useEffect(() => {
        fetchTrainingData();
      }, [fetchTrainingData]);

      const handlePassingGradeChange = (e) => {
        setTraining(prev => ({ ...prev, passing_grade: e.target.valueAsNumber || 0 }));
      };
      
      const handleSavePassingGrade = async () => {
        const { error } = await supabase
          .from('trainings')
          .update({ passing_grade: training.passing_grade })
          .eq('id', training.id);
      
        if (error) {
          toast({ title: 'Hata', description: 'Geçme notu güncellenemedi.', variant: 'destructive' });
        } else {
          toast({ title: 'Başarılı', description: 'Geçme notu güncellendi.' });
        }
      };

      const tabs = [
        { id: 'participants', label: 'Katılımcılar', icon: Users },
        { id: 'documents', label: 'Dokümanlar', icon: FileText },
        { id: 'exam', label: 'Sınav & Notlar', icon: HelpCircle },
        { id: 'certificates', label: 'Sertifikalar', icon: Award },
      ];

      if (loading) {
        return <LoadingSpinner />;
      }

      if (!training) {
        return (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Eğitim bulunamadı.</p>
            <Button asChild>
              <Link to="/trainings"><ArrowLeft className="mr-2 h-4 w-4" />Eğitim Listesine Dön</Link>
            </Button>
          </div>
        );
      }

      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl font-bold text-gray-800">{training.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {new Date(training.planned_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })} - {training.location}
                  </CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link to="/trainings"><ArrowLeft className="mr-2 h-4 w-4" />Geri</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 px-6" aria-label="Tabs">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
              <div className="p-6">
                {activeTab === 'participants' && <ParticipantManager trainingId={trainingId} />}
                {activeTab === 'documents' && <DocumentManager trainingId={trainingId} />}
                {activeTab === 'exam' && (
                  <div className="space-y-8">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-end gap-4">
                          <div className="w-48">
                            <Label htmlFor="passing_grade">Geçme Notu (%)</Label>
                            <Input
                              id="passing_grade"
                              type="number"
                              value={training.passing_grade || ''}
                              onChange={handlePassingGradeChange}
                              className="mt-1"
                              min="0"
                              max="100"
                            />
                          </div>
                          <Button onClick={handleSavePassingGrade}><Save className="mr-2 h-4 w-4" />Kaydet</Button>
                        </div>
                      </CardContent>
                    </Card>
                    <QuestionManager trainingId={trainingId} trainingName={training.name} />
                    <ExamResults trainingId={trainingId} passingGrade={training.passing_grade} />
                  </div>
                )}
                {activeTab === 'certificates' && <CertificateSystem trainingId={trainingId} trainingName={training.name} trainer={training.trainer} />}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    };

    export default TrainingDetail;