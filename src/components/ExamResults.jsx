import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save } from 'lucide-react';

const ExamResults = ({ trainingId, passingGrade }) => {
  const [results, setResults] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const maxScore = useMemo(() => questions.reduce((sum, q) => sum + q.points, 0), [questions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: participantsData, error: pError } = await supabase
      .from('training_participants')
      .select('id, employee:employees(id, first_name, last_name)')
      .eq('training_id', trainingId)
      .eq('participation_status', 'Katıldı');

    const { data: questionsData, error: qError } = await supabase
      .from('training_exam_questions')
      .select('points')
      .eq('training_id', trainingId);

    const { data: resultsData, error: rError } = await supabase
      .from('training_exam_results')
      .select('*')
      .eq('training_id', trainingId);

    if (pError || qError || rError) {
      toast({ title: 'Hata', description: 'Sınav verileri alınamadı.', variant: 'destructive' });
    } else {
      setParticipants(participantsData);
      setQuestions(questionsData);
      
      const initialResults = participantsData.map(p => {
        const existingResult = resultsData.find(r => r.participant_id === p.id);
        return {
          participant_id: p.id,
          participant_name: `${p.employee.first_name} ${p.employee.last_name}`,
          score: existingResult ? existingResult.score : '',
        };
      });
      setResults(initialResults);
    }
    setLoading(false);
  }, [trainingId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScoreChange = (participantId, score) => {
    // Score'u string olarak tut, sadece kayıt sırasında number'a çevir
    // Boş string veya geçerli sayı kabul et
    let newScore = score;
    
    // Eğer değer girilmişse ve geçerli bir sayıysa
    if (score !== '' && score !== null) {
      const numericValue = parseFloat(score);
      // NaN değilse ve 0'dan büyük veya eşitse işlem yap
      if (!isNaN(numericValue)) {
        // maxScore'u aşmasını engelle
        newScore = Math.min(Math.max(0, numericValue), maxScore);
      }
    }
    
    setResults(prev => prev.map(r => r.participant_id === participantId ? { ...r, score: newScore } : r));
  };

  const handleSaveResults = async () => {
    // passingGrade kontrolü - null veya undefined ise uyarı ver
    const validPassingGrade = passingGrade !== null && passingGrade !== undefined ? Number(passingGrade) : null;
    
    if (validPassingGrade === null) {
      toast({ 
        title: 'Uyarı', 
        description: 'Lütfen önce geçme notunu kaydedin.', 
        variant: 'destructive' 
      });
      return;
    }

    const resultsToSave = results
      .filter(r => r.score !== '' && r.score !== null && !isNaN(Number(r.score)))
      .map(r => {
        const scoreValue = Number(r.score);
        // Yüzde hesaplama - maxScore 0'dan büyük olmalı
        const percentage = maxScore > 0 ? (scoreValue / maxScore) * 100 : 0;
        
        // Yüzde değerini kontrol et (0-100 arası olmalı)
        const validPercentage = Math.max(0, Math.min(100, percentage));
        
        // Geçme notu kontrolü - passingGrade yüzde cinsinden
        const isPassed = validPercentage >= validPassingGrade;
        
        return {
          training_id: trainingId,
          participant_id: r.participant_id,
          score: scoreValue,
          percentage: validPercentage,
          status: isPassed ? 'Başarılı' : 'Başarısız',
          exam_date: new Date().toISOString(),
        };
      });

    if (resultsToSave.length === 0) {
      toast({ title: 'Uyarı', description: 'Kaydedilecek geçerli not bulunamadı.', variant: 'default' });
      return;
    }

    const { error } = await supabase.from('training_exam_results').upsert(resultsToSave, { onConflict: 'training_id, participant_id' });

    if (error) {
      toast({ title: 'Hata', description: 'Sonuçlar kaydedilemedi.', variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Sınav sonuçları kaydedildi.' });
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Sınav Sonuçları Girişi</CardTitle>
            <CardDescription>Katılımcıların sınav notlarını girin. Maksimum Puan: {maxScore}</CardDescription>
          </div>
          <Button onClick={handleSaveResults}><Save className="mr-2 h-4 w-4" />Tümünü Kaydet</Button>
        </div>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Not girişi için eğitime katılan personel bulunmuyor.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Katılımcı</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Not</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Yüzde</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map(r => {
                  // Score'u number'a çevir ve validate et
                  const scoreValue = r.score !== '' && r.score !== null ? Number(r.score) : null;
                  const percentage = maxScore > 0 && scoreValue !== null ? (scoreValue / maxScore) * 100 : 0;
                  
                  // Yüzde değerini kontrol et (0-100 arası olmalı)
                  const validPercentage = Math.max(0, Math.min(100, percentage));
                  
                  // Geçme notu kontrolü
                  const validPassingGrade = passingGrade !== null && passingGrade !== undefined ? Number(passingGrade) : null;
                  const status = validPassingGrade !== null && scoreValue !== null 
                    ? (validPercentage >= validPassingGrade ? 'Başarılı' : 'Başarısız')
                    : null;
                  
                  return (
                    <tr key={r.participant_id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{r.participant_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*\.?[0-9]*"
                          className="w-24 h-8"
                          value={r.score === '' || r.score === null ? '' : r.score}
                          onChange={e => handleScoreChange(r.participant_id, e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {scoreValue !== null ? `${validPercentage.toFixed(2)}%` : '-'}
                        {validPassingGrade !== null && (
                          <span className="text-xs text-gray-500 ml-2">(Geçme: {validPassingGrade}%)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {status && (
                          <span className={`font-semibold ${status === 'Başarılı' ? 'text-green-600' : 'text-red-600'}`}>{status}</span>
                        )}
                        {!status && scoreValue !== null && (
                          <span className="text-gray-400 text-xs">Geçme notu belirlenmemiş</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExamResults;