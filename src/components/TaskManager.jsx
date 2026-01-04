import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Plus, GripVertical, Calendar as CalendarIcon, User, AlertCircle, CheckCircle, Loader, Search, X as XIcon, Tag, Trash2, Edit, BarChart3, TrendingUp, Target, Clock, Download, Folder, FolderPlus, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { cn, logAction, openPrintWindow, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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

const TaskCard = ({ task, onSelect, compact = false }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const priority = priorityMap[task.priority] || priorityMap.medium;

  if (compact) {
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelect(task)}>
          <CardContent className="p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs leading-snug">{task.title}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{task.assignee_name}</p>
              </div>
              <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <GripVertical className="h-3 w-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="mb-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 cursor-pointer" onClick={() => onSelect(task)}>
              <p className="font-medium text-sm leading-snug">{task.title}</p>
            </div>
            <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none">
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => onSelect(task)}>
            {task.description && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{task.description}</p>}
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <div className="flex items-center space-x-2 overflow-hidden">
                <div className={`flex items-center space-x-1 ${priority.color}`}>{React.cloneElement(priority.icon, {})}<span>{priority.label}</span></div>
                {task.due_date && <div className="flex items-center space-x-1"><CalendarIcon className="h-3 w-3" /><span>{format(new Date(task.due_date), 'dd MMM', { locale: tr })}</span></div>}
                {task.tags && task.tags.split(',').map(tag => tag.trim() && <div key={tag} className="flex items-center space-x-1 bg-gray-200 px-1.5 py-0.5 rounded"><Tag className="h-3 w-3" /><span>{tag}</span></div>)}
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0"><User className="h-3 w-3" /><span>{task.assignee_name}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const TaskColumn = ({ id, title, tasks, onSelectTask }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`bg-gray-100 rounded-lg p-3 w-full md:w-1/3 transition-colors ${isOver ? 'bg-gray-200 ring-2 ring-blue-400' : ''}`}
      data-column-id={id}
    >
      <h3 className="font-semibold text-gray-700 mb-4 px-1">{title} ({tasks.length})</h3>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[200px]">{tasks.map(task => <TaskCard key={task.id} task={task} onSelect={onSelectTask} />)}</div>
      </SortableContext>
    </div>
  );
};

const ProjectTaskColumn = ({ id, title, tasks, onSelectTask, projectId }) => {
  const columnId = `${projectId}-${id}`;
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`bg-white rounded-lg p-2 transition-colors ${isOver ? 'bg-gray-100 ring-2 ring-blue-400' : ''}`}
      data-column-id={columnId}
      data-status={id}
    >
      <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
        {id === 'todo' && <Clock className="h-4 w-4 text-blue-600" />}
        {id === 'in-progress' && <Loader className="h-4 w-4 text-yellow-600" />}
        {id === 'done' && <CheckCircle className="h-4 w-4 text-green-600" />}
        <span className={id === 'todo' ? 'text-blue-600' : id === 'in-progress' ? 'text-yellow-600' : 'text-green-600'}>
          {title} ({tasks.length})
        </span>
      </h4>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[100px] space-y-1">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onSelect={onSelectTask} compact={true} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

const TaskManager = ({ user }) => {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [expandedProjects, setExpandedProjects] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [showProjectReportDialog, setShowProjectReportDialog] = useState(false);
  const [selectedProjectForReport, setSelectedProjectForReport] = useState(null);

  // Analiz verileri
  const analysisData = useMemo(() => {
    if (!tasks.length) return null;

    const today = new Date();

    // Durum bazlı analiz
    const byStatus = {
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      done: tasks.filter(t => t.status === 'done').length,
    };

    const statusData = [
      { name: 'Beklemede', value: byStatus.todo, color: '#3B82F6' },
      { name: 'Devam Ediyor', value: byStatus.inProgress, color: '#F59E0B' },
      { name: 'Tamamlandı', value: byStatus.done, color: '#10B981' },
    ];

    // Öncelik bazlı analiz
    const byPriority = {};
    tasks.forEach(t => {
      const priority = t.priority || 'medium';
      if (!byPriority[priority]) byPriority[priority] = 0;
      byPriority[priority]++;
    });

    const priorityData = [
      { name: 'Düşük', value: byPriority.low || 0, color: '#9CA3AF' },
      { name: 'Orta', value: byPriority.medium || 0, color: '#3B82F6' },
      { name: 'Yüksek', value: byPriority.high || 0, color: '#F59E0B' },
      { name: 'Kritik', value: byPriority.critical || 0, color: '#EF4444' },
    ].filter(d => d.value > 0);

    // Atanan bazlı analiz
    const byAssignee = {};
    tasks.forEach(t => {
      const assignee = t.assignee_name || 'Atanmamış';
      if (!byAssignee[assignee]) byAssignee[assignee] = { total: 0, done: 0, pending: 0 };
      byAssignee[assignee].total++;
      if (t.status === 'done') byAssignee[assignee].done++;
      else byAssignee[assignee].pending++;
    });

    const assigneeData = Object.entries(byAssignee)
      .map(([name, data]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Geciken görevler
    const overdueTasks = tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < today;
    });

    // Aylık trend
    const byMonth = {};
    tasks.forEach(t => {
      if (!t.created_at) return;
      const month = format(new Date(t.created_at), 'MMM yyyy', { locale: tr });
      if (!byMonth[month]) byMonth[month] = { created: 0, done: 0 };
      byMonth[month].created++;
      if (t.status === 'done') byMonth[month].done++;
    });

    const monthlyData = Object.entries(byMonth)
      .map(([month, data]) => ({ month, ...data }))
      .slice(-12);

    // Etiket bazlı analiz
    const byTag = {};
    tasks.forEach(t => {
      if (!t.tags) return;
      t.tags.split(',').forEach(tag => {
        const trimmedTag = tag.trim();
        if (!trimmedTag) return;
        if (!byTag[trimmedTag]) byTag[trimmedTag] = 0;
        byTag[trimmedTag]++;
      });
    });

    const tagData = Object.entries(byTag)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Tamamlanma oranı
    const completionRate = tasks.length > 0 ? Math.round((byStatus.done / tasks.length) * 100) : 0;

    return {
      total: tasks.length,
      byStatus,
      completionRate,
      overdue: overdueTasks.length,
      statusData,
      priorityData,
      assigneeData,
      monthlyData,
      tagData,
    };
  }, [tasks]);

  const employeeOptions = useMemo(() => employees.map(emp => ({
    value: emp.id,
    label: `${emp.registration_number} - ${emp.first_name} ${emp.last_name}`
  })).sort((a, b) => a.label.localeCompare(b.label)), [employees]);

  const initialFormState = { title: '', description: '', status: 'todo', priority: 'medium', assignee_id: null, part_code: '', tags: '', comments: [], files: [], project_id: null };
  const initialProjectFormState = { name: '', description: '', color: '#3B82F6', status: 'active' };

  const fetchTasks = async () => {
    const [tasksRes, employeesRes, projectsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, registration_number').eq('is_active', true),
      supabase.from('projects').select('*').order('created_at', { ascending: true })
    ]);
    
    if (tasksRes.error || employeesRes.error || projectsRes.error) {
      console.error("Error fetching data:", tasksRes.error || employeesRes.error || projectsRes.error);
    } else {
      const enrichedTasks = tasksRes.data.map(task => {
        const assignee = employeesRes.data.find(e => e.id === task.assignee_id);
        const project = projectsRes.data.find(p => p.id === task.project_id);
        return {
          ...task,
          assignee_name: assignee ? `${assignee.first_name} ${assignee.last_name}` : 'Atanmamış',
          project_name: project ? project.name : 'Proje Yok',
          project_color: project ? project.color : '#6B7280'
        }
      });
      setTasks(enrichedTasks);
      setEmployees(employeesRes.data);
      setProjects(projectsRes.data || []);
      
      // İlk yüklemede tüm projeleri genişlet
      if (Object.keys(expandedProjects).length === 0 && projectsRes.data.length > 0) {
        const initialExpanded = {};
        projectsRes.data.forEach(p => { initialExpanded[p.id] = true; });
        initialExpanded['no-project'] = true;
        setExpandedProjects(initialExpanded);
      }
    }
  };
  
  const projectOptions = useMemo(() => [
    { value: '', label: 'Proje Yok' },
    ...projects.map(p => ({ value: p.id, label: p.name }))
  ], [projects]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const searchMatch = searchTerm === '' || task.title.toLowerCase().includes(searchTerm.toLowerCase()) || (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const assigneeMatch = filterAssignee === '' || (task.assignee_name && task.assignee_name.toLowerCase().includes(filterAssignee.toLowerCase()));
      const tagMatch = filterTag === '' || (task.tags && task.tags.toLowerCase().includes(filterTag.toLowerCase()));
      const projectMatch = filterProject === '' || filterProject === 'all' || task.project_id === filterProject || (filterProject === 'no-project' && !task.project_id);
      return searchMatch && assigneeMatch && tagMatch && projectMatch;
    });
  }, [tasks, searchTerm, filterAssignee, filterTag, filterProject]);
  
  // Proje bazlı görevlerin gruplandırılması
  const tasksByProject = useMemo(() => {
    const grouped = { 'no-project': [] };
    projects.forEach(p => { grouped[p.id] = []; });
    
    filteredTasks.forEach(task => {
      if (task.project_id && grouped[task.project_id]) {
        grouped[task.project_id].push(task);
      } else {
        grouped['no-project'].push(task);
      }
    });
    
    return grouped;
  }, [filteredTasks, projects]);
  
  const toggleProjectExpand = (projectId) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };
  
  const handleSaveProject = async (projectData) => {
    if (!projectData.name) {
      toast({ title: "Hata", description: "Proje adı boş olamaz.", variant: "destructive" });
      return;
    }
    
    let response;
    if (editingProject) {
      response = await supabase.from('projects').update(projectData).eq('id', editingProject.id).select();
    } else {
      response = await supabase.from('projects').insert(projectData).select();
    }
    
    if (response.error) {
      toast({ title: "Kayıt Başarısız", description: response.error.message, variant: "destructive" });
    } else {
      toast({ title: editingProject ? "Proje Güncellendi" : "Proje Oluşturuldu" });
      logAction(editingProject ? 'UPDATE_PROJECT' : 'CREATE_PROJECT', `Proje: ${response.data[0].name}`, authUser);
      fetchTasks();
      setIsProjectFormOpen(false);
      setEditingProject(null);
    }
  };
  
  const handleDeleteProject = async (projectId) => {
    // Önce projeye ait görevleri projeden çıkar
    await supabase.from('tasks').update({ project_id: null }).eq('project_id', projectId);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Proje Silindi" });
      logAction('DELETE_PROJECT', `Proje silindi: ${projectId}`, authUser);
      fetchTasks();
    }
  };

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
    const overId = over.id;
    
    // Eğer over bir kolon ise (todo, in-progress, done veya projectId-status formatında)
    let overContainer = null;
    
    // Direkt kolon ID'leri (Kanban sekmesi için)
    if (overId === 'todo' || overId === 'in-progress' || overId === 'done') {
      overContainer = overId;
    } 
    // Proje bazlı kolon ID'leri (Proje Bazlı sekme için: projectId-status)
    else if (typeof overId === 'string' && overId.includes('-')) {
      const parts = overId.split('-');
      const lastPart = parts[parts.length - 1];
      if (lastPart === 'todo' || lastPart === 'in-progress' || lastPart === 'done') {
        overContainer = lastPart;
      }
    }
    // Eğer over bir görev kartı ise, o görevin bulunduğu kolonu bul
    else {
      const task = tasks.find(t => t.id === overId);
      if (task) {
        overContainer = task.status;
      } else {
        // Kolon container'ını bulmaya çalış
        overContainer = findContainer(overId);
      }
    }
    
    // Eğer kolon bulunamadıysa veya aynı kolona bırakıldıysa işlem yapma
    if (!overContainer) return;
    
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask || activeTask.status === overContainer) return;
    
    // Durumu güncelle
    const { error } = await supabase
      .from('tasks')
      .update({ status: overContainer })
      .eq('id', activeId);
    
    if (error) {
      toast({ 
        title: "Hata", 
        description: "Görev durumu güncellenirken bir hata oluştu.", 
        variant: "destructive" 
      });
      return;
    }
    
    // UI'ı güncelle
    setTasks((prevTasks) => {
      return prevTasks.map(task => 
        task.id === activeId ? { ...task, status: overContainer } : task
      );
    });
    
    logAction('UPDATE_TASK_STATUS', `Görev durumu güncellendi: ${activeId} -> ${overContainer}`, authUser);
  };
  
  const findContainer = (id) => {
    // Kolon ID'lerini kontrol et
    if (id === 'todo' || id === 'in-progress' || id === 'done') {
      return id;
    }
    // Proje bazlı kolon ID'leri için
    if (typeof id === 'string' && id.includes('-')) {
      const parts = id.split('-');
      const lastPart = parts[parts.length - 1];
      if (lastPart === 'todo' || lastPart === 'in-progress' || lastPart === 'done') {
        return lastPart;
      }
    }
    // Görev ID'si ise, görevin bulunduğu kolonu bul
    const task = tasks.find(t => t.id === id);
    return task ? task.status : null;
  };

  const handleSaveTask = async (taskData) => {
    if (!taskData.title) {
      toast({ title: "Hata", description: "Görev başlığı boş olamaz.", variant: "destructive" });
      return;
    }
    
    const saveData = { ...taskData };
    if(saveData.assignee_id === '') saveData.assignee_id = null;

    // UI için eklenen alanları temizle (veritabanında yok)
    const { assignee_name, project_name, project_color, ...cleanData } = saveData;

    let response;
    if (editingTask) {
      const { id, ...updateData } = cleanData;
      response = await supabase.from('tasks').update(updateData).eq('id', id).select();
    } else {
      response = await supabase.from('tasks').insert(cleanData).select();
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

      // Öncelik bazlı analiz ekle
      reportData.tableData.rows.push(
        ['===', '===', '===', '===', '===', '===', '===', '==='],
        ['ÖNCELİK BAZLI ANALİZ', '', '', '', '', '', '', ''],
        ['Öncelik', 'Görev Sayısı', 'Oran (%)', '', '', '', '', ''],
        ...Object.entries(tasksByPriority).sort((a, b) => b[1] - a[1]).map(([priority, count]) => [
          priorityMap[priority]?.label || priority,
          count.toString(),
          `%${((count / filteredData.length) * 100).toFixed(1)}`,
          '', '', '', '', ''
        ])
      );

      // Atanan bazlı analiz ekle
      reportData.tableData.rows.push(
        ['===', '===', '===', '===', '===', '===', '===', '==='],
        ['ATANAN BAZLI ANALİZ', '', '', '', '', '', '', ''],
        ['Atanan', 'Görev Sayısı', 'Tamamlanan', 'Tamamlanma Oranı', '', '', '', ''],
        ...Object.entries(tasksByAssignee).sort((a, b) => b[1] - a[1]).map(([assignee, count]) => {
          const doneCount = filteredData.filter(t => (t.assignee_name || 'Atanmamış') === assignee && t.status === 'done').length;
          return [
            assignee,
            count.toString(),
            doneCount.toString(),
            `%${((doneCount / count) * 100).toFixed(0)}`,
            '', '', '', ''
          ];
        })
      );

      // Geciken görevler listesi ekle
      if (overdueTasks.length > 0) {
        reportData.tableData.rows.push(
          ['===', '===', '===', '===', '===', '===', '===', '==='],
          ['GECİKEN GÖREVLER', '', '', '', '', '', '', ''],
          ['Başlık', 'Atanan', 'Termin Tarihi', 'Durum', 'Öncelik', '', '', ''],
          ...overdueTasks.map(t => [
            t.title || '-',
            t.assignee_name || 'Atanmamış',
            t.due_date ? format(new Date(t.due_date), 'dd.MM.yyyy', { locale: tr }) : '-',
            statusMap[t.status] || t.status,
            priorityMap[t.priority]?.label || t.priority,
            '', '', ''
          ])
        );
      }

      // Etiket bazlı analiz
      const tasksByTag = {};
      filteredData.forEach(t => {
        if (t.tags) {
          const tags = t.tags.split(',').map(tag => tag.trim());
          tags.forEach(tag => {
            if (!tasksByTag[tag]) tasksByTag[tag] = 0;
            tasksByTag[tag]++;
          });
        }
      });

      if (Object.keys(tasksByTag).length > 0) {
        reportData.tableData.rows.push(
          ['===', '===', '===', '===', '===', '===', '===', '==='],
          ['ETİKET BAZLI ANALİZ', '', '', '', '', '', '', ''],
          ['Etiket', 'Görev Sayısı', '', '', '', '', '', ''],
          ...Object.entries(tasksByTag).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([tag, count]) => [
            tag,
            count.toString(),
            '', '', '', '', '', ''
          ])
        );
      }

      await openPrintWindow(reportData, toast);
      toast({ title: "Rapor Hazır", description: "Detaylı görev raporu başarıyla oluşturuldu." });
    } catch (error) {
      console.error('Detaylı rapor hatası:', error);
      toast({
        title: "Rapor Oluşturulamadı",
        description: error.message || "Rapor oluşturulurken bir hata oluştu.",
        variant: "destructive"
      });
    }
  };

  const handleGenerateProjectReport = async () => {
    if (!selectedProjectForReport) {
      toast({ title: "Hata", description: "Lütfen bir proje seçin.", variant: "destructive" });
      return;
    }

    try {
      setShowProjectReportDialog(false);
      toast({ title: "Proje bazlı rapor hazırlanıyor...", description: "Seçilen proje için görev verileri toplanıyor." });

      const project = projects.find(p => p.id === selectedProjectForReport);
      const projectName = project ? project.name : 'Bilinmeyen Proje';

      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*, assignee:employees(first_name, last_name, registration_number), project:projects(name, description)')
        .eq('project_id', selectedProjectForReport)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      const enrichedTasks = allTasks.map(task => {
        const assignee = task.assignee;
        return {
          ...task,
          assignee_name: assignee ? `${assignee.registration_number || ''} - ${assignee.first_name} ${assignee.last_name}`.trim() : 'Atanmamış',
          project_name: task.project?.name || 'Proje Yok'
        };
      });

      const tasksByStatus = {
        todo: enrichedTasks.filter(t => t.status === 'todo'),
        inProgress: enrichedTasks.filter(t => t.status === 'in-progress'),
        done: enrichedTasks.filter(t => t.status === 'done')
      };

      const tasksByPriority = enrichedTasks.reduce((acc, t) => {
        const priority = t.priority || 'medium';
        if (!acc[priority]) acc[priority] = 0;
        acc[priority]++;
        return acc;
      }, {});

      const tasksByAssignee = enrichedTasks.reduce((acc, t) => {
        const assignee = t.assignee_name || 'Atanmamış';
        if (!acc[assignee]) acc[assignee] = 0;
        acc[assignee]++;
        return acc;
      }, {});

      const overdueTasks = enrichedTasks.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== 'done';
      });

      const reportId = `RPR-TASK-PROJ-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Sections formatı kullan - her bölüm ayrı tablo olarak render edilir
      const sections = [];
      
      // 1. Görev Listesi
      if (enrichedTasks.length > 0) {
        sections.push({
          title: 'GÖREV LİSTESİ',
          headers: ['Başlık', 'Durum', 'Öncelik', 'Atanan', 'Termin Tarihi'],
          rows: enrichedTasks.map(t => [
            t.title || '-',
            statusMap[t.status]?.label || t.status,
            priorityMap[t.priority]?.label || t.priority,
            t.assignee_name || 'Atanmamış',
            t.due_date ? format(new Date(t.due_date), 'dd.MM.yyyy', { locale: tr }) : '-'
          ])
        });
      }
      
      // 2. Durum Bazlı Özet
      sections.push({
        title: 'DURUM BAZLI ÖZET',
        headers: ['Durum', 'Görev Sayısı', 'Oran (%)'],
        rows: [
          ['Bekleyen', tasksByStatus.todo.length.toString(), enrichedTasks.length > 0 ? `%${((tasksByStatus.todo.length / enrichedTasks.length) * 100).toFixed(1)}` : '%0'],
          ['Devam Eden', tasksByStatus.inProgress.length.toString(), enrichedTasks.length > 0 ? `%${((tasksByStatus.inProgress.length / enrichedTasks.length) * 100).toFixed(1)}` : '%0'],
          ['Tamamlanan', tasksByStatus.done.length.toString(), enrichedTasks.length > 0 ? `%${((tasksByStatus.done.length / enrichedTasks.length) * 100).toFixed(1)}` : '%0']
        ]
      });
      
      // 3. Öncelik Bazlı Özet
      if (Object.keys(tasksByPriority).length > 0) {
        sections.push({
          title: 'ÖNCELİK BAZLI ÖZET',
          headers: ['Öncelik', 'Görev Sayısı', 'Oran (%)'],
          rows: Object.entries(tasksByPriority).sort((a, b) => {
            const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
            return (priorityOrder[b[0]] || 0) - (priorityOrder[a[0]] || 0);
          }).map(([priority, count]) => [
            priorityMap[priority]?.label || priority,
            count.toString(),
            `%${((count / enrichedTasks.length) * 100).toFixed(1)}`
          ])
        });
      }
      
      // 4. Geciken Görevler
      if (overdueTasks.length > 0) {
        sections.push({
          title: 'GECİKEN GÖREVLER',
          headers: ['Başlık', 'Atanan', 'Termin Tarihi', 'Öncelik'],
          rows: overdueTasks.map(t => [
            t.title || '-',
            t.assignee_name || 'Atanmamış',
            t.due_date ? format(new Date(t.due_date), 'dd.MM.yyyy', { locale: tr }) : '-',
            priorityMap[t.priority]?.label || t.priority
          ])
        });
      }
      
      // 5. Atanan Bazlı Özet
      if (Object.keys(tasksByAssignee).length > 1) {
        sections.push({
          title: 'ATANAN BAZLI ÖZET',
          headers: ['Atanan', 'Toplam Görev', 'Tamamlanan', 'Tamamlanma Oranı'],
          rows: Object.entries(tasksByAssignee).sort((a, b) => b[1] - a[1]).map(([assignee, count]) => {
            const doneCount = enrichedTasks.filter(t => (t.assignee_name || 'Atanmamış') === assignee && t.status === 'done').length;
            return [
              assignee,
              count.toString(),
              doneCount.toString(),
              `%${((doneCount / count) * 100).toFixed(0)}`
            ];
          })
        });
      }
      
      const reportData = {
        title: `Proje Bazlı Görev Raporu: ${projectName}`,
        reportId,
        filters: {
          'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
          'Proje': projectName,
          'Açıklama': project?.description || '-'
        },
        kpiCards: [
          { title: 'Toplam Görev', value: enrichedTasks.length.toString() },
          { title: 'Bekleyen', value: tasksByStatus.todo.length.toString() },
          { title: 'Devam Eden', value: tasksByStatus.inProgress.length.toString() },
          { title: 'Tamamlanan', value: tasksByStatus.done.length.toString() },
          { title: 'Geciken', value: overdueTasks.length.toString() },
          { title: 'Tamamlanma Oranı', value: enrichedTasks.length > 0 ? `%${((tasksByStatus.done.length / enrichedTasks.length) * 100).toFixed(1)}` : '%0' }
        ],
        sections,
        signatureFields: [
          { title: 'Hazırlayan', name: authUser?.user_metadata?.name || 'Sistem Kullanıcısı', role: ' ' },
          { title: 'Kontrol Eden', name: '', role: '..................' },
          { title: 'Onaylayan', name: '', role: '..................' }
        ]
      }

      await openPrintWindow(reportData, toast);
      toast({ title: "Rapor Hazır", description: `${projectName} projesi için rapor başarıyla oluşturuldu.` });
      setSelectedProjectForReport(null);
    } catch (error) {
      console.error('Proje bazlı rapor hatası:', error);
      toast({
        title: "Rapor Oluşturulamadı",
        description: error.message || "Rapor oluşturulurken bir hata oluştu.",
        variant: "destructive"
      });
    }
  };

  const TaskForm = ({ task, onSave }) => {
    const [formData, setFormData] = useState(task || { ...initialFormState, project_id: selectedProject });
    return (
      <div className="grid gap-4 py-4 px-6 modal-body-scroll">
        <div className="space-y-2"><Label>Başlık</Label><Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
        <div className="space-y-2"><Label>Açıklama</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Proje</Label><Select value={formData.project_id || 'none'} onValueChange={project_id => setFormData({...formData, project_id: project_id === 'none' ? null : project_id})}><SelectTrigger><SelectValue placeholder="Proje seçin..." /></SelectTrigger><SelectContent><SelectItem value="none">Proje Yok</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: p.color}}></div>{p.name}</div></SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Öncelik</Label><Select value={formData.priority} onValueChange={priority => setFormData({...formData, priority})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Düşük</SelectItem><SelectItem value="medium">Orta</SelectItem><SelectItem value="high">Yüksek</SelectItem><SelectItem value="critical">Kritik</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Atanan</Label><Combobox options={employeeOptions} value={formData.assignee_id} onSelect={(value) => setFormData({...formData, assignee_id: value})} placeholder="Personel Seç" searchPlaceholder="Personel ara..." emptyPlaceholder="Personel bulunamadı."/></div>
          <div className="space-y-2"><Label>Termin Tarihi</Label><Popover><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start", !formData.due_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{formData.due_date ? format(new Date(formData.due_date), 'PPP', { locale: tr }) : <span>Tarih seçin</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.due_date ? new Date(formData.due_date) : null} onSelect={date => setFormData({...formData, due_date: date?.toISOString()})} initialFocus /></PopoverContent></Popover></div>
          <div className="space-y-2 col-span-2"><Label>Etiketler (virgülle ayırın)</Label><Input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} /></div>
        </div>
        <div className="flex justify-end pt-4"><Button onClick={() => onSave(formData)}>Kaydet</Button></div>
      </div>
    );
  };
  
  const ProjectForm = ({ project, onSave }) => {
    const [formData, setFormData] = useState(project || initialProjectFormState);
    const colorOptions = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
    return (
      <div className="grid gap-4 py-4 px-6">
        <div className="space-y-2"><Label>Proje Adı</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Proje adı..." /></div>
        <div className="space-y-2"><Label>Açıklama</Label><Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Proje açıklaması..." /></div>
        <div className="space-y-2">
          <Label>Renk</Label>
          <div className="flex gap-2 flex-wrap">
            {colorOptions.map(color => (
              <button key={color} onClick={() => setFormData({...formData, color})} className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{backgroundColor: color}}></button>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-4"><Button onClick={() => onSave(formData)}>Kaydet</Button></div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Aksiyon Takibi</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => { setEditingProject(null); setIsProjectFormOpen(true); }}><FolderPlus className="mr-2 h-4 w-4" />Yeni Proje</Button>
              <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Yeni Görev</Button>
              <Button variant="outline" onClick={() => setShowProjectReportDialog(true)}><FileText className="h-4 w-4 mr-2" />Proje Bazlı Rapor</Button>
              <Button variant="outline" onClick={handleGenerateDetailedReport}><Download className="h-4 w-4 mr-2" />Detaylı Rapor</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <Folder className="h-4 w-4" /> Proje Bazlı
              </TabsTrigger>
              <TabsTrigger value="kanban" className="flex items-center gap-2">
                <Target className="h-4 w-4" /> Kanban
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Detaylı Analiz
              </TabsTrigger>
            </TabsList>

            {/* Proje Bazlı Sekme */}
            <TabsContent value="projects">
              <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Görev ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>
                <Input placeholder="Personel filtrele..." value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="w-full sm:w-[180px]" />
                {(searchTerm || filterAssignee) && <Button variant="ghost" onClick={() => { setSearchTerm(''); setFilterAssignee(''); }}><XIcon className="h-4 w-4 mr-2" /> Temizle</Button>}
              </div>
              
              <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
                <div className="space-y-4">
                  {/* Projeler ve Görevler */}
                  {projects.map(project => (
                    <div key={project.id} className="border rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                        style={{ borderLeft: `4px solid ${project.color}` }}
                        onClick={() => toggleProjectExpand(project.id)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedProjects[project.id] ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
                          <Folder className="h-5 w-5" style={{ color: project.color }} />
                          <div>
                            <h3 className="font-semibold">{project.name}</h3>
                            {project.description && <p className="text-xs text-gray-500">{project.description}</p>}
                          </div>
                          <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-full text-xs font-medium">
                            {tasksByProject[project.id]?.length || 0} görev
                          </span>
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingProject(project); setIsProjectFormOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { if(confirm('Bu projeyi silmek istediğinize emin misiniz?')) handleDeleteProject(project.id); }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          <Button size="sm" onClick={() => { setEditingTask(null); setSelectedProject(project.id); setIsFormOpen(true); }}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      
                      {expandedProjects[project.id] && tasksByProject[project.id]?.length > 0 && (
                        <div className="border-t bg-gray-50 p-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <ProjectTaskColumn 
                              id="todo" 
                              title="Beklemede" 
                              tasks={tasksByProject[project.id].filter(t => t.status === 'todo')} 
                              onSelectTask={setViewingTask}
                              projectId={project.id}
                            />
                            <ProjectTaskColumn 
                              id="in-progress" 
                              title="Devam Eden" 
                              tasks={tasksByProject[project.id].filter(t => t.status === 'in-progress')} 
                              onSelectTask={setViewingTask}
                              projectId={project.id}
                            />
                            <ProjectTaskColumn 
                              id="done" 
                              title="Tamamlandı" 
                              tasks={tasksByProject[project.id].filter(t => t.status === 'done')} 
                              onSelectTask={setViewingTask}
                              projectId={project.id}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                
                  {/* Projesiz Görevler */}
                  {tasksByProject['no-project']?.length > 0 && (
                    <div className="border rounded-lg overflow-hidden border-dashed">
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 bg-gray-100"
                        onClick={() => toggleProjectExpand('no-project')}
                      >
                        <div className="flex items-center gap-3">
                          {expandedProjects['no-project'] ? <ChevronDown className="h-5 w-5 text-gray-500" /> : <ChevronRight className="h-5 w-5 text-gray-500" />}
                          <Folder className="h-5 w-5 text-gray-400" />
                          <div>
                            <h3 className="font-semibold text-gray-600">Proje Atanmamış Görevler</h3>
                          </div>
                          <span className="ml-2 px-2 py-0.5 bg-gray-300 rounded-full text-xs font-medium">
                            {tasksByProject['no-project'].length} görev
                          </span>
                        </div>
                      </div>
                      
                      {expandedProjects['no-project'] && (
                        <div className="border-t bg-gray-50 p-2">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <ProjectTaskColumn 
                              id="todo" 
                              title="Beklemede" 
                              tasks={tasksByProject['no-project'].filter(t => t.status === 'todo')} 
                              onSelectTask={setViewingTask}
                              projectId="no-project"
                            />
                            <ProjectTaskColumn 
                              id="in-progress" 
                              title="Devam Eden" 
                              tasks={tasksByProject['no-project'].filter(t => t.status === 'in-progress')} 
                              onSelectTask={setViewingTask}
                              projectId="no-project"
                            />
                            <ProjectTaskColumn 
                              id="done" 
                              title="Tamamlandı" 
                              tasks={tasksByProject['no-project'].filter(t => t.status === 'done')} 
                              onSelectTask={setViewingTask}
                              projectId="no-project"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {projects.length === 0 && tasksByProject['no-project']?.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                      <Folder className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Henüz proje veya görev bulunmuyor.</p>
                      <Button className="mt-4" onClick={() => setIsProjectFormOpen(true)}><FolderPlus className="mr-2 h-4 w-4" />İlk Projeyi Oluştur</Button>
                    </div>
                  )}
                </div>
              </DndContext>
            </TabsContent>

            <TabsContent value="kanban">
              <div className="flex flex-col sm:flex-row gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                <div className="relative flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Görev ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" /></div>
                <Input placeholder="Personel filtrele..." value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="w-full sm:w-[180px]" />
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Proje filtrele..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Projeler</SelectItem>
                    <SelectItem value="no-project">Projesiz</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                            <p className="text-sm font-medium text-blue-600">Toplam Görev</p>
                            <p className="text-3xl font-bold text-blue-900">{analysisData.total}</p>
                          </div>
                          <Target className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">Tamamlanma Oranı</p>
                            <p className="text-3xl font-bold text-green-900">%{analysisData.completionRate}</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-yellow-600">Devam Eden</p>
                            <p className="text-3xl font-bold text-yellow-900">{analysisData.byStatus.inProgress}</p>
                          </div>
                          <Loader className="h-8 w-8 text-yellow-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-50 to-red-100">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-600">Geciken</p>
                            <p className="text-3xl font-bold text-red-900">{analysisData.overdue}</p>
                          </div>
                          <Clock className="h-8 w-8 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Grafikler - İlk Satır */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Durum Dağılımı */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Target className="h-5 w-5" /> Durum Dağılımı
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
                            <Tooltip formatter={(value) => [value + ' görev', '']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Öncelik Dağılımı */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" /> Öncelik Dağılımı
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={analysisData.priorityData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={3}
                              dataKey="value"
                              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            >
                              {analysisData.priorityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [value + ' görev', '']} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Grafikler - İkinci Satır */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Aylık Trend */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" /> Aylık Görev Trendi
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
                            <Area type="monotone" dataKey="created" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Oluşturulan" />
                            <Area type="monotone" dataKey="done" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Tamamlanan" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Kişi Bazlı Performans */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <User className="h-5 w-5" /> Personel Bazlı Görevler
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analysisData.assigneeData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" fontSize={12} />
                            <YAxis dataKey="name" type="category" fontSize={10} width={100} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="done" stackId="a" fill="#10B981" name="Tamamlandı" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="pending" stackId="a" fill="#F59E0B" name="Bekliyor" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Etiket Bazlı Analiz */}
                  {analysisData.tagData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Tag className="h-5 w-5" /> Etiket Bazlı Dağılım
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={analysisData.tagData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={11} />
                            <YAxis fontSize={12} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8B5CF6" name="Görev Sayısı" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
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
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if(!open) setSelectedProject(null); }}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>{editingTask ? 'Görevi Düzenle' : 'Yeni Görev Oluştur'}</DialogTitle></DialogHeader><TaskForm task={editingTask} onSave={handleSaveTask} /></DialogContent></Dialog>
      <Dialog open={isProjectFormOpen} onOpenChange={setIsProjectFormOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingProject ? 'Projeyi Düzenle' : 'Yeni Proje Oluştur'}</DialogTitle><DialogDescription>Projeler, görevlerinizi düzenli ve organize tutmanıza yardımcı olur.</DialogDescription></DialogHeader><ProjectForm project={editingProject} onSave={handleSaveProject} /></DialogContent></Dialog>
      <Dialog open={showProjectReportDialog} onOpenChange={setShowProjectReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Proje Bazlı Rapor</DialogTitle>
            <DialogDescription>Rapor oluşturmak istediğiniz projeyi seçin.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Proje Seçin</label>
              <Select value={selectedProjectForReport || ''} onValueChange={setSelectedProjectForReport}>
                <SelectTrigger>
                  <SelectValue placeholder="Proje seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length > 0 ? (
                    projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color || '#3B82F6' }}></div>
                          {project.name}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-projects" disabled>Henüz proje yok</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedProjectForReport && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Seçilen Proje:</strong> {projects.find(p => p.id === selectedProjectForReport)?.name || 'Bilinmeyen'}
                </p>
                {projects.find(p => p.id === selectedProjectForReport)?.description && (
                  <p className="text-xs text-blue-700 mt-1">
                    {projects.find(p => p.id === selectedProjectForReport)?.description}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowProjectReportDialog(false); setSelectedProjectForReport(null); }}>
              İptal
            </Button>
            <Button onClick={handleGenerateProjectReport} disabled={!selectedProjectForReport}>
              <FileText className="h-4 w-4 mr-2" />
              Rapor Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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