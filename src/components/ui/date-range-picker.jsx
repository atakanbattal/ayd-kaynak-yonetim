import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon, X, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subDays, subMonths, subYears } from "date-fns";
import { tr } from "date-fns/locale";
import { createPortal } from "react-dom";

// Sekme/route değişince tüm tarih modallarını kapatmak için global event
export const CLOSE_DATE_PICKERS_EVENT = "close-all-date-pickers";

// Hazır tarih aralıkları
const presets = [
    { label: "Bugün", getValue: () => ({ from: new Date(), to: new Date() }) },
    { label: "Dün", getValue: () => { const d = subDays(new Date(), 1); return { from: d, to: d }; } },
    { label: "Son 7 Gün", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
    { label: "Son 30 Gün", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
    { label: "Bu Hafta", getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
    { label: "Bu Ay", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: "Geçen Ay", getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: "Bu Yıl", getValue: () => ({ from: startOfYear(new Date()), to: new Date() }) },
    { label: "Geçen Yıl", getValue: () => ({ from: startOfYear(subYears(new Date(), 1)), to: endOfYear(subYears(new Date(), 1)) }) },
];

/**
 * Optimize edilmiş Tarih Aralığı Seçici
 * - Portal kullanarak dropdown'ı body'ye render eder (taşma sorunu çözülür)
 * - Sadece "Uygula" butonuna basıldığında kapanır
 * - Akıllı pozisyonlama (ekran dışına taşmaz)
 */
export function DateRangePicker({
    value,
    onChange,
    placeholder = "Tarih aralığı seçin",
    className,
    showPresets = true,
    singleDate = false,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempRange, setTempRange] = useState(value);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);
    const location = useLocation();

    // Value değiştiğinde tempRange'i güncelle
    useEffect(() => {
        setTempRange(value);
    }, [value]);

    // Route değişince modalı kapat
    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname]);

    // Sekme değişince veya global kapatma eventi
    useEffect(() => {
        const handler = () => setIsOpen(false);
        window.addEventListener(CLOSE_DATE_PICKERS_EVENT, handler);
        return () => window.removeEventListener(CLOSE_DATE_PICKERS_EVENT, handler);
    }, []);

    // Escape tuşu ile kapat
    useEffect(() => {
        const handler = (e) => { if (e.key === "Escape") setIsOpen(false); };
        if (isOpen) {
            document.addEventListener("keydown", handler);
        }
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen]);

    // Pozisyonu hesapla - viewport ortasında, kenar çubuğu ve sağ kenarı taşmadan
    const calculatePosition = useCallback(() => {
        const dropdownWidth = showPresets && !singleDate ? 580 : 320;
        const dropdownHeight = 480;
        const padding = 20;
        const sidebarWidth = 300; // Kenar çubuğu alanı

        // Geçerli alan: sidebar sağından, viewport sağına kadar
        const contentLeft = sidebarWidth;
        const contentRight = window.innerWidth - padding;
        const contentWidth = contentRight - contentLeft;

        // Modal viewport ortasında (içerik alanında)
        let left = contentLeft + (contentWidth - dropdownWidth) / 2;
        let top = Math.max(padding, (window.innerHeight - dropdownHeight) / 2);

        // Modal sığmıyorsa kenarlara yasla
        if (dropdownWidth > contentWidth) {
            left = contentLeft;
        } else if (left < contentLeft) {
            left = contentLeft;
        } else if (left + dropdownWidth > contentRight) {
            left = contentRight - dropdownWidth;
        }

        setDropdownPosition({ top, left });
    }, [showPresets, singleDate]);

    // Açıldığında pozisyonu hesapla
    useEffect(() => {
        if (isOpen) {
            calculatePosition();
            window.addEventListener('resize', calculatePosition);
            window.addEventListener('scroll', calculatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', calculatePosition);
            window.removeEventListener('scroll', calculatePosition, true);
        };
    }, [isOpen, calculatePosition]);

    // Dışarı tıklandığında kapat
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current && 
                !containerRef.current.contains(event.target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setTempRange(value); // İptal edildiğinde eski değere dön
            }
        };
        
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, value]);

    // Tarih seçildiğinde (otomatik kapanmaz, sadece seçimi günceller)
    const handleSelect = (range) => {
        if (singleDate) {
            setTempRange({ from: range, to: range });
        } else {
            setTempRange(range);
        }
    };

    // Hızlı seçim butonuna tıklandığında
    const handlePresetClick = (preset) => {
        const newValue = preset.getValue();
        setTempRange(newValue);
        onChange?.(newValue);
        setIsOpen(false);
    };

    // Uygula butonuna tıklandığında
    const handleApply = () => {
        if (singleDate) {
            if (tempRange?.from) {
                onChange?.(tempRange);
                setIsOpen(false);
            }
        } else {
            if (tempRange?.from && tempRange?.to) {
                onChange?.(tempRange);
                setIsOpen(false);
            }
        }
    };

    // Temizle butonuna tıklandığında
    const handleClear = (e) => {
        if (e) e.stopPropagation();
        setTempRange(undefined);
        onChange?.(undefined);
    };

    // İptal butonuna tıklandığında
    const handleCancel = () => {
        setTempRange(value); // Eski değere dön
        setIsOpen(false);
    };

    const formatDateRange = () => {
        if (!value?.from) return placeholder;
        if (singleDate || !value?.to || value.from.getTime() === value.to.getTime()) {
            return format(value.from, "dd MMM yyyy", { locale: tr });
        }
        return `${format(value.from, "dd MMM", { locale: tr })} - ${format(value.to, "dd MMM yyyy", { locale: tr })}`;
    };

    // Dropdown içeriği (Portal ile render edilir)
    const dropdownContent = isOpen && createPortal(
        <>
        {/* Arka plan overlay - dışarı tıklayınca kapat */}
        <div
            className="fixed inset-0 z-[99998] bg-black/30 pointer-events-auto"
            aria-hidden="true"
            onClick={() => { setIsOpen(false); setTempRange(value); }}
        />
        <div
            ref={dropdownRef}
            className="fixed z-[99999] bg-white dark:bg-gray-900 border rounded-lg shadow-2xl pointer-events-auto"
            style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                minWidth: showPresets && !singleDate ? 580 : 320,
                maxHeight: 'calc(100vh - 40px)',
                overflow: 'auto',
            }}
        >
            <div className="flex flex-col sm:flex-row">
                {/* Presets - Sol panel */}
                {showPresets && !singleDate && (
                    <div className="border-b sm:border-b-0 sm:border-r p-2 space-y-1 min-w-[140px] bg-gray-50 dark:bg-gray-800">
                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Hızlı Seçim</p>
                        {presets.map((preset) => (
                            <Button
                                key={preset.label}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-sm h-8"
                                onClick={() => handlePresetClick(preset)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Calendar - Sağ panel */}
                <div className="p-3">
                    <Calendar
                        mode={singleDate ? "single" : "range"}
                        selected={singleDate ? tempRange?.from : tempRange}
                        onSelect={handleSelect}
                        numberOfMonths={singleDate ? 1 : 2}
                        locale={tr}
                        initialFocus
                    />

                    {/* Footer - Durum ve butonlar */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t mt-3 gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                        <p className="text-sm text-muted-foreground">
                            {tempRange?.from && tempRange?.to
                                ? `${format(tempRange.from, "dd.MM.yyyy")} - ${format(tempRange.to, "dd.MM.yyyy")}`
                                : tempRange?.from
                                    ? `${format(tempRange.from, "dd.MM.yyyy")} - Bitiş seçin`
                                    : "Başlangıç tarihi seçin"
                            }
                        </p>
                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                className="flex-1 sm:flex-none whitespace-nowrap min-w-[60px]"
                            >
                                Temizle
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                                className="flex-1 sm:flex-none whitespace-nowrap min-w-[60px]"
                            >
                                İptal
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleApply}
                                disabled={singleDate ? !tempRange?.from : (!tempRange?.from || !tempRange?.to)}
                                className="flex-1 sm:flex-none whitespace-nowrap min-w-[60px]"
                            >
                                Uygula
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </>,
        document.body
    );

    return (
        <div ref={containerRef} className={cn("relative inline-block", className)}>
            {/* Trigger Button */}
            <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full justify-between text-left font-normal h-10",
                    !value?.from && "text-muted-foreground"
                )}
            >
                <span className="flex items-center gap-2 truncate">
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{formatDateRange()}</span>
                </span>
                <span className="flex items-center gap-1">
                    {value?.from && (
                        <X
                            className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClear(e);
                            }}
                        />
                    )}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                </span>
            </Button>

            {/* Dropdown (Portal ile body'ye render edilir) */}
            {dropdownContent}
        </div>
    );
}

/**
 * Basit Tek Tarih Seçici
 */
export function DatePicker({ value, onChange, placeholder = "Tarih seçin", className }) {
    return (
        <DateRangePicker
            value={value ? { from: value, to: value } : undefined}
            onChange={(range) => onChange?.(range?.from)}
            placeholder={placeholder}
            className={className}
            showPresets={false}
            singleDate={true}
        />
    );
}

export default DateRangePicker;
