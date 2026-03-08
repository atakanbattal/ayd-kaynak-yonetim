import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from '@/lib/customSupabaseClient';

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
  if (!user) return;
  try {
    const { error } = await supabase
      .from('audit_log')
      .insert({ 
        action: action, 
        details: details,
        user_name: user.user_metadata?.name || user.email
      });
    if (error) {
      console.error('Error logging action:', error);
    }
  } catch (error) {
    console.error('Error in logAction:', error);
  }
};

const PLACEHOLDER_VALUES = new Set(['', '-', '—', '===', 'N/A', 'null', 'undefined']);

const isMeaningfulValue = (value) => {
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  if (value === null || value === undefined) return false;

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 && !PLACEHOLDER_VALUES.has(normalizedValue);
  }

  if (Array.isArray(value)) {
    return value.some(isMeaningfulValue);
  }

  if (typeof value === 'object') {
    return Object.values(value).some(isMeaningfulValue);
  }

  return Boolean(value);
};

const sanitizeRows = (rows = []) => {
  return rows.filter((row) => {
    if (!Array.isArray(row)) {
      return isMeaningfulValue(row);
    }

    if (row[0] === '__DESC__') {
      return isMeaningfulValue(row[1]);
    }

    return row.some(isMeaningfulValue);
  });
};

const sanitizeTableData = (tableData) => {
  if (!tableData?.headers || !tableData?.rows) return null;

  const sanitizedRows = sanitizeRows(tableData.rows);
  if (sanitizedRows.length === 0) return null;

  return {
    ...tableData,
    rows: sanitizedRows
  };
};

const sanitizeListSection = (section) => {
  const items = (section.items || []).filter((item) => {
    const hasHeader = isMeaningfulValue(item?.header);
    const hasDetails = Array.isArray(item?.details) && item.details.some(isMeaningfulValue);
    return hasHeader || hasDetails;
  });

  if (items.length === 0) return null;
  return { ...section, items };
};

const sanitizeSection = (section) => {
  if (!section) return null;

  if (section.type === 'chart') {
    if (!Array.isArray(section.data) || section.data.length === 0) return null;
    return section;
  }

  const tableData = sanitizeTableData(section.tableData || (section.headers && section.rows ? {
    headers: section.headers,
    rows: section.rows,
    options: section.options
  } : null));

  if (tableData) {
    return {
      ...section,
      tableData,
      headers: undefined,
      rows: undefined
    };
  }

  if (section.type === 'list') {
    return sanitizeListSection(section);
  }

  return null;
};

export const sanitizeReportData = (reportData) => {
  if (!reportData || typeof reportData !== 'object') return reportData;

  const sanitizedReport = {
    ...reportData
  };

  if (reportData.filters && typeof reportData.filters === 'object') {
    sanitizedReport.filters = Object.fromEntries(
      Object.entries(reportData.filters).filter(([, value]) => isMeaningfulValue(value))
    );
  }

  if (Array.isArray(reportData.kpiCards)) {
    sanitizedReport.kpiCards = reportData.kpiCards.filter((card) =>
      isMeaningfulValue(card?.title) && isMeaningfulValue(card?.value)
    );
  }

  if (reportData.singleItemData && typeof reportData.singleItemData === 'object') {
    sanitizedReport.singleItemData = Object.fromEntries(
      Object.entries(reportData.singleItemData).filter(([, value]) => isMeaningfulValue(value))
    );
  }

  if (reportData.tableData) {
    sanitizedReport.tableData = sanitizeTableData(reportData.tableData);
  }

  if (Array.isArray(reportData.sections)) {
    sanitizedReport.sections = reportData.sections
      .map(sanitizeSection)
      .filter(Boolean);
  }

  if (Array.isArray(reportData.attachments)) {
    sanitizedReport.attachments = reportData.attachments.filter((file) =>
      isMeaningfulValue(file?.path) || isMeaningfulValue(file?.url)
    );
  }

  return sanitizedReport;
};

export const openPrintWindow = async (reportData, toast) => {
  try {
    toast({ title: "Rapor verisi hazırlanıyor...", description: "Lütfen bekleyin." });

    const sanitizedReportData = sanitizeReportData(reportData);

    if (sanitizedReportData.attachments) {
        sanitizedReportData.attachments.forEach(file => {
            const publicUrlData = supabase.storage.from('attachments').getPublicUrl(file.path);
            file.url = publicUrlData.data.publicUrl;
        });
    }
    
    const { data, error } = await supabase
      .from('report_snapshots')
      .insert({ data: sanitizedReportData })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    if (data && data.id) {
      const landscapeParam = sanitizedReportData.landscape ? '&landscape=1' : '';
      const printWindow = window.open(`/print?snapshot_id=${data.id}${landscapeParam}`, '_blank');
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
