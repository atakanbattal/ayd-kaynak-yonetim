import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Save, Calendar as CalendarIcon, FileText, Edit, Search, Download, LayoutGrid, List, AlertTriangle, Factory, Activity, Gauge, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction, openPrintWindow } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, LineChart, Line, Brush } from 'recharts';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

const CHART_COLORS = {
    actual: '#4f46e5',
    ifs: '#9333ea',
    positive: '#059669',
    warning: '#dc2626',
    neutral: '#64748b',
    accent: '#0ea5e9',
};

const normalizeText = (value) => String(value || '').trim().toUpperCase();

const parseDuration = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};

const formatNumber = (value, fractionDigits = 2) => {
    if (!Number.isFinite(value)) return '-';
    return value.toLocaleString('tr-TR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
};

const formatPercent = (value, fractionDigits = 1) => {
    if (!Number.isFinite(value)) return '-';
    return `%${value.toLocaleString('tr-TR', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    })}`;
};

const formatSeconds = (value, fractionDigits = 2) => Number.isFinite(value) ? `${formatNumber(value, fractionDigits)} sn` : '-';

const getRecordDateValue = (dateValue) => {
    if (!dateValue) return null;
    try {
        return parseISO(dateValue);
    } catch {
        const fallback = new Date(dateValue);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
};

const isDateInRange = (dateValue, range) => {
    const recordDate = getRecordDateValue(dateValue);
    if (!recordDate) return false;

    const recordTime = startOfDay(recordDate).getTime();
    const startTime = range?.from ? startOfDay(range.from).getTime() : null;
    const endTime = range?.to ? endOfDay(range.to).getTime() : null;

    if (startTime !== null && recordTime < startTime) return false;
    if (endTime !== null && recordTime > endTime) return false;
    return true;
};

const average = (values) => {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const calculateStdDev = (values, meanValue) => {
    if (!values.length || !Number.isFinite(meanValue)) return 0;
    const variance = values.reduce((sum, value) => sum + ((value - meanValue) ** 2), 0) / values.length;
    return Math.sqrt(variance);
};

const getVariance = (partDuration, ifsDuration) => {
    if (!Number.isFinite(partDuration) || !Number.isFinite(ifsDuration)) return null;
    return partDuration - ifsDuration;
};

const getPerformanceStatus = (partDuration, ifsDuration) => {
    const variance = getVariance(partDuration, ifsDuration);
    if (!Number.isFinite(variance)) return 'IFS Yok';
    if (variance < 0) return 'IFS Altı';
    if (variance > 0) return 'IFS Üstü';
    return 'IFS Eşit';
};

const getRobotSortNum = (robotNo) => {
    if (!robotNo) return 9999;
    const match = String(robotNo).match(/RK0*(\d+)/i) || String(robotNo).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 9999;
};

const hasDailyTimeEntryContent = (record) => {
    const textValues = [record?.part_code, record?.description];
    const numericValues = [record?.part_duration, record?.ifs_duration];

    return textValues.some((value) => String(value || '').trim() !== '')
        || numericValues.some((value) => value !== null && value !== undefined && String(value).trim() !== '');
};

const getDailyTimeRecordKey = (record) => (
    record?.robot_id ? `${record.robot_id}-${record.station}` : `${record?.robot_no}-${record?.station}`
);

const buildUniqueDailyTimeRecords = (records) => {
    const uniqueMap = new Map();

    records.forEach((record) => {
        if (!hasDailyTimeEntryContent(record)) return;

        const key = getDailyTimeRecordKey(record);
        const existing = uniqueMap.get(key);
        const recordTimestamp = new Date(record?.updated_at || record?.created_at || 0).getTime();
        const existingTimestamp = new Date(existing?.updated_at || existing?.created_at || 0).getTime();

        if (!existing || recordTimestamp >= existingTimestamp) {
            uniqueMap.set(key, record);
        }
    });

    return Array.from(uniqueMap.values());
};

const filterAndSortDailyTimeRecords = (records, {
    dateRange,
    line_id = 'all',
    station = 'all',
    robotSearch = '',
    partSearch = '',
}) => {
    const normalizedRobotSearch = normalizeText(robotSearch);
    const normalizedPartSearch = normalizeText(partSearch);

    return records
        .filter((record) => {
            if (!isDateInRange(record.record_date, dateRange)) return false;
            if (line_id !== 'all' && record.line_id !== line_id) return false;
            if (station !== 'all' && record.station !== Number(station)) return false;
            if (normalizedRobotSearch && !normalizeText(record.robot_no).includes(normalizedRobotSearch)) return false;
            if (normalizedPartSearch && !normalizeText(record.part_code).includes(normalizedPartSearch)) return false;
            return true;
        })
        .sort((a, b) => {
            const dateA = getRecordDateValue(a.record_date)?.getTime() || 0;
            const dateB = getRecordDateValue(b.record_date)?.getTime() || 0;
            if (dateB !== dateA) return dateB - dateA;
            const robotNumA = getRobotSortNum(a.robot_no);
            const robotNumB = getRobotSortNum(b.robot_no);
            if (robotNumA !== robotNumB) return robotNumA - robotNumB;
            return (a.station || 0) - (b.station || 0);
        });
};

const chartTooltipFormatter = (value, name) => {
    if (!Number.isFinite(Number(value))) return [value, name];
    if (String(name).includes('Oran')) return [formatPercent(Number(value)), name];
    return [formatNumber(Number(value)), name];
};

const buildTrendData = (records, mode) => {
    const grouped = new Map();

    records.forEach((record) => {
        const date = getRecordDateValue(record.record_date);
        if (!date) return;

        let key;
        let label;
        let sortValue;

        if (mode === 'week') {
            const weekStart = startOfWeek(date, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
            key = format(weekStart, 'yyyy-MM-dd');
            label = `${format(weekStart, 'dd MMM', { locale: tr })} - ${format(weekEnd, 'dd MMM', { locale: tr })}`;
            sortValue = weekStart.getTime();
        } else if (mode === 'month') {
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            key = format(monthStart, 'yyyy-MM');
            label = format(monthStart, 'MMM yyyy', { locale: tr });
            sortValue = monthStart.getTime();
        } else {
            key = format(date, 'yyyy-MM-dd');
            label = format(date, 'dd MMM', { locale: tr });
            sortValue = startOfDay(date).getTime();
        }

        if (!grouped.has(key)) {
            grouped.set(key, {
                key,
                label,
                sortValue,
                count: 0,
                partDurations: [],
                ifsDurations: [],
                variances: [],
                overIfsCount: 0,
            });
        }

        const entry = grouped.get(key);
        const partDuration = parseDuration(record.part_duration);
        const ifsDuration = parseDuration(record.ifs_duration);
        const variance = getVariance(partDuration, ifsDuration);

        entry.count += 1;
        if (Number.isFinite(partDuration)) entry.partDurations.push(partDuration);
        if (Number.isFinite(ifsDuration)) entry.ifsDurations.push(ifsDuration);
        if (Number.isFinite(variance)) {
            entry.variances.push(variance);
            if (variance > 0) entry.overIfsCount += 1;
        }
    });

    return Array.from(grouped.values())
        .sort((a, b) => a.sortValue - b.sortValue)
        .map((entry) => ({
            label: entry.label,
            count: entry.count,
            avgPartDuration: average(entry.partDurations) || 0,
            avgIfsDuration: average(entry.ifsDurations) || 0,
            avgVariance: average(entry.variances) || 0,
            overIfsRate: entry.variances.length ? (entry.overIfsCount / entry.variances.length) * 100 : 0,
        }));
};

const buildAnalytics = (records, searchTerm = '') => {
    const normalizedSearch = normalizeText(searchTerm);
    const enrichedRecords = records.map((record) => {
        const partDuration = parseDuration(record.part_duration);
        const ifsDuration = parseDuration(record.ifs_duration);
        const variance = getVariance(partDuration, ifsDuration);
        return {
            ...record,
            partDuration,
            ifsDuration,
            variance,
            normalizedPartCode: normalizeText(record.part_code),
        };
    });

    const validPartDurations = enrichedRecords.map((record) => record.partDuration).filter(Number.isFinite);
    const comparableRecords = enrichedRecords.filter((record) => Number.isFinite(record.variance));
    const overIfsRecords = comparableRecords.filter((record) => record.variance > 0);
    const underIfsRecords = comparableRecords.filter((record) => record.variance < 0);

    const totals = {
        recordCount: enrichedRecords.length,
        comparableCount: comparableRecords.length,
        partDurationTotal: validPartDurations.reduce((sum, value) => sum + value, 0),
        ifsDurationTotal: comparableRecords.reduce((sum, record) => sum + record.ifsDuration, 0),
        avgPartDuration: average(validPartDurations) || 0,
        avgIfsDuration: average(comparableRecords.map((record) => record.ifsDuration)) || 0,
        avgVariance: average(comparableRecords.map((record) => record.variance)) || 0,
        overIfsCount: overIfsRecords.length,
        underIfsCount: underIfsRecords.length,
        equalIfsCount: comparableRecords.length - overIfsRecords.length - underIfsRecords.length,
        overIfsRate: comparableRecords.length ? (overIfsRecords.length / comparableRecords.length) * 100 : 0,
        underIfsRate: comparableRecords.length ? (underIfsRecords.length / comparableRecords.length) * 100 : 0,
        uniquePartCount: new Set(enrichedRecords.map((record) => record.normalizedPartCode).filter(Boolean)).size,
        uniqueRobotCount: new Set(enrichedRecords.map((record) => record.robot_no).filter(Boolean)).size,
    };

    const lineAnalysisMap = new Map();
    enrichedRecords.forEach((record) => {
        const key = record.line_name || 'N/A';
        if (!lineAnalysisMap.has(key)) {
            lineAnalysisMap.set(key, {
                lineName: key,
                recordCount: 0,
                partDurations: [],
                ifsDurations: [],
                variances: [],
                overIfsCount: 0,
                robots: new Set(),
                parts: new Set(),
            });
        }

        const entry = lineAnalysisMap.get(key);
        entry.recordCount += 1;
        if (record.robot_no) entry.robots.add(record.robot_no);
        if (record.normalizedPartCode) entry.parts.add(record.normalizedPartCode);
        if (Number.isFinite(record.partDuration)) entry.partDurations.push(record.partDuration);
        if (Number.isFinite(record.ifsDuration)) entry.ifsDurations.push(record.ifsDuration);
        if (Number.isFinite(record.variance)) {
            entry.variances.push(record.variance);
            if (record.variance > 0) entry.overIfsCount += 1;
        }
    });

    const lineAnalysis = Array.from(lineAnalysisMap.values())
        .map((entry) => ({
            lineName: entry.lineName,
            recordCount: entry.recordCount,
            robotCount: entry.robots.size,
            partCount: entry.parts.size,
            avgPartDuration: average(entry.partDurations) || 0,
            avgIfsDuration: average(entry.ifsDurations) || 0,
            avgVariance: average(entry.variances) || 0,
            overIfsRate: entry.variances.length ? (entry.overIfsCount / entry.variances.length) * 100 : 0,
        }))
        .sort((a, b) => (b.avgVariance - a.avgVariance) || (b.recordCount - a.recordCount));

    const overIfsPartMap = new Map();
    overIfsRecords.forEach((record) => {
        const key = record.normalizedPartCode || 'PARÇA KODU YOK';
        if (!overIfsPartMap.has(key)) {
            overIfsPartMap.set(key, {
                partCode: key,
                overIfsCount: 0,
                variances: [],
                partDurations: [],
                ifsDurations: [],
                lines: new Set(),
                robots: new Set(),
            });
        }

        const entry = overIfsPartMap.get(key);
        entry.overIfsCount += 1;
        entry.variances.push(record.variance);
        entry.partDurations.push(record.partDuration);
        entry.ifsDurations.push(record.ifsDuration);
        if (record.line_name) entry.lines.add(record.line_name);
        if (record.robot_no) entry.robots.add(record.robot_no);
    });

    const overIfsParts = Array.from(overIfsPartMap.values())
        .map((entry) => ({
            partCode: entry.partCode,
            overIfsCount: entry.overIfsCount,
            avgVariance: average(entry.variances) || 0,
            avgPartDuration: average(entry.partDurations) || 0,
            avgIfsDuration: average(entry.ifsDurations) || 0,
            lineCount: entry.lines.size,
            robotCount: entry.robots.size,
        }))
        .sort((a, b) => (b.avgVariance - a.avgVariance) || (b.overIfsCount - a.overIfsCount))
        .slice(0, 12);

    const uniquePartCodes = Array.from(new Set(enrichedRecords.map((record) => record.normalizedPartCode).filter(Boolean)));
    const showPartFocus = Boolean(normalizedSearch) || uniquePartCodes.length === 1;
    const partFocusLabel = uniquePartCodes.length === 1 ? uniquePartCodes[0] : (normalizedSearch || 'SEÇİLİ PARÇALAR');

    let partInsights = null;
    if (showPartFocus && enrichedRecords.length > 0) {
        const robotAnalysisMap = new Map();
        enrichedRecords.forEach((record) => {
            const key = record.robot_no || 'N/A';
            if (!robotAnalysisMap.has(key)) {
                robotAnalysisMap.set(key, {
                    robotNo: key,
                    recordCount: 0,
                    partDurations: [],
                    ifsDurations: [],
                    variances: [],
                    minDuration: Number.POSITIVE_INFINITY,
                    maxDuration: Number.NEGATIVE_INFINITY,
                });
            }

            const entry = robotAnalysisMap.get(key);
            entry.recordCount += 1;
            if (Number.isFinite(record.partDuration)) {
                entry.partDurations.push(record.partDuration);
                entry.minDuration = Math.min(entry.minDuration, record.partDuration);
                entry.maxDuration = Math.max(entry.maxDuration, record.partDuration);
            }
            if (Number.isFinite(record.ifsDuration)) entry.ifsDurations.push(record.ifsDuration);
            if (Number.isFinite(record.variance)) entry.variances.push(record.variance);
        });

        const robotBreakdown = Array.from(robotAnalysisMap.values())
            .map((entry) => ({
                robotNo: entry.robotNo,
                recordCount: entry.recordCount,
                avgPartDuration: average(entry.partDurations) || 0,
                avgIfsDuration: average(entry.ifsDurations) || 0,
                avgVariance: average(entry.variances) || 0,
                minDuration: Number.isFinite(entry.minDuration) ? entry.minDuration : 0,
                maxDuration: Number.isFinite(entry.maxDuration) ? entry.maxDuration : 0,
            }))
            .sort((a, b) => (b.recordCount - a.recordCount) || (a.avgPartDuration - b.avgPartDuration));

        const sortedRecords = [...enrichedRecords].sort((a, b) => {
            const dateA = getRecordDateValue(a.record_date)?.getTime() || 0;
            const dateB = getRecordDateValue(b.record_date)?.getTime() || 0;
            if (dateA !== dateB) return dateA - dateB;
            if (a.robot_no !== b.robot_no) return String(a.robot_no || '').localeCompare(String(b.robot_no || ''));
            return (a.station || 0) - (b.station || 0);
        });

        const spcValues = sortedRecords.map((record) => record.partDuration).filter(Number.isFinite);
        const mean = average(spcValues) || 0;
        const stdDev = calculateStdDev(spcValues, mean);
        const avgIfs = average(sortedRecords.map((record) => record.ifsDuration).filter(Number.isFinite)) || 0;
        const ucl = mean + (3 * stdDev);
        const lcl = Math.max(0, mean - (3 * stdDev));
        const outOfControlCount = sortedRecords.filter((record) => Number.isFinite(record.partDuration) && (record.partDuration > ucl || record.partDuration < lcl)).length;

        const spcSeries = sortedRecords.map((record, index) => ({
            sample: index + 1,
            actual: record.partDuration,
            ifs: record.ifsDuration,
            mean,
            ucl,
            lcl,
            label: `${format(getRecordDateValue(record.record_date) || new Date(), 'dd.MM.yyyy')} | ${record.robot_no} | İst. ${record.station}`,
        }));

        partInsights = {
            label: partFocusLabel,
            matchedPartCount: uniquePartCodes.length,
            robotBreakdown,
            spcSeries,
            mean,
            stdDev,
            avgIfs,
            outOfControlCount,
        };
    }

    return {
        totals,
        lineAnalysis,
        overIfsParts,
        dailyTrend: buildTrendData(enrichedRecords, 'day'),
        weeklyTrend: buildTrendData(enrichedRecords, 'week'),
        monthlyTrend: buildTrendData(enrichedRecords, 'month'),
        partInsights,
    };
};

const MetricCard = ({ title, value, subtitle, icon: Icon, accentClass }) => (
    <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="p-0">
            <div className={`h-1 ${accentClass}`} />
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                        <Icon className="h-5 w-5 text-slate-600" />
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
);

const AnalyticsLineChart = React.memo(({ data, linesConfig, xAxisKey = 'label', height = 360 }) => {
    if (!data.length) {
        return <p className="py-12 text-center text-sm text-slate-500">Grafik için yeterli veri yok.</p>;
    }

    const shouldRotateLabels = data.length > 8;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: data.length > 12 ? 52 : shouldRotateLabels ? 28 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                    dataKey={xAxisKey}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    angle={shouldRotateLabels ? -28 : 0}
                    textAnchor={shouldRotateLabels ? 'end' : 'middle'}
                    height={data.length > 12 ? 84 : shouldRotateLabels ? 72 : 40}
                    interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={72} />
                <Tooltip formatter={chartTooltipFormatter} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {linesConfig.map((lineConfig) => (
                    <Line
                        key={lineConfig.key}
                        type="monotone"
                        dataKey={lineConfig.key}
                        name={lineConfig.name}
                        stroke={lineConfig.color}
                        strokeWidth={2.5}
                        dot={false}
                    />
                ))}
                {data.length > 12 && (
                    <Brush
                        dataKey={xAxisKey}
                        height={26}
                        stroke="#94a3b8"
                        travellerWidth={10}
                    />
                )}
            </LineChart>
        </ResponsiveContainer>
    );
});

const AnalyticsBarChart = React.memo(({ data, barsConfig, xAxisKey = 'label', height = 360 }) => {
    if (!data.length) {
        return <p className="py-12 text-center text-sm text-slate-500">Grafik için yeterli veri yok.</p>;
    }

    const shouldRotateLabels = data.length > 6;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: data.length > 10 ? 52 : shouldRotateLabels ? 28 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                    dataKey={xAxisKey}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    angle={shouldRotateLabels ? -28 : 0}
                    textAnchor={shouldRotateLabels ? 'end' : 'middle'}
                    height={data.length > 10 ? 84 : shouldRotateLabels ? 72 : 40}
                    interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} width={72} />
                <Tooltip formatter={chartTooltipFormatter} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {barsConfig.map((barConfig) => (
                    <Bar
                        key={barConfig.key}
                        dataKey={barConfig.key}
                        name={barConfig.name}
                        fill={barConfig.color}
                        radius={[6, 6, 0, 0]}
                    />
                ))}
                {data.length > 10 && (
                    <Brush
                        dataKey={xAxisKey}
                        height={26}
                        stroke="#94a3b8"
                        travellerWidth={10}
                    />
                )}
            </BarChart>
        </ResponsiveContainer>
    );
});

const ListAnalyticsDashboard = React.memo(({ analytics, totals, activePartSearch, isSearchPending, filteredRecords, onEditRecord, onDeleteRecord }) => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <MetricCard
                title="Toplam Kayıt"
                value={String(totals.recordCount)}
                subtitle={`${totals.uniqueRobotCount} robot / ${totals.uniquePartCount} parça`}
                icon={Activity}
                accentClass="bg-gradient-to-r from-indigo-600 to-sky-500"
            />
            <MetricCard
                title="Ort. Parça Süresi"
                value={formatSeconds(totals.avgPartDuration)}
                subtitle={`Toplam: ${formatSeconds(totals.partDurationTotal)}`}
                icon={Clock}
                accentClass="bg-gradient-to-r from-sky-500 to-cyan-400"
            />
            <MetricCard
                title="Ort. IFS Süresi"
                value={formatSeconds(totals.avgIfsDuration)}
                subtitle={`Kıyaslanabilir: ${totals.comparableCount} kayıt`}
                icon={Gauge}
                accentClass="bg-gradient-to-r from-violet-600 to-fuchsia-500"
            />
            <MetricCard
                title="IFS Altı Çalışma"
                value={String(totals.underIfsCount)}
                subtitle={formatPercent(totals.underIfsRate)}
                icon={TrendingUp}
                accentClass="bg-gradient-to-r from-emerald-600 to-lime-500"
            />
            <MetricCard
                title="IFS Üstü Çalışma"
                value={String(totals.overIfsCount)}
                subtitle={formatPercent(totals.overIfsRate)}
                icon={AlertTriangle}
                accentClass="bg-gradient-to-r from-rose-600 to-orange-500"
            />
            <MetricCard
                title="Ort. IFS Farkı"
                value={formatSeconds(totals.avgVariance)}
                subtitle={totals.avgVariance <= 0 ? 'Negatif fark daha iyi performans gösterir' : 'Pozitif fark iyileştirme fırsatını gösterir'}
                icon={Factory}
                accentClass="bg-gradient-to-r from-slate-700 to-slate-500"
            />
        </div>

        {activePartSearch && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Parça odaklı analiz aktif:</span> `{activePartSearch}`
                {analytics.partInsights?.matchedPartCount > 1 && ` · ${analytics.partInsights.matchedPartCount} farklı eşleşen parça birlikte analiz ediliyor.`}
                {isSearchPending && <span className="ml-2 text-slate-500">Filtre güncelleniyor...</span>}
            </div>
        )}

        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle>Günlük Trend</CardTitle>
                <CardDescription>Daha geniş görünüm ile daha fazla tarih ve daha detaylı eğilim analizi</CardDescription>
            </CardHeader>
            <CardContent>
                <AnalyticsLineChart
                    data={analytics.dailyTrend}
                    linesConfig={[
                        { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                        { key: 'avgIfsDuration', name: 'Ort. IFS Süresi', color: CHART_COLORS.ifs },
                    ]}
                    height={420}
                />
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle>Haftalık Trend</CardTitle>
                    <CardDescription>Hafta bazında tempo değişimi ve IFS hizalaması</CardDescription>
                </CardHeader>
                <CardContent>
                    <AnalyticsLineChart
                        data={analytics.weeklyTrend}
                        linesConfig={[
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                            { key: 'avgIfsDuration', name: 'Ort. IFS Süresi', color: CHART_COLORS.ifs },
                        ]}
                        height={360}
                    />
                </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle>Aylık Trend</CardTitle>
                    <CardDescription>Ay bazında proses seviyesi ve ortalama süre takibi</CardDescription>
                </CardHeader>
                <CardContent>
                    <AnalyticsLineChart
                        data={analytics.monthlyTrend}
                        linesConfig={[
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                            { key: 'avgIfsDuration', name: 'Ort. IFS Süresi', color: CHART_COLORS.ifs },
                        ]}
                        height={360}
                    />
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle>Hat Bazlı Analiz</CardTitle>
                    <CardDescription>Hatların ortalama süre, IFS farkı ve iyileştirme sırası</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AnalyticsBarChart
                        data={analytics.lineAnalysis.slice(0, 12)}
                        barsConfig={[
                            { key: 'avgVariance', name: 'Ort. IFS Farkı', color: CHART_COLORS.warning },
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                        ]}
                        xAxisKey="lineName"
                        height={400}
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-slate-50 text-slate-500">
                                <tr>
                                    {['Hat', 'Kayıt', 'Ort. Süre', 'Ort. IFS', 'Ort. Fark', 'IFS Üstü'].map((header) => (
                                        <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em]">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {analytics.lineAnalysis.slice(0, 8).map((line) => (
                                    <tr key={line.lineName}>
                                        <td className="px-3 py-2 font-semibold text-slate-900">{line.lineName}</td>
                                        <td className="px-3 py-2">{line.recordCount}</td>
                                        <td className="px-3 py-2">{formatSeconds(line.avgPartDuration)}</td>
                                        <td className="px-3 py-2">{formatSeconds(line.avgIfsDuration)}</td>
                                        <td className="px-3 py-2">{formatSeconds(line.avgVariance)}</td>
                                        <td className="px-3 py-2">{formatPercent(line.overIfsRate)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {analytics.lineAnalysis.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Hat analizi için kayıt bulunamadı.</p>}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle>IFS Süresinin Üstünde Çalışılan Parçalar</CardTitle>
                    <CardDescription>İyileştirme odağı gereken parçalar ve aşım yoğunluğu</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <AnalyticsBarChart
                        data={analytics.overIfsParts.slice(0, 12)}
                        barsConfig={[
                            { key: 'avgVariance', name: 'Ort. IFS Farkı', color: CHART_COLORS.warning },
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                        ]}
                        xAxisKey="partCode"
                        height={400}
                    />
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-slate-50 text-slate-500">
                                <tr>
                                    {['Parça', 'Aşım', 'Ort. Süre', 'Ort. IFS', 'Ort. Fark'].map((header) => (
                                        <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em]">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {analytics.overIfsParts.slice(0, 10).map((part) => (
                                    <tr key={part.partCode}>
                                        <td className="px-3 py-2 font-semibold text-slate-900">{part.partCode}</td>
                                        <td className="px-3 py-2">{part.overIfsCount}</td>
                                        <td className="px-3 py-2">{formatSeconds(part.avgPartDuration)}</td>
                                        <td className="px-3 py-2">{formatSeconds(part.avgIfsDuration)}</td>
                                        <td className="px-3 py-2 text-rose-600">{formatSeconds(part.avgVariance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {analytics.overIfsParts.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Seçili filtrede IFS üstü çalışan parça bulunmadı.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>

        {analytics.partInsights && (
            <>
                <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-4">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle>{analytics.partInsights.label} için Süre Kararlılık Grafiği</CardTitle>
                                <CardDescription>Parça bazında gerçek süre, IFS ve ortalama karşılaştırması</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AnalyticsLineChart
                                    data={analytics.partInsights.spcSeries.map((point) => ({ ...point, sampleLabel: String(point.sample) }))}
                                    linesConfig={[
                                        { key: 'actual', name: 'Gerçek Süre', color: CHART_COLORS.actual },
                                        { key: 'ifs', name: 'IFS', color: CHART_COLORS.ifs },
                                        { key: 'mean', name: 'Ortalama', color: CHART_COLORS.accent },
                                    ]}
                                    xAxisKey="sampleLabel"
                                    height={420}
                                />
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4">
                        <MetricCard
                            title="Parça Ortalaması"
                            value={formatSeconds(analytics.partInsights.mean)}
                            subtitle={`${analytics.partInsights.matchedPartCount} eşleşen parça kodu`}
                            icon={Gauge}
                            accentClass="bg-gradient-to-r from-indigo-600 to-blue-500"
                        />
                        <MetricCard
                            title="Standart Sapma"
                            value={formatSeconds(analytics.partInsights.stdDev)}
                            subtitle="Süre dağılımının ne kadar değiştiğini gösterir"
                            icon={Activity}
                            accentClass="bg-gradient-to-r from-fuchsia-600 to-violet-500"
                        />
                        <MetricCard
                            title="Kontrol Dışı Nokta"
                            value={String(analytics.partInsights.outOfControlCount)}
                            subtitle={`Ort. IFS: ${formatSeconds(analytics.partInsights.avgIfs)}`}
                            icon={AlertTriangle}
                            accentClass="bg-gradient-to-r from-rose-600 to-orange-500"
                        />
                    </div>
                </div>

                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle>{analytics.partInsights.label} için Robot Bazlı Süre Analizi</CardTitle>
                        <CardDescription>Aranan parçanın hangi robotta hangi sürede kaynatıldığını karşılaştırır</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <AnalyticsBarChart
                            data={analytics.partInsights.robotBreakdown.slice(0, 14)}
                            barsConfig={[
                                { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                                { key: 'avgIfsDuration', name: 'Ort. IFS Süresi', color: CHART_COLORS.ifs },
                            ]}
                            xAxisKey="robotNo"
                            height={400}
                        />
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-slate-50 text-slate-500">
                                    <tr>
                                        {['Robot', 'Kayıt', 'Ort. Süre', 'Ort. IFS', 'Ort. Fark', 'Min', 'Maks'].map((header) => (
                                            <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em]">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {analytics.partInsights.robotBreakdown.map((robot) => (
                                        <tr key={robot.robotNo}>
                                            <td className="px-3 py-2 font-semibold text-slate-900">{robot.robotNo}</td>
                                            <td className="px-3 py-2">{robot.recordCount}</td>
                                            <td className="px-3 py-2">{formatSeconds(robot.avgPartDuration)}</td>
                                            <td className="px-3 py-2">{formatSeconds(robot.avgIfsDuration)}</td>
                                            <td className={`px-3 py-2 ${robot.avgVariance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatSeconds(robot.avgVariance)}</td>
                                            <td className="px-3 py-2">{formatSeconds(robot.minDuration)}</td>
                                            <td className="px-3 py-2">{formatSeconds(robot.maxDuration)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </>
        )}

        <Card className="border-0 shadow-sm">
            <CardHeader>
                <CardTitle>Detay Kayıtlar</CardTitle>
                <CardDescription>Tarih filtresi, parça kodu araması ve IFS durumuna göre detaylı liste</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="border-t overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                {['Tarih', 'Robot No', 'İstasyon', 'Hat Adı', 'Parça Kodu', 'Parça Süresi', 'IFS Süre', 'Fark', 'Durum', 'Açıklama', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-[0.08em]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.map((record) => {
                                const partDuration = parseDuration(record.part_duration);
                                const ifsDuration = parseDuration(record.ifs_duration);
                                const variance = getVariance(partDuration, ifsDuration);
                                const status = getPerformanceStatus(partDuration, ifsDuration);
                                const statusClass = status === 'IFS Altı'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : status === 'IFS Üstü'
                                        ? 'bg-rose-100 text-rose-800'
                                        : status === 'IFS Eşit'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-slate-100 text-slate-700';

                                return (
                                    <tr key={record.id} className="hover:bg-slate-50/80">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{format(getRecordDateValue(record.record_date) || new Date(), 'dd.MM.yyyy')}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">{record.robot_no}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${record.station === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                İst. {record.station}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{record.line_name}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">{record.part_code}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{Number.isFinite(partDuration) ? formatSeconds(partDuration) : <span className="text-slate-400 italic">Boş</span>}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">{Number.isFinite(ifsDuration) ? formatSeconds(ifsDuration) : <span className="text-slate-400 italic">Boş</span>}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${Number.isFinite(variance) && variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {Number.isFinite(variance) ? formatSeconds(variance) : '-'}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>
                                        </td>
                                        <td className="px-4 py-2 text-sm max-w-xs truncate" title={record.description}>{record.description || '-'}</td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap">
                                            <Button variant="ghost" size="sm" onClick={() => onEditRecord(record)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => onDeleteRecord(record)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filteredRecords.length === 0 && (
                        <p className="text-center py-10 text-slate-500">Seçili filtrelerde kayıt bulunamadı.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    </>
));

const DailyTimeTracking = () => {
    const [records, setRecords] = useState([]);
    const [lines, setLines] = useState([]);
    const [robots, setRobots] = useState([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { user } = useAuth();

    const [showDialog, setShowDialog] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [viewMode, setViewMode] = useState('template'); // 'template' | 'list' - varsayılan veri girişi
    const [templateDate, setTemplateDate] = useState(new Date().toISOString().split('T')[0]);
    const [templatePanelMode, setTemplatePanelMode] = useState('entry');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);

    const [formState, setFormState] = useState({
        record_date: new Date().toISOString().split('T')[0],
        robot_no: '',
        station: '',
        line_id: '',
        part_code: '',
        part_duration: '',
        ifs_duration: '',
        description: '',
    });

    const [filters, setFilters] = useState({
        dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
        line_id: 'all',
        station: 'all',
    });
    const [searchInputs, setSearchInputs] = useState({ robot_no: '', part_code: '' });
    const deferredRobotFilter = useDeferredValue(searchInputs.robot_no);
    const deferredPartCodeFilter = useDeferredValue(searchInputs.part_code);
    const isSearchPending = searchInputs.robot_no !== deferredRobotFilter || searchInputs.part_code !== deferredPartCodeFilter;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [recordsData, linesData, robotsData] = await Promise.all([
                supabase.from('daily_time_tracking').select('*').order('record_date', { ascending: false }),
                supabase.from('lines').select('*').eq('deleted', false),
                supabase.from('robots').select('*').eq('deleted', false).eq('active', true).order('name'),
            ]);

            if (recordsData.error) throw recordsData.error;
            if (linesData.error) throw linesData.error;

            setLines(linesData.data || []);
            setRobots(robotsData.data || []);

            const lineMap = new Map((linesData.data || []).map(l => [l.id, l.name]));
            setRecords((recordsData.data || []).map(r => ({
                ...r,
                line_name: lineMap.get(r.line_id) || 'N/A'
            })));
        } catch (error) {
            toast({ title: "Veri yüklenemedi", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredRecords = useMemo(() => {
        return filterAndSortDailyTimeRecords(records, {
            dateRange: filters.dateRange,
            line_id: filters.line_id,
            station: filters.station,
            robotSearch: deferredRobotFilter,
            partSearch: deferredPartCodeFilter,
        });
    }, [records, filters.dateRange, filters.line_id, filters.station, deferredRobotFilter, deferredPartCodeFilter]);

    const analytics = useMemo(() => buildAnalytics(filteredRecords, deferredPartCodeFilter), [filteredRecords, deferredPartCodeFilter]);
    const totals = analytics.totals;
    const activePartSearch = normalizeText(deferredPartCodeFilter);
    const getCurrentListRecords = useCallback(() => filterAndSortDailyTimeRecords(records, {
        dateRange: filters.dateRange,
        line_id: filters.line_id,
        station: filters.station,
        robotSearch: searchInputs.robot_no,
        partSearch: searchInputs.part_code,
    }), [records, filters.dateRange, filters.line_id, filters.station, searchInputs.robot_no, searchInputs.part_code]);

    // Taslak satırları: Her robot için 2 istasyon (robot.line_id ile hat bilgisi)
    const lineMap = useMemo(() => new Map(lines.map(l => [l.id, l.name])), [lines]);
    const templateRows = useMemo(() => {
        const rows = [];
        const getRobotSortNum = (name) => {
            if (!name) return 9999;
            const m = String(name).match(/RK0*(\d+)/i) || String(name).match(/(\d+)/);
            return m ? parseInt(m[1], 10) : 9999;
        };
        const sortedRobots = [...robots.filter(r => r.line_id)].sort((a, b) => {
            const lineA = (lineMap.get(a.line_id) || '').localeCompare(lineMap.get(b.line_id) || '');
            if (lineA !== 0) return lineA;
            return getRobotSortNum(a.name) - getRobotSortNum(b.name);
        });
        sortedRobots.forEach(r => {
            const lineName = lineMap.get(r.line_id) || 'N/A';
            for (let station = 1; station <= 2; station++) {
                rows.push({
                    key: `${r.id}-${station}`,
                    robot_id: r.id,
                    robot_no: r.name,
                    line_id: r.line_id,
                    line_name: lineName,
                    station,
                    part_code: '',
                    part_duration: '',
                    ifs_duration: '',
                    description: '',
                    existingId: null,
                });
            }
        });
        return rows;
    }, [robots, lineMap]);

    // Taslak için mevcut kayıtları yükle ve birleştir
    const [templateData, setTemplateData] = useState([]);
    const [templateLoading, setTemplateLoading] = useState(false);
    const loadTemplateForDate = useCallback(async (dateStr) => {
        if (!dateStr) return;
        setTemplateLoading(true);
        try {
            const { data } = await supabase
                .from('daily_time_tracking')
                .select('*')
                .eq('record_date', dateStr);
            const existingMap = new Map();
            (data || []).forEach(rec => {
                // robot_id ile eşleştirme - aynı isimde birden fazla robot varsa doğru satıra düşmesi için
                const key = rec.robot_id ? `${rec.robot_id}-${rec.station}` : `${rec.robot_no}-${rec.station}`;
                existingMap.set(key, rec);
            });
            const merged = templateRows.map(row => {
                const key = row.robot_id ? `${row.robot_id}-${row.station}` : `${row.robot_no}-${row.station}`;
                const existing = existingMap.get(key);
                if (existing) {
                    return {
                        ...row,
                        part_code: existing.part_code || '',
                        part_duration: existing.part_duration != null ? String(existing.part_duration) : '',
                        ifs_duration: existing.ifs_duration != null ? String(existing.ifs_duration) : '',
                        description: existing.description || '',
                        existingId: existing.id,
                    };
                }
                return row;
            });
            setTemplateData(merged);
        } catch (e) {
            toast({ title: 'Hata', description: e.message, variant: 'destructive' });
            setTemplateData(templateRows);
        } finally {
            setTemplateLoading(false);
        }
    }, [templateRows]);

    useEffect(() => {
        if (viewMode === 'template' && templateRows.length > 0) {
            loadTemplateForDate(templateDate);
        }
    }, [viewMode, templateDate, templateRows.length, loadTemplateForDate]);

    useEffect(() => {
        setTemplatePanelMode('entry');
    }, [templateDate]);

    const updateTemplateRow = (key, field, value) => {
        setTemplateData(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
    };

    const templateSavedRecords = useMemo(() => (
        [...buildUniqueDailyTimeRecords(records.filter((record) => record.record_date === templateDate))].sort((a, b) => {
            const lineCompare = String(a.line_name || '').localeCompare(String(b.line_name || ''));
            if (lineCompare !== 0) return lineCompare;
            const robotCompare = getRobotSortNum(a.robot_no) - getRobotSortNum(b.robot_no);
            if (robotCompare !== 0) return robotCompare;
            return (a.station || 0) - (b.station || 0);
        })
    ), [records, templateDate]);

    const templatePreviewStats = useMemo(() => {
        const comparableRecords = templateSavedRecords.filter((record) => {
            const partDuration = parseDuration(record.part_duration);
            const ifsDuration = parseDuration(record.ifs_duration);
            return Number.isFinite(partDuration) && Number.isFinite(ifsDuration);
        });

        return {
            totalCount: templateSavedRecords.length,
            comparableCount: comparableRecords.length,
            overIfsCount: comparableRecords.filter((record) => getPerformanceStatus(parseDuration(record.part_duration), parseDuration(record.ifs_duration)) === 'IFS Üstü').length,
            underIfsCount: comparableRecords.filter((record) => getPerformanceStatus(parseDuration(record.part_duration), parseDuration(record.ifs_duration)) === 'IFS Altı').length,
        };
    }, [templateSavedRecords]);

    const handleSaveTemplate = async () => {
        if (isSavingTemplate) return;

        setIsSavingTemplate(true);
        try {
            const { data: existingRecords, error: existingError } = await supabase
                .from('daily_time_tracking')
                .select('id, robot_id, robot_no, station')
                .eq('record_date', templateDate);

            if (existingError) throw existingError;

            const existingByKey = new Map();
            (existingRecords || []).forEach((record) => {
                const key = getDailyTimeRecordKey(record);
                if (!existingByKey.has(key)) {
                    existingByKey.set(key, []);
                }
                existingByKey.get(key).push(record);
            });

            const preparedRows = templateData.map((row) => {
                const rowKey = getDailyTimeRecordKey(row);
                return {
                    row,
                    rowKey,
                    hasContent: hasDailyTimeEntryContent(row),
                    existingMatches: existingByKey.get(rowKey) || [],
                };
            });

            const rowsToSave = preparedRows.filter((item) => item.hasContent);
            const idsToDelete = [...new Set(preparedRows
                .filter((item) => !item.hasContent)
                .flatMap((item) => item.existingMatches.map((record) => record.id))
                .filter(Boolean))];

            if (rowsToSave.length === 0 && idsToDelete.length === 0) {
                toast({ title: 'Uyarı', description: 'Kaydedilecek bir veri bulunamadı.', variant: 'default' });
                return;
            }

            if (idsToDelete.length > 0) {
                const { error: deleteEmptyError } = await supabase
                    .from('daily_time_tracking')
                    .delete()
                    .in('id', idsToDelete);

                if (deleteEmptyError) throw deleteEmptyError;
            }

            for (const { row, existingMatches } of rowsToSave) {
                const partDur = row.part_duration ? parseFloat(row.part_duration) : null;
                const ifsDur = row.ifs_duration ? parseFloat(row.ifs_duration) : null;
                const primaryExistingRecord = existingMatches[0];
                const payload = {
                    record_date: templateDate,
                    robot_no: row.robot_no,
                    robot_id: row.robot_id || null,
                    station: row.station,
                    line_id: row.line_id,
                    part_code: (row.part_code || '').trim(),
                    part_duration: partDur,
                    ifs_duration: ifsDur,
                    description: (row.description || '').trim() || null,
                    updated_at: new Date().toISOString(),
                };

                if (primaryExistingRecord?.id) {
                    const { error: updateError } = await supabase
                        .from('daily_time_tracking')
                        .update(payload)
                        .eq('id', primaryExistingRecord.id);

                    if (updateError) throw updateError;

                    if (existingMatches.length > 1) {
                        const duplicateIds = existingMatches.slice(1).map((record) => record.id);
                        if (duplicateIds.length > 0) {
                            const { error: duplicateDeleteError } = await supabase
                                .from('daily_time_tracking')
                                .delete()
                                .in('id', duplicateIds);

                            if (duplicateDeleteError) throw duplicateDeleteError;
                        }
                    }
                } else {
                    const { error: insertError } = await supabase
                        .from('daily_time_tracking')
                        .insert(payload);

                    if (insertError) throw insertError;
                }
            }

            const saveSummary = `${rowsToSave.length} kayıt güncellendi${idsToDelete.length > 0 ? `, ${idsToDelete.length} boş kayıt temizlendi` : ''}.`;
            toast({ title: 'Başarılı', description: saveSummary });
            logAction('SAVE_TEMPLATE_DAILY_TIME', `${templateDate}: ${saveSummary}`, user);
            await fetchData();
            await loadTemplateForDate(templateDate);
            setTemplatePanelMode('preview');
        } catch (error) {
            toast({ title: 'Kayıt Başarısız', description: error.message, variant: 'destructive' });
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const resetForm = useCallback(() => {
        setFormState({
            record_date: new Date().toISOString().split('T')[0],
            robot_no: '',
            station: '',
            line_id: '',
            part_code: '',
            part_duration: '',
            ifs_duration: '',
            description: '',
        });
        setEditingRecord(null);
    }, []);

    const openDialog = useCallback((record = null) => {
        if (record) {
            setEditingRecord(record);
            setFormState({
                record_date: record.record_date,
                robot_no: record.robot_no || '',
                station: String(record.station),
                line_id: record.line_id || '',
                part_code: record.part_code || '',
                part_duration: record.part_duration != null ? String(record.part_duration) : '',
                ifs_duration: record.ifs_duration != null ? String(record.ifs_duration) : '',
                description: record.description || '',
            });
        } else {
            resetForm();
        }
        setShowDialog(true);
    }, [resetForm]);

    const handleSave = async () => {
        // Validasyon
        if (!formState.record_date) {
            toast({ title: "Hata", description: "Tarih zorunludur.", variant: "destructive" });
            return;
        }
        if (!formState.robot_no.trim()) {
            toast({ title: "Hata", description: "Robot No zorunludur.", variant: "destructive" });
            return;
        }
        if (!formState.station || !['1', '2'].includes(formState.station)) {
            toast({ title: "Hata", description: "İstasyon zorunludur ve sadece 1 veya 2 olabilir.", variant: "destructive" });
            return;
        }
        if (!formState.line_id) {
            toast({ title: "Hata", description: "Hat Adı zorunludur.", variant: "destructive" });
            return;
        }
        if (!formState.part_code.trim()) {
            toast({ title: "Hata", description: "Parça Kodu zorunludur.", variant: "destructive" });
            return;
        }

        const partDur = formState.part_duration !== '' ? parseFloat(formState.part_duration) : null;
        const ifsDur = formState.ifs_duration !== '' ? parseFloat(formState.ifs_duration) : null;

        if (partDur !== null && partDur < 0) {
            toast({ title: "Hata", description: "Parça Süresi negatif olamaz.", variant: "destructive" });
            return;
        }
        if (ifsDur !== null && ifsDur < 0) {
            toast({ title: "Hata", description: "IFS Süre negatif olamaz.", variant: "destructive" });
            return;
        }

        const matchedRobot = robots.find(r => r.name === formState.robot_no.trim());
        const dataToSave = {
            record_date: formState.record_date,
            robot_no: formState.robot_no.trim(),
            robot_id: matchedRobot?.id || null,
            station: Number(formState.station),
            line_id: formState.line_id,
            part_code: formState.part_code.trim(),
            part_duration: partDur,
            ifs_duration: ifsDur,
            description: formState.description.trim() || null,
            updated_at: new Date().toISOString(),
        };

        try {
            let result;
            if (editingRecord) {
                result = await supabase.from('daily_time_tracking').update(dataToSave).eq('id', editingRecord.id);
            } else {
                result = await supabase.from('daily_time_tracking').insert(dataToSave);
            }

            if (result.error) throw result.error;

            toast({ title: "Başarılı", description: editingRecord ? "Kayıt güncellendi." : "Kayıt eklendi." });
            logAction(editingRecord ? 'UPDATE_DAILY_TIME' : 'CREATE_DAILY_TIME', `Parça: ${dataToSave.part_code}, Robot: ${dataToSave.robot_no}`, user);
            setShowDialog(false);
            resetForm();
            fetchData();
        } catch (error) {
            toast({ title: "Kayıt Başarısız", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            const { error } = await supabase.from('daily_time_tracking').delete().eq('id', deleteConfirm.id);
            if (error) throw error;
            toast({ title: "Silindi", description: "Kayıt başarıyla silindi.", variant: "destructive" });
            logAction('DELETE_DAILY_TIME', `ID: ${deleteConfirm.id}`, user);
            fetchData();
        } catch (error) {
            toast({ title: "Silme Başarısız", description: error.message, variant: "destructive" });
        }
        setDeleteConfirm(null);
    };

    // Rapor Oluştur (Yazdırma penceresi)
    const handleGenerateReport = async () => {
        try {
            let reportRecords;
            if (viewMode === 'template') {
                let dateRecords = templateSavedRecords;
                if (dateRecords.length === 0) {
                    const { data } = await supabase.from('daily_time_tracking').select('*').eq('record_date', templateDate);
                    const lm = new Map(lines.map(l => [l.id, l.name]));
                    dateRecords = buildUniqueDailyTimeRecords((data || []).map(r => ({ ...r, line_name: lm.get(r.line_id) || 'N/A' })));
                }
                reportRecords = [...dateRecords].sort((a, b) => {
                    const rnA = getRobotSortNum(a.robot_no);
                    const rnB = getRobotSortNum(b.robot_no);
                    if (rnA !== rnB) return rnA - rnB;
                    return (a.station || 0) - (b.station || 0);
                });
            } else {
                reportRecords = getCurrentListRecords();
            }

            if (reportRecords.length === 0) {
                toast({ title: 'Veri Yok', description: 'Rapor oluşturmak için filtreye uygun kayıt bulunamadı.', variant: 'destructive' });
                return;
            }

            const reportAnalytics = buildAnalytics(reportRecords, searchInputs.part_code);
            const periodLabel = viewMode === 'template'
                ? format(new Date(templateDate + 'T12:00:00'), 'dd.MM.yyyy', { locale: tr })
                : `${format(filters.dateRange?.from || new Date(), 'dd.MM.yyyy', { locale: tr })} - ${format(filters.dateRange?.to || new Date(), 'dd.MM.yyyy', { locale: tr })}`;

            const reportSections = [];

            if (reportAnalytics.lineAnalysis.length > 0) {
                reportSections.push({
                    type: 'chart',
                    title: 'Hat Bazlı Performans Grafiği',
                    chartType: 'bar',
                    data: reportAnalytics.lineAnalysis.slice(0, 12),
                    config: {
                        xAxisKey: 'lineName',
                        bars: [
                            { key: 'avgVariance', name: 'Ort. IFS Farkı', color: CHART_COLORS.warning },
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                        ],
                        height: 320,
                        xAxisAngle: reportAnalytics.lineAnalysis.length > 6 ? -35 : 0,
                        xAxisHeight: reportAnalytics.lineAnalysis.length > 6 ? 88 : 44,
                        yAxisWidth: 72,
                    },
                });
            }

            if (reportAnalytics.lineAnalysis.length > 0) {
                reportSections.push({
                    title: 'Hat Bazlı Performans Analizi',
                    headers: ['Hat', 'Kayıt', 'Robot', 'Parça', 'Ort. Süre', 'Ort. IFS', 'Ort. Fark', 'IFS Üstü Oran'],
                    rows: reportAnalytics.lineAnalysis.map((line) => [
                        line.lineName,
                        String(line.recordCount),
                        String(line.robotCount),
                        String(line.partCount),
                        formatNumber(line.avgPartDuration),
                        formatNumber(line.avgIfsDuration),
                        formatNumber(line.avgVariance),
                        formatPercent(line.overIfsRate),
                    ]),
                    options: {
                        columnWidths: ['18%', '10%', '10%', '10%', '13%', '13%', '13%', '13%'],
                        rightAlignColumns: [1, 2, 3, 4, 5, 6, 7],
                    },
                });
            }

            if (reportAnalytics.overIfsParts.length > 0) {
                reportSections.push({
                    type: 'chart',
                    title: 'IFS Üstü Parçalar Grafiği',
                    chartType: 'bar',
                    data: reportAnalytics.overIfsParts.slice(0, 12),
                    config: {
                        xAxisKey: 'partCode',
                        bars: [
                            { key: 'avgVariance', name: 'Ort. IFS Farkı', color: CHART_COLORS.warning },
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                        ],
                        height: 320,
                        xAxisAngle: reportAnalytics.overIfsParts.length > 6 ? -35 : 0,
                        xAxisHeight: reportAnalytics.overIfsParts.length > 6 ? 88 : 44,
                        yAxisWidth: 72,
                    },
                });

                reportSections.push({
                    title: 'IFS Süresinin Üstünde Çalışılan Parçalar',
                    headers: ['Parça', 'Aşım Kaydı', 'Ort. Süre', 'Ort. IFS', 'Ort. Fark', 'Hat', 'Robot'],
                    rows: reportAnalytics.overIfsParts.map((part) => [
                        part.partCode,
                        String(part.overIfsCount),
                        formatNumber(part.avgPartDuration),
                        formatNumber(part.avgIfsDuration),
                        formatNumber(part.avgVariance),
                        String(part.lineCount),
                        String(part.robotCount),
                    ]),
                    options: {
                        columnWidths: ['22%', '12%', '14%', '14%', '14%', '12%', '12%'],
                        rightAlignColumns: [1, 2, 3, 4, 5, 6],
                    },
                });
            }

            const trendSections = [
                { title: 'Günlük Trend', data: reportAnalytics.dailyTrend },
                { title: 'Haftalık Trend', data: reportAnalytics.weeklyTrend },
                { title: 'Aylık Trend', data: reportAnalytics.monthlyTrend },
            ];

            trendSections.forEach((section) => {
                if (section.data.length === 0) return;
                reportSections.push({
                    type: 'chart',
                    title: section.title,
                    chartType: 'line',
                    data: section.data,
                    config: {
                        xAxisKey: 'label',
                        lines: [
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                            { key: 'avgIfsDuration', name: 'Ort. IFS Süresi', color: CHART_COLORS.ifs },
                        ],
                        xAxisAngle: section.data.length > 8 ? -35 : 0,
                        xAxisHeight: section.data.length > 8 ? 80 : 40,
                        yAxisWidth: 72,
                    },
                });
            });

            if (reportAnalytics.partInsights?.spcSeries?.length > 0) {
                reportSections.push({
                    type: 'chart',
                    title: `${reportAnalytics.partInsights.label} - Süre Kararlılık Grafiği`,
                    chartType: 'line',
                    data: reportAnalytics.partInsights.spcSeries.map((point) => ({
                        ...point,
                        sampleLabel: String(point.sample),
                    })),
                    config: {
                        xAxisKey: 'sampleLabel',
                        lines: [
                            { key: 'actual', name: 'Gerçek Süre', color: CHART_COLORS.actual },
                            { key: 'ifs', name: 'IFS', color: CHART_COLORS.ifs },
                            { key: 'mean', name: 'Ortalama', color: CHART_COLORS.accent },
                        ],
                        yAxisWidth: 72,
                    },
                });

                reportSections.push({
                    type: 'chart',
                    title: `${reportAnalytics.partInsights.label} - Robot Bazlı Süre Karşılaştırması`,
                    chartType: 'bar',
                    data: reportAnalytics.partInsights.robotBreakdown,
                    config: {
                        xAxisKey: 'robotNo',
                        bars: [
                            { key: 'avgPartDuration', name: 'Ort. Parça Süresi', color: CHART_COLORS.actual },
                            { key: 'avgIfsDuration', name: 'Ort. IFS Süresi', color: CHART_COLORS.ifs },
                        ],
                        yAxisWidth: 72,
                    },
                });

                reportSections.push({
                    title: `${reportAnalytics.partInsights.label} - Robot Bazlı Detay`,
                    headers: ['Robot', 'Kayıt', 'Ort. Süre', 'Ort. IFS', 'Ort. Fark', 'Min', 'Maks'],
                    rows: reportAnalytics.partInsights.robotBreakdown.map((robot) => [
                        robot.robotNo,
                        String(robot.recordCount),
                        formatNumber(robot.avgPartDuration),
                        formatNumber(robot.avgIfsDuration),
                        formatNumber(robot.avgVariance),
                        formatNumber(robot.minDuration),
                        formatNumber(robot.maxDuration),
                    ]),
                    options: {
                        columnWidths: ['20%', '10%', '14%', '14%', '14%', '14%', '14%'],
                        rightAlignColumns: [1, 2, 3, 4, 5, 6],
                    },
                });
            }

            const reportData = {
                title: 'Günlük Süre Takibi - Analitik Rapor',
                reportId: `RPR-DAILY-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`,
                filters: {
                    'Rapor Modu': viewMode === 'template' ? 'Günlük Veri Giriş Raporu' : 'Filtreli Analiz Raporu',
                    'Rapor Dönemi': periodLabel,
                    'Rapor Tarihi': format(new Date(), 'dd.MM.yyyy HH:mm', { locale: tr }),
                    'Hat Filtresi': filters.line_id !== 'all' ? (lines.find((line) => line.id === filters.line_id)?.name || 'Seçili Hat') : 'Tümü',
                    'Robot Filtresi': searchInputs.robot_no || 'Tümü',
                    'Parça Araması': searchInputs.part_code || 'Tümü',
                    'İstasyon': filters.station !== 'all' ? `İstasyon ${filters.station}` : 'Tümü',
                    'Toplam Kayıt': `${reportAnalytics.totals.recordCount} adet`,
                    'IFS Kıyaslanabilir Kayıt': `${reportAnalytics.totals.comparableCount} adet`,
                },
                landscape: true,
                kpiCards: [
                    { title: 'Toplam Kayıt', value: String(reportAnalytics.totals.recordCount) },
                    { title: 'Ort. Parça Süresi', value: formatNumber(reportAnalytics.totals.avgPartDuration) },
                    { title: 'Ort. IFS', value: formatNumber(reportAnalytics.totals.avgIfsDuration) },
                    { title: 'IFS Altı', value: String(reportAnalytics.totals.underIfsCount) },
                    { title: 'IFS Üstü', value: String(reportAnalytics.totals.overIfsCount) },
                    { title: 'Ort. Fark', value: formatNumber(reportAnalytics.totals.avgVariance) },
                ],
                sections: reportSections,
                tableData: {
                    headers: ['Tarih', 'Robot No', 'İst.', 'Hat', 'Parça', 'Süre (sn)', 'IFS (sn)', 'Fark', 'Durum', 'Açıklama'],
                    rows: reportRecords.map(r => [
                        format(getRecordDateValue(r.record_date) || new Date(), 'dd.MM.yyyy'),
                        r.robot_no,
                        'İst. ' + r.station,
                        r.line_name,
                        r.part_code || '-',
                        Number.isFinite(parseDuration(r.part_duration)) ? formatNumber(parseDuration(r.part_duration)) : '-',
                        Number.isFinite(parseDuration(r.ifs_duration)) ? formatNumber(parseDuration(r.ifs_duration)) : '-',
                        (() => {
                            const variance = getVariance(parseDuration(r.part_duration), parseDuration(r.ifs_duration));
                            return Number.isFinite(variance)
                                ? {
                                    value: formatNumber(variance),
                                    style: { color: variance > 0 ? '#b91c1c' : '#047857', fontWeight: 700 }
                                }
                                : '-';
                        })(),
                        (() => {
                            const status = getPerformanceStatus(parseDuration(r.part_duration), parseDuration(r.ifs_duration));
                            const tone = status === 'IFS Altı'
                                ? { background: '#dcfce7', color: '#166534' }
                                : status === 'IFS Üstü'
                                    ? { background: '#fee2e2', color: '#991b1b' }
                                    : status === 'IFS Eşit'
                                        ? { background: '#fef3c7', color: '#92400e' }
                                        : { background: '#e2e8f0', color: '#334155' };
                            return {
                                value: status,
                                badge: tone,
                            };
                        })(),
                        r.description || '-',
                    ]),
                    options: {
                        columnWidths: ['10%', '10%', '7%', '10%', '10%', '10%', '10%', '10%', '9%', '14%'],
                        wrapColumns: [9],
                        rightAlignColumns: [5, 6, 7],
                    },
                },
            };
            await openPrintWindow(reportData, toast);
            toast({ title: 'Rapor Hazır', description: 'Rapor yeni sekmede açıldı.' });
        } catch (error) {
            toast({ title: 'Rapor Oluşturulamadı', description: error.message, variant: 'destructive' });
        }
    };

    // CSV Export
    const handleExport = () => {
        const currentListRecords = getCurrentListRecords();

        if (currentListRecords.length === 0) {
            toast({ title: "Uyarı", description: "Dışa aktarılacak veri bulunamadı." });
            return;
        }

        const lineMap = new Map(lines.map(l => [l.id, l.name]));
        const headers = ['Tarih', 'Robot No', 'İstasyon', 'Hat Adı', 'Parça Kodu', 'Parça Süresi (sn)', 'IFS Süre (sn)', 'IFS Farkı (sn)', 'Durum', 'Açıklama'];
        const rows = currentListRecords.map(r => [
            format(getRecordDateValue(r.record_date) || new Date(), 'dd.MM.yyyy'),
            r.robot_no,
            r.station,
            lineMap.get(r.line_id) || 'N/A',
            r.part_code,
            r.part_duration != null ? r.part_duration : '',
            r.ifs_duration != null ? r.ifs_duration : '',
            Number.isFinite(getVariance(parseDuration(r.part_duration), parseDuration(r.ifs_duration)))
                ? getVariance(parseDuration(r.part_duration), parseDuration(r.ifs_duration))
                : '',
            getPerformanceStatus(parseDuration(r.part_duration), parseDuration(r.ifs_duration)),
            r.description || ''
        ]);

        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gunluk_sure_takibi_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "İndirildi", description: `${currentListRecords.length} kayıt CSV olarak indirildi.` });
    };

    // Hızlı tarih butonları
    const setQuickDate = (type) => {
        const today = new Date();
        if (type === 'today') {
            setFilters(prev => ({ ...prev, dateRange: { from: today, to: today } }));
        } else if (type === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            setFilters(prev => ({ ...prev, dateRange: { from: yesterday, to: yesterday } }));
        } else if (type === 'thisMonth') {
            setFilters(prev => ({ ...prev, dateRange: { from: startOfMonth(today), to: endOfMonth(today) } }));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-indigo-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Günlük Süre Takibi</h1>
                        <p className="text-sm text-gray-500">Robot bazlı parça süre kayıt ve takip sistemi</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                        <Button
                            variant={viewMode === 'template' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('template')}
                            className={viewMode === 'template' ? 'bg-indigo-600' : ''}
                        >
                            <LayoutGrid className="h-4 w-4 mr-1" /> Veri Girişi
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className={viewMode === 'list' ? 'bg-indigo-600' : ''}
                        >
                            <List className="h-4 w-4 mr-1" /> Analiz ve Liste
                        </Button>
                    </div>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" />CSV İndir
                    </Button>
                    <Button variant="outline" onClick={handleGenerateReport}>
                        <FileText className="h-4 w-4 mr-2" />Rapor Al
                    </Button>
                    {viewMode === 'list' && (
                        <Button onClick={() => openDialog()}>
                            <Plus className="h-4 w-4 mr-2" />Yeni Kayıt
                        </Button>
                    )}
                </div>
            </div>

            {/* Veri Girişi Modu */}
            {viewMode === 'template' && (
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <CardTitle>Günlük Veri Girişi</CardTitle>
                                <CardDescription>
                                    Tarih seçin, robot ve hat bilgileri hazır. Girişi yaptıktan sonra kayıtları ayrı görüntüleme ekranından kontrol edin.
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                <Label className="text-sm font-medium">Tarih:</Label>
                                <Input
                                    type="date"
                                    value={templateDate}
                                    onChange={e => setTemplateDate(e.target.value)}
                                    className="w-[160px] h-10"
                                />
                                <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={templatePanelMode === 'entry' ? 'default' : 'ghost'}
                                        className={templatePanelMode === 'entry' ? 'bg-indigo-600' : ''}
                                        onClick={() => {
                                            setTemplatePanelMode('entry');
                                            loadTemplateForDate(templateDate);
                                        }}
                                    >
                                        Veri Girişi
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={templatePanelMode === 'preview' ? 'default' : 'ghost'}
                                        className={templatePanelMode === 'preview' ? 'bg-indigo-600' : ''}
                                        onClick={() => setTemplatePanelMode('preview')}
                                    >
                                        Kayıt Görüntüle
                                    </Button>
                                </div>
                                {templatePanelMode === 'entry' ? (
                                    <Button
                                        onClick={handleSaveTemplate}
                                        disabled={templateLoading || isSavingTemplate}
                                        className="bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {isSavingTemplate ? 'Kaydediliyor...' : 'Girişi Kaydet'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setTemplatePanelMode('entry');
                                            loadTemplateForDate(templateDate);
                                        }}
                                    >
                                        Düzenlemeye Dön
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            {templatePanelMode === 'entry'
                                ? 'Aynı tarih ve aynı robot-istasyon için tekrar kaydettiğinizde yeni kayıt açılmaz, mevcut kayıt güncellenir. Boş bırakılan satırlar kaydedilmez.'
                                : `Bu alanda ${format(new Date(`${templateDate}T12:00:00`), 'dd.MM.yyyy', { locale: tr })} tarihine ait kaydedilmiş verileri görüyorsunuz. Yeni kayıt eklemek veya düzenlemek için "Düzenlemeye Dön" kullanın.`}
                        </div>

                        {templatePanelMode === 'entry' ? (
                            <>
                                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase w-[100px]">ROBOT</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase w-[120px]">HAT ADI</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase w-[70px]">İst.</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase min-w-[140px]">PARÇA KODU</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase w-[100px]">PARÇA SÜRESİ (sn)</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase w-[90px]">IFS (sn)</th>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {templateLoading ? (
                                                <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Yükleniyor...</td></tr>
                                            ) : (
                                                templateData.map((row) => {
                                                    const lineColors = { ATMACA: 'bg-amber-50', KARTAL: 'bg-sky-50', PARS: 'bg-amber-50/70', KURT: 'bg-emerald-50' };
                                                    const bg = lineColors[row.line_name] || 'bg-white';
                                                    return (
                                                        <tr key={row.key} className={`${bg} hover:bg-gray-50/80`}>
                                                            <td className="px-4 py-2 font-medium text-gray-900">{row.robot_no}</td>
                                                            <td className="px-4 py-2 font-medium text-gray-700">{row.line_name}</td>
                                                            <td className="px-4 py-2">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${row.station === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                                    {row.station}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <Input
                                                                    placeholder="Parça kodu"
                                                                    value={row.part_code}
                                                                    onChange={e => updateTemplateRow(row.key, 'part_code', e.target.value)}
                                                                    className="h-9 text-sm border-gray-200"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    placeholder="0"
                                                                    value={row.part_duration}
                                                                    onChange={e => updateTemplateRow(row.key, 'part_duration', e.target.value)}
                                                                    className="h-9 text-sm border-gray-200 w-20"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    placeholder="0"
                                                                    value={row.ifs_duration}
                                                                    onChange={e => updateTemplateRow(row.key, 'ifs_duration', e.target.value)}
                                                                    className="h-9 text-sm border-gray-200 w-20"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <Input
                                                                    placeholder="Opsiyonel"
                                                                    value={row.description}
                                                                    onChange={e => updateTemplateRow(row.key, 'description', e.target.value)}
                                                                    className="h-9 text-sm border-gray-200"
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {templateData.length === 0 && !templateLoading && (
                                    <p className="text-center py-8 text-gray-500">Robot tanımı bulunamadı. Ana Veri modülünden robot ekleyin.</p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="grid gap-3 md:grid-cols-4">
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kaydedilen Kayıt</p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">{templatePreviewStats.totalCount}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">IFS Kıyaslanan</p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">{templatePreviewStats.comparableCount}</p>
                                    </div>
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-600">IFS Üstü</p>
                                        <p className="mt-1 text-2xl font-bold text-rose-700">{templatePreviewStats.overIfsCount}</p>
                                    </div>
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-600">IFS Altı</p>
                                        <p className="mt-1 text-2xl font-bold text-emerald-700">{templatePreviewStats.underIfsCount}</p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10 bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Robot</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Hat</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">İst.</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Parça Kodu</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Parça Süresi</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">IFS</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Fark</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Durum</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase">Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {templateSavedRecords.map((record) => {
                                                const partDuration = parseDuration(record.part_duration);
                                                const ifsDuration = parseDuration(record.ifs_duration);
                                                const variance = getVariance(partDuration, ifsDuration);
                                                const status = getPerformanceStatus(partDuration, ifsDuration);
                                                const statusClass = status === 'IFS Altı'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : status === 'IFS Üstü'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : status === 'IFS Eşit'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-slate-100 text-slate-700';

                                                return (
                                                    <tr key={record.id || getDailyTimeRecordKey(record)} className="hover:bg-slate-50/80">
                                                        <td className="px-4 py-2 font-medium text-slate-900">{record.robot_no}</td>
                                                        <td className="px-4 py-2">{record.line_name}</td>
                                                        <td className="px-4 py-2">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${record.station === 1 ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                                İst. {record.station}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2 font-semibold text-slate-900">{record.part_code || '-'}</td>
                                                        <td className="px-4 py-2">{Number.isFinite(partDuration) ? formatSeconds(partDuration) : '-'}</td>
                                                        <td className="px-4 py-2">{Number.isFinite(ifsDuration) ? formatSeconds(ifsDuration) : '-'}</td>
                                                        <td className={`px-4 py-2 font-semibold ${Number.isFinite(variance) && variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {Number.isFinite(variance) ? formatSeconds(variance) : '-'}
                                                        </td>
                                                        <td className="px-4 py-2">
                                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>
                                                        </td>
                                                        <td className="px-4 py-2 text-slate-600">{record.description || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {templateSavedRecords.length === 0 && (
                                        <p className="py-10 text-center text-slate-500">Bu tarih için henüz kaydedilmiş veri bulunmuyor.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Liste modu: Filtreler, Toplamlar, Tablo */}
            {viewMode === 'list' && (
            <>
            <Card className="border-0 shadow-sm">
                <CardContent className="pt-6 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <DateRangePicker
                            value={filters.dateRange}
                            onChange={(range) => setFilters(prev => ({ ...prev, dateRange: range || { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } }))}
                            placeholder="Tarih Aralığı"
                            className="w-[280px]"
                        />
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => setQuickDate('today')}>Bugün</Button>
                            <Button variant="outline" size="sm" onClick={() => setQuickDate('yesterday')}>Dün</Button>
                            <Button variant="outline" size="sm" onClick={() => setQuickDate('thisMonth')}>Bu Ay</Button>
                        </div>
                        <Select value={filters.line_id} onValueChange={v => setFilters(prev => ({ ...prev, line_id: v }))}>
                            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Tüm Hatlar" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm Hatlar</SelectItem>
                                {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filters.station} onValueChange={v => setFilters(prev => ({ ...prev, station: v }))}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tüm İst." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tüm İstasyonlar</SelectItem>
                                <SelectItem value="1">İstasyon 1</SelectItem>
                                <SelectItem value="2">İstasyon 2</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Robot No"
                                value={searchInputs.robot_no}
                                onChange={e => setSearchInputs(prev => ({ ...prev, robot_no: e.target.value }))}
                                className="w-[150px] pl-9"
                            />
                        </div>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Parça Kodu Ara"
                                value={searchInputs.part_code}
                                onChange={e => setSearchInputs(prev => ({ ...prev, part_code: e.target.value }))}
                                className="w-[190px] pl-9"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setFilters({
                                    dateRange: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
                                    line_id: 'all',
                                    station: 'all',
                                });
                                setSearchInputs({ robot_no: '', part_code: '' });
                            }}
                        >
                            Temizle
                        </Button>
                    </div>

                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
                        <span className="font-semibold">IFS:</span> Bir parçanın hedeflenen ideal üretim süresidir. IFS altı süreler hedef üstü performans, IFS üstü süreler ise iyileştirme alanı olarak değerlendirilir.
                    </div>
                </CardContent>
            </Card>
            <ListAnalyticsDashboard
                analytics={analytics}
                totals={totals}
                activePartSearch={activePartSearch}
                isSearchPending={isSearchPending}
                filteredRecords={filteredRecords}
                onEditRecord={openDialog}
                onDeleteRecord={setDeleteConfirm}
            />
            </>
            )}

            {/* Kayıt Ekleme/Düzenleme Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-2xl p-0 overflow-hidden border-0">
                    <DialogHeader className="bg-gradient-to-r from-indigo-600 to-indigo-500 p-6 text-white">
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            {editingRecord ? <Edit className="h-6 w-6 text-white/80" /> : <Plus className="h-6 w-6 text-white/80" />}
                            {editingRecord ? 'Kayıt Düzenle' : 'Yeni Kayıt Ekle'}
                        </DialogTitle>
                        <DialogDescription className="text-indigo-100 opacity-90">
                            Günlük süre takibi için gerekli bilgileri aşağıdan yönetebilirsiniz.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" /> Tarih <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="date"
                                    value={formState.record_date}
                                    onChange={e => setFormState(prev => ({ ...prev, record_date: e.target.value }))}
                                    className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 flex items-center justify-center text-[8px] font-bold text-indigo-500">R</span> Robot No <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formState.robot_no} onValueChange={v => setFormState(prev => ({ ...prev, robot_no: v }))}>
                                    <SelectTrigger className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                        <SelectValue placeholder="Robot seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {robots.map(r => (
                                            <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <span className="w-3.5 h-3.5 rounded-sm bg-indigo-100 border border-indigo-300"></span> İstasyon <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formState.station} onValueChange={v => setFormState(prev => ({ ...prev, station: v }))}>
                                    <SelectTrigger className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                        <SelectValue placeholder="İstasyon seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">İstasyon 1</SelectItem>
                                        <SelectItem value="2">İstasyon 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-indigo-500" /> Hat Adı <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formState.line_id} onValueChange={v => setFormState(prev => ({ ...prev, line_id: v }))}>
                                    <SelectTrigger className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                        <SelectValue placeholder="Hat seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                <Search className="w-3.5 h-3.5 text-indigo-500" /> Parça Kodu <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                placeholder="Parça kodu giriniz"
                                value={formState.part_code}
                                onChange={e => setFormState(prev => ({ ...prev, part_code: e.target.value }))}
                                className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500" /> Parça Süresi (sn)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={formState.part_duration}
                                    onChange={e => setFormState(prev => ({ ...prev, part_duration: e.target.value }))}
                                    className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-purple-500" /> IFS Süre (sn)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={formState.ifs_duration}
                                    onChange={e => setFormState(prev => ({ ...prev, ifs_duration: e.target.value }))}
                                    className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all font-mono"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">Açıklama</Label>
                            <Input
                                placeholder="Açıklama (opsiyonel)"
                                value={formState.description}
                                onChange={e => setFormState(prev => ({ ...prev, description: e.target.value }))}
                                className="h-10 rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowDialog(false)}
                            className="rounded-lg border-gray-300 hover:bg-gray-100 hover:text-gray-900 transition-colors px-6"
                        >
                            İptal
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200 transition-all px-6"
                        >
                            <Save className="mr-2 h-4 w-4" />{editingRecord ? 'Değişiklikleri Kaydet' : 'Kaydı Tamamla'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Silme Onayı */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-2xl border-0 overflow-hidden">
                    <DialogHeader className="bg-red-50 p-6 border-b border-red-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-red-900">Kaydı Sil</DialogTitle>
                                <DialogDescription className="text-red-700 mt-1">
                                    Bu işlem geri alınamaz.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-6">
                        <p className="text-gray-600">
                            Bu kaydı silmek istediğinize emin misiniz? Silinen veriler kalıcı olarak kaldırılacaktır.
                        </p>
                    </div>
                    <DialogFooter className="p-6 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg border-gray-300 hover:bg-gray-100 hover:text-gray-900 px-6 font-medium"
                        >
                            İptal
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md shadow-red-200 px-6 font-medium"
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Sil
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DailyTimeTracking;
