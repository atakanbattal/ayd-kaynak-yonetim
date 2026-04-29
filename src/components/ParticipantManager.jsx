import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Users, Trash2 } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

const ParticipantManager = ({ trainingId }) => {
  const [participants, setParticipants] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [includeInactiveEmployees, setIncludeInactiveEmployees] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: participantsData, error: participantsError } = await supabase
      .from('training_participants')
      .select('*, employee:employees(*)')
      .eq('training_id', trainingId);

    let employeesQuery = supabase.from('employees').select('*');
    if (!includeInactiveEmployees) {
      employeesQuery = employeesQuery.eq('is_active', true);
    }
    const { data: employeesData, error: employeesError } = await employeesQuery.order('registration_number', {
      ascending: true,
    });

    if (participantsError || employeesError) {
      toast({ title: 'Hata', description: 'Veriler alınamadı.', variant: 'destructive' });
    } else {
      setParticipants(participantsData ?? []);
      setAllEmployees(employeesData ?? []);
    }
    setLoading(false);
  }, [trainingId, toast, includeInactiveEmployees]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const employeeOptions = useMemo(() => {
    const participantIds = new Set(participants.map((p) => p.employee_id));
    return allEmployees
      .filter((emp) => !participantIds.has(emp.id))
      .map((emp) => {
        const reg = emp.registration_number != null ? String(emp.registration_number) : '';
        const regTrim = reg.replace(/^0+/, '') || reg;
        const inactiveNote = emp.is_active === false ? ' (pasif)' : '';
        const label = `${reg || '—'} - ${emp.first_name} ${emp.last_name}${inactiveNote}`;
        return {
          value: emp.id,
          label,
          keywords: [reg, regTrim, emp.first_name, emp.last_name].filter(Boolean),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [allEmployees, participants]);

  const handleAddParticipants = async () => {
    if (selectedEmployees.length === 0) return;

    const newParticipants = selectedEmployees.map(employeeId => ({
      training_id: trainingId,
      employee_id: employeeId,
      participation_status: 'Bekleniyor'
    }));

    const { error } = await supabase.from('training_participants').insert(newParticipants);

    if (error) {
      toast({ title: 'Hata', description: 'Katılımcılar eklenemedi.', variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Katılımcılar eklendi.' });
      setSelectedEmployees([]);
      fetchData();
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    const { error } = await supabase.from('training_participants').delete().eq('id', participantId);
    if (error) {
      toast({ title: 'Hata', description: 'Katılımcı kaldırılamadı.', variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Katılımcı kaldırıldı.' });
      fetchData();
    }
  };

  const handleStatusChange = async (participantId, status) => {
    const { error } = await supabase
      .from('training_participants')
      .update({ participation_status: status })
      .eq('id', participantId);

    if (error) {
      toast({ title: 'Hata', description: 'Durum güncellenemedi.', variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Katılım durumu güncellendi.' });
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Katılımcı Yönetimi</CardTitle>
        <CardDescription>Eğitime katılacak personelleri yönetin.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="inactive-employees-training"
                checked={includeInactiveEmployees}
                onChange={(e) => setIncludeInactiveEmployees(e.target.checked)}
                className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
              />
              <label htmlFor="inactive-employees-training" className="text-sm text-muted-foreground cursor-pointer">
                Pasif personeli de göster
              </label>
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-grow">
              <label className="text-sm font-medium">Personel Ekle</label>
              <Combobox
                options={employeeOptions}
                value={selectedEmployees}
                onSelect={(id) => {
                  if (!id) return;
                  setSelectedEmployees((prev) =>
                    prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
                  );
                }}
                placeholder="Personel seç..."
                searchPlaceholder="Ad, soyad veya sicil ile ara..."
                emptyPlaceholder="Eklenecek personel yok (zaten katılımcı veya liste boş)."
                isMulti={true}
              />
            </div>
            <Button onClick={handleAddParticipants} disabled={selectedEmployees.length === 0}>
              <UserPlus className="mr-2 h-4 w-4" /> Ekle
            </Button>
          </div>

          <div className="border rounded-lg mt-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Personel</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sicil No</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Katılım Durumu</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {participants.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{p.employee.first_name} {p.employee.last_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{p.employee.registration_number}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <Select value={p.participation_status} onValueChange={(status) => handleStatusChange(p.id, status)}>
                        <SelectTrigger className="w-[150px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bekleniyor">Bekleniyor</SelectItem>
                          <SelectItem value="Katıldı">Katıldı</SelectItem>
                          <SelectItem value="Katılmadı">Katılmadı</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveParticipant(p.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {participants.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-lg">Henüz katılımcı eklenmemiş.</p>
                <p className="text-sm">Yukarıdan personel ekleyerek başlayın.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ParticipantManager;