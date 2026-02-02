
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart3, 
  LayoutDashboard, 
  Tags, 
  FileSpreadsheet, 
  Upload, 
  Trash2, 
  TrendingUp,
  ShoppingBag, 
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileUp,
  Calendar,
  Save,
  Plus,
  RefreshCcw,
  Loader2,
  FileText,
  Users,
  Search,
  Filter,
  ArrowDownWideNarrow,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { EventData, DailySaleRecord, ActiveTab } from './types';
import { supabase } from './services/supabase';
import { parseEventExcel } from './services/salesProcessor';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LabelList
} from 'recharts';
import Papa from 'papaparse';
import { GoogleGenAI } from "@google/genai";

const MAIN_COLOR = '#2563eb';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [events, setEvents] = useState<EventData[]>([]);
  const [dailySales, setDailySales] = useState<DailySaleRecord[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [reportDate, setReportDate] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [salesSearchTerm, setSalesSearchTerm] = useState<string>('');
  const [layerFilter, setLayerFilter] = useState<string>('all');
  
  // AI Insights state
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const eventExcelRef = useRef<HTMLInputElement>(null);
  const dailySaleCsvRef = useRef<HTMLInputElement>(null);

  const convertDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
    const parts = cleanStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d.length === 4) return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return cleanStr;
  };

  const fetchData = async () => {
    try {
      setErrorMessage(null);
      const { data: eventsData, error: eventsError } = await supabase.from('Events').select('*');
      if (eventsError) throw eventsError;

      const groupedEvents: Record<string, EventData> = {};
      eventsData?.forEach((p: any) => {
        const key = `${p.event_name}_${p.start_date}`;
        if (!groupedEvents[key]) {
          groupedEvents[key] = {
            event_id: key,
            event_name: p.event_name,
            start_date: p.start_date,
            end_date: p.end_date,
            products: []
          };
        }
        groupedEvents[key].products.push(p);
      });
      setEvents(Object.values(groupedEvents));

      const { data: salesData, error: salesError } = await supabase
        .from('DailySale')
        .select('*')
        .order('amount_excl_tax', { ascending: false });
      
      if (salesError) throw salesError;
      setDailySales(salesData || []);

      if (salesData && salesData.length > 0 && !reportDate) {
        const dates = [...new Set(salesData.map((s: any) => s.sales_day))].sort() as string[];
        setReportDate(dates[dates.length - 1]);
      }
    } catch (err: any) {
      setErrorMessage("Lỗi kết nối: " + err.message);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleImportDailySale = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: async (results) => {
        try {
          const dataToInsert = results.data.map((row: any) => ({
            sales_day: convertDate(row['Sales Day'] || row['sales_day']),
            layer1_code: String(row['Layer1 Code'] || row['layer1_code'] || '').trim(),
            barcode: String(row['Barcode'] || row['barcode'] || '').trim(),
            item_name: String(row['Item Name'] || row['item_name'] || '').trim(),
            qty: Number(row['QTY'] || row['qty']) || 0,
            amount_excl_tax: Number(row['Amount(Tax excl.)'] || row['amount_excl_tax']) || 0,
            transaction: String(row['Slip No.'] || row['slip_no'] || row['Transaction'] || '').trim()
          })).filter(r => r.sales_day && r.barcode);

          const { error } = await supabase.from('DailySale').insert(dataToInsert);
          if (error) throw error;
          await fetchData();
          setSuccessMessage(`Đã nạp thành công ${dataToInsert.length} giao dịch.`);
          setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
          setErrorMessage("Lỗi nạp liệu CSV: " + err.message);
        } finally {
          setIsProcessing(false);
          if (dailySaleCsvRef.current) dailySaleCsvRef.current.value = '';
        }
      }
    });
  };

  const handleCreateEventExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !newEventName || !newStartDate || !newEndDate) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const products = parseEventExcel(data);
        const dataToInsert = products.map(p => ({
          event_name: newEventName,
          start_date: convertDate(newStartDate),
          end_date: convertDate(newEndDate),
          barcode: p.barcode,
          item_name: p.item_name
        }));
        const { error } = await supabase.from('Events').insert(dataToInsert);
        if (error) throw error;
        await fetchData();
        setShowEventForm(false);
        setNewEventName('');
      } catch (err: any) { setErrorMessage(err.message); }
      finally { setIsProcessing(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearDailySales = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa TOÀN BỘ dữ liệu doanh thu?")) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('DailySale').delete().neq('sales_day', '1900-01-01');
      if (error) throw error;
      await fetchData();
      setSuccessMessage("Đã xóa sạch dữ liệu doanh thu.");
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setIsProcessing(false); }
  };

  const deleteSalesByDate = async (date: string) => {
    if (!window.confirm(`Xóa dữ liệu ngày ${date}?`)) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('DailySale').delete().eq('sales_day', date);
      if (error) throw error;
      await fetchData();
    } catch (err: any) { setErrorMessage(err.message); }
    finally { setIsProcessing(false); }
  };

  const reportDataResult = useMemo(() => {
    const event = events.find(e => e.event_id === selectedEventId);
    if (!event || dailySales.length === 0 || !reportDate) return null;

    const eventBarcodes = new Set(event.products.map(p => p.barcode.trim()));
    
    const daySales = dailySales.filter(s => eventBarcodes.has(s.barcode.trim()) && s.sales_day === reportDate);
    const dayRevenue = daySales.reduce((acc, curr) => acc + curr.amount_excl_tax, 0);

    const effectiveEndDate = reportDate > event.end_date ? event.end_date : reportDate;
    const cumulativeSales = dailySales.filter(s => 
      eventBarcodes.has(s.barcode.trim()) && 
      s.sales_day >= event.start_date && 
      s.sales_day <= effectiveEndDate
    );
    
    const totalRevenue = cumulativeSales.reduce((acc, curr) => acc + curr.amount_excl_tax, 0);
    const totalQty = cumulativeSales.reduce((acc, curr) => acc + curr.qty, 0);
    const totalCustomers = new Set(cumulativeSales.map(s => s.transaction).filter(Boolean)).size;

    const barcodeGroups: Record<string, { name: string, qty: number, revenue: number }> = {};
    cumulativeSales.forEach(s => {
      const bc = s.barcode.trim();
      if (!barcodeGroups[bc]) barcodeGroups[bc] = { name: s.item_name, qty: 0, revenue: 0 };
      barcodeGroups[bc].qty += s.qty;
      barcodeGroups[bc].revenue += s.amount_excl_tax;
    });

    return { 
      eventName: event.event_name,
      dayRevenue,
      totalRevenue, totalQty, totalCustomers,
      topQty: Object.entries(barcodeGroups).map(([bc, d]) => ({ itemName: d.name, qty: d.qty })).sort((a,b)=>b.qty-a.qty).slice(0, 5),
      topValue: Object.entries(barcodeGroups).map(([bc, d]) => ({ itemName: d.name, revenue: d.revenue })).sort((a,b)=>b.revenue-a.revenue).slice(0, 5),
      details: Object.entries(barcodeGroups).map(([bc, d]) => ({ barcode: bc, item_name: d.name, qty: d.qty, revenue: d.revenue })).sort((a,b)=>b.revenue-a.revenue)
    };
  }, [events, selectedEventId, dailySales, reportDate]);

  const generateAIInsight = async () => {
    if (!reportDataResult) return;
    setIsAiLoading(true);
    setAiInsight(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Bạn là một chuyên gia phân tích bán lẻ cao cấp. Hãy phân tích báo cáo doanh thu sự kiện sau:
      Sự kiện: ${reportDataResult.eventName}
      Tổng doanh thu lũy kế: ${new Intl.NumberFormat('vi-VN').format(reportDataResult.totalRevenue)} VND
      Tổng số khách hàng: ${reportDataResult.totalCustomers}
      Tổng số lượng bán: ${reportDataResult.totalQty}
      Sản phẩm bán chạy nhất theo số lượng: ${reportDataResult.topQty.map(i => i.itemName).join(', ')}
      Sản phẩm có giá trị cao nhất: ${reportDataResult.topValue.map(i => i.itemName).join(', ')}
      
      Hãy đưa ra 3 nhận xét ngắn gọn về hiệu quả kinh doanh và 2 khuyến nghị hành động cụ thể. Viết bằng tiếng Việt, định dạng Markdown chuyên nghiệp.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setAiInsight(response.text);
    } catch (err: any) {
      setErrorMessage("Lỗi phân tích AI: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const layerOptions = useMemo(() => {
    const layers = [...new Set(dailySales.map(s => s.layer1_code))].filter(Boolean).sort() as string[];
    return layers;
  }, [dailySales]);

  const filteredDailySales = useMemo(() => {
    return dailySales.filter(s => {
      const matchesSearch = !salesSearchTerm || s.barcode.includes(salesSearchTerm) || s.item_name.toLowerCase().includes(salesSearchTerm.toLowerCase());
      const matchesLayer = layerFilter === 'all' || s.layer1_code === layerFilter;
      return matchesSearch && matchesLayer;
    });
  }, [dailySales, salesSearchTerm, layerFilter]);

  const formatNum = (v: number | string | any) => {
    const num = Number(v);
    return isNaN(num) ? '0' : new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="