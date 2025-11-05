import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UploadCloud, FileText, Trash2, Download } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const DocumentManager = ({ trainingId }) => {
  const [documents, setDocuments] = useState([]);
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('Eğitim Materyali');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = useCallback(acceptedFiles => {
    setFiles(prev => [...prev, ...acceptedFiles.map(file => Object.assign(file, {
      preview: URL.createObjectURL(file)
    }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc', '.docx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt', '.pptx'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('training_documents')
      .select('*')
      .eq('training_id', trainingId);

    if (error) {
      toast({ title: 'Hata', description: 'Dokümanlar alınamadı.', variant: 'destructive' });
    } else {
      setDocuments(data);
    }
    setLoading(false);
  }, [trainingId, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async () => {
    if (files.length === 0 || !user) return;
    setUploading(true);

    for (const file of files) {
      const filePath = `${user.id}/${trainingId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);

      if (uploadError) {
        toast({ title: 'Yükleme Hatası', description: `${file.name} yüklenemedi. ${uploadError.message}`, variant: 'destructive' });
        continue;
      }

      const { error: dbError } = await supabase.from('training_documents').insert({
        training_id: trainingId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        document_category: category,
        uploaded_by: user.id,
      });

      if (dbError) {
        toast({ title: 'Veritabanı Hatası', description: 'Dosya bilgisi kaydedilemedi.', variant: 'destructive' });
      }
    }

    setUploading(false);
    setFiles([]);
    fetchDocuments();
    toast({ title: 'Başarılı', description: 'Tüm dosyalar yüklendi.' });
  };

  const handleDelete = async (doc) => {
    const { error: storageError } = await supabase.storage.from('attachments').remove([doc.file_path]);
    if (storageError) {
      toast({ title: 'Hata', description: 'Dosya silinemedi.', variant: 'destructive' });
      return;
    }
    const { error: dbError } = await supabase.from('training_documents').delete().eq('id', doc.id);
    if (dbError) {
      toast({ title: 'Hata', description: 'Doküman kaydı silinemedi.', variant: 'destructive' });
    } else {
      toast({ title: 'Başarılı', description: 'Doküman silindi.' });
      fetchDocuments();
    }
  };

  const handleDownload = async (filePath, fileName) => {
    const { data, error } = await supabase.storage.from('attachments').download(filePath);
    if (error) {
      toast({ title: 'Hata', description: 'Dosya indirilemedi.', variant: 'destructive' });
      return;
    }
    const blob = new Blob([data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (loading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doküman Yönetimi</CardTitle>
        <CardDescription>Eğitimle ilgili dokümanları yükleyin ve yönetin.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}`}>
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">Dosyaları buraya sürükleyin veya seçmek için tıklayın</p>
            <p className="text-xs text-gray-500">PDF, Word, Excel, PPT, JPG, PNG (Maks. 10MB)</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-grow">
                  <label className="text-sm font-medium">Kategori</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Eğitim Materyali">Eğitim Materyali</SelectItem>
                      <SelectItem value="Sunum">Sunum</SelectItem>
                      <SelectItem value="Katılım Tutanağı">Katılım Tutanağı</SelectItem>
                      <SelectItem value="Sınav Kağıdı">Sınav Kağıdı</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Yükle
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {files.map((file, i) => (
                  <div key={i} className="border rounded-lg p-2 text-center text-xs relative">
                    <FileText className="mx-auto h-10 w-10 text-gray-400" />
                    <p className="truncate mt-1">{file.name}</p>
                    <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => setFiles(files.filter((_, index) => index !== i))}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Yüklenmiş Dokümanlar</h3>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-lg">Henüz doküman yüklenmemiş.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map(doc => (
                  <div key={doc.id} className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-indigo-500" />
                      <div>
                        <p className="font-medium text-sm truncate">{doc.file_name}</p>
                        <p className="text-xs text-gray-500">{doc.document_category}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc.file_path, doc.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentManager;