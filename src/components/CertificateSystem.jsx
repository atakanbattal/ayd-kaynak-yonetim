import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Loader2, Award, Download, RefreshCw } from 'lucide-react';
    import { openPrintWindow } from '@/lib/utils';

    const CertificateSystem = ({ trainingId, trainingName, trainer }) => {
      const [certificates, setCertificates] = useState([]);
      const [successfulParticipants, setSuccessfulParticipants] = useState([]);
      const [allParticipants, setAllParticipants] = useState([]);
      const [loading, setLoading] = useState(true);
      const { toast } = useToast();
    
      const fetchData = useCallback(async () => {
        setLoading(true);
        
        // Başarılı katılımcılar
        const { data: resultsData, error: resultsError } = await supabase
          .from('training_exam_results')
          .select('id, participant_id, participant:training_participants(id, employee:employees(id, first_name, last_name))')
          .eq('training_id', trainingId)
          .eq('status', 'Başarılı');
        
        // Tüm katılımcılar (eğitime katılanlar)
        const { data: allParticipantsData, error: allParticipantsError } = await supabase
          .from('training_participants')
          .select('id, employee:employees(id, first_name, last_name)')
          .eq('training_id', trainingId)
          .eq('participation_status', 'Katıldı');
    
        const { data: certsData, error: certsError } = await supabase
          .from('training_certificates')
          .select('*')
          .eq('training_id', trainingId);
    
        if (resultsError || certsError || allParticipantsError) {
          toast({ title: 'Hata', description: 'Veriler alınamadı.', variant: 'destructive' });
        } else {
          setSuccessfulParticipants(resultsData || []);
          setAllParticipants(allParticipantsData || []);
          setCertificates(certsData || []);
        }
        setLoading(false);
      }, [trainingId, toast]);
    
      useEffect(() => {
        fetchData();
      }, [fetchData]);
    
      const handleGenerateCertificates = async () => {
        const certsToCreate = successfulParticipants
          .filter(p => !certificates.some(c => c.participant_id === p.participant.id))
          .map(p => ({
            training_id: trainingId,
            participant_id: p.participant.id,
            certificate_number: `AYD-CERT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
            issue_date: new Date().toISOString(),
          }));
    
        if (certsToCreate.length === 0) {
          toast({ title: 'Bilgi', description: 'Oluşturulacak yeni sertifika bulunmuyor.' });
          return;
        }
    
        const { error } = await supabase.from('training_certificates').insert(certsToCreate);
    
        if (error) {
          toast({ title: 'Hata', description: 'Sertifikalar oluşturulamadı.', variant: 'destructive' });
        } else {
          toast({ title: 'Başarılı', description: `${certsToCreate.length} adet yeni sertifika kaydı oluşturuldu.` });
          fetchData();
        }
      };
      
      // Tüm katılımcılar için sertifika oluştur
      const handleGenerateCertificatesForAll = async () => {
        const certsToCreate = allParticipants
          .filter(p => !certificates.some(c => c.participant_id === p.id))
          .map(p => ({
            training_id: trainingId,
            participant_id: p.id,
            certificate_number: `AYD-CERT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
            issue_date: new Date().toISOString(),
          }));
    
        if (certsToCreate.length === 0) {
          toast({ title: 'Bilgi', description: 'Oluşturulacak yeni sertifika bulunmuyor.' });
          return;
        }
    
        const { error } = await supabase.from('training_certificates').insert(certsToCreate);
    
        if (error) {
          toast({ title: 'Hata', description: 'Sertifikalar oluşturulamadı.', variant: 'destructive' });
        } else {
          toast({ title: 'Başarılı', description: `${certsToCreate.length} adet yeni sertifika kaydı oluşturuldu (Tüm katılımcılar için).` });
          fetchData();
        }
      };

      const handleDownloadCertificate = (participant) => {
        // Hem successfulParticipants hem de allParticipants için çalışacak şekilde düzenle
        const participantId = participant.participant?.id || participant.id;
        const employee = participant.participant?.employee || participant.employee;
        
        const certificate = certificates.find(c => c.participant_id === participantId);
        if (!certificate) {
             toast({ title: 'Hata', description: 'Sertifika verisi bulunamadı.', variant: 'destructive' });
             return;
        }

        const reportData = {
          title: `Sertifika - ${employee.first_name} ${employee.last_name}`,
          certificateData: {
            participantName: `${employee.first_name} ${employee.last_name}`,
            trainingName: trainingName,
            issueDate: new Date(certificate.issue_date).toLocaleDateString('tr-TR'),
            certificateNumber: certificate.certificate_number,
            trainerName: trainer ? `${trainer.first_name} ${trainer.last_name}`.toUpperCase() : 'Eğitmen',
          }
        };
        openPrintWindow(reportData, toast);
      };
      
      // Eğitim adına göre tüm sertifikaları otomatik bas
      const handlePrintAllCertificates = async () => {
        // Tüm katılımcılar için sertifikaları bul
        const allParticipantsWithCerts = allParticipants
          .map(p => ({
            id: p.id,
            employee: p.employee,
            certificate: certificates.find(c => c.participant_id === p.id),
          }))
          .filter(p => p.certificate); // Sadece sertifikası olanları al
        
        if (allParticipantsWithCerts.length === 0) {
          toast({ 
            title: 'Uyarı', 
            description: 'Yazdırılacak sertifika bulunamadı. Önce sertifikaları oluşturun.', 
            variant: 'default' 
          });
          return;
        }
        
        toast({ 
          title: 'Bilgi', 
          description: `${allParticipantsWithCerts.length} adet sertifika yazdırılıyor...` 
        });
        
        // Her sertifikayı sırayla yazdır (kısa gecikme ile)
        for (let i = 0; i < allParticipantsWithCerts.length; i++) {
          const p = allParticipantsWithCerts[i];
          setTimeout(() => {
            handleDownloadCertificate(p);
          }, i * 500); // Her sertifika arasında 500ms bekle
        }
      };
    
      if (loading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
      }
    
      // Tüm katılımcılar için sertifika listesi oluştur
      const participantsWithCerts = allParticipants.map(p => {
        const result = successfulParticipants.find(sp => sp.participant.id === p.id);
        return {
          id: p.id,
          participant: { id: p.id, employee: p.employee },
          certificate: certificates.find(c => c.participant_id === p.id),
          isSuccessful: !!result
        };
      });
      
      const hasCertificates = participantsWithCerts.filter(p => p.certificate).length > 0;
    
      return (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Sertifika Yönetimi</CardTitle>
                <CardDescription>Başarılı personeller için sertifikaları yönetin veya tüm katılımcılar için toplu sertifika oluşturun.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGenerateCertificates} disabled={successfulParticipants.length === 0}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Başarılılar İçin Oluştur
                </Button>
                <Button onClick={handleGenerateCertificatesForAll} disabled={allParticipants.length === 0} variant="secondary">
                  <RefreshCw className="mr-2 h-4 w-4" /> Tüm Katılımcılar İçin Oluştur
                </Button>
                <Button 
                  onClick={handlePrintAllCertificates} 
                  disabled={!hasCertificates}
                  variant="outline"
                >
                  <Download className="mr-2 h-4 w-4" /> Tümünü Yazdır ({trainingName})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {participantsWithCerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Award className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-lg">Henüz eğitime katılan personel bulunmuyor.</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Personel</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sertifika Durumu</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {participantsWithCerts.map(p => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          {p.participant.employee.first_name} {p.participant.employee.last_name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {p.isSuccessful ? (
                            <span className="text-green-600 font-semibold">Başarılı</span>
                          ) : (
                            <span className="text-gray-500">Katılımcı</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {p.certificate ? (
                            <span className="text-green-600 font-semibold">Oluşturuldu</span>
                          ) : (
                            <span className="text-yellow-600 font-semibold">Bekliyor</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                          <Button variant="ghost" size="icon" disabled={!p.certificate} onClick={() => handleDownloadCertificate(p)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      );
    };
    
    export default CertificateSystem;