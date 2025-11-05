import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
    import { Loader2, Plus, Save, Trash2, FileText, Printer } from 'lucide-react';
    import { openPrintWindow } from '@/lib/utils';
    
    const QuestionManager = ({ trainingId, trainingName }) => {
      const [questions, setQuestions] = useState([]);
      const [loading, setLoading] = useState(true);
      const [showForm, setShowForm] = useState(false);
      const [editingQuestion, setEditingQuestion] = useState(null);
      const [formState, setFormState] = useState(getInitialFormState());
      const { toast } = useToast();
    
      function getInitialFormState() {
        return {
          question_text: '',
          question_type: 'çoktan seçmeli',
          options: [{ text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }],
          points: 10,
        };
      }
    
      const fetchQuestions = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('training_exam_questions')
          .select('*')
          .eq('training_id', trainingId)
          .order('created_at');
        if (error) {
          toast({ title: 'Hata', description: 'Sınav soruları alınamadı.', variant: 'destructive' });
        } else {
          setQuestions(data);
        }
        setLoading(false);
      }, [trainingId, toast]);
    
      useEffect(() => {
        fetchQuestions();
      }, [fetchQuestions]);
    
      const openForm = (question = null) => {
        if (question) {
          setEditingQuestion(question);
          setFormState(question);
        } else {
          setEditingQuestion(null);
          setFormState(getInitialFormState());
        }
        setShowForm(true);
      };
    
      const handleSave = async () => {
        const saveData = { ...formState, training_id: trainingId };
        let response;
        if (editingQuestion) {
          response = await supabase.from('training_exam_questions').update(saveData).eq('id', editingQuestion.id);
        } else {
          response = await supabase.from('training_exam_questions').insert(saveData);
        }
    
        if (response.error) {
          toast({ title: 'Hata', description: 'Soru kaydedilemedi.', variant: 'destructive' });
        } else {
          toast({ title: 'Başarılı', description: 'Soru kaydedildi.' });
          setShowForm(false);
          fetchQuestions();
        }
      };
    
      const handleDelete = async (questionId) => {
        const { error } = await supabase.from('training_exam_questions').delete().eq('id', questionId);
        if (error) {
          toast({ title: 'Hata', description: 'Soru silinemedi.', variant: 'destructive' });
        } else {
          toast({ title: 'Başarılı', description: 'Soru silindi.' });
          fetchQuestions();
        }
      };
    
      const handleOptionChange = (index, text) => {
        const newOptions = [...formState.options];
        newOptions[index].text = text;
        setFormState({ ...formState, options: newOptions });
      };
    
      const handleCorrectOptionChange = (index) => {
        const newOptions = formState.options.map((opt, i) => ({
          ...opt,
          is_correct: i === index,
        }));
        setFormState({ ...formState, options: newOptions });
      };
    
      const handleGenerateExamPaper = () => {
        const reportData = {
          title: `Sınav Kağıdı - ${trainingName}`,
          examData: {
            trainingName: trainingName,
            questions: questions,
          }
        };
        openPrintWindow(reportData, toast);
      };
    
      if (loading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
      }
    
      return (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Sınav Soru Bankası</CardTitle>
                <CardDescription>Eğitim sınavı için soruları yönetin.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerateExamPaper} disabled={questions.length === 0}>
                  <Printer className="mr-2 h-4 w-4" />Sınav Kağıdı Oluştur
                </Button>
                <Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" />Soru Ekle</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                 <FileText className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-lg">Henüz sınav sorusu eklenmemiş.</p>
                <p className="text-sm">"Soru Ekle" butonu ile başlayabilirsiniz.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div key={q.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <p className="font-medium">{index + 1}. {q.question_text} ({q.points} Puan)</p>
                      <div>
                        <Button variant="ghost" size="icon" onClick={() => openForm(q)}><Save className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(q.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      {q.question_type === 'çoktan seçmeli' && q.options.map((opt, i) => (
                        <p key={i} className={opt.is_correct ? 'font-bold text-green-600' : ''}>- {opt.text}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
    
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingQuestion ? 'Soruyu Düzenle' : 'Yeni Soru Ekle'}</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4 modal-body-scroll px-6">
                <div><Label>Soru Metni</Label><Input value={formState.question_text} onChange={e => setFormState({...formState, question_text: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Soru Tipi</Label><Select value={formState.question_type} onValueChange={type => setFormState({...formState, question_type: type})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="çoktan seçmeli">Çoktan Seçmeli</SelectItem><SelectItem value="doğru/yanlış">Doğru/Yanlış</SelectItem><SelectItem value="açık uçlu">Açık Uçlu</SelectItem></SelectContent></Select></div>
                  <div><Label>Puan</Label><Input type="number" value={formState.points} onChange={e => setFormState({...formState, points: parseInt(e.target.value) || 0})} /></div>
                </div>
                {formState.question_type === 'çoktan seçmeli' && (
                  <div>
                    <Label>Seçenekler (Doğru olanı işaretleyin)</Label>
                    <div className="space-y-2 mt-2">
                      {formState.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="radio" name="correct_option" checked={opt.is_correct} onChange={() => handleCorrectOptionChange(i)} />
                          <Input value={opt.text} onChange={e => handleOptionChange(i, e.target.value)} placeholder={`Seçenek ${i + 1}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      );
    };
    
    export default QuestionManager;