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
  FileUp,
  Calendar,
  Plus,
  RefreshCcw,
  Loader2,
  FileText,
  Users,
  Search,
  Filter,
  ArrowDownWideNarrow,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { EventData, DailySaleRecord, ActiveTab } from './types';
import { supabase } from './services/supabase';
import { parseEventExcel } from './services/salesProcessor';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
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
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
              <BarChart3 className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase leading-none">EVENT ANALYTICS</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kohnan Reporting System</p>
            </div>
          </div>
          <nav className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl border">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Báo cáo' },
              { id: 'events', icon: Tags, label: 'Event' },
              { id: 'daily_sales', icon: FileSpreadsheet, label: 'Dữ liệu' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id as any); setAiInsight(null); }} 
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {/* Alerts */}
        {errorMessage && (
          <div className="mb-6 bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-600 font-bold text-sm animate-in slide-in-from-top-4">
            <XCircle size={18} /> {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-auto opacity-50 hover:opacity-100"><Plus className="rotate-45" size={18} /></button>
          </div>
        )}
        {successMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-600 font-bold text-sm animate-in slide-in-from-top-4">
            <CheckCircle2 size={18} /> {successMessage}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[300px] space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Chọn sự kiện</label>
                <select 
                  value={selectedEventId} 
                  onChange={e => { setSelectedEventId(e.target.value); setAiInsight(null); }} 
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 ring-blue-50 transition-all cursor-pointer"
                >
                  <option value="">-- Chọn một Event --</option>
                  {events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.event_name} (Bắt đầu: {ev.start_date})</option>)}
                </select>
              </div>
              <div className="w-64 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ngày xem báo cáo</label>
                <select 
                  value={reportDate} 
                  onChange={e => { setReportDate(e.target.value); setAiInsight(null); }} 
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-4 ring-blue-50 transition-all cursor-pointer"
                >
                  <option value="">Chọn ngày...</option>
                  {[...new Set(dailySales.map(s => s.sales_day))].sort().reverse().map((d: string) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {reportDataResult && (
                <button 
                  onClick={generateAIInsight}
                  disabled={isAiLoading}
                  className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  {isAiLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Phân tích AI
                </button>
              )}
            </div>

            {reportDataResult ? (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                {/* AI Insight Card */}
                {aiInsight && (
                  <div className="bg-white p-8 rounded-[3rem] border-2 border-blue-100 shadow-xl shadow-blue-50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-blue-100 group-hover:text-blue-200 transition-colors">
                      <Sparkles size={120} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-sm font-black text-blue-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <Sparkles size={18} /> Phân tích chiến lược từ AI
                      </h3>
                      <div className="prose prose-slate max-w-none text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                        {aiInsight}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Cumulative Revenue */}
                  <div className="bg-blue-600 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl text-white relative overflow-hidden group border-4 border-blue-500 min-h-[220px] flex flex-col justify-center">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                      <p className="text-[10px] md:text-[12px] font-black text-white/80 uppercase tracking-[0.3em] mb-2 md:mb-4 drop-shadow-md">Tổng doanh thu Lũy kế (Net)</p>
                      <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-[1000] tracking-tighter leading-tight flex items-baseline flex-wrap gap-x-2 drop-shadow-lg">
                        {formatNum(reportDataResult.totalRevenue)}
                        <span className="text-xl md:text-2xl lg:text-3xl opacity-60 font-bold">đ</span>
                      </h2>
                      <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/20 flex items-center justify-between">
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">
                          {events.find(e => e.event_id === selectedEventId)?.start_date} → {reportDate > (events.find(e => e.event_id === selectedEventId)?.end_date || '') ? events.find(e => e.event_id === selectedEventId)?.end_date : reportDate}
                        </span>
                        <TrendingUp size={24} className="opacity-40" />
                      </div>
                    </div>
                  </div>

                  {/* Day Revenue */}
                  <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border-4 border-slate-100 shadow-sm flex flex-col justify-center min-h-[220px]">
                    <p className="text-[10px] md:text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 md:mb-4">Doanh thu trong ngày ({reportDate})</p>
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-[1000] text-blue-600 tracking-tighter leading-tight flex items-baseline flex-wrap gap-x-2 drop-shadow-sm">
                      {formatNum(reportDataResult.dayRevenue)}
                      <span className="text-xl md:text-2xl lg:text-3xl opacity-30 font-bold text-slate-900">đ</span>
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-6 md:gap-8">
                    <div className="bg-slate-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-blue-600">
                      <Users size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Số lượng khách (Lũy kế)</p>
                      <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter">{formatNum(reportDataResult.totalCustomers)}</h3>
                    </div>
                  </div>
                  <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-sm flex items-center gap-6 md:gap-8">
                    <div className="bg-slate-50 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-emerald-500">
                      <ShoppingBag size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Số lượng bán ra (Lũy kế)</p>
                      <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter">{formatNum(reportDataResult.totalQty)}</h3>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm h-[400px]">
                    <h3 className="text-xs font-black uppercase mb-10 flex items-center gap-3 tracking-widest text-slate-800">
                      <Trophy className="text-amber-500" size={18} /> Top 5 Số lượng (Lũy kế)
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportDataResult.topQty} layout="vertical" margin={{ left: -10, right: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="itemName" type="category" width={120} tick={{fontSize: 9, fontWeight: '800', fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Bar dataKey="qty" fill={MAIN_COLOR} radius={[0, 8, 8, 0]} barSize={24}>
                          <LabelList dataKey="qty" position="right" style={{fontSize: 11, fontWeight: '900', fill: '#1e293b'}} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm h-[400px]">
                    <h3 className="text-xs font-black uppercase mb-10 flex items-center gap-3 tracking-widest text-slate-800">
                      <TrendingUp className="text-emerald-500" size={18} /> Top 5 Trị giá (Lũy kế)
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportDataResult.topValue} layout="vertical" margin={{ left: -10, right: 60 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="itemName" type="category" width={120} tick={{fontSize: 9, fontWeight: '800', fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 8, 8, 0]} barSize={24}>
                          <LabelList dataKey="revenue" position="right" style={{fontSize: 10, fontWeight: '900', fill: '#1e293b'}} formatter={(v:any)=>formatNum(v)} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-6 md:px-10 py-6 bg-slate-50 border-b flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                      <FileText size={18} className="text-blue-600" /> Bảng SKU Lũy kế
                    </h3>
                    <span className="text-[11px] font-black bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full uppercase tracking-widest">
                      {reportDataResult.details.length} Sản phẩm
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white font-black text-slate-400 uppercase tracking-widest border-b">
                        <tr>
                          <th className="px-6 md:px-10 py-5">Barcode</th>
                          <th className="px-6 md:px-10 py-5">Tên sản phẩm</th>
                          <th className="px-6 md:px-10 py-5 text-center">Số lượng</th>
                          <th className="px-6 md:px-10 py-5 text-right">Doanh thu (Lũy kế)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-bold">
                        {reportDataResult.details.map((s, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-6 md:px-10 py-4 font-mono text-slate-400 text-[10px]">{s.barcode}</td>
                            <td className="px-6 md:px-10 py-4 truncate max-w-[350px] text-slate-700">{s.item_name}</td>
                            <td className="px-6 md:px-10 py-4 text-center text-slate-900">{formatNum(s.qty)}</td>
                            <td className="px-6 md:px-10 py-4 text-right text-blue-600 font-black text-sm">
                              {formatNum(s.revenue)}<span className="text-[10px] opacity-30 ml-1 font-medium italic">đ</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] py-48 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center animate-in zoom-in-95">
                <LayoutDashboard size={80} className="text-slate-200 mb-8" />
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-[0.2em]">Hệ thống đã sẵn sàng</h3>
                <p className="text-slate-400 text-sm mt-5 uppercase font-bold tracking-widest max-w-md">Vui lòng chọn Event và Ngày báo cáo ở thanh công cụ phía trên.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Quản lý Event</h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Khai báo danh mục và thời gian sự kiện</p>
              </div>
              <button 
                onClick={() => setShowEventForm(!showEventForm)} 
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl ${showEventForm ? 'bg-slate-100 text-slate-500 shadow-none' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'}`}
              >
                {showEventForm ? 'Đóng Form' : <><Plus size={18}/> Tạo mới Event</>}
              </button>
            </div>

            {showEventForm && (
              <div className="bg-white p-10 rounded-[3rem] border shadow-2xl space-y-8 animate-in zoom-in-95">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên chương trình</label>
                    <input value={newEventName} onChange={e=>setNewEventName(e.target.value)} placeholder="Tên Event" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày bắt đầu</label>
                    <input type="date" value={newStartDate} onChange={e=>setNewStartDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày kết thúc</label>
                    <input type="date" value={newEndDate} onChange={e=>setNewEndDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <input type="file" ref={eventExcelRef} onChange={handleCreateEventExcel} className="hidden" accept=".xlsx,.xls" />
                  <button onClick={() => eventExcelRef.current?.click()} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Nạp Excel Sản phẩm & Lưu</button>
                  <button onClick={() => setShowEventForm(false)} className="text-slate-400 font-black text-xs uppercase px-6">Hủy</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map(ev => (
                <div key={ev.event_id} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-blue-400 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-10">
                    <div className="space-y-1">
                      <h4 className="font-black text-xl uppercase tracking-tight text-slate-800">{ev.event_name}</h4>
                      <p className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Calendar size={12} className="text-blue-500" /> {ev.start_date} ~ {ev.end_date}
                      </p>
                    </div>
                    <button onClick={async () => {
                      if(window.confirm("Xóa sự kiện này?")) { await supabase.from('Events').delete().eq('event_name', ev.event_name); fetchData(); }
                    }} className="text-slate-200 hover:text-rose-500 p-2"><Trash2 size={20} /></button>
                  </div>
                  <span className="bg-blue-50 text-blue-600 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                    {ev.products.length} SKU Hàng hóa
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'daily_sales' && (
          <div className="space-y-8 animate-in slide-in-from-left-10 duration-500">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="bg-blue-600 p-5 rounded-[1.5rem] text-white shadow-2xl shadow-blue-100">
                  <Upload size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Dữ liệu Doanh thu</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Import file CSV Daily Sale để phân tích</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={clearDailySales} className="text-rose-500 font-black text-[10px] uppercase px-5 py-3 hover:bg-rose-50 rounded-xl transition-all tracking-widest flex items-center gap-2">
                  <RefreshCcw size={14} /> Làm sạch dữ liệu
                </button>
                <input type="file" ref={dailySaleCsvRef} onChange={handleImportDailySale} className="hidden" accept=".csv" />
                <button onClick={() => dailySaleCsvRef.current?.click()} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 shadow-2xl shadow-slate-200 hover:-translate-y-1 transition-all tracking-widest">
                  <FileUp size={18}/> Import CSV Daily Sale
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-fit">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-[0.2em]">Lịch sử nạp liệu (Sales Day)</h4>
                  <div className="space-y-3 max-h-[500px] overflow-auto custom-scrollbar pr-2">
                    {[...new Set(dailySales.map(s => s.sales_day))].sort().reverse().map((date: string) => (
                      <div key={date} className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.2rem] border border-transparent hover:border-blue-100 hover:bg-white transition-all group shadow-sm">
                        <span className="font-black text-xs text-slate-700">{date}</span>
                        <button onClick={() => deleteSalesByDate(date)} className="text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-9 space-y-6">
                <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      placeholder="Tìm Barcode hoặc Tên..." 
                      value={salesSearchTerm} 
                      onChange={e=>setSalesSearchTerm(e.target.value)} 
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                    <Filter size={14} className="text-slate-400" />
                    <select 
                      value={layerFilter} 
                      onChange={e=>setLayerFilter(e.target.value)} 
                      className="bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer text-slate-600"
                    >
                      <option value="all">Tất cả Layer 1</option>
                      {layerOptions.map((l: string) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 px-4">
                    <ArrowDownWideNarrow size={16} />
                    <span className="text-[10px] font-black uppercase">Sắp xếp: Trị giá Giảm dần</span>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-[11px] border-separate border-spacing-0">
                      <thead className="bg-slate-50 sticky top-0 z-10 font-black text-slate-400 uppercase tracking-widest border-b shadow-sm">
                        <tr>
                          <th className="px-8 py-5">Layer 1</th>
                          <th className="px-8 py-5">Barcode</th>
                          <th className="px-8 py-5">Tên sản phẩm</th>
                          <th className="px-8 py-5 text-center">Qty</th>
                          <th className="px-8 py-5 text-right">Trị giá (Excl)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-bold text-slate-600 bg-white">
                        {filteredDailySales.slice(0, 200).map((s: DailySaleRecord, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-4"><span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter">{s.layer1_code}</span></td>
                            <td className="px-8 py-4 font-mono text-slate-400 text-[10px]">{s.barcode}</td>
                            <td className="px-8 py-4 truncate max-w-[280px] text-slate-800">{s.item_name}</td>
                            <td className="px-8 py-4 text-center font-black text-slate-900">{s.qty}</td>
                            <td className="px-8 py-4 text-right font-black text-blue-600">
                              {formatNum(s.amount_excl_tax)}<span className="text-[9px] opacity-30 ml-0.5 font-medium italic">đ</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-16 rounded-[4rem] shadow-2xl flex flex-col items-center gap-8 border-2 border-blue-600 animate-in zoom-in-95">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
            <p className="font-black text-slate-800 text-lg uppercase tracking-[0.3em]">Hệ thống đang xử lý...</p>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-100 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">© 2025 Kohnan Event Analytics - Built with Gemini AI</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Database Connected
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">
              <Sparkles size={12} />
              AI Insights Ready
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
