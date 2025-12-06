import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Plus, GripVertical, Calendar as CalendarIcon, User, AlertCircle, CheckCircle, Loader, Search, X as XIcon, Tag, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/components/ui/use-toast';
import { cn, logAction, openPrintWindow, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Combobox } from '@/components/ui/combobox';
import { Download } from 'lucide-react';

const priorityMap = {
  low: { label: 'Düşük', icon: <CheckCircle className="h-4 w-4 text-gray-500" />, color: 'text-gray-500' },
  medium: { label: 'Orta', icon: <Loader className="h-4 w-4 text-blue-500" />, color: 'text-blue-500' },
  high: { label: 'Yüksek', icon: <AlertCircle className="h-4 w-4 text-yellow-500" />, color: 'text-yellow-500' },
  critical: { label: 'Kritik', icon: <AlertCircle className="h-4 w-4 text-red-500" />, color: 'text-red-500' },
};

const statusMap = {
  'todo': 'Beklemede',
  'in-progress': 'Devam Ediyor',
  'done': 'Tamamlandı'
};

const TaskCard = ({ task, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const priority = priorityMap[task.priority] || priorityMap.medium;

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="mb-3">
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(task)}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <p className="font-medium text-sm leading-snug">{task.title}</p>
            <div {...listeners} className="cursor-grab p-1 text-gray-400 hover:text-gray-600"><GripVertical className="h-4 w-4" /></div>
          </div>
          {task.description && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{task.description}</p>}
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <div className="flex items-center space-x-2 overflow-hidden">
              <div className={`flex items-center space-x-1 ${priority.color}`}>{React.cloneElement(priority.icon, {})}<span>{priority.label}</span></div>
              {task.due_date && <div className="flex items-center space-x-1"><CalendarIcon className="h-3 w-3" /><span>{format(new Date(task.due_date), 'dd MMM', { locale: tr })}</span></div>}
              {task.tags && task.tags.split(',').map(tag => tag.trim() && <div key={tag} className="flex items-center space-x-1 bg-gray-200 px-1.5 py-0.5 rounded"><Tag className="h-3 w-3" /><span>{tag}</span></div>)}
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0"><User className="h-3 w-3" /><span>{task.assignee_name}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const TaskColumn = ({ id, title, tasks, onSelectTask }) => {
  const { setNodeRef } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="bg-gray-100 rounded-lg p-3 w-full md:w-1/3">
      <h3 className="font-semibold text-gray-700 mb-4 px-1">{title} ({tasks.length})</h3>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[200px]">{tasks.map(task => <TaskCard key={task.id} task={task} onSelect={onSelectTask} />)}</div>
      </SortableContext>
    </div>
  );
};

const TaskManager = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const employeeOptions = useMemo(() => employees.map(emp => ({
    value: emp.id,
    label: `${emp.registration_number} - ${emp.first_name} ${emp.last_name}`
  })).sort((a, b) => a.label.localeCompare(b.label)), [employees]);

  const initialFormState = { title: '', description: '', status: 'todo', priority: 'medium', assignee_id: null, part_code: '', tags: '', comments: [], files: [] };

  const fetchTasks = async () => {
    const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    const { data: employeesData, error: employeesError } = await supabase.from('employees').select('id, first_name, last_name, registration_number').eq('is_active', true);
    
    if (tasksError || employeesError) {
      console.error("Error fetching data:", tasksError || employeesError);
    } else {
      const enrichedTasks = tasksData.map(task => {
        const assignee = employeesData.find(e => e.id === task.assignee_id);
        return {
          ...task,
          assignee_name: assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Atanmamış'
        }
      });
      setTasks(enrichedTasks);
      setEmployees(employeesData);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const searchMatch = searchTerm === '' || task.title.toLowerCase().includes(searchTerm.toLowerCase()) || (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const assigneeMatch = filterAssignee === '' || (task.assignee_name && task.assignee_name.toLowerCase().includes(filterAssignee.toLowerCase()));
      const tagMatch = filterTag === '' || (task.tags && task.tags.toLowerCase().includes(filterTag.toLowerCase()));
      return searchMatch && assigneeMatch && tagMatch;
    });
  }, [tasks, searchTerm, filterAssignee, filterTag]);

  const columns = useMemo(() => ({
    todo: filteredTasks.filter(t => t.status === 'todo'),
    'in-progress': filteredTasks.filter(t => t.status === 'in-progress'),
    done: filteredTasks.filter(t => t.status === 'done'),
  }), [filteredTasks]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overContainer = findContainer(over.id);
    if (!overContainer) return;
    setTasks((prevTasks) => {
      const activeIndex = prevTasks.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prevTasks;
      const newTasks = [...prevTasks];
      newTasks[activeIndex].status = overContainer;
      return arrayMove(newTasks, activeIndex, newTasks.length -1);
    });
    await supabase.from('tasks').update({ status: overContainer }).eq('id', activeId);
    fetchTasks();
  };
  
  const findContainer = (id) => {
    if (id in columns) return id;
    for (const containerId of Object.keys(columns)) {
      if (columns[containerId].find((item) => item.id === id)) return containerId;
    }
    return null;
  };

  const handleSaveTask = async (taskData) => {
    if (!taskData.title) {
      toast({ title: "Hata", description: "Görev başlığı boş olamaz.", variant: "destructive" });
      return;
    }
    
    const saveData = { ...taskData };
    if(saveData.assignee_id === '') saveData.assignee_id = null;

    let response;
    if (editingTask) {
      const { id, assignee_name, ...updateData } = saveData;
      response = await supabase.from('tasks').update(updateData).eq('id', id).select();
    } else {
      const { assignee_name, ...insertData } = saveData;
      response = await supabase.from('tasks').insert(insertData).select();
    }

    if (response.error) {
      toast({ title: "Kayıt Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: editingTask ? "Görev Güncellendi" : "Görev Eklendi" });
      logAction(editingTask ? 'UPDATE_TASK' : 'CREATE_TASK', `Görev: ${response.data[0].title}`, authUser);
      fetchTasks();
      setIsFormOpen(false);
      setEditingTask(null);
    }
  };

  const handleDeleteTask = async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Görev Silindi", variant: "destructive" });
      logAction('DELETE_TASK', `Görev silindi: ID ${taskId}`, authUser);
      fetchTasks();
      setViewingTask(null);
    }
  };

  const handleGenerateDetailedReport = async () => {
    try {
      toast({ title: "Detaylı görev raporu hazırlanıyor...", description: "Tüm görev verileri toplanıyor." });

      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*, assignee:employees(first_name, last_name, registration_number)')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      const filteredData = allTasks.filter(task => {
        const searchMatch = searchTerm === '' || task.title.toLowerCase().includes(searchTerm.toLowerCase()) || (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const assigneeMatch = filterAssignee === '' || (task.assignee_name && task.assignee_name.toLowerCase().includes(filterAssignee.toLowerCase()));
        const tagMatch = filterTag === '' || (task.tags && task.tags.toLowerCase().includes(filterTag.toLowerCase()));
        return searchMatch && assigneeMatch && tagMatch;
      });

      const tasksByStatus = {
        todo: filteredData.filter(t => t.status === 'todo'),
        inProgress: filteredData.filter(t => t.status === 'in-progress'),
        done: filteredData.filter(t => t.status === 'done')
      };

      const tasksByPriority = filteredData.reduce((acc, t) => {
        const priority = t.priority || 'medium';
        if (!acc[priority]) acc[priority] = 0;
        acc[priority]++;
        return acc;
      }, {});

      const tasksByAssignee = filteredData.reduce((acc, t) => {
        const assignee = t.assignee_name || 'Atanmamış';
        if (!acc[assignee]) acc[assignee] = 0;
        acc[assignee]++;
        return acc;
      }, {});

      const overdueTasks = filteredData.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== 'done';
      });

      const reportId = `RPR-TASK-DET-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const reportData = {
        title: 'Aksiyon Takibi - Detaylı Rapor',
        reportId,
        filters: {
          'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
          'Arama Terimi': searchTerm || 'Yok',
          'Atanan Filtresi': filterAssignee || 'Yok',
          'Etiket Filtresi': filterTag || 'Yok'
        },
        kpiCards: [
          { title: 'Toplam Görev', value: filteredData.length.toString() },
          { title: 'Bekleyen Görevler', value: tasksByStatus.todo.length.toString() },
          { title: 'Devam Eden Görevler', value: tasksByStatus.inProgress.length.toString() },
          { title: 'Tamamlanan Görevler', value: tasksByStatus.done.length.toString() },
          { title: 'Geciken Görevler', value: overdueTasks.length.toString() },
          { title: 'Farklı Atanan', value: Object.keys(tasksByAssignee).length.toString() }
        ],
        tableData: {
          headers: ['Başlık', 'Açıklama', 'Durum', 'Öncelik', 'Atanan', 'Termin Tarihi', 'Etiketler', 'Oluşturulma'],
          rows: filteredData.map(t => [
            t.title || '-',
            t.description ? (t.description.length > 50 ? t.description.substring(0, 50) + '...' : t.description) : '-',
            statusMap[t.status] || t.status,
            priorityMap[t.priority]?.label || t.priority,
            t.assignee_name || 'Atanmamış',
            t.due_date ? format(new Date(t.due_date), 'dd.MM.yyyy', { locale: tr }) : '-',
            t.tags || '-',
            t.created_at ? format(new Date(t.created_at), 'dd.MM.yyyy', { locale: tr }) : '-'
          ])
        },
        signatureFields: [
          { title: 'Hazırlayan', name: authUser?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
          { title: 'Kontrol Eden', name: '', role: '..................' },
          { title: 'Onaylayan', name: '', role: '..................' }
        ]
      };

      // Öncelik bazlı özet ekle
      if (Object.keys(tasksByPriority).length > 0) {
        reportData.tableData.rows.push(
          ['---', '---', '---', '---', '---', '---', '---', '---'],
          ...Object.entries(tasksByPriority).map(([priority, count]) => [
            'ÖZET',
            `${priorityMap[priority]?.label || priority} Öncelik Özeti`,
            '-',
            priorityMap[priority]?.label || priority,
            '-',
            '-',
            '-',
            `${count} görev`
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

  const TaskForm = ({ task, onSave }) => {
    const [formData, setFormData] = useState(task || initialFormState);
    return (
      <div className="grid gap-4 py-4 px-6 modal-body-scroll">
        <div className="space-y-2"><Label>Başlık</Label><Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
        <div className="space-y-2"><Label>Açıklama</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Öncelik</Label><Select value={formData.priority} onValueChange={priority => setFormData({...formData, priority})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Düşük</SelectItem><SelectItem value="medium">Orta</SelectItem><SelectItem value="high">Yüksek</SelectItem><SelectItem value="critical">Kritik</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Atanan</Label><Combobox options={employeeOptions} value={formData.assignee_id} onSelect={(value) => setFormData({...formData, assignee_id: value})} placeholder="Personel Seç" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı."/></div>
          <div className="space-y-2"><Label>Termin Tarihi</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start", !formData.due_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formData.due_date ? format(new Date(formData.due_date), 'PPP', { locale: tr }) : <span>Tarih seçin</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.due_date ? new Date(formData.due_date) : null} onSelect={date => setFormData({...formData, due_date: date?.toISOString()})} initialFocus /></PopoverContent></Popover></div>
          <div className="space-y-2"><Label>Etiketler (virgülle ayırın)</Label><Input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} /></div>
        </div>
        <div className="flex justify-end pt-4"><Button onClick={() => onSave(formData)}>Kaydet</Button></div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader><div className="flex justify-between items-center"><CardTitle>Aksiyon Takibi</CardTitle><div className="flex space-x-2"><Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Yeni Görev</Button><Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button></div></div></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
            <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Görev ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>
            <Input placeholder="Personel filtrele..." value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="w-full sm:w-[180px]" />
            <Input placeholder="Etiket filtrele..." value={filterTag} onChange={e => setFilterTag(e.target.value)} className="w-full sm:w-[180px]" />
            {(searchTerm || filterAssignee || filterTag) && <Button variant="ghost" onClick={() => { setSearchTerm(''); setFilterAssignee(''); setFilterTag(''); }}><XIcon className="h-4 w-4 mr-2" /> Temizle</Button>}
          </div>
          <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <TaskColumn id="todo" title={statusMap['todo']} tasks={columns.todo} onSelectTask={setViewingTask} />
              <TaskColumn id="in-progress" title={statusMap['in-progress']} tasks={columns['in-progress']} onSelectTask={setViewingTask} />
              <TaskColumn id="done" title={statusMap['done']} tasks={columns.done} onSelectTask={setViewingTask} />
            </div>
          </DndContext>
        </CardContent>
      </Card>
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{editingTask ? 'Görevi Düzenle' : 'Yeni Görev Oluştur'}</DialogTitle></DialogHeader><TaskForm task={editingTask} onSave={handleSaveTask} /></DialogContent></Dialog>
      <Dialog open={!!viewingTask} onOpenChange={() => setViewingTask(null)}>
        <DialogContent className="max-w-2xl">
          {viewingTask && <>
            <DialogHeader><DialogTitle>{viewingTask.title}</DialogTitle><DialogDescription>Oluşturan: {viewingTask.assignee_name} · Öncelik: {priorityMap[viewingTask.priority]?.label}</DialogDescription></DialogHeader>
            <div className="py-4 space-y-4 px-6 modal-body-scroll"><p>{viewingTask.description || "Açıklama yok."}</p>
              <div className="text-sm text-gray-600 space-y-2">
                {viewingTask.due_date && <div className="flex items-center"><CalendarIcon className="h-4 w-4 mr-2" /><span>Termin: {format(new Date(viewingTask.due_date), 'PPP, p', { locale: tr })}</span></div>}
                {viewingTask.tags && <div className="flex items-center"><Tag className="h-4 w-4 mr-2" /><span>Etiketler: {viewingTask.tags}</span></div>}
              </div>
            </div>
            <div className="flex justify-end space-x-2"><Button variant="outline" onClick={() => { setViewingTask(null); setEditingTask(viewingTask); setIsFormOpen(true); }}><Edit className="h-4 w-4 mr-2" />Düzenle</Button><Button variant="destructive" onClick={() => handleDeleteTask(viewingTask.id)}><Trash2 className="h-4 w-4 mr-2" />Sil</Button></div>
          </>}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default TaskManager;