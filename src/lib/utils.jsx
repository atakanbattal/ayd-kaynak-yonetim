import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "@/lib/customSupabaseClient";

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(0);
  }
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(value);
}

export const logAction = async (action, details, user) => {
  const userName = user?.user_metadata?.name || user?.email || 'Sistem';
  try {
    const { error } = await supabase
      .from('audit_log')
      .insert([{ user_name: userName, action, details }]);
    if (error) {
      console.error('Error logging action:', error);
    }
  } catch (error) {
    console.error('Error in logAction:', error);
  }
};

export const openPrintWindow = async (reportData, toast) => {
  try {
    toast({ title: "Rapor verisi hazırlanıyor...", description: "Lütfen bekleyin." });
    
    const { data, error } = await supabase
      .from('report_snapshots')
      .insert({ data: reportData })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    if (data && data.id) {
      const printWindow = window.open(`/print?snapshot_id=${data.id}`, '_blank');
      if (!printWindow) {
        toast({
          title: "Açılır Pencere Engellendi",
          description: "Raporu yeni bir sekmede açmak için lütfen tarayıcınızda açılır pencerelere izin verin.",
          variant: "destructive",
        });
      }
    } else {
       throw new Error("Snapshot ID alınamadı.");
    }
  } catch (error) {
    console.error("Rapor verisi hazırlanırken hata oluştu:", error);
    toast({
      title: "Rapor Oluşturulamadı",
      description: "Rapor verisi hazırlanırken bir hata oluştu. Lütfen tekrar deneyin.",
      variant: "destructive",
    });
  }
};