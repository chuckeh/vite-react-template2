import React, { useState, useMemo, useEffect } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  Upload, LayoutDashboard, Users, PieChart as PieIcon, Settings, 
  Search, Bell, ChevronDown, TrendingUp, DollarSign, Calendar, 
  MapPin, ArrowUpRight, ArrowDownRight, Filter, Download, MoreHorizontal,
  Globe, Target, Table as TableIcon, AlertCircle, Clock, CalendarDays, Hourglass, FileDown,
  Activity, Minus, Maximize2, Minimize2, UserCheck, UserX, UserMinus, Wallet, RefreshCcw, Layers, FileText, Percent, BarChart2, Grid3X3, Lightbulb, TrendingDown, Trophy, List, UserPlus, ShieldCheck, ArrowUp, ArrowDown, Sparkles
} from 'lucide-react';

// --- Farben & Konstanten ---
const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6'];
const STATUS_COLORS = {
  active: '#10b981',   // Emerald
  slipping: '#f59e0b', // Amber
  churned: '#ef4444'   // Red
};

const MONTHS_DE = {
  'Januar': 0, 'Februar': 1, 'März': 2, 'April': 3, 'Mai': 4, 'Juni': 5,
  'Juli': 6, 'August': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Dezember': 11,
  'January': 0, 'February': 1, 'March': 2, 'May': 4, 'June': 5, 'July': 6, 'October': 9, 'December': 11
};
const WEEKDAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// Order for Heatmap (Mo-So)
const HEATMAP_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// Prefixes to strip for Cleaned Campaign View
const CLEAN_PREFIXES = [
  'erotischesexgeschichtenclub_',
  'geilesexstories_',
  'erotikgeschichten-tv_',
  'erotischegeschichten_',
  'sexgeschichten-gratis',
  'SG-geilesexstories',
  // New prefixes from user request
  'sexfilmerocks_', 'lunalove96_', 'carocream_', 'erotischesexgeschichten_', 'heissepornos_',
  'katjakrasavice_', 'carocreamcom_', 'schnuggie91_', 'fotzeinfo_', 'sexgeschichtencom_',
  'sgsexgeschichtengratis_', 'default_', 'sgerotischesexgeschichten_', 'sexgeschichteninfo_',
  'geilesexgeschichten_', 'amateurpornosnet_', 'geschichten_', 'geilesexstories_', 'camgirlportal_',
  'deutschepornosgratis_', 'camsex_', 'onlyfans_', 'pornvideosex_'
];

// Exact cleaned names to ignore in the list (if they appear without a model suffix)
const IGNORED_CLEAN_NAMES = [
  'sexfilmerocks', 'lunalove96', 'carocream', 'erotischesexgeschichten', 'heissepornos',
  'katjakrasavice', 'carocreamcom', 'schnuggie91', 'fotzeinfo', 'sexgeschichtencom',
  'sgsexgeschichtengratis', 'default', 'sgerotischesexgeschichten', 'sexgeschichteninfo',
  'geilesexgeschichten', 'amateurpornosnet', 'geschichten', 'geilesexstories',
  'camgirlportal', 'deutschepornosgratis', 'camsex', 'onlyfans', 'pornvideosex',
  'unbekannt'
];

// --- Hilfsfunktionen ---

const formatCurrency = (value) => 
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const formatPercent = (value) => 
  new Intl.NumberFormat('de-DE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);

const formatDate = (date) => 
  date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

const formatDateTime = (date) => 
  date ? date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const parseAnyDateString = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  const cleanStr = dateString.replace(/"/g, '').trim();

  // 1. ISO Format
  if (cleanStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(cleanStr);
    if (!isNaN(date)) return date;
  }

  // 2. Deutsches Format
  const parts = cleanStr.split(/[\s,.]+/);
  if (parts.length < 3) return null;

  let day, monthIndex, year, hours = 0, minutes = 0;
  const firstPart = parts[0];
  
  if (isNaN(parseInt(firstPart))) {
    const monthName = firstPart;
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
    monthIndex = MONTHS_DE[monthName];
    for (let i = 3; i < parts.length; i++) {
        if (parts[i].includes(':')) {
            const timeParts = parts[i].split(':');
            hours = parseInt(timeParts[0], 10);
            minutes = parseInt(timeParts[1], 10);
            break;
        }
    }
  } else {
    day = parseInt(parts[0], 10);
    monthIndex = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  }

  if (monthIndex === undefined || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year += 2000;
  return new Date(year, monthIndex, day, hours, minutes);
};

// Modified CSV Parser to handle semicolons automatically
const parseCSV = (text) => {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  
  // Detect delimiter (Big7 & Visit-X use ';')
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  
  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
  const result = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = [];
    let inQuotes = false;
    let currentField = '';
    const line = lines[i];
    
    for (let char of line) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delimiter && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else currentField += char;
    }
    row.push(currentField.trim());
    
    if (row.length >= headers.length) { 
      const obj = {};
      headers.forEach((header, index) => {
        // Clean quotes from value
        let val = row[index] ? row[index].replace(/^"|"$/g, '') : '';
        obj[header] = val;
      });
      result.push(obj);
    }
  }
  return result;
};

const fillMonthlyGaps = (monthlyStats) => {
  const data = Object.values(monthlyStats).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  if (data.length === 0) return [];
  const filledData = [];
  const start = new Date(data[0].dateObj);
  const end = new Date(data[data.length - 1].dateObj);
  start.setDate(1);
  end.setDate(1);
  const current = new Date(start);
  while (current <= end) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthlyStats[monthKey];
    if (existing) {
      filledData.push(existing);
    } else {
      filledData.push({
        dateStr: monthKey,
        name: current.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        dateObj: new Date(current),
        revenue: 0,
        commission: 0,
        transactions: 0,
        refunds: 0
      });
    }
    current.setMonth(current.getMonth() + 1);
  }
  return filledData;
};

const downloadCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.click();
};

const getRowUniqueId = (row, type) => {
    // Generate a unique fingerprint for deduplication based on row content
    if (type === 'MDH') return row['Conversion Id']; 
    if (type === 'Big7') return row['TransactionID'] || `${row['User']}-${row['Uhrzeit']}-${row['Provision']}`;
    if (type === 'Visit-X') return `${row['Benutzer']}-${row['Datum']}-${row['Provision']}-${row['Produkt']}`;
    if (type === 'Chaturbate') return `${row['User ID']}-${row['Timestamp']}-${row['Commission']}`;
    return null;
};

// Campaign Name Cleaner
const getCleanedCampaignName = (rawName) => {
  if (!rawName) return 'unbekannt';
  let name = rawName;
  
  // 1. Remove Prefixes (Check logic: startsWith)
  for (const prefix of CLEAN_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.substring(prefix.length);
      break; 
    }
  }
  
  // 2. Remove leading underscore if it was left over (e.g. from sexgeschichten-gratis_xyz if only sexgeschichten-gratis was in list)
  if (name.startsWith('_')) name = name.substring(1);

  // 3. Normalize (remove '-' and lowercase)
  return name.replace(/-/g, '').toLowerCase();
};

// --- Komponenten ---

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      active 
        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
    <span className="font-medium">{label}</span>
    {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
  </button>
);

const StatCard = ({ title, value, subtext, icon: Icon, trend, color = 'indigo', highlight = false }) => {
  const colorStyles = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-500',
    rose: 'bg-rose-500/10 text-rose-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    blue: 'bg-blue-500/10 text-blue-400',
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur border p-6 rounded-2xl transition-colors relative overflow-hidden ${highlight ? 'border-emerald-500/50 shadow-lg shadow-emerald-900/10' : 'border-slate-700/50 hover:border-slate-600'}`}>
      {highlight && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-3xl"></div>}
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colorStyles[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${
            trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <h3 className={`text-sm font-medium ${highlight ? 'text-emerald-200' : 'text-slate-400'}`}>{title}</h3>
        <p className={`font-bold tracking-tight ${highlight ? 'text-4xl text-white' : 'text-2xl text-white'}`}>{value}</p>
        {subtext && <p className="text-xs text-slate-500 whitespace-pre-line">{subtext}</p>}
      </div>
    </div>
  );
};

// Heatmap Cell Component
const HeatmapCell = ({ value, max, label, tooltip }) => {
  const intensity = max > 0 ? value / max : 0;
  return (
    <div 
      className="w-full h-8 rounded-sm relative group transition-all hover:scale-110 hover:z-10"
      style={{
        backgroundColor: `rgba(16, 185, 129, ${0.1 + (intensity * 0.9)})`, 
        border: '1px solid rgba(0,0,0,0.2)'
      }}
    >
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-xs p-2 rounded shadow-xl whitespace-nowrap z-20 border border-slate-700 pointer-events-none">
        <div className="font-bold mb-1 text-emerald-400">{label}</div>
        <div>{tooltip}</div>
      </div>
    </div>
  );
};

// --- Hauptanwendung ---

export default function AnalyticsDashboard() {
  const [rawData, setRawData] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all'); // NEW: Month Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [detectedFormats, setDetectedFormats] = useState(new Set());
  
  // Lists & Filters
  const [userListLimit, setUserListLimit] = useState(100);
  const [transactionLimit, setTransactionLimit] = useState(250);
  const [trackListLimit, setTrackListLimit] = useState(100);
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  
  // Behavior Analysis State
  const [behaviorMetric, setBehaviorMetric] = useState('commission'); 
  const [behaviorDisplay, setBehaviorDisplay] = useState('sum'); 
  const [behaviorChartType, setBehaviorChartType] = useState('heatmap');
  
  // Cleaned Campaigns Monthly State
  const [showMonthlyCleaned, setShowMonthlyCleaned] = useState(false);

  // Sorting State
  const [txSortConfig, setTxSortConfig] = useState({ key: 'date', direction: 'desc' });

  // UI State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUserListMaximized, setIsUserListMaximized] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
      const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setErrorMsg(null);
    setRawData([]);
    setDetectedFormats(new Set());

    if (files.length > 0) {
      setIsProcessing(true);
      
      const promises = files.map(file => {
          return new Promise((resolve, reject) => {
             const reader = new FileReader();
             reader.onload = (e) => resolve(parseCSV(e.target.result));
             reader.onerror = (e) => reject(e);
             reader.readAsText(file);
          });
      });

      try {
          const results = await Promise.all(promises);
          const mergedData = results.flat();
          
          if (mergedData.length === 0) throw new Error("Keine gültigen Daten in den Dateien gefunden.");
          
          const formats = new Set();
          mergedData.slice(0, 100).forEach(row => {
             if (row.hasOwnProperty('Income') && row.hasOwnProperty('Event Type')) formats.add('MDH');
             else if (row.hasOwnProperty('WMS') && row.hasOwnProperty('SubID')) formats.add('Big7');
             else if (row.hasOwnProperty('Produkt') && row.hasOwnProperty('Token')) formats.add('Visit-X');
             else if (row.hasOwnProperty('Commission') || row.hasOwnProperty('Purchase Amount')) formats.add('Chaturbate');
          });
          setDetectedFormats(formats);

          setRawData(mergedData);
      } catch (err) {
          console.error(err);
          setErrorMsg("Fehler beim Verarbeiten der Dateien.");
      }
      setIsProcessing(false);
    }
  };

  // Determine available months from data
  const availableMonths = useMemo(() => {
    const months = new Set();
    rawData.forEach(row => {
        let date = null;
        if (row.hasOwnProperty('Income') && row.hasOwnProperty('Event Type')) date = parseAnyDateString(row['Datetime']);
        else if (row.hasOwnProperty('WMS') && row.hasOwnProperty('SubID')) date = parseAnyDateString(row['Uhrzeit']);
        else if (row.hasOwnProperty('Produkt') && row.hasOwnProperty('Token')) date = parseAnyDateString(row['Datum']);
        else if (row.hasOwnProperty('Commission') || row.hasOwnProperty('Purchase Amount')) date = parseAnyDateString(row['Timestamp']);
        
        if (date) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(monthKey);
        }
    });
    return Array.from(months).sort().reverse();
  }, [rawData]);

  const processedData = useMemo(() => {
    if (rawData.length === 0) return null;

    let filteredRows = rawData;
    const now = new Date();
    const currentYear = now.getFullYear();

    let totalRevenue = 0;
    let totalCommission = 0;
    let totalRefunds = 0;
    let totalRefundCount = 0;
    const usersSet = new Set();
    const countryStats = {};
    const trackStats = {};
    const cleanedTrackStats = {}; 
    const cleanedTrackStatsMonthly = {}; // For Monthly Breakdown
    const monthlyStats = {};
    const userSpending = {};
    
    // Time Stats
    const hourStats = Array(24).fill(0).map((_, i) => ({ hour: i, count: 0, revenue: 0, commission: 0 }));
    const weekdayStats = Array(7).fill(0).map((_, i) => ({ day: WEEKDAYS_DE[i], count: 0, revenue: 0, commission: 0 }));
    const heatmapStats = Array(7).fill(0).map(() => Array(24).fill(0).map(() => ({ revenue: 0, commission: 0, count: 0 })));
    
    // Signups Stats
    const signupList = [];
    const signupMonthlyStats = {};
    const signupCampaigns = {};

    // Time Blocks (6 Steps of 4 Hours)
    const timeBlocks = [
        { label: '00-04 Nacht', range: [0, 1, 2, 3], count: 0, revenue: 0, commission: 0 },
        { label: '04-08 Morgen', range: [4, 5, 6, 7], count: 0, revenue: 0, commission: 0 },
        { label: '08-12 Vormittag', range: [8, 9, 10, 11], count: 0, revenue: 0, commission: 0 },
        { label: '12-16 Nachmittag', range: [12, 13, 14, 15], count: 0, revenue: 0, commission: 0 },
        { label: '16-20 Abend', range: [16, 17, 18, 19], count: 0, revenue: 0, commission: 0 },
        { label: '20-24 Spätabend', range: [20, 21, 22, 23], count: 0, revenue: 0, commission: 0 },
    ];

    const transactionList = [];
    let minDate = null;
    let maxDate = null;
    const churnBuckets = {};
    
    // Deduplication Set
    const processedTransactionIds = new Set();
    let duplicatesSkipped = 0;

    filteredRows.forEach((row, idx) => {
      let amount = 0;
      let commission = 0;
      let date = null;
      let signupDate = null;
      let userId = '';
      let country = 'Unbekannt';
      let track = 'Ohne Kampagne';
      let isRefund = false;
      let isSignup = false;
      let formatType = '';

      // --- Format Parsing ---
      if (row.hasOwnProperty('Income') && row.hasOwnProperty('Event Type')) {
        formatType = 'MDH';
        const incomeStr = (row['Income'] || '0').replace(',', '.');
        const income = parseFloat(incomeStr) || 0;
        commission = income; 
        if (row['Event Type'] === 'Sign-up') {
            isSignup = true;
        } else {
            if (commission < 0) isRefund = true;
            amount = commission / 0.35; // 35% share
        }
        date = parseAnyDateString(row['Datetime']);
        userId = row['Member Username'] || row['User ID'];
        track = row['Campaign'] || 'Ohne Kampagne';
        country = 'Global/Unbekannt'; 
      } else if (row.hasOwnProperty('WMS') && row.hasOwnProperty('SubID')) {
        formatType = 'Big7';
        const provStr = (row['Provision'] || '0').replace(',', '.');
        commission = parseFloat(provStr) || 0;
        
        if (row['Typ'] === 'SALE') {
             amount = commission / 0.30; // 30% share
        } else if (row['Typ'] === 'SOI' || row['Typ'] === 'LEAD') {
             amount = 0;
             isSignup = true;
        } else {
             amount = 0; 
        }
        date = parseAnyDateString(row['Uhrzeit']);
        userId = row['User'];
        track = row['SubID'] || 'Ohne Kampagne';
        country = 'Unbekannt'; 
      } else if (row.hasOwnProperty('Produkt') && row.hasOwnProperty('Token')) {
        formatType = 'Visit-X';
        const provStr = (row['Provision'] || '0').replace(',', '.');
        commission = parseFloat(provStr) || 0;
        amount = commission / 0.38; // 38% share
        date = parseAnyDateString(row['Datum']);
        userId = row['Benutzer'] || row['User ID'];
        track = row['Kampagne'] || row['Additional ID'] || 'Ohne Kampagne';
        country = 'Unbekannt';
      } else if (row.hasOwnProperty('Commission') || row.hasOwnProperty('Purchase Amount')) {
        formatType = 'Chaturbate';
        let amountStr = (row['Purchase Amount'] || '0').toString();
        let commStr = (row['Commission'] || '0').toString();
        if (amountStr.includes(',') && !amountStr.includes('.')) amountStr = amountStr.replace(',', '.');
        if (commStr.includes(',') && !commStr.includes('.')) commStr = commStr.replace(',', '.');
        amount = parseFloat(amountStr) || 0;
        commission = parseFloat(commStr) || 0;
        date = parseAnyDateString(row['Timestamp']);
        signupDate = parseAnyDateString(row['Signup Date']);
        userId = row['User ID'];
        country = row['Country'] || 'Unbekannt';
        track = row['Track'] || 'Ohne Kampagne';
        if (commission < 0 || amount < 0) isRefund = true;
      }
      
      if (!date) return;

      // --- Deduplication Check ---
      const uniqueId = getRowUniqueId(row, formatType);
      if (uniqueId) {
          if (processedTransactionIds.has(uniqueId)) {
              duplicatesSkipped++;
              return; // Skip Duplicate
          }
          processedTransactionIds.add(uniqueId);
      }

      // --- DATE FILTERING LOGIC ---
      const filterPass = () => {
        // 1. Specific Month Filter (Priority)
        if (selectedMonth !== 'all') {
            const rowMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return rowMonth === selectedMonth;
        }

        // 2. Range Filter (Fallback)
        if (dateFilter === 'all') return true;
        if (dateFilter === 'ytd') return date.getFullYear() === currentYear;
        if (dateFilter === '12m') {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(now.getFullYear() - 1);
          return date >= oneYearAgo;
        }
        return true;
      };

      if (!filterPass()) return;

      // Update Time Range
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      // --- Handle Signups ---
      if (isSignup) {
          signupList.push({ date, userId, track });
          
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!signupMonthlyStats[monthKey]) {
              signupMonthlyStats[monthKey] = {
                  dateStr: monthKey,
                  name: date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
                  count: 0
              };
          }
          signupMonthlyStats[monthKey].count += 1;

          if (!signupCampaigns[track]) signupCampaigns[track] = 0;
          signupCampaigns[track] += 1;

          return; // Stop processing revenue for pure signups
      }

      // --- Filter 0 EUR Transactions (if not a signup) ---
      if (Math.abs(amount) < 0.01 && Math.abs(commission) < 0.01) return;

      // --- Aggregation ---
      totalRevenue += amount;
      totalCommission += commission;
      if (isRefund) {
          totalRefunds += Math.abs(commission);
          totalRefundCount += 1;
      }
      
      if (userId) usersSet.add(userId);

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { 
          dateStr: monthKey, dateObj: new Date(date.getFullYear(), date.getMonth(), 1),
          name: date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }), revenue: 0, commission: 0, transactions: 0, refunds: 0 
        };
      }
      monthlyStats[monthKey].revenue += amount;
      monthlyStats[monthKey].commission += commission;
      monthlyStats[monthKey].transactions += 1;
      if (isRefund) monthlyStats[monthKey].refunds += Math.abs(commission);

      const hour = date.getHours();
      const jsDay = date.getDay(); // 0=Sun
      const adjDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 6=Sun

      hourStats[hour].count += 1;
      hourStats[hour].revenue += amount;
      hourStats[hour].commission += commission;

      weekdayStats[jsDay].count += 1;
      weekdayStats[jsDay].revenue += amount;
      weekdayStats[jsDay].commission += commission;

      // Heatmap
      if (heatmapStats[adjDay] && heatmapStats[adjDay][hour]) {
          heatmapStats[adjDay][hour].revenue += amount;
          heatmapStats[adjDay][hour].commission += commission;
          heatmapStats[adjDay][hour].count += 1;
      }

      // Time Blocks
      const blockIndex = Math.floor(hour / 4);
      if (timeBlocks[blockIndex]) {
          timeBlocks[blockIndex].count += 1;
          timeBlocks[blockIndex].revenue += amount;
          timeBlocks[blockIndex].commission += commission;
      }

      if (!countryStats[country]) countryStats[country] = { name: country, revenue: 0, commission: 0, count: 0 };
      countryStats[country].revenue += amount;
      countryStats[country].commission += commission;
      countryStats[country].count += 1;

      // Track Quality Stats
      if (!trackStats[track]) trackStats[track] = { 
          name: track, revenue: 0, commission: 0, count: 0, 
          refundCount: 0, refundAmount: 0 
      };
      trackStats[track].revenue += amount;
      trackStats[track].commission += commission;
      trackStats[track].count += 1;
      if (isRefund) {
          trackStats[track].refundCount += 1;
          trackStats[track].refundAmount += Math.abs(commission);
      }

      // NEW: Cleaned Track Stats
      const cleanName = getCleanedCampaignName(track);
      if (!IGNORED_CLEAN_NAMES.includes(cleanName)) {
        // Aggregate Total
        if (!cleanedTrackStats[cleanName]) cleanedTrackStats[cleanName] = { 
            name: cleanName, revenue: 0, commission: 0, count: 0,
            refundCount: 0, refundAmount: 0
        };
        cleanedTrackStats[cleanName].revenue += amount;
        cleanedTrackStats[cleanName].commission += commission;
        cleanedTrackStats[cleanName].count += 1;
        if (isRefund) {
            cleanedTrackStats[cleanName].refundCount += 1;
            cleanedTrackStats[cleanName].refundAmount += Math.abs(commission);
        }

        // Aggregate Monthly
        const cleanMonthKey = `${cleanName}|${monthKey}`;
        if (!cleanedTrackStatsMonthly[cleanMonthKey]) {
            cleanedTrackStatsMonthly[cleanMonthKey] = {
                name: cleanName,
                sortDate: monthKey,
                displayDate: date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
                revenue: 0, commission: 0, count: 0,
                refundCount: 0, refundAmount: 0
            };
        }
        cleanedTrackStatsMonthly[cleanMonthKey].revenue += amount;
        cleanedTrackStatsMonthly[cleanMonthKey].commission += commission;
        cleanedTrackStatsMonthly[cleanMonthKey].count += 1;
        if (isRefund) {
            cleanedTrackStatsMonthly[cleanMonthKey].refundCount += 1;
            cleanedTrackStatsMonthly[cleanMonthKey].refundAmount += Math.abs(commission);
        }
      }

      transactionList.push({
          id: `tx-${idx}-${Math.random()}`,
          date, userId, country, track, amount, commission, isRefund
      });

      if (userId) {
        if (!userSpending[userId]) {
          userSpending[userId] = { 
            id: userId, country: country, track: track,
            totalSpent: 0, totalCommission: 0, txCount: 0, signupDate: signupDate,
            transactions: []
          };
        }
        userSpending[userId].totalSpent += amount;
        userSpending[userId].totalCommission += commission;
        userSpending[userId].txCount += 1;
        userSpending[userId].transactions.push({ date, amount, commission });
      }
    });

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const conversionTimes = [];
    const safeMaxDate = maxDate || new Date();
    
    // We don't pre-sort transactionList here anymore to save memo time, we sort in the useMemo below
    // But we need to sort signupList
    signupList.sort((a,b) => b.date - a.date);

    let activeCount = 0;
    let slippingCount = 0;
    let churnedCount = 0; 
    let potentialLostRevenue = 0;

    // CLV Buckets
    const clvBuckets = { '0-10€': 0, '10-50€': 0, '50-100€': 0, '100-500€': 0, '500€+': 0 };

    const enrichedUsers = Object.values(userSpending).map(user => {
        user.transactions.sort((a,b) => a.date - b.date);
        const firstSpend = user.transactions[0]?.date || null;
        const lastActive = user.transactions[user.transactions.length - 1]?.date || null;
        const effectiveSignup = user.signupDate || firstSpend;

        const comm30d = user.transactions
            .filter(t => t.date >= new Date(safeMaxDate.getTime() - thirtyDaysMs))
            .reduce((sum, t) => sum + t.commission, 0);

        const commPrev30d = user.transactions
            .filter(t => t.date >= new Date(safeMaxDate.getTime() - 2 * thirtyDaysMs) && t.date < new Date(safeMaxDate.getTime() - thirtyDaysMs))
            .reduce((sum, t) => sum + t.commission, 0);
        
        let trend = 'flat';
        if (comm30d > commPrev30d * 1.1) trend = 'up';
        else if (comm30d < commPrev30d * 0.9) trend = 'down';

        const daysSinceLast = lastActive ? Math.floor((safeMaxDate - lastActive) / (1000 * 60 * 60 * 24)) : -1;
        let daysToFirst = 0;
        if (effectiveSignup && firstSpend && user.signupDate) {
             daysToFirst = Math.ceil(Math.abs(firstSpend - user.signupDate) / (1000 * 60 * 60 * 24));
        }
        if (daysToFirst >= 0 && daysToFirst < 3650 && user.signupDate) conversionTimes.push(daysToFirst);

        const avgComm = user.txCount > 0 ? user.totalCommission / user.txCount : 0;
        
        let status = 'active'; 
        if (daysSinceLast > 120) status = 'churned';
        else if (daysSinceLast > 60) status = 'slipping';
        
        if (status === 'active') activeCount++;
        else if (status === 'slipping') slippingCount++;
        else {
            churnedCount++;
            potentialLostRevenue += avgComm;
        }

        if (lastActive) {
            const lastActiveKey = `${lastActive.getFullYear()}-${String(lastActive.getMonth() + 1).padStart(2, '0')}`;
            if (!churnBuckets[lastActiveKey]) churnBuckets[lastActiveKey] = { name: lastActiveKey, count: 0 };
            churnBuckets[lastActiveKey].count += 1;
        }

        // CLV Distribution
        const val = user.totalCommission;
        if (val < 10) clvBuckets['0-10€']++;
        else if (val < 50) clvBuckets['10-50€']++;
        else if (val < 100) clvBuckets['50-100€']++;
        else if (val < 500) clvBuckets['100-500€']++;
        else clvBuckets['500€+']++;
        
        return { 
          ...user, firstSpend, lastActive, comm30d, trend, daysSinceLast, daysToFirst, avgComm, status,
          signupDate: effectiveSignup 
        };
    });

    const avgConversionDays = conversionTimes.length > 0 ? (conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length).toFixed(1) : 0;
    const churnTimelineData = Object.values(churnBuckets).sort((a,b) => a.name.localeCompare(b.name));
    
    // Prepare CLV Chart Data
    const clvData = Object.keys(clvBuckets).map(key => ({ name: key, count: clvBuckets[key] }));

    // Prepare Quality/Refund Data
    const qualityData = Object.values(trackStats)
        .filter(t => t.count > 5) // Min 5 transactions to be relevant
        .map(t => ({
            name: t.name,
            refundRate: (t.refundCount / t.count) * 100,
            refundAmount: t.refundAmount,
            totalCommission: t.commission, // Net
            count: t.count
        }))
        .sort((a,b) => b.refundRate - a.refundRate)
        .slice(0, 20); // Top 20 worst

    // Calculate Best Hours/Days
    const topHours = [...hourStats].sort((a,b) => b.commission - a.commission).slice(0, 3);
    const topDays = [...weekdayStats].sort((a,b) => b.commission - a.commission).slice(0, 3);
    
    // Calculate Best Time per Day
    const bestTimePerDay = heatmapStats.map((dayHours, idx) => {
        const bestHour = dayHours.reduce((max, curr, hIdx) => curr.commission > max.commission ? {...curr, hour: hIdx} : max, {commission: -1, hour: 0});
        return { day: HEATMAP_DAYS[idx], hour: bestHour.hour, val: bestHour.commission };
    });

    // Prepare Signup Stats
    const signupTimelineData = Object.values(signupMonthlyStats).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    const topSignupCampaigns = Object.entries(signupCampaigns)
        .map(([name, count]) => ({ name, count }))
        .sort((a,b) => b.count - a.count)
        .slice(0, 10);

    return {
      totalRevenue, totalCommission, totalRefunds, totalRefundCount, totalTx: filteredRows.length, uniqueUsers: usersSet.size,
      aov: totalRevenue / (filteredRows.length || 1), avgConversionDays,
      monthlyData: fillMonthlyGaps(monthlyStats),
      countryData: Object.values(countryStats).sort((a, b) => b.commission - a.commission), 
      trackData: Object.values(trackStats).sort((a, b) => b.commission - a.commission), 
      cleanedTrackData: Object.values(cleanedTrackStats).sort((a, b) => b.commission - a.commission),
      cleanedTrackDataMonthly: Object.values(cleanedTrackStatsMonthly).sort((a, b) => b.sortDate.localeCompare(a.sortDate) || b.commission - a.commission),
      topUsers: enrichedUsers.sort((a, b) => b.totalCommission - a.totalCommission), 
      hourStats, weekdayStats, heatmapStats, transactionList, clvData, qualityData, timeBlocks, topHours, topDays, bestTimePerDay,
      signupList, signupTimelineData, topSignupCampaigns, duplicatesSkipped,
      dateRange: { min: minDate, max: maxDate },
      churnStats: { active: activeCount, slipping: slippingCount, churned: churnedCount, lostRevenue: potentialLostRevenue, timeline: churnTimelineData }
    };
  }, [rawData, dateFilter, selectedMonth]);

  // --- Sorting Logic for Transactions ---
  const handleTxSort = (key) => {
    let direction = 'desc';
    if (txSortConfig.key === key && txSortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setTxSortConfig({ key, direction });
  };

  const sortedTransactions = useMemo(() => {
      if (!processedData) return [];
      const data = [...processedData.transactionList];
      
      return data.sort((a, b) => {
          let aVal = a[txSortConfig.key];
          let bVal = b[txSortConfig.key];

          // Handle string case
          if (typeof aVal === 'string') aVal = aVal.toLowerCase();
          if (typeof bVal === 'string') bVal = bVal.toLowerCase();

          if (aVal < bVal) return txSortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return txSortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [processedData, txSortConfig]);


  const handleExportTransactions = () => {
    if (!processedData) return;
    const dataToExport = sortedTransactions.slice(0, transactionLimit === 'all' ? undefined : 5000).map(t => ({
      Date: formatDateTime(t.date),
      Type: t.isRefund ? 'REFUND' : 'PURCHASE',
      UserID: t.userId,
      Commission: t.commission.toFixed(2),
      Revenue: t.amount.toFixed(2),
      Track: t.track,
      Country: t.country
    }));
    downloadCSV(dataToExport, `transactions_export.csv`);
  };

  const handleExportUsers = () => {
    if (!processedData) return;
    const dataToExport = processedData.topUsers.slice(0, userListLimit).map(u => ({
      Rank: processedData.topUsers.indexOf(u) + 1,
      UserID: u.id,
      Status: u.status.toUpperCase(),
      Country: u.country,
      Kampagne: u.track,
      MyCommission: u.totalCommission.toFixed(2),
      Transactions: u.txCount,
      SignupDate: formatDate(u.signupDate),
      LastSeen: formatDate(u.lastActive),
      DaysSince: u.daysSinceLast
    }));
    downloadCSV(dataToExport, `user_list_commission_export.csv`);
  };

  const handleExportCampaigns = () => {
    if (!processedData) return;
    const dataToExport = processedData.trackData.slice(0, trackListLimit).map(t => ({
      Campaign: t.name, MyCommission: t.commission.toFixed(2), PlatformRevenue: t.revenue.toFixed(2), Sales: t.count
    }));
    downloadCSV(dataToExport, `campaigns_commission_export.csv`);
  };

  const handleExportCleanedCampaigns = () => {
    if (!processedData) return;
    const dataSource = showMonthlyCleaned ? processedData.cleanedTrackDataMonthly : processedData.cleanedTrackData;
    const dataToExport = dataSource.slice(0, trackListLimit).map(t => ({
      CleanedCampaign: t.name, 
      Month: t.displayDate || 'Total',
      MyCommission: t.commission.toFixed(2), 
      PlatformRevenue: t.revenue.toFixed(2), 
      Sales: t.count
    }));
    downloadCSV(dataToExport, `models_cleaned_export.csv`);
  };

  if (!processedData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Upload className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">RevStat</h1>
          <p className="text-slate-400 mb-6">
            Unterstützt Multi-Upload (Chaturbate, MDH, Big7, Visit-X)<br/>
            <span className="text-xs text-slate-500">Du kannst mehrere CSV Dateien gleichzeitig wählen.</span>
          </p>
          {errorMsg && <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm"><AlertCircle className="w-4 h-4 inline mr-2" />{errorMsg}</div>}
          <label className="block w-full cursor-pointer group">
            <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            <div className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 group-hover:scale-[1.02]">
              <Upload className="w-5 h-5" />Dateien Auswählen
            </div>
          </label>
        </div>
      </div>
    );
  }

  const displayedUsers = processedData.topUsers
    .filter(u => u.id.includes(searchQuery))
    .filter(u => userStatusFilter === 'all' || u.status === userStatusFilter)
    .slice(0, userListLimit);

  // Helper for Behavior Charts
  const getBehaviorValue = (item) => {
      const val = behaviorMetric === 'commission' ? item.commission : item.revenue;
      if (behaviorDisplay === 'sum') return val;
      const total = behaviorMetric === 'commission' ? processedData.totalCommission : processedData.totalRevenue;
      return total > 0 ? (val / total) * 100 : 0;
  };

  const getHeatmapMax = () => {
      let max = 0;
      processedData.heatmapStats.forEach(day => day.forEach(hour => {
          const val = getBehaviorValue(hour);
          if (val > max) max = val;
      }));
      return max;
  };
  const heatmapMax = getHeatmapMax();

  // Helper for Sort Header
  const SortableHeader = ({ label, sortKey, align = 'left' }) => (
      <th 
        className={`p-3 bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-lg cursor-pointer hover:text-white transition-colors text-${align}`}
        onClick={() => handleTxSort(sortKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          {label}
          {txSortConfig.key === sortKey && (
             txSortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>
          )}
        </div>
      </th>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingUp className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">IQ Stats</h1>
            <span className="text-xs text-slate-500 font-medium">Provision Dashboard</span>
          </div>
        </div>
        <div className="space-y-2 flex-1">
          <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hauptmenü</p>
          <SidebarItem icon={LayoutDashboard} label="Übersicht" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} />
          <SidebarItem icon={UserMinus} label="Churn Analyse" active={activeView === 'churn'} onClick={() => setActiveView('churn')} />
          <SidebarItem icon={Lightbulb} label="Insights & Qualität" active={activeView === 'insights'} onClick={() => setActiveView('insights')} />
          <SidebarItem icon={UserPlus} label="Signups (Leads)" active={activeView === 'signups'} onClick={() => setActiveView('signups')} />
          <SidebarItem icon={Clock} label="Zeit & Verhalten" active={activeView === 'behavior'} onClick={() => setActiveView('behavior')} />
          <SidebarItem icon={FileText} label="Transaktionen" active={activeView === 'transactions'} onClick={() => setActiveView('transactions')} />
          <SidebarItem icon={Globe} label="Länder" active={activeView === 'geo'} onClick={() => setActiveView('geo')} />
          <SidebarItem icon={Target} label="Kampagnen" active={activeView === 'campaigns'} onClick={() => setActiveView('campaigns')} />
          <SidebarItem icon={Sparkles} label="Modelle (Bereinigt)" active={activeView === 'cleaned_campaigns'} onClick={() => setActiveView('cleaned_campaigns')} />
          <SidebarItem icon={Users} label="Top User" active={activeView === 'users'} onClick={() => setActiveView('users')} />
        </div>
        <div className="mt-auto bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
           <div className="flex items-start gap-3">
             <div className="text-xs text-slate-400 w-full">
               <p className="font-bold text-slate-300 mb-1 flex items-center gap-2">
                 <Layers className="w-3 h-3 text-emerald-400" />
                 Formate & Status
               </p>
               <p className="mb-1 flex flex-wrap gap-1">
                 {Array.from(detectedFormats).map(f => (
                   <span key={f} className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-white">{f}</span>
                 ))}
                 {detectedFormats.size === 0 && <span>Keine erkannt</span>}
               </p>
               <div className="mt-2 border-t border-slate-700 pt-1 text-[10px] text-slate-500 space-y-1">
                 <p className="flex justify-between"><span>Transaktionen:</span> <span>{processedData.totalTx}</span></p>
                 {processedData.duplicatesSkipped > 0 && (
                    <p className="flex justify-between text-amber-400"><span>Duplikate (Skip):</span> <span>{processedData.duplicatesSkipped}</span></p>
                 )}
               </div>
             </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center justify-between px-8 z-20 shrink-0">
          <h2 className="text-xl font-bold text-white hidden sm:block">
            {activeView === 'dashboard' && 'Dashboard Übersicht'}
            {activeView === 'users' && 'Top Spender (Provision)'}
            {activeView === 'churn' && 'Churn & Retention Analyse'}
            {activeView === 'campaigns' && 'Kampagnen (Provision)'}
            {activeView === 'cleaned_campaigns' && 'Modelle & Kampagnen (Bereinigt)'}
            {activeView === 'geo' && 'Geo (Provision)'}
            {activeView === 'behavior' && 'Zeit & Kaufverhalten'}
            {activeView === 'transactions' && 'Transaktions-Liste'}
            {activeView === 'insights' && 'Insights & Qualität'}
            {activeView === 'signups' && 'Signups (Leads)'}
          </h2>
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-1 border border-slate-800">
               <select 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-medium px-2 py-1.5 rounded outline-none border-none cursor-pointer hover:bg-slate-800"
               >
                   <option value="all">Alle Monate</option>
                   {availableMonths.map(month => (
                       <option key={month} value={month}>{month}</option>
                   ))}
               </select>
               {selectedMonth === 'all' && (
                  <div className="flex border-l border-slate-700 pl-2 ml-1">
                    <button onClick={() => setDateFilter('all')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>Max</button>
                    <button onClick={() => setDateFilter('12m')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateFilter === '12m' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>1 Jahr</button>
                    <button onClick={() => setDateFilter('ytd')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${dateFilter === 'ytd' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>YTD</button>
                  </div>
               )}
            </div>
            <button onClick={toggleFullscreen} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700" title="Vollbild umschalten">
               {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700">
               <Upload className="w-4 h-4 text-slate-300" />
               <input type="file" accept=".csv" multiple onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {activeView === 'dashboard' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Deine Provision (Netto)" 
                  value={formatCurrency(processedData.totalCommission)} 
                  subValue={`aus ${formatCurrency(processedData.totalRevenue)} Umsatz\n(Nach Storno-Abzug)`} 
                  icon={Wallet} 
                  color="emerald" 
                  highlight={true} 
                  trend="up"
                />
                <StatCard title="Aktive User" value={processedData.churnStats.active} subValue="Kauf < 60 Tage" icon={UserCheck} color="indigo"/>
                <StatCard title="Ø Warenkorb" value={formatCurrency(processedData.aov)} subValue="Umsatz pro Kauf" icon={PieIcon} color="rose"/>
                <StatCard title="Storno Quote" value={`${((processedData.totalRefundCount / processedData.totalTx) * 100).toFixed(1)}%`} subValue={`${formatCurrency(processedData.totalRefunds)} Volumen`} icon={AlertCircle} color="amber"/>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-6">Provisions-Verlauf</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.monthlyData}>
                        <defs><linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} axisLine={false} tickLine={false} minTickGap={30}/>
                        <YAxis stroke="#64748b" tick={{fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `€${val}`} />
                        <RechartsTooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} itemStyle={{color: '#e2e8f0'}} formatter={(value, name) => [formatCurrency(value), name === 'commission' ? 'Provision' : 'Plattform Umsatz']}/>
                        <Area type="monotone" dataKey="commission" name="Provision" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorComm)" />
                        <Area type="monotone" dataKey="revenue" name="Plattform Umsatz" stroke="#6366f1" strokeWidth={1} fillOpacity={0} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'churn' && (
             <div className="space-y-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Aktive User" value={processedData.churnStats.active} subValue="Kauf < 60 Tage" icon={UserCheck} color="emerald" />
                    <StatCard title="Gefährdet (Slipping)" value={processedData.churnStats.slipping} subValue="Kauf vor 60-120 Tagen" icon={AlertCircle} color="amber" />
                    <StatCard title="Verlorenes Potenzial" value={formatCurrency(processedData.churnStats.lostRevenue)} subValue="Geschätzter Umsatz durch Churn" icon={UserMinus} color="rose" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <h3 className="text-lg font-bold text-white mb-6">User Status Verteilung</h3>
                      <div className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                               <Pie data={[{name: 'Active', value: processedData.churnStats.active, color: STATUS_COLORS.active},{name: 'Slipping', value: processedData.churnStats.slipping, color: STATUS_COLORS.slipping},{name: 'Churned', value: processedData.churnStats.churned, color: STATUS_COLORS.churned}]} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                                  {[{name: 'Active', value: processedData.churnStats.active, color: STATUS_COLORS.active},{name: 'Slipping', value: processedData.churnStats.slipping, color: STATUS_COLORS.slipping},{name: 'Churned', value: processedData.churnStats.churned, color: STATUS_COLORS.churned}].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />)}
                               </Pie>
                               <RechartsTooltip />
                               <Legend verticalAlign="middle" align="right" layout="vertical" />
                            </PieChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <h3 className="text-lg font-bold text-white mb-6">"Der Friedhof": Wann wurden User inaktiv?</h3>
                      <p className="text-xs text-slate-400 mb-4">Zeigt an, in welchem Monat User ihren *letzten* Kauf getätigt haben.</p>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={processedData.churnStats.timeline.slice(-12)}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 10}} />
                              <YAxis stroke="#64748b" hide />
                              <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                              <Bar dataKey="count" fill="#64748b" name="Zuletzt aktiv" radius={[4, 4, 0, 0]} />
                           </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                </div>
             </div>
          )}

          {activeView === 'signups' && (
            <div className="space-y-6 max-w-7xl mx-auto">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard title="Gesamt Signups" value={processedData.signupList.length} subValue="Erfasste kostenlose Anmeldungen" icon={UserPlus} color="blue" />
                  <StatCard title="Ø Signups / Tag" value={(processedData.signupList.length / (processedData.monthlyData.length * 30 || 1)).toFixed(1)} subValue="Durchschnitt" icon={Activity} color="indigo" />
                  <StatCard title="Aktive Kampagnen" value={processedData.topSignupCampaigns.length} subValue="Mit mindestens 1 Signup" icon={Target} color="emerald" />
               </div>

               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-6">Signups (Leads) Verlauf</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.signupTimelineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} />
                        <YAxis stroke="#64748b" hide />
                        <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                        <Bar dataKey="count" fill="#3b82f6" name="Signups" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                     <h3 className="text-lg font-bold text-white mb-4">Top Kampagnen (Leads)</h3>
                     <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-950 text-slate-400 text-xs uppercase sticky top-0">
                              <tr>
                                 <th className="p-3">Kampagne</th>
                                 <th className="p-3 text-right">Anzahl</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800">
                              {processedData.topSignupCampaigns.map((camp, i) => (
                                 <tr key={i} className="hover:bg-slate-800/50">
                                    <td className="p-3 font-mono text-blue-300">{camp.name}</td>
                                    <td className="p-3 text-right font-bold text-white">{camp.count}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                     <h3 className="text-lg font-bold text-white mb-4">Letzte Anmeldungen</h3>
                     <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-950 text-slate-400 text-xs uppercase sticky top-0">
                              <tr>
                                 <th className="p-3">Datum</th>
                                 <th className="p-3">User</th>
                                 <th className="p-3 text-right">Kampagne</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-800">
                              {processedData.signupList.slice(0, 50).map((signup, i) => (
                                 <tr key={i} className="hover:bg-slate-800/50">
                                    <td className="p-3 text-slate-400">{formatDate(signup.date)}</td>
                                    <td className="p-3 text-white">{signup.userId}</td>
                                    <td className="p-3 text-right text-slate-500 text-xs">{signup.track}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeView === 'insights' && (
            <div className="space-y-6 max-w-7xl mx-auto">
               {/* CLV Distribution */}
               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                     <Users className="w-5 h-5 text-indigo-400" />
                     Kunden-Wert Verteilung (CLV Histogramm)
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">Wie viele Kunden befinden sich in welchem "Spending-Bucket"?</p>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.clvData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" hide />
                        <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Anzahl User" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* Quality Check Table */}
               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                     <TrendingDown className="w-5 h-5 text-rose-400" />
                     Storno-Radar: Top 20 Kampagnen mit Stornos
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">Kampagnen mit den höchsten Storno-Quoten (min. 5 Sales).</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-800">
                        <tr>
                          <th className="p-3">Kampagne</th>
                          <th className="p-3 text-right">Storno-Quote</th>
                          <th className="p-3 text-right">Storno-Volumen</th>
                          <th className="p-3 text-right">Netto Provision</th>
                          <th className="p-3 text-right">Gesamt Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm">
                        {processedData.qualityData.map((track, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-mono text-indigo-400 font-medium">{track.name}</td>
                            <td className="p-3 text-right">
                               <span className={`px-2 py-1 rounded text-xs font-bold ${
                                   track.refundRate > 20 ? 'bg-rose-500/20 text-rose-400' : 
                                   track.refundRate > 10 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-300'
                               }`}>
                                   {track.refundRate.toFixed(1)}%
                               </span>
                            </td>
                            <td className="p-3 text-right text-rose-400 font-medium">-{formatCurrency(track.refundAmount)}</td>
                            <td className="p-3 text-right text-emerald-400 font-medium">{formatCurrency(track.totalCommission)}</td>
                            <td className="p-3 text-right text-slate-300">{track.count}</td>
                          </tr>
                        ))}
                        {processedData.qualityData.length === 0 && (
                            <tr><td colSpan="5" className="p-4 text-center text-slate-500">Keine Stornos gefunden.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}

          {activeView === 'behavior' && (
            <div className="space-y-6 max-w-7xl mx-auto">
               <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                  <div className="flex flex-col">
                    <h3 className="text-white font-bold flex items-center gap-2"><Settings className="w-4 h-4"/> Analyse Einstellungen</h3>
                    <p className="text-xs text-slate-400 mt-1">Wähle Metrik & Darstellung für Charts & Heatmap</p>
                  </div>
                  <div className="flex gap-4">
                     <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => setBehaviorChartType('heatmap')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${behaviorChartType === 'heatmap' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><Grid3X3 className="w-3 h-3"/> Heatmap</button>
                        <button onClick={() => setBehaviorChartType('bars')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${behaviorChartType === 'bars' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><BarChart2 className="w-3 h-3"/> Charts</button>
                        <button onClick={() => setBehaviorChartType('tables')} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${behaviorChartType === 'tables' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><List className="w-3 h-3"/> Tabellen</button>
                     </div>
                     <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-700">
                        <button onClick={() => setBehaviorMetric('commission')} className={`px-3 py-1.5 rounded text-xs font-medium ${behaviorMetric === 'commission' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>Provision</button>
                        <button onClick={() => setBehaviorMetric('revenue')} className={`px-3 py-1.5 rounded text-xs font-medium ${behaviorMetric === 'revenue' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Umsatz</button>
                     </div>
                  </div>
               </div>

               {/* HEATMAP VIEW */}
               {behaviorChartType === 'heatmap' && (
                 <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-x-auto">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Grid3X3 className="w-5 h-5 text-emerald-400" />
                        Heatmap: {behaviorMetric === 'commission' ? 'Provision' : 'Umsatz'} Intensität
                    </h3>
                    <div className="min-w-[800px]">
                      {/* Header (Hours) */}
                      <div className="grid grid-cols-[50px_repeat(24,_1fr)] gap-1 mb-2">
                         <div className="text-xs text-slate-500 font-bold">Zeit</div>
                         {Array.from({length: 24}).map((_, i) => (
                           <div key={i} className="text-[10px] text-slate-500 text-center">{i}h</div>
                         ))}
                      </div>
                      
                      {/* Rows (Days) */}
                      {processedData.heatmapStats.map((dayData, dayIdx) => (
                        <div key={dayIdx} className="grid grid-cols-[50px_repeat(24,_1fr)] gap-1 mb-1 items-center">
                           <div className="text-xs text-slate-400 font-medium">{HEATMAP_DAYS[dayIdx]}</div>
                           {dayData.map((hourData, hourIdx) => (
                             <HeatmapCell 
                               key={hourIdx} 
                               value={getBehaviorValue(hourData)} 
                               max={heatmapMax} 
                               label={`${HEATMAP_DAYS[dayIdx]}, ${hourIdx}:00 Uhr`}
                               tooltip={`${formatCurrency(behaviorMetric === 'commission' ? hourData.commission : hourData.revenue)} (${hourData.count} Tx)`}
                             />
                           ))}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end items-center gap-2 text-xs text-slate-500">
                       <span>Wenig</span>
                       <div className="w-24 h-2 bg-gradient-to-r from-emerald-900/20 to-emerald-500 rounded"></div>
                       <span>Viel</span>
                    </div>
                 </div>
               )}

               {/* BAR CHARTS VIEW */}
               {behaviorChartType === 'bars' && (
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-indigo-400" />
                          Beste Uhrzeit
                      </h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={processedData.hourStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="hour" stroke="#64748b" tickFormatter={(v) => `${v}h`} fontSize={12} />
                            <YAxis stroke="#64748b" hide />
                            <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} 
                              formatter={(value, name, props) => {
                                  const val = getBehaviorValue(props.payload);
                                  return [behaviorDisplay === 'percent' ? formatPercent(val) : formatCurrency(val), behaviorMetric === 'commission' ? 'Provision' : 'Umsatz'];
                              }}
                            />
                            <Bar dataKey={(item) => getBehaviorValue(item)} fill="#6366f1" radius={[4, 4, 0, 0]} name="Wert" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                          <CalendarDays className="w-5 h-5 text-emerald-400" />
                          Bester Wochentag
                      </h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={processedData.weekdayStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickFormatter={(v) => v.substring(0,2)} />
                            <YAxis stroke="#64748b" hide />
                            <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} 
                               formatter={(value, name, props) => {
                                  const val = getBehaviorValue(props.payload);
                                  return [behaviorDisplay === 'percent' ? formatPercent(val) : formatCurrency(val), behaviorMetric === 'commission' ? 'Provision' : 'Umsatz'];
                              }}
                            />
                            <Bar dataKey={(item) => getBehaviorValue(item)} fill="#10b981" radius={[4, 4, 0, 0]} name="Wert" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                 </div>
               )}

               {/* NEW: TABULAR DETAILS VIEW */}
               {behaviorChartType === 'tables' && (
                 <div className="space-y-6">
                    
                    {/* Top Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h4 className="text-emerald-400 text-sm font-bold uppercase mb-4 flex items-center gap-2"><Trophy className="w-4 h-4"/> Top 3 Uhrzeiten</h4>
                            <div className="space-y-3">
                                {processedData.topHours.map((h, i) => (
                                    <div key={i} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                                        <span className="text-white font-mono text-lg">{h.hour}:00</span>
                                        <span className="text-slate-400 text-sm">{formatCurrency(h.commission)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h4 className="text-indigo-400 text-sm font-bold uppercase mb-4 flex items-center gap-2"><Trophy className="w-4 h-4"/> Top 3 Wochentage</h4>
                            <div className="space-y-3">
                                {processedData.topDays.map((d, i) => (
                                    <div key={i} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                                        <span className="text-white text-lg">{d.day}</span>
                                        <span className="text-slate-400 text-sm">{formatCurrency(d.commission)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 col-span-2">
                            <h4 className="text-rose-400 text-sm font-bold uppercase mb-4 flex items-center gap-2"><Activity className="w-4 h-4"/> Performance nach Tageszeit (4h Blöcke)</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {processedData.timeBlocks.map((block, i) => (
                                    <div key={i} className="flex justify-between items-center bg-slate-950/50 p-2 rounded">
                                        <span className="text-slate-300 text-sm">{block.label}</span>
                                        <span className="text-white font-bold">{formatCurrency(block.commission)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Best Time Per Day Table */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-4">Beste Uhrzeit pro Wochentag</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                                    <tr>
                                        {processedData.bestTimePerDay.map((d, i) => (
                                            <th key={i} className="p-3 text-center border-b border-slate-800">{d.day}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {processedData.bestTimePerDay.map((d, i) => (
                                            <td key={i} className="p-4 text-center border-r border-slate-800 last:border-0">
                                                <div className="text-2xl font-bold text-white mb-1">{d.hour}:00</div>
                                                <div className="text-xs text-emerald-400">{formatCurrency(d.val)}</div>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                 </div>
               )}
            </div>
          )}

          {activeView === 'transactions' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[800px] max-w-full mx-auto overflow-hidden">
               <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur z-20">
                  <div>
                    <h3 className="text-xl font-bold text-white">Transaktions-Liste</h3>
                    <p className="text-slate-400 text-sm">Alle einzelnen Buchungen im Detail.</p>
                  </div>
                  <div className="flex gap-2">
                      <select value={transactionLimit} onChange={(e) => setTransactionLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none">
                         <option value={250}>Letzte 250</option>
                         <option value={1000}>Letzte 1000</option>
                         <option value="all">Alle</option>
                      </select>
                      <button onClick={handleExportTransactions} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-indigo-500/20 transition-all">
                        <FileDown className="w-4 h-4" /> CSV Export
                      </button>
                  </div>
               </div>
               <div className="overflow-auto flex-1 custom-scrollbar">
                 <table className="w-full text-left relative whitespace-nowrap">
                   <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-lg">
                     <tr>
                       <SortableHeader label="Datum & Zeit" sortKey="date" align="left" />
                       <SortableHeader label="Typ" sortKey="isRefund" align="center" />
                       <SortableHeader label="User ID" sortKey="userId" align="left" />
                       <SortableHeader label="Land" sortKey="country" align="left" />
                       <SortableHeader label="Umsatz" sortKey="amount" align="right" />
                       <SortableHeader label="Provision" sortKey="commission" align="right" />
                       <SortableHeader label="Kampagne" sortKey="track" align="right" />
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800 text-sm">
                     {sortedTransactions
                       .slice(0, transactionLimit === 'all' ? undefined : transactionLimit)
                       .map((tx, idx) => (
                       <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                         <td className="p-3 pl-6 text-slate-300 font-mono text-xs">{formatDateTime(tx.date)}</td>
                         <td className="p-3 text-center">
                            {tx.isRefund 
                                ? <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">REFUND</span>
                                : <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">KAUF</span>
                            }
                         </td>
                         <td className="p-3 font-mono text-indigo-300">{tx.userId}</td>
                         <td className="p-3 text-slate-400">{tx.country === 'Global/Unbekannt' ? '🌐' : tx.country}</td>
                         <td className={`p-3 text-right ${tx.isRefund ? 'text-rose-400' : 'text-slate-300'}`}>{formatCurrency(tx.amount)}</td>
                         <td className={`p-3 text-right font-bold ${tx.isRefund ? 'text-rose-500' : 'text-emerald-400'}`}>{formatCurrency(tx.commission)}</td>
                         <td className="p-3 text-right text-xs text-slate-500 truncate max-w-[150px]" title={tx.track}>{tx.track}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 <div className="p-4 text-center text-xs text-slate-500 border-t border-slate-800 bg-slate-900 sticky bottom-0">
                   Zeige {transactionLimit === 'all' ? sortedTransactions.length : Math.min(transactionLimit, sortedTransactions.length)} Einträge
                 </div>
               </div>
            </div>
          )}

          {activeView === 'campaigns' && (
            <div className="space-y-6 max-w-7xl mx-auto">
               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[800px]">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">Kampagnen Details</h3>
                      <p className="text-slate-400 text-sm">Sortiert nach deiner Provision.</p>
                    </div>
                    <div className="flex gap-2">
                       <select value={trackListLimit} onChange={(e) => setTrackListLimit(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none">
                         <option value={50}>Top 50</option>
                         <option value={100}>Top 100</option>
                         <option value={500}>Top 500</option>
                       </select>
                       <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input type="text" placeholder="Suche..." className="bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm w-48" onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}/>
                       </div>
                       <button onClick={handleExportCampaigns} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white flex items-center gap-2 text-sm"><FileDown className="w-4 h-4" /> Export</button>
                    </div>
                 </div>
                 <div className="overflow-auto flex-1 border border-slate-800 rounded-lg">
                   <table className="w-full text-left relative">
                     <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-sm">
                       <tr>
                         <th className="p-3 bg-slate-950">Kampagne (Track)</th>
                         <th className="p-3 text-right bg-slate-950 text-emerald-400 font-bold">Deine Provision</th>
                         <th className="p-3 text-right bg-slate-950">Plattform Umsatz</th>
                         <th className="p-3 text-right bg-slate-950">Verkäufe</th>
                         <th className="p-3 text-right bg-slate-950">Ø Prov./Sale</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800 text-sm">
                       {processedData.trackData
                         .filter(t => t.name.toLowerCase().includes(searchQuery))
                         .slice(0, trackListLimit)
                         .map((track, idx) => (
                         <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                           <td className="p-3 font-mono text-indigo-400 font-medium">{track.name}</td>
                           <td className="p-3 text-right text-emerald-400 font-bold">{formatCurrency(track.commission)}</td>
                           <td className="p-3 text-right text-slate-400">{formatCurrency(track.revenue)}</td>
                           <td className="p-3 text-right text-slate-300">{track.count}</td>
                           <td className="p-3 text-right text-slate-500">{formatCurrency(track.commission / track.count)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            </div>
          )}

          {activeView === 'cleaned_campaigns' && (
            <div className="space-y-6 max-w-7xl mx-auto">
               <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[800px]">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">Modelle & Kampagnen (Bereinigt)</h3>
                      <p className="text-slate-400 text-sm">Gruppiert nach Namen (ohne Prefixe und Sonderzeichen).</p>
                    </div>
                    <div className="flex gap-2">
                       <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                          <span className="text-xs text-slate-400">Monatliche Details</span>
                          <button 
                            onClick={() => setShowMonthlyCleaned(!showMonthlyCleaned)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${showMonthlyCleaned ? 'bg-emerald-600' : 'bg-slate-700'}`}
                          >
                             <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showMonthlyCleaned ? 'left-6' : 'left-1'}`}></div>
                          </button>
                       </div>
                       <select value={trackListLimit} onChange={(e) => setTrackListLimit(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none">
                         <option value={50}>Top 50</option>
                         <option value={100}>Top 100</option>
                         <option value={500}>Top 500</option>
                       </select>
                       <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input type="text" placeholder="Suche..." className="bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm w-48" onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}/>
                       </div>
                       <button onClick={handleExportCleanedCampaigns} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white flex items-center gap-2 text-sm"><FileDown className="w-4 h-4" /> Export</button>
                    </div>
                 </div>
                 <div className="overflow-auto flex-1 border border-slate-800 rounded-lg">
                   <table className="w-full text-left relative">
                     <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-sm">
                       <tr>
                         <th className="p-3 bg-slate-950">Name (Bereinigt)</th>
                         {showMonthlyCleaned && <th className="p-3 bg-slate-950">Monat</th>}
                         <th className="p-3 text-right bg-slate-950 text-emerald-400 font-bold">Deine Provision</th>
                         <th className="p-3 text-right bg-slate-950">Plattform Umsatz</th>
                         <th className="p-3 text-right bg-slate-950">Verkäufe</th>
                         <th className="p-3 text-right bg-slate-950">Ø Prov./Sale</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800 text-sm">
                       {(showMonthlyCleaned ? processedData.cleanedTrackDataMonthly : processedData.cleanedTrackData)
                         .filter(t => t.name.toLowerCase().includes(searchQuery))
                         .slice(0, trackListLimit)
                         .map((track, idx) => (
                         <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                           <td className="p-3 font-mono text-indigo-400 font-medium capitalize">{track.name}</td>
                           {showMonthlyCleaned && <td className="p-3 text-slate-300">{track.displayDate}</td>}
                           <td className="p-3 text-right text-emerald-400 font-bold">{formatCurrency(track.commission)}</td>
                           <td className="p-3 text-right text-slate-400">{formatCurrency(track.revenue)}</td>
                           <td className="p-3 text-right text-slate-300">{track.count}</td>
                           <td className="p-3 text-right text-slate-500">{formatCurrency(track.commission / track.count)}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            </div>
          )}

          {activeView === 'geo' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                   <h3 className="text-lg font-bold text-white mb-6">Provisions-Verteilung</h3>
                   <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={processedData.countryData.slice(0, 8)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="commission">
                            {processedData.countryData.slice(0, 8).map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0)" />)}
                          </Pie>
                          <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                   </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-center items-center text-center">
                   <Globe className="w-16 h-16 text-emerald-500/20 mb-4" />
                   <h3 className="text-2xl font-bold text-white mb-2">{processedData.countryData.length} Länder</h3>
                   <p className="text-slate-400">Aktive Märkte im ausgewählten Zeitraum</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl h-[500px] flex flex-col">
                 <h3 className="text-xl font-bold text-white mb-6">Länderliste Detail</h3>
                 <div className="overflow-auto flex-1 border border-slate-800 rounded-lg">
                   <table className="w-full text-left relative">
                     <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10">
                       <tr>
                         <th className="p-3 bg-slate-950">Land</th>
                         <th className="p-3 text-right bg-slate-950 text-emerald-400 font-bold">Provision</th>
                         <th className="p-3 text-right bg-slate-950">Plattform Umsatz</th>
                         <th className="p-3 text-right bg-slate-950">Anteil (%)</th>
                         <th className="p-3 text-right bg-slate-950">Tx</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800 text-sm">
                       {processedData.countryData.map((country, idx) => (
                         <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                           <td className="p-3"><span className="font-bold text-white">{country.name === 'Global/Unbekannt' ? 'Unbekannt' : country.name}</span></td>
                           <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(country.commission)}</td>
                           <td className="p-3 text-right text-slate-400">{formatCurrency(country.revenue)}</td>
                           <td className="p-3 text-right text-slate-400">{((country.commission / processedData.totalCommission) * 100).toFixed(1)}%</td>
                           <td className="p-3 text-right text-slate-300">{country.count}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
            </div>
          )}

          {activeView === 'users' && (
            <div className={`bg-slate-900 border border-slate-800 shadow-xl flex flex-col overflow-hidden ${
              isUserListMaximized 
                ? 'fixed inset-0 z-50 w-screen h-screen rounded-none' 
                : 'rounded-2xl h-[800px] max-w-full mx-auto'
            }`}>
               <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur z-20">
                  <div>
                    <h3 className="text-xl font-bold text-white">Top Spender Liste</h3>
                    <p className="text-slate-400 text-sm">Sortiert nach <span className="text-emerald-400 font-bold">deiner Provision</span>.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                      <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-700">
                          <button onClick={() => setUserStatusFilter('all')} className={`px-3 py-1.5 rounded text-xs font-medium ${userStatusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Alle</button>
                          <button onClick={() => setUserStatusFilter('active')} className={`px-3 py-1.5 rounded text-xs font-medium ${userStatusFilter === 'active' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`}>Active</button>
                          <button onClick={() => setUserStatusFilter('inactive')} className={`px-3 py-1.5 rounded text-xs font-medium ${userStatusFilter === 'inactive' ? 'bg-amber-600/20 text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}>Inaktiv</button>
                          <button onClick={() => setUserStatusFilter('churned')} className={`px-3 py-1.5 rounded text-xs font-medium ${userStatusFilter === 'churned' ? 'bg-rose-600/20 text-rose-400' : 'text-slate-400 hover:text-rose-400'}`}>Churned</button>
                      </div>
                      <select value={userListLimit} onChange={(e) => setUserListLimit(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none">
                         <option value={100}>Top 100</option>
                         <option value={250}>Top 250</option>
                         <option value={500}>Top 500</option>
                         <option value={1000}>Top 1000</option>
                      </select>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                        <input type="text" placeholder="User ID..." className="bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm w-32 md:w-48" onChange={(e) => setSearchQuery(e.target.value)}/>
                      </div>
                      <button onClick={handleExportUsers} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-emerald-500/20 transition-all">
                        <FileDown className="w-4 h-4" /> CSV
                      </button>
                      <button 
                        onClick={() => setIsUserListMaximized(!isUserListMaximized)}
                        className="p-2 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title={isUserListMaximized ? "Verkleinern" : "Maximieren"}
                      >
                        {isUserListMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>
                  </div>
               </div>
               <div className="overflow-auto flex-1 custom-scrollbar">
                 <table className="w-full text-left relative whitespace-nowrap">
                   <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-lg">
                     <tr>
                       <th className="p-3 pl-6 bg-slate-950 text-center">Rank</th>
                       <th className="p-3 bg-slate-950">User ID</th>
                       <th className="p-3 bg-slate-950">Kampagne</th>
                       <th className="p-3 bg-slate-950">Status</th>
                       <th className="p-3 bg-slate-950 text-right text-emerald-400 font-bold border-b-2 border-emerald-500/30">My Share</th>
                       <th className="p-3 bg-slate-950 text-right text-slate-500">Platform Rev</th>
                       <th className="p-3 bg-slate-950 text-right text-indigo-400">30d Prov.</th>
                       <th className="p-3 bg-slate-950 text-center">Trend</th>
                       <th className="p-3 bg-slate-950 text-right">Tx</th>
                       <th className="p-3 bg-slate-950 text-right">Avg Prov.</th>
                       <th className="p-3 bg-slate-950 text-right">Signup</th>
                       <th className="p-3 bg-slate-950 text-center" title="Days to 1st spend">Dt1st</th>
                       <th className="p-3 bg-slate-950 text-right">Last Seen</th>
                       <th className="p-3 bg-slate-950 text-center">Days Since</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800 text-sm">
                     {displayedUsers.map((user, idx) => (
                       <tr key={idx} className="hover:bg-slate-800/50 transition-colors group">
                         <td className="p-3 pl-6 text-slate-500 font-mono text-center">#{processedData.topUsers.indexOf(user) + 1}</td>
                         <td className="p-3 font-mono font-bold text-indigo-400">
                            {user.id}
                         </td>
                         <td className="p-3">
                            <span className="text-slate-400 text-xs truncate max-w-[120px] block" title={user.track}>{user.track}</span>
                         </td>
                         <td className="p-3">
                            {user.status === 'active' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><UserCheck className="w-3 h-3"/> Active</span>}
                            {user.status === 'inactive' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><UserMinus className="w-3 h-3"/> Inaktiv</span>}
                            {user.status === 'churned' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20"><UserX className="w-3 h-3"/> Churned</span>}
                         </td>
                         <td className="p-3 text-right font-bold text-emerald-400 group-hover:text-emerald-300 text-base">{formatCurrency(user.totalCommission)}</td>
                         <td className="p-3 text-right text-slate-500 text-xs">{formatCurrency(user.totalSpent)}</td>
                         <td className="p-3 text-right text-indigo-300 font-medium">{user.comm30d > 0 ? formatCurrency(user.comm30d) : <span className="text-slate-600">-</span>}</td>
                         <td className="p-3 text-center">
                            {user.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500 inline" />}
                            {user.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-rose-500 inline" />}
                            {user.trend === 'flat' && <Minus className="w-4 h-4 text-slate-600 inline" />}
                         </td>
                         <td className="p-3 text-right text-slate-300">{user.txCount}</td>
                         <td className="p-3 text-right text-slate-400">{formatCurrency(user.avgComm)}</td>
                         <td className="p-3 text-right text-slate-400 text-xs">{formatDate(user.signupDate)}</td>
                         <td className="p-3 text-center text-slate-400">{user.daysToFirst >= 0 ? `${user.daysToFirst}d` : '-'}</td>
                         <td className="p-3 text-right text-slate-300 text-xs font-medium">{formatDate(user.lastActive)}</td>
                         <td className="p-3 text-center">
                             <span className={`px-2 py-1 rounded text-xs font-bold ${
                                 user.daysSinceLast <= 60 ? 'bg-emerald-500/10 text-emerald-400' : 
                                 user.daysSinceLast <= 180 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                             }`}>
                                 {user.daysSinceLast}d
                             </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 <div className="p-4 text-center text-xs text-slate-500 border-t border-slate-800 bg-slate-900 sticky bottom-0">
                   Zeige {displayedUsers.length} User
                 </div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
