
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ICONS, MOCK_DATA, MOCK_USERS } from './constants';
import { Seal, SealStatus, FilterOptions, MovementHistory, User, UserRole, AppSettings } from './types';
import * as XLSX from 'xlsx';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ApiService } from './services/api';

// --- HELPERS ---

const getStatusStyles = (status: SealStatus) => {
  switch (status) {
    case SealStatus.ENTRADA_INVENTARIO:
      return "bg-emerald-50 text-emerald-800 border-emerald-200 icon-bg-emerald-500 text-emerald-600";
    case SealStatus.ASIGNACION_INSTALACION:
      return "bg-sky-50 text-sky-800 border-sky-200 icon-bg-sky-500 text-sky-600";
    case SealStatus.SALIDA_FABRICA:
      return "bg-gray-100 text-gray-700 border-gray-300 icon-bg-gray-500 text-gray-600";
    case SealStatus.DESPACHADO:
      return "bg-indigo-50 text-indigo-800 border-indigo-200 icon-bg-indigo-500 text-indigo-600";
    case SealStatus.DESTRUIDO:
      return "bg-red-50 text-red-800 border-red-200 icon-bg-red-500 text-red-600";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200 icon-bg-slate-500 text-slate-600";
  }
};

const getStatusColorHex = (status: SealStatus) => {
  switch (status) {
    case SealStatus.ENTRADA_INVENTARIO: return "#10b981";
    case SealStatus.ASIGNACION_INSTALACION: return "#0ea5e9";
    case SealStatus.SALIDA_FABRICA: return "#64748b";
    case SealStatus.DESPACHADO: return "#6366f1";
    case SealStatus.DESTRUIDO: return "#ef4444";
    default: return "#94a3b8";
  }
};

const getStatusIconColor = (status: SealStatus) => {
  switch (status) {
    case SealStatus.ENTRADA_INVENTARIO: return "bg-emerald-500";
    case SealStatus.ASIGNADO: return "bg-sky-500";
    case SealStatus.ENTREGADO: return "bg-amber-500";
    case SealStatus.INSTALADO: return "bg-orange-500";
    case SealStatus.NO_INSTALADO: return "bg-stone-400";
    case SealStatus.SALIDA_FABRICA: return "bg-gray-500";
    case SealStatus.DESTRUIDO: return "bg-red-500";
    default: return "bg-slate-500";
  }
};

const getStatusTextColor = (status: SealStatus) => {
  switch (status) {
    case SealStatus.ENTRADA_INVENTARIO: return "text-emerald-600";
    case SealStatus.ASIGNADO: return "text-sky-600";
    case SealStatus.ENTREGADO: return "text-amber-600";
    case SealStatus.INSTALADO: return "text-orange-600";
    case SealStatus.NO_INSTALADO: return "text-stone-600";
    case SealStatus.SALIDA_FABRICA: return "text-gray-600";
    case SealStatus.DESTRUIDO: return "text-red-600";
    default: return "text-slate-600";
  }
};

// --- COLOR HELPERS ---

const darkenColor = (hex: string, amount: number) => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `#${Math.max(0, r - amount).toString(16).padStart(2, '0')}${Math.max(0, g - amount).toString(16).padStart(2, '0')}${Math.max(0, b - amount).toString(16).padStart(2, '0')}`;
};

const lightenColor = (hex: string, amount: number) => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `#${Math.min(255, r + amount).toString(16).padStart(2, '0')}${Math.min(255, g + amount).toString(16).padStart(2, '0')}${Math.min(255, b + amount).toString(16).padStart(2, '0')}`;
};

// --- EXPORT FUNCTIONS ---

const exportToExcel = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// --- COMPONENTS ---

const DashboardView: React.FC<{ seals: Seal[]; user: User; cities: string[] }> = ({ seals, user, cities }) => {
  // Normalizamos comparación de ciudades
  const citySeals = useMemo(() => 
    seals.filter(s => s.city?.toUpperCase() === user.city?.toUpperCase()), 
    [seals, user.city]
  );
  
  const stats = useMemo(() => {
    return {
      total: citySeals.length,
      available: citySeals.filter(s => s.status === SealStatus.ENTRADA_INVENTARIO || s.status === SealStatus.NO_INSTALADO).length,
      assigned: citySeals.filter(s => s.status === SealStatus.ASIGNADO || s.status === SealStatus.ENTREGADO).length,
      finalized: citySeals.filter(s => s.status === SealStatus.INSTALADO || s.status === SealStatus.SALIDA_FABRICA).length,
      destroyed: citySeals.filter(s => s.status === SealStatus.DESTRUIDO).length,
    };
  }, [citySeals]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    citySeals.forEach(s => {
      counts[s.status] = (counts[s.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace('_', ' '), value, rawName: name }));
  }, [citySeals]);

  const cityData = useMemo(() => {
    return cities.map(city => ({
      name: city.toUpperCase(),
      cantidad: seals.filter(s => s.city?.toUpperCase() === city.toUpperCase()).length
    }));
  }, [seals, cities]);

  const recentMovements = useMemo(() => {
    return seals
      .flatMap(s => s.history.map(h => ({ ...h, sealId: s.id, city: s.city })))
      .filter(m => user.role === UserRole.ADMIN || m.city?.toUpperCase() === user.city?.toUpperCase())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [seals, user]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-3xl font-black text-custom-blue uppercase tracking-tighter italic">Dashboard de Operaciones</h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Estadísticas en Tiempo Real - Sede: <span className="text-custom-blue">{user.city}</span></p>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado Global</p>
            <p className="text-sm font-black text-custom-blue uppercase tracking-tighter">ACTIVA</p>
          </div>
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Total Inventario', value: stats.total, color: 'text-custom-blue', bg: 'bg-white', icon: <ICONS.Truck /> },
          { label: 'Disponibles', value: stats.available, color: 'text-emerald-600', bg: 'bg-emerald-50/50', icon: <ICONS.Plus /> },
          { label: 'En Tránsito', value: stats.assigned, color: 'text-sky-600', bg: 'bg-sky-50/50', icon: <ICONS.Move /> },
          { label: 'Instalados', value: stats.finalized, color: 'text-orange-600', bg: 'bg-orange-50/50', icon: <ICONS.StopCircle /> },
          { label: 'Bajas/Deterioro', value: stats.destroyed, color: 'text-red-600', bg: 'bg-red-50/50', icon: <ICONS.Trash /> },
        ].map((card, idx) => (
          <div key={idx} className={`${card.bg} p-6 rounded-3xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 group`}>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-colors ${card.color.replace('text', 'bg').replace('600', '100')} ${card.color}`}>
              {card.icon}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
            <p className={`text-3xl font-black ${card.color} tracking-tighter italic`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Distribución por Estado */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-black text-custom-blue uppercase tracking-widest mb-8 border-l-4 border-custom-blue pl-4">Distribución por Estado</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColorHex(entry.rawName as SealStatus)} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-xs font-black text-custom-blue uppercase tracking-widest border-l-4 border-custom-blue pl-4">Últimos Movimientos</h4>
            <div className="bg-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-slate-500">TIEMPO REAL</div>
          </div>
          <div className="space-y-4">
            {recentMovements.length > 0 ? recentMovements.map((move, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className={`w-2 h-10 rounded-full ${getStatusIconColor(move.toStatus)}`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-[11px] font-black text-custom-blue uppercase">Sello {move.sealId}</p>
                    <p className="text-[9px] font-bold text-slate-400 font-mono">{move.date.split(' ')[0]}</p>
                  </div>
                  <p className="text-[10px] text-slate-600 font-medium italic line-clamp-1">{move.details}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${getStatusStyles(move.toStatus).split('icon-bg-')[0]}`}>
                    {move.toStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-300 space-y-4 italic">
                <ICONS.History className="w-12 h-12 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Sin actividad registrada</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {user.role === UserRole.ADMIN && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h4 className="text-xs font-black text-custom-blue uppercase tracking-widest mb-8 border-l-4 border-custom-blue pl-4">Inventario por Sede</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="cantidad" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsView: React.FC<{ 
  settings: AppSettings; 
  onUpdate: (s: AppSettings) => void;
  onRestoreDB: (data: any) => void;
}> = ({ settings, onUpdate, onRestoreDB }) => {
  const [title, setTitle] = useState(settings.title);
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logo);
  const [newType, setNewType] = useState('');
  const [sealTypes, setSealTypes] = useState<string[]>(settings?.sealTypes || []);
  const [themeColor, setThemeColor] = useState(settings?.themeColor || '#003594');
  const [zplConfig, setZplConfig] = useState(settings?.zplConfig || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbFileRef = useRef<HTMLInputElement>(null);

  const presetColors = [
    { name: 'Azul Original', hex: '#003594' },
    { name: 'Rojo Corporativo', hex: '#c21b1b' },
    { name: 'Verde Logística', hex: '#0c8444' },
    { name: 'Negro Premium', hex: '#111827' },
    { name: 'Naranja Alerta', hex: '#ea580c' },
    { name: 'Púrpura Operativo', hex: '#6d28d9' }
  ];

  const addSealType = () => {
    if (newType.trim() && !sealTypes.includes(newType.trim().toUpperCase())) { setSealTypes([...sealTypes, newType.trim().toUpperCase()]); setNewType(''); }
  };
  const removeSealType = (type: string) => setSealTypes(sealTypes.filter(t => t !== type));
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => { 
    onUpdate({ title, logo: logoPreview, sealTypes, themeColor, zplConfig }); 
    alert('Configuración guardada satisfactoriamente.'); 
  };

  const handleExportDB = () => {
    const dbData = {
      seals: JSON.parse(localStorage.getItem('selloData') || '[]'),
      users: JSON.parse(localStorage.getItem('selloUsers') || '[]'),
      cities: JSON.parse(localStorage.getItem('selloCities') || '[]'),
      settings: JSON.parse(localStorage.getItem('selloSettings') || '{}'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GestionSellos_Backup_${new Date().toLocaleDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (window.confirm("¿Restaurar base de datos? Esto sobrescribirá la información actual.")) {
          onRestoreDB(data);
          alert("Base de datos restaurada. La aplicación se reiniciará.");
          window.location.reload();
        }
      } catch (err) {
        alert("Archivo de respaldo inválido.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div><h3 className="text-2xl font-black text-custom-blue uppercase tracking-tighter italic">CONFIGURACIONES</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Personalice la identidad corporativa y parámetros globales</p></div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 space-y-10 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block">Logo Corporativo</label>
            <div className="flex items-center gap-6">
              <div className="w-48 h-24 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative group">
                {logoPreview ? <img src={logoPreview} className="w-full h-full object-contain" /> : <ICONS.Truck className="w-8 h-8 text-slate-300" />}
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"><ICONS.Plus className="text-white w-6 h-6" /></div>
              </div>
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-custom-blue uppercase hover:bg-slate-50">Cambiar Logo</button>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block">Nombre de la Plataforma</label>
            <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-6 py-4 text-xl font-black text-custom-blue focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all uppercase" value={title} onChange={(e) => setTitle(e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block mb-4">Personalización del Tema Visual</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Color Principal</p>
              <div className="flex items-center gap-4">
                <input 
                  type="color" 
                  value={themeColor} 
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200 overflow-hidden"
                />
                <input 
                  type="text" 
                  value={themeColor.toUpperCase()} 
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-mono text-xs font-bold text-custom-blue w-24"
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Paleta Predefinida</p>
              <div className="flex flex-wrap gap-3">
                {presetColors.map(color => (
                  <button 
                    key={color.hex} 
                    onClick={() => setThemeColor(color.hex)}
                    className="group flex flex-col items-center gap-2"
                    title={color.name}
                  >
                    <div 
                      className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${themeColor.toLowerCase() === color.hex.toLowerCase() ? 'border-custom-blue ring-2 ring-blue-100 ring-offset-2' : 'border-transparent'}`}
                      style={{ backgroundColor: color.hex }}
                    ></div>
                    <span className="text-[8px] font-black text-slate-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity">{color.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: themeColor }}></div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider italic">Vista previa: Este color se aplicará a botones, encabezados y elementos clave de la interfaz.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block">Catálogo de Precintos</label>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="flex gap-3 mb-4">
              <input type="text" placeholder="Ej: Sello Metálico" className="flex-1 border border-slate-200 bg-white p-3.5 rounded-xl text-sm font-bold text-custom-blue outline-none uppercase" value={newType} onChange={e => setNewType(e.target.value.toUpperCase())} />
              <button onClick={addSealType} className="bg-custom-blue text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black">Añadir</button>
            </div>
            <div className="flex flex-wrap gap-2">{(sealTypes || []).map(t => <div key={t} className="bg-white border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-3 font-bold text-[11px] text-custom-blue shadow-sm group">{t}<button onClick={() => removeSealType(t)} className="text-slate-300 hover:text-red-500 transition-colors"><ICONS.Trash className="w-3.5 h-3.5" /></button></div>)}</div>
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-slate-100">
          <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block">Configurador de Etiqueta ZPL</label>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed mb-4">Utilice variables como <span className="text-custom-blue">`{"{{ID}}"}`</span>, <span className="text-custom-blue">`{"{{TYPE}}"}`</span>, <span className="text-custom-blue">`{"{{PLATE}}"}`</span> y <span className="text-custom-blue">`{"{{TRAILER}}"}`</span>.</p>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <textarea 
              className="w-full border border-slate-200 bg-white p-4 rounded-xl font-mono text-xs text-slate-700 h-48 focus:ring-4 focus:ring-blue-50 outline-none"
              value={zplConfig}
              onChange={(e) => setZplConfig(e.target.value)}
              placeholder="Ingrese código ZPL..."
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block mb-4">Gestión de Base de Datos (LocalStorage)</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-custom-blue uppercase tracking-widest mb-1">Exportar Backup</h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Descargue una copia completa de la base de datos (sellos, historial y usuarios) en formato JSON.</p>
              </div>
              <button onClick={handleExportDB} className="mt-4 w-full bg-white border border-custom-blue text-custom-blue font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-custom-blue hover:text-white transition-all">Generar Backup (.json)</button>
            </div>
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1">Restaurar Datos</h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Cargue un archivo de respaldo previo para migrar o recuperar su información.</p>
              </div>
              <input ref={dbFileRef} type="file" accept=".json" onChange={handleImportDB} className="hidden" />
              <button onClick={() => dbFileRef.current?.click()} className="mt-4 w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all">Cargar Respaldo</button>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest block mb-4">Estado de Conexión (Supabase)</label>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${import.meta.env.VITE_SUPABASE_URL ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <div>
                <p className="text-[10px] font-black text-custom-blue uppercase tracking-widest">
                  {import.meta.env.VITE_SUPABASE_URL ? 'Conectado a la Nube' : 'Modo Local (Sin Configurar)'}
                </p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                  {import.meta.env.VITE_SUPABASE_URL ? `URL: ${import.meta.env.VITE_SUPABASE_URL.substring(0, 25)}...` : 'Configure las variables de entorno para sincronizar'}
                </p>
              </div>
            </div>
            <button 
              onClick={async () => {
                try {
                  // Probar Sellos
                  const sealsData = await ApiService.getSeals();
                  let writeStatusSeals = "Lectura OK.";
                  if (sealsData.length > 0) {
                    const resSeals = await ApiService.saveSeals(sealsData);
                    if (resSeals.success) {
                      writeStatusSeals += " Escritura OK.";
                    } else {
                      writeStatusSeals += ` Error Escritura: ${resSeals.errorMessage}`;
                    }
                  }
                  
                  // Probar Usuarios
                  const usersData = await ApiService.getUsers();
                  let writeStatusUsers = "Lectura OK.";
                  if (usersData.length > 0) {
                    const resUsers = await ApiService.saveUsers(usersData);
                    if (resUsers.success) {
                      writeStatusUsers += " Escritura OK.";
                    } else {
                      writeStatusUsers += ` Error Escritura: ${resUsers.errorMessage}`;
                    }
                  }
                  
                  alert(`Supabase - Resultados:\n\n1. PRECINTOS:\n- Conexión: OK\n- Estado: ${writeStatusSeals}\n- Cantidad: ${sealsData.length} en base de datos\n\n2. USUARIOS:\n- Conexión: OK\n- Estado: ${writeStatusUsers}\n- Cantidad: ${usersData.length} en base de datos`);
                } catch (e: any) {
                  alert(`Error de conexión con Supabase: ${e.message || e}`);
                }
              }}
              className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-custom-blue hover:bg-slate-100 transition-all"
            >
              Probar Conexión
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button onClick={handleSave} className="bg-custom-blue text-white px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-custom-blue-dark transition-all">Guardar Cambios Generales</button>
        </div>
      </div>
    </div>
  );
};

const CityManagement: React.FC<{ 
  cities: string[]; 
  onAddCity: (city: string) => void; 
  onDeleteCity: (city: string) => void;
  onUpdateCity: (oldCity: string, newCity: string) => void;
}> = ({ cities, onAddCity, onDeleteCity, onUpdateCity }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<string | null>(null);
  const [newCityName, setNewCityName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    const cleanCity = newCityName.trim().toUpperCase();
    if (editingCity) onUpdateCity(editingCity, cleanCity);
    else {
      if (cities.map(c => c.toUpperCase()).includes(cleanCity)) return alert('La ciudad ya existe');
      onAddCity(cleanCity);
    }
    setIsModalOpen(false); setEditingCity(null); setNewCityName('');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div><h3 className="text-2xl font-black text-custom-blue uppercase tracking-tighter italic">Sedes Operativas</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Configuración Maestro de Puntos Logísticos</p></div>
        <button onClick={() => { setEditingCity(null); setNewCityName(''); setIsModalOpen(true); }} className="flex items-center gap-2 bg-custom-blue text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-custom-blue-dark transition-all"><ICONS.Plus className="w-4 h-4" /> Registrar Ciudad</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100"><tr><th className="px-8 py-5 text-[10px] font-black text-custom-blue uppercase tracking-widest">Nombre de Ciudad</th><th className="px-8 py-5 text-[10px] font-black text-custom-blue uppercase tracking-widest text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {cities.map(city => (
              <tr key={city} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5 font-black text-custom-blue uppercase">{city}</td>
                <td className="px-8 py-5 text-right flex justify-end gap-2">
                  <button onClick={() => { setEditingCity(city); setNewCityName(city); setIsModalOpen(true); }} className="text-slate-400 hover:text-custom-blue p-2 rounded-lg hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                  <button onClick={() => onDeleteCity(city)} className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><ICONS.Trash className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
            <div className="bg-custom-blue px-8 py-5 text-white font-black text-xs uppercase tracking-widest">{editingCity ? 'Actualizar Sede' : 'Nueva Sede'}</div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Nombre de la Ciudad</label><input type="text" required className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-custom-blue focus:bg-white outline-none uppercase" value={newCityName} onChange={e => setNewCityName(e.target.value)} /></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => { setIsModalOpen(false); setEditingCity(null); }} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button><button type="submit" className="flex-1 bg-custom-blue text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg">{editingCity ? 'Guardar Cambios' : 'Registrar'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const UserManagement: React.FC<{ 
  users: User[]; 
  cities: string[];
  onAddUser: (u: User) => void; 
  onUpdateUser: (u: User) => void;
  onDeleteUser: (id: string) => void 
}> = ({ users, cities, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ username: '', fullName: '', password: '', role: UserRole.GESTOR, city: cities[0] || '' });
  
  useEffect(() => {
    if (editingUser) setFormData({ username: editingUser.username, fullName: editingUser.fullName, password: editingUser.password || '', role: editingUser.role, city: editingUser.city });
    else setFormData({ username: '', fullName: '', password: '', role: UserRole.GESTOR, city: cities[0] || '' });
  }, [editingUser, cities]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return alert('Usuario y contraseña obligatorios');
    if (editingUser) onUpdateUser({ ...editingUser, ...formData });
    else {
      // Calculamos un ID numérico secuencial basado en los usuarios existentes para evitar fallas con columnas numéricas de base de datos
      const numericIds = users.map(user => parseInt(user.id, 10)).filter(num => !isNaN(num));
      const nextId = numericIds.length > 0 ? (Math.max(...numericIds) + 1).toString() : "4";
      const u: User = { ...formData, id: nextId, organization: 'Gestión de Sellos Group' };
      onAddUser(u);
    }
    setIsModalOpen(false); setEditingUser(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div><h3 className="text-2xl font-black text-custom-blue uppercase tracking-tighter italic">Personal Operativo</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Directorio Maestro de Accesos por Sede</p></div>
        <button onClick={() => { setEditingUser(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-custom-blue text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-custom-blue-dark transition-all"><ICONS.Plus className="w-4 h-4" /> Registrar Usuario</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100"><tr><th className="px-8 py-5 text-[10px] font-black text-custom-blue uppercase tracking-widest">Nombre Completo</th><th className="px-8 py-5 text-[10px] font-black text-custom-blue uppercase tracking-widest">ID / Ciudad</th><th className="px-8 py-5 text-[10px] font-black text-custom-blue uppercase tracking-widest">Permisos</th><th className="px-8 py-5 text-[10px] font-black text-custom-blue uppercase tracking-widest text-right">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-8 py-5 font-black text-custom-blue uppercase">{u.fullName}</td>
                <td className="px-8 py-5"><p className="text-slate-600 font-mono text-xs font-bold uppercase">{u.username}</p><p className="text-[10px] text-custom-blue font-black uppercase">{u.city}</p></td>
                <td className="px-8 py-5"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${u.role === UserRole.ADMIN ? 'bg-custom-blue text-white border-custom-blue' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>{u.role}</span></td>
                <td className="px-8 py-5 text-right flex justify-end gap-2">
                  <button onClick={() => { setEditingUser(u); setIsModalOpen(true); }} className="text-slate-400 hover:text-custom-blue p-2 rounded-lg hover:bg-slate-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                  {u.username !== 'admin' && <button onClick={() => onDeleteUser(u.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><ICONS.Trash className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="bg-custom-blue px-8 py-5 text-white font-black text-xs uppercase tracking-widest">{editingUser ? 'Actualizar Personal' : 'Nuevo Registro de Personal'}</div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Nombre Completo</label><input type="text" required className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-custom-blue focus:bg-white outline-none uppercase" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value.toUpperCase()})} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">ID Usuario (Login)</label><input type="text" required className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm font-mono font-bold text-custom-blue focus:bg-white outline-none uppercase" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toUpperCase()})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Contraseña</label><input type="password" required className="w-full border border-slate-200 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-custom-blue focus:bg-white outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Sede Asignada</label><select className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-custom-blue focus:bg-white outline-none appearance-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}>{cities.map(city => <option key={city} value={city}>{city}</option>)}</select></div>
              </div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Rol / Permisos</label>
                <select className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-3.5 text-sm font-bold text-custom-blue focus:bg-white outline-none appearance-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                  <option value={UserRole.GESTOR}>Gestor Operativo (Local)</option>
                  <option value={UserRole.ADMIN}>Administrador Maestro</option>
                  <option value={UserRole.AUXILIAR_SALIDA}>Auxiliar Salida Fábrica</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => { setIsModalOpen(false); setEditingUser(null); }} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button><button type="submit" className="flex-1 bg-custom-blue text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black shadow-lg">{editingUser ? 'Guardar Cambios' : 'Registrar'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const InventorySearchModal: React.FC<{ 
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: FilterOptions) => void; 
  sealTypes: string[] 
}> = ({ isOpen, onClose, onSearch, sealTypes }) => {
  const [filters, setFilters] = useState<FilterOptions>({ idSello: '', estado: '', tipo: 'Todos', fechaInicio: '', fechaFin: '' });
  if (!isOpen) return null;
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSearch(filters); onClose(); };
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 animate-in zoom-in duration-200">
        <div className="bg-custom-blue px-6 py-5 flex justify-between items-center text-white"><div className="flex items-center gap-2"><ICONS.Filter className="w-4 h-4" /><h3 className="text-[10px] font-black uppercase tracking-widest">Filtros de Búsqueda</h3></div><button onClick={onClose} className="hover:rotate-90 transition-transform">✕</button></div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">ID Sello</label><input type="text" placeholder="Ej: BOG-001" className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3.5 text-sm font-mono font-bold text-custom-blue focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase" value={filters.idSello} onChange={(e) => setFilters({...filters, idSello: e.target.value.toUpperCase()})} /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Estado Logístico</label><select className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3.5 text-sm font-bold text-custom-blue focus:bg-white outline-none appearance-none" value={filters.estado} onChange={(e) => setFilters({...filters, estado: e.target.value})}><option value="">Cualquier estado</option>{Object.values(SealStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Clasificación de Tipo</label><select className="w-full border border-gray-200 bg-gray-50 rounded-xl p-3.5 text-sm font-bold text-custom-blue focus:bg-white outline-none appearance-none" value={filters.tipo} onChange={(e) => setFilters({...filters, tipo: e.target.value})}><option value="Todos">Todos los tipos</option>{sealTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="flex gap-4 pt-6"><button type="button" onClick={onClose} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cerrar</button><button type="submit" className="flex-1 bg-custom-blue text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"><ICONS.SearchSmall className="w-4 h-4" /> Ejecutar Filtro</button></div>
        </form>
      </div>
    </div>
  );
};

const TraceabilityView: React.FC<{ seals: Seal[]; user: User }> = ({ seals, user }) => {
  const [searchId, setSearchId] = useState('');
  // Normalizamos comparación de ciudades
  const foundSeal = useMemo(() => { 
    if (!searchId) return null; 
    return seals.find(s => s.id.toUpperCase() === searchId.toUpperCase() && s.city?.toUpperCase() === user.city?.toUpperCase()) || null; 
  }, [seals, searchId, user.city]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (!foundSeal && searchId) alert(`No se encontró ningún precinto con el ID "${searchId}" en la sede ${user.city}`); };
  const handleDownloadHistory = () => { if (!foundSeal) return; const historyData = foundSeal.history.map(h => ({ Fecha: h.date, "Estado Origen": h.fromStatus || "REGISTRO INICIAL", "Estado Destino": h.toStatus, Operador: h.user, Detalles: h.details })); exportToExcel(historyData, `Trazabilidad_Sello_${foundSeal.id}`); };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center"><div><h3 className="text-2xl font-black text-custom-blue uppercase tracking-tighter italic">Consulta de Trazabilidad</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Sede Actual: <span className="text-custom-blue">{user.city}</span></p></div>{foundSeal && <button onClick={handleDownloadHistory} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all"><ICONS.Excel className="w-4 h-4" /> Descargar Historial</button>}</div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-2xl"><form onSubmit={handleSearch} className="flex gap-4"><div className="flex-1 relative"><div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400"><ICONS.Search className="w-5 h-5" /></div><input type="text" placeholder="Ingrese el ID del Sello" className="w-full pl-12 pr-4 py-4 border border-gray-200 bg-gray-50 rounded-xl text-lg font-mono font-bold text-custom-blue focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase" value={searchId} onChange={(e) => setSearchId(e.target.value.toUpperCase())} /></div><button type="submit" className="bg-custom-blue text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-custom-blue-dark transition-all shadow-lg">Consultar</button></form></div>
      {foundSeal ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-1 space-y-6"><div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Estado en {user.city}</h4><div className={`p-4 rounded-xl border-2 text-center font-black text-lg uppercase mb-4 transition-all duration-500 ${getStatusStyles(foundSeal.status).split('icon-bg-')[0]}`}>{foundSeal.status.replace('_', ' ')}</div><div className="space-y-4 pt-4 border-t border-slate-100 text-[11px]"><div className="flex justify-between"><span className="font-black text-slate-400 uppercase">Tipo:</span><span className="font-bold text-black uppercase">{foundSeal.type}</span></div><div className="flex justify-between"><span className="font-black text-slate-400 uppercase">Alta:</span><span className="font-bold text-black">{foundSeal.creationDate}</span></div><div className="flex justify-between"><span className="font-black text-slate-400 uppercase">Sede:</span><span className="font-bold text-custom-blue uppercase">{foundSeal.city}</span></div></div></div></div>
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Bitácora de Eventos (Historial)</h4><div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">{foundSeal.history.map((h, i) => (<div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"><div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 border-white text-white shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors duration-500 ${getStatusIconColor(h.toStatus)}`}><ICONS.History className="w-5 h-5" /></div><div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border-l-4 shadow-sm transition-all hover:shadow-md ${h.toStatus === SealStatus.DESTRUIDO ? 'border-red-500 bg-red-50/20' : h.toStatus === SealStatus.SALIDA_FABRICA ? 'border-gray-400 bg-gray-50/50' : h.toStatus === SealStatus.NO_INSTALADO ? 'border-stone-400 bg-stone-50' : 'border-custom-blue'}`}><div className="flex items-center justify-between space-x-2 mb-1"><div className={`font-black uppercase text-[10px] transition-colors ${getStatusTextColor(h.toStatus)}`}>{h.toStatus.replace('_', ' ')}</div><time className="font-mono text-[9px] text-slate-400 font-bold">{h.date}</time></div><div className="text-slate-700 text-[10px] font-medium italic leading-relaxed">{h.details}</div><div className="mt-2 pt-2 border-t border-slate-50 text-[9px] font-black text-slate-400 uppercase">Operador: {h.user}</div></div></div>))}</div></div>
        </div>
      ) : <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center space-y-4"><div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm"><ICONS.Search className="w-8 h-8 text-blue-100" /></div><p className="font-black text-slate-300 uppercase text-xs tracking-[0.3em]">Esperando ID de Precinto en Sede {user.city}</p></div>}
    </div>
  );
};

const MovementsView: React.FC<{ 
  seals: Seal[]; 
  onInitiateMove: (s: Seal[], status: SealStatus) => void; 
  user: User;
}> = ({ seals, onInitiateMove, user }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const foundSeals = useMemo(() => { 
    if (!searchQuery) return []; 
    const ids = searchQuery.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== ''); 
    // Normalizamos comparación de ciudades
    return seals.filter(s => ids.includes(s.id.toUpperCase()) && s.city?.toUpperCase() === user.city?.toUpperCase()); 
  }, [seals, searchQuery, user.city]);

  const allFound = useMemo(() => { 
    if (!searchQuery) return false; 
    const ids = searchQuery.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== ''); 
    return foundSeals.length === ids.length; 
  }, [foundSeals, searchQuery]);

  const commonStatus = useMemo(() => { 
    if (foundSeals.length === 0) return null; 
    const status = foundSeals[0].status; 
    return foundSeals.every(s => s.status === status) ? status : 'MIXED'; 
  }, [foundSeals]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); const ids = searchQuery.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== ''); if (foundSeals.length < ids.length) alert(`Uno o más precintos no existen en la sede ${user.city} o han sido escritos incorrectamente.`); else if (commonStatus === 'MIXED') alert(`Error de Lote: Todos los precintos deben estar en el mismo estado para realizar una operación masiva.`); };
  const isFinal = (commonStatus as any) === SealStatus.SALIDA_FABRICA || (commonStatus as any) === SealStatus.DESTRUIDO;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end"><div><h3 className="text-2xl font-black text-custom-blue uppercase tracking-tighter italic">Movimiento Operativo</h3><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión Centralizada - Sede: <span className="text-custom-blue">{user.city}</span></p></div></div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-2xl"><form onSubmit={handleSearch} className="flex flex-col gap-4"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Ingrese IDs separados por coma para gestión masiva</label><div className="flex gap-4"><div className="flex-1 relative"><div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400"><ICONS.Move className="w-5 h-5" /></div><input type="text" placeholder="Ej: BOG-001, BOG-002, BOG-003" className="w-full pl-12 pr-4 py-4 border border-gray-200 bg-gray-50 rounded-xl text-lg font-mono font-bold text-custom-blue focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none transition-all uppercase" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div><button type="submit" className="bg-custom-blue text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-custom-blue-dark transition-all shadow-lg">MOVIMIENTO SELLOS</button></div></form></div>
      {foundSeals.length > 0 && allFound && commonStatus !== 'MIXED' ? (
        <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in zoom-in duration-200">
          <div className="bg-custom-blue px-8 py-4 text-white flex justify-between items-center"><p className="text-[10px] font-black uppercase tracking-widest">{foundSeals.length > 1 ? `OPERACIÓN POR LOTE (${foundSeals.length} UNIDADES)` : `ID: ${foundSeals[0].id}`}</p><p className="text-[10px] font-black uppercase tracking-widest">Sede: {user.city}</p></div>
          <div className="p-8 space-y-6"><div className="text-center space-y-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Actual del Sello</p><div className={`p-3 rounded-2xl border-2 text-center font-black text-xl uppercase shadow-inner transition-all duration-500 ${getStatusStyles(commonStatus as SealStatus).split('icon-bg-')[0]}`}>{(commonStatus as SealStatus).replace('_', ' ')}</div></div>
            {!isFinal ? (
              <div className="space-y-4"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Seleccione el Cambio de Estado para el Sello</p><div className="grid grid-cols-1 gap-2">
                  {commonStatus === SealStatus.ENTRADA_INVENTARIO && <button onClick={() => onInitiateMove(foundSeals, SealStatus.SALIDA_FABRICA)} className="bg-custom-blue text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.01] transition-all">ASIGNACIÓN E INSTALACIÓN DE SELLO</button>}
                  {commonStatus === SealStatus.SALIDA_FABRICA && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center py-4 italic">El sello está listo para Salida Fábrica (pendiente escaneo QR)</p>}
                  <button onClick={() => onInitiateMove(foundSeals, SealStatus.DESTRUIDO)} className="bg-red-600 text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.01] transition-all">Reportar Sello Destruido</button>
                </div></div>
            ) : <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4 animate-in zoom-in"><p className={`text-sm font-black uppercase tracking-widest transition-colors ${getStatusTextColor(commonStatus as SealStatus)}`}>Ciclo operativo finalizado ({(commonStatus as SealStatus).replace('_', ' ')})</p></div>}
          </div>
        </div>
      ) : searchQuery !== '' ? <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-3xl p-12 text-center space-y-4"><div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm"><ICONS.StopCircle className="w-8 h-8 text-red-500" /></div><div className="space-y-1"><p className="font-black text-red-800 uppercase text-xs tracking-widest">Inconsistencia en el Lote</p><p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Verifique que todos los precintos existan y tengan el mismo estado actual.</p></div></div> : <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center space-y-4"><div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm"><ICONS.Move className="w-8 h-8 text-blue-100" /></div><p className="font-black text-slate-300 uppercase text-xs tracking-[0.3em]">Ingrese IDs para iniciar gestión masiva en {user.city}</p></div>}
    </div>
  );
};

const DespachoScannerView: React.FC<{ 
  seals: Seal[]; 
  onConfirmExit: (sealIds: string | string[]) => void;
  user: User;
  setActiveTab?: (tab: string) => void;
}> = ({ seals, onConfirmExit, user, setActiveTab }) => {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedSeals, setConfirmedSeals] = useState<{ ids: string[]; containerId: string; types: string[]; plate: string; time: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [scannerSessionId, setScannerSessionId] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Optimizaciones para Dispositivos Móviles y Handhelds (Lectores Láser)
  const [scannerMode, setScannerMode] = useState<'camera' | 'laser'>(() => {
    return (localStorage.getItem('sello_scanner_mode') as 'camera' | 'laser') || 'camera';
  });
  const [laserInput, setLaserInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(true);
  const [recentScans, setRecentScans] = useState<Array<{
    id: string;
    time: string;
    success: boolean;
    details: string;
    containerId?: string;
  }>>([]);
  const [justScannedId, setJustScannedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Guardar el modo del escáner en localStorage
  const handleModeChange = (mode: 'camera' | 'laser') => {
    setScannerMode(mode);
    localStorage.setItem('sello_scanner_mode', mode);
    setError(null);
    setScanResult(null);
    setConfirmedSeals(null);
    if (mode === 'laser') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Sonido y vibración para ambientes industriales ruidosos (Zebra, Honeywell, Handhelds, Celulares)
  const playBeep = (type: 'success' | 'error') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Pitch alto y agradable (A5)
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
      } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Pitch bajo (A3) para indicar advertencia
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("Audio feedback not supported or blocked by browser policy", e);
    }
  };

  const triggerVibration = (type: 'success' | 'error') => {
    if (navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate(100);
      } else {
        navigator.vibrate([120, 80, 120]);
      }
    }
  };

  // Función unificada para procesar códigos QR o de barras
  const processCode = (decodedText: string): { success: boolean; errorMsg?: string; data?: any } => {
    let sealId = decodedText.trim();
    let containerId = '-';
    let type = 'BOTELLA';
    let plate = '-';
    const qrDataObj: { [key: string]: string } = {};

    const upperText = decodedText.toUpperCase();
    if (upperText.includes("SELLO:") || upperText.includes("CONTENEDOR:") || upperText.includes("PLACA:")) {
      const lines = decodedText.split('\n');
      lines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim().toUpperCase();
          const val = line.substring(colonIdx + 1).trim();
          qrDataObj[key] = val;
        }
      });
      if (qrDataObj["SELLO"]) {
        sealId = qrDataObj["SELLO"];
      }
      if (qrDataObj["CONTENEDOR"]) {
        containerId = qrDataObj["CONTENEDOR"];
      } else if (qrDataObj["ID CONTENEDOR"]) {
        containerId = qrDataObj["ID CONTENEDOR"];
      }
      if (qrDataObj["TIPO"]) {
        type = qrDataObj["TIPO"];
      }
      if (qrDataObj["PLACA"]) {
        plate = qrDataObj["PLACA"];
      }
    }
    
    // Separar por comas si es un lote
    const sealIds = sealId.split(',').map(id => id.trim().toUpperCase()).filter(id => id !== '');
    
    if (sealIds.length === 0) {
      return { success: false, errorMsg: "No se encontraron IDs de precintos válidos en la lectura." };
    }

    // Buscar todos los sellos correspondientes en inventario local
    const foundSeals = seals.filter(s => sealIds.includes(s.id.toUpperCase()));
    const foundIds = foundSeals.map(s => s.id.toUpperCase());
    const missingIds = sealIds.filter(id => !foundIds.includes(id));

    if (missingIds.length > 0) {
      return { success: false, errorMsg: `Sellos no encontrados en el sistema: ${missingIds.join(', ')}` };
    }

    // Validar estados (Deben estar listos para Salida Fábrica)
    const invalidStatusSeals = foundSeals.filter(s => s.status !== SealStatus.SALIDA_FABRICA);
    if (invalidStatusSeals.length > 0) {
      const invalidDetails = invalidStatusSeals.map(s => `${s.id} (${s.status})`).join(', ');
      return { success: false, errorMsg: `No listos para despacho: ${invalidDetails}` };
    }

    // Confirmar la salida de fábrica en el sistema
    onConfirmExit(sealIds);

    const finalContainerId = (containerId && containerId !== '-') ? containerId : (foundSeals[0].containerId || '-');
    const finalPlate = (plate && plate !== '-') ? plate : '-';
    const types = Array.from(new Set(foundSeals.map(s => s.type || type)));

    return {
      success: true,
      data: {
        ids: foundSeals.map(s => s.id),
        containerId: finalContainerId,
        types: types,
        plate: finalPlate,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }
    };
  };

  // Manejo de Cámara Web
  useEffect(() => {
    if (scannerMode !== 'camera' || !isCameraActive) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 12, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    const onScanSuccess = (decodedText: string) => {
      setScanResult(decodedText);
      scanner.clear().catch(e => console.warn("Scanner clear error on success", e));
      
      const res = processCode(decodedText);
      
      const newScanEntry = {
        id: decodedText.length > 35 ? decodedText.substring(0, 32) + '...' : decodedText,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        success: res.success,
        details: res.success ? `Salida confirmada con éxito` : (res.errorMsg || 'Inconsistencia de datos'),
        containerId: res.data?.containerId
      };

      setRecentScans(prev => [newScanEntry, ...prev]);

      if (res.success) {
        playBeep('success');
        triggerVibration('success');
        setConfirmedSeals(res.data);
      } else {
        playBeep('error');
        triggerVibration('error');
        setError(res.errorMsg || 'Error de validación');
      }
    };

    scanner.render(onScanSuccess, (err) => console.warn(err));

    return () => {
      scanner.clear().catch(e => console.warn("Scanner clear error", e));
    };
  }, [seals, onConfirmExit, scannerSessionId, isCameraActive, scannerMode]);

  // Manejo de Redirección Automática / Cuenta Regresiva en modo Cámara
  useEffect(() => {
    if (!confirmedSeals || scannerMode !== 'camera') {
      setCountdown(null);
      return;
    }

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          setConfirmedSeals(null);
          setScanResult(null);
          setError(null);
          setScannerSessionId(s => s + 1);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmedSeals, scannerMode]);

  // Manejo de Lectura de Pistola Láser o Lector de Mano (Handheld)
  const handleLaserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = laserInput.trim();
    if (!rawCode) return;

    setLaserInput(''); // Limpiar campo inmediatamente para permitir el próximo disparo de láser

    const res = processCode(rawCode);

    const newScanEntry = {
      id: rawCode.toUpperCase(),
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      success: res.success,
      details: res.success ? 'Salida confirmada de fábrica' : (res.errorMsg || 'Error de lectura'),
      containerId: res.data?.containerId
    };

    setRecentScans(prev => [newScanEntry, ...prev]);

    if (res.success) {
      playBeep('success');
      triggerVibration('success');
      setJustScannedId(rawCode.toUpperCase());
      setTimeout(() => setJustScannedId(null), 1500);
    } else {
      playBeep('error');
      triggerVibration('error');
    }

    // Forzar el enfoque de vuelta en el campo para el siguiente escaneo físico
    setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  };

  const handleNextScan = () => {
    setConfirmedSeals(null);
    setScanResult(null);
    setError(null);
    setScannerSessionId(prev => prev + 1);
  };

  const handleCloseCamera = () => {
    if (user.role !== UserRole.AUXILIAR_SALIDA && setActiveTab) {
      setActiveTab('inventory');
    } else {
      setIsCameraActive(false);
      setConfirmedSeals(null);
      setScanResult(null);
      setError(null);
    }
  };

  const handleStartCamera = () => {
    setIsCameraActive(true);
    setConfirmedSeals(null);
    setScanResult(null);
    setError(null);
    setScannerSessionId(prev => prev + 1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Encabezado Responsivo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-custom-blue uppercase tracking-tighter italic">Control Salida Fábrica</h3>
          <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Sede Operativa: <span className="text-custom-blue">{user.city}</span></p>
        </div>
        
        {/* Selector de Modo de Escaneo (Cámara vs Pistola Láser/Handheld) */}
        <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 w-full sm:w-auto shadow-sm">
          <button 
            onClick={() => handleModeChange('camera')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scannerMode === 'camera' ? 'bg-white text-custom-blue shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            Cámara Celular/Tablet
          </button>
          <button 
            onClick={() => handleModeChange('laser')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${scannerMode === 'laser' ? 'bg-white text-custom-blue shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 12v1.5m0 0v1.5m0-1.5h1.5m-1.5 0h-1.5M12 18.75h1.5m1.5 0h1.5m-9 0h.008v.008H6v-.008z" />
            </svg>
            Pistola Láser/Handheld
          </button>
        </div>
      </div>

      {/* Grid Responsivo de Dos Columnas para Tablets, Handhelds y Celulares */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Columna Principal: Escáner Activo (Cámara o Panel Láser) */}
        <div className="lg:col-span-7 space-y-4 w-full">
          
          {scannerMode === 'camera' ? (
            // --- MODO CÁMARA (Para Celulares y Tablets tradicionales) ---
            !isCameraActive ? (
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 text-center space-y-6">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Cámara en Pausa</h4>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-wide">
                    La cámara se ha desactivado para ahorrar batería. Reactívela para continuar escaneando precintos.
                  </p>
                </div>
                <button 
                  onClick={handleStartCamera} 
                  className="w-full bg-custom-blue hover:bg-black text-white font-black py-3.5 rounded-2xl transition-all shadow-lg text-xs uppercase tracking-widest"
                >
                  Activar Cámara / Iniciar Escaneo
                </button>
              </div>
            ) : (
              <div className={`bg-white rounded-3xl shadow-xl border border-slate-200 p-4 sm:p-6 transition-all duration-300 ${confirmedSeals ? 'max-w-md mx-auto space-y-4' : 'space-y-4'}`}>
                
                {/* Elemento del escáner en el DOM */}
                <div className={confirmedSeals ? "hidden" : "space-y-4"}>
                  <div id="reader" className="overflow-hidden rounded-2xl border-2 border-slate-100 bg-slate-50"></div>
                  
                  {scanResult && !error && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                      <p className="text-emerald-800 font-black text-[9px] uppercase tracking-widest">Sello Identificado</p>
                      <p className="text-emerald-600 font-mono font-bold text-lg">{scanResult}</p>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center space-y-2">
                      <p className="text-red-800 font-black text-[10px] uppercase tracking-widest">Error de Validación</p>
                      <p className="text-red-600 text-[10px] font-bold leading-relaxed">{error}</p>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setScanResult(null); setError(null); setScannerSessionId(prev => prev + 1); }} className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-black uppercase py-2 rounded-lg transition-all">Reintentar</button>
                        <button onClick={handleCloseCamera} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black uppercase py-2 rounded-lg transition-all">Cerrar</button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex flex-col gap-3.5 items-center">
                    <div className="flex items-center flex-col gap-1">
                      <ICONS.History className="w-4 h-4 text-slate-300" />
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider text-center">Enfoque el código QR de salida para validar y despachar automáticamente</p>
                    </div>

                    <button 
                      onClick={handleCloseCamera}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-[10px] uppercase tracking-widest border border-slate-200"
                    >
                      Cerrar Ventana de Cámara
                    </button>
                  </div>
                </div>

                {/* Confirmación de Salida Exitosa (Modo Cámara) */}
                {confirmedSeals && (
                  <div className="space-y-4 animate-in zoom-in duration-200 text-center">
                    <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-base font-black text-emerald-800 uppercase tracking-tight">Salida Confirmada</h4>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        {confirmedSeals.ids.length > 1 ? `${confirmedSeals.ids.length} Movimientos Registrados` : 'Movimiento de Sello Registrado'}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 text-left space-y-1.5 text-xs">
                      <div className="flex flex-col gap-1 text-[11px] border-b border-slate-200 pb-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-black">IDs Sellos Despachados:</span>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar pt-1">
                          {confirmedSeals.ids.map((id: string) => (
                            <span key={id} className="font-mono font-black text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded border border-slate-300">
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo Sello:</span>
                        <span className="font-black bg-slate-900 text-white px-1.5 py-0.5 rounded text-[9px] uppercase">
                          {confirmedSeals.types.join(', ')}
                        </span>
                      </div>
                      {confirmedSeals.plate && confirmedSeals.plate !== '-' && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Placa Vehículo:</span>
                          <span className="font-mono font-black text-slate-950 uppercase">{confirmedSeals.plate}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hora Salida:</span>
                        <span className="font-medium text-slate-600">{confirmedSeals.time}</span>
                      </div>
                    </div>

                    {/* Información de Contenedor Asociado */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 space-y-0.5">
                      <span className="text-[8px] font-black text-emerald-800 uppercase tracking-widest block">Contenedor Asociado</span>
                      <p className="text-sm font-mono font-black text-emerald-950 tracking-wider uppercase">{confirmedSeals.containerId}</p>
                    </div>

                    {countdown !== null && (
                      <div className="text-[10px] text-emerald-600 font-black uppercase tracking-wider py-1 animate-pulse">
                        Próximo escaneo en {countdown} segundos...
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={handleNextScan} 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl transition-all shadow-md text-[10px] uppercase tracking-widest"
                      >
                        Escanear Siguiente
                      </button>
                      <button 
                        onClick={handleCloseCamera} 
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black py-2.5 rounded-xl transition-all border border-slate-200 text-[10px] uppercase tracking-widest"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )
          ) : (
            // --- MODO GATILLO/LECTOR LÁSER (Especializado para Handhelds Zebra/Honeywell y alta velocidad) ---
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-6 space-y-5">
              
              <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <div className="bg-custom-blue/10 w-10 h-10 rounded-full flex items-center justify-center text-custom-blue">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h.008v.008H12V12z" />
                  </svg>
                </div>
                <div className="space-y-0.5">
                  <span className="inline-flex items-center gap-1.5 text-[9px] bg-emerald-100 text-emerald-800 font-black uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Canal Activo
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed">
                    Integrado con gatillo de terminal industrial. Los precintos leídos se validan y despachan de inmediato.
                  </p>
                </div>
              </div>

              {/* Caja de Enfoque y Entrada del Escáner */}
              <form onSubmit={handleLaserSubmit} className="space-y-4">
                <div 
                  onClick={() => inputRef.current?.focus()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isInputFocused 
                      ? 'border-emerald-400 bg-emerald-50/20 shadow-inner' 
                      : 'border-amber-400 bg-amber-50/20'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={laserInput}
                    onChange={(e) => setLaserInput(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    placeholder="Escanee con la pistola o ingrese ID..."
                    className="w-full opacity-0 absolute pointer-events-none"
                    autoFocus
                  />
                  
                  {isInputFocused ? (
                    <div className="space-y-3">
                      <div className="text-emerald-600 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Listo para Lectura (Gatillo Físico)
                      </div>
                      <p className="font-mono text-2xl font-black text-slate-800 tracking-widest select-none">
                        {laserInput ? laserInput.toUpperCase() : "--- --- ---"}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Presione el disparador físico del terminal para capturar el código.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-amber-700 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1">
                        <svg className="w-4 h-4 text-amber-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Lector Desvanecido
                      </div>
                      <button 
                        type="button" 
                        onClick={() => inputRef.current?.focus()}
                        className="bg-amber-500 hover:bg-black text-white text-[10px] font-black uppercase px-6 py-2.5 rounded-xl transition-all tracking-wider shadow-sm"
                      >
                        Haga Clic para Re-enfocar Lector
                      </button>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        El enfoque de la terminal se desvió. Toque el botón antes de volver a escanear.
                      </p>
                    </div>
                  )}
                </div>

                {/* Entrada Manual Auxiliar en caso de códigos dañados */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">¿Sello Dañado? Ingrese ID Manualmente:</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="ID DE PRECINTO" 
                      value={laserInput}
                      onChange={(e) => setLaserInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-black text-custom-blue uppercase outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    <button 
                      type="submit" 
                      disabled={!laserInput.trim()}
                      className="bg-custom-blue hover:bg-black disabled:bg-slate-200 text-white px-5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md"
                    >
                      Despachar
                    </button>
                  </div>
                </div>
              </form>

            </div>
          )}

        </div>

        {/* Columna Lateral: Historial de Escaneos de la Sesión Actual */}
        <div className="lg:col-span-5 space-y-4 w-full">
          
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Registro de Sesión</h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Precintos leídos en esta carga</p>
              </div>
              <span className="bg-custom-blue/10 text-custom-blue px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                {recentScans.filter(s => s.success).length} Despachados
              </span>
            </div>

            {recentScans.length > 0 ? (
              <div className="space-y-2 max-h-72 lg:max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {recentScans.map((scan, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                      justScannedId === scan.id 
                        ? 'bg-emerald-100 border-emerald-400 scale-[1.02] shadow-md' 
                        : scan.success 
                        ? 'bg-slate-50/80 border-slate-100' 
                        : 'bg-red-50 border-red-100'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-[11px] text-slate-900 tracking-wide truncate uppercase">
                          {scan.id}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold">
                          {scan.time}
                        </span>
                      </div>
                      <p className={`text-[9px] font-bold uppercase leading-tight truncate ${scan.success ? 'text-slate-500' : 'text-red-600'}`}>
                        {scan.details}
                      </p>
                    </div>

                    <div>
                      {scan.success ? (
                        <div className="bg-emerald-100 border border-emerald-200 w-6 h-6 rounded-full flex items-center justify-center text-emerald-600">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="bg-red-100 border border-red-200 w-6 h-6 rounded-full flex items-center justify-center text-red-600">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                <svg className="w-10 h-10 mx-auto text-slate-200 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-relaxed">
                  Ningún precinto leído todavía.<br />Los escaneos de esta sesión aparecerán aquí.
                </p>
              </div>
            )}

            {recentScans.length > 0 && (
              <button 
                onClick={() => setRecentScans([])}
                className="w-full text-slate-400 hover:text-slate-700 font-bold py-1.5 rounded-lg transition-all text-[9px] uppercase tracking-widest border border-slate-100 text-center block bg-slate-50/50"
              >
                Vaciar Registro de Sesión
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

const LoginScreen: React.FC<{ onLogin: (user: User) => void; users: User[]; settings: AppSettings }> = ({ onLogin, users, settings }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const handleLogin = (e: React.FormEvent) => { e.preventDefault(); const user = users.find(u => u.username.toLowerCase() === username.toLowerCase()); if (user) { if (user.password === password) onLogin(user); else setError('Contraseña incorrecta.'); } else setError('Usuario no encontrado o no asignado a ninguna sede.'); };
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="bg-custom-blue p-12 text-center text-white"><div className="bg-white/10 w-48 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden backdrop-blur-md border border-white/20 shadow-2xl">{settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <ICONS.Truck className="w-10 h-10" />}</div><h1 className="text-3xl font-black tracking-tight uppercase italic">{settings.title}</h1></div>
        <form onSubmit={handleLogin} className="p-10 space-y-8">{error && <div className="bg-red-50 text-red-700 p-4 rounded-xl text-[11px] font-bold border border-red-200 animate-pulse">{error}</div>}<div className="space-y-2"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Identificación de Usuario</label><input type="text" required className="w-full border border-slate-200 bg-slate-50 rounded-xl px-5 py-4 focus:bg-white focus:ring-4 focus:ring-blue-50 font-bold text-custom-blue outline-none transition-all uppercase" value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} /></div><div className="space-y-2"><label className="text-[10px] font-black text-custom-blue uppercase tracking-widest">Contraseña de Acceso</label><input type="password" required className="w-full border border-slate-200 bg-slate-50 rounded-xl px-5 py-4 focus:bg-white focus:ring-4 focus:ring-blue-50 font-bold text-custom-blue outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} /></div><button type="submit" className="w-full bg-custom-blue text-white font-black py-5 rounded-xl hover:bg-black transition-all shadow-2xl uppercase tracking-[0.2em] text-xs">Validar Credenciales</button></form>
      </div>
    </div>
  );
};

// --- ZEBRA BROWSER PRINT UTILITIES ---
const sendZPLToLocalZebra = async (zplContent: string): Promise<boolean> => {
  const bases = [
    "https://127.0.0.1:19196",
    "https://localhost:19196",
    "http://127.0.0.1:19190",
    "http://localhost:19190"
  ];

  let success = false;
  let lastError = null;

  for (const base of bases) {
    try {
      console.log(`[ZebraPrint] Probando conectar con Zebra local en ${base}...`);
      
      // Intentar obtener la impresora predeterminada
      const defaultRes = await fetch(`${base}/default?type=printer`, {
        method: "GET",
        mode: "cors",
        credentials: "omit"
      });

      if (!defaultRes.ok) {
        console.warn(`[ZebraPrint] Endpoint ${base}/default retornó estado no-ok: ${defaultRes.status}`);
        continue;
      }

      const deviceText = await defaultRes.text();
      console.log(`[ZebraPrint] Respuesta de impresora predeterminada:`, deviceText);
      
      if (!deviceText || deviceText.trim() === "" || deviceText.includes("No devices found")) {
        console.warn(`[ZebraPrint] No se encontró ninguna impresora Zebra en ${base}`);
        continue;
      }

      let deviceObj: any = null;
      try {
        deviceObj = JSON.parse(deviceText);
      } catch (err) {
        // En algunas versiones puede devolver CSV o texto plano: "nombre,uid,tipo,..."
        const parts = deviceText.split(",");
        if (parts.length >= 2) {
          deviceObj = {
            name: parts[0].trim(),
            uid: parts[1].trim(),
            connection: parts[2]?.trim() || "usb",
            deviceType: "printer",
            version: 2,
            provider: "Zebra Technologies"
          };
        }
      }

      if (!deviceObj || !deviceObj.name) {
        console.warn(`[ZebraPrint] Información de impresora inválida parseada de ${base}`);
        continue;
      }

      console.log(`[ZebraPrint] Impresora detectada con éxito:`, deviceObj.name);

      // Enviar el comando ZPL
      const payload = {
        device: deviceObj,
        data: zplContent
      };

      const writeRes = await fetch(`${base}/write`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8"
        },
        body: JSON.stringify(payload)
      });

      if (writeRes.ok) {
        console.log(`[ZebraPrint] ¡Impresión enviada satisfactoriamente a través de ${base}!`);
        success = true;
        break;
      } else {
        const errText = await writeRes.text();
        console.error(`[ZebraPrint] Error escribiendo ZPL a ${base}:`, errText);
        lastError = new Error(`Error escribiendo ZPL: ${writeRes.statusText}`);
      }
    } catch (err: any) {
      console.warn(`[ZebraPrint] No se pudo comunicar con ${base}:`, err.message || err);
      lastError = err;
    }
  }

  return success;
};

// --- MAIN APP ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [seals, setSeals] = useState<Seal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cities, setCities] = useState<string[]>(['BOGOTÁ', 'MEDELLÍN', 'CALI', 'BARRANQUILLA']);
  const [filteredSeals, setFilteredSeals] = useState<Seal[]>([]);
  const [isSearchPerformed, setIsSearchPerformed] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNewSealModalOpen, setIsNewSealModalOpen] = useState(false);
  const [selectedSeals, setSelectedSeals] = useState<Seal[]>([]);
  const [targetStatus, setTargetStatus] = useState<SealStatus | null>(null);
  const [isMoveFormOpen, setIsMoveFormOpen] = useState(false);
  const [moveData, setMoveData] = useState({ requester: '', observations: '', vehiclePlate: '', trailerContainer: '', deliveredSub: '', containerId: '' });
  const [singleLabelPerBatch, setSingleLabelPerBatch] = useState(true);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isDeleteModeActive, setIsDeleteModeActive] = useState(false);
  
  const [appSettings, setAppSettings] = useState<AppSettings>({ 
    title: 'GESTION DE SELLOS', 
    logo: null, 
    sealTypes: ['Botella', 'Cable', 'Plástico', 'Metálico'], 
    themeColor: '#003594',
    zplConfig: '^XA^FO50,50^BQN,2,10^FDQA,{{ID}}^FS^FO250,50^A0N,30,30^FDSELLO: {{ID}}^FS^FO250,100^A0N,20,20^FDTIPO: {{TYPE}}^FS^FO250,130^A0N,20,20^FDPLACA: {{PLATE}}^FS^FO250,160^A0N,20,20^FDREMOLQUE: {{TRAILER}}^FS^XZ'
  });
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const fileExcelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const color = appSettings.themeColor || '#003594';
    root.style.setProperty('--color-primary', color);
    root.style.setProperty('--color-primary-dark', darkenColor(color, 40));
    root.style.setProperty('--color-primary-light', lightenColor(color, 40));
  }, [appSettings.themeColor]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedUser = localStorage.getItem('selloUser');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));

        const [dbSeals, dbUsers, dbCities, dbSettings] = await Promise.all([
          ApiService.getSeals(),
          ApiService.getUsers(),
          ApiService.getCities(),
          ApiService.getSettings()
        ]);

        if (dbSeals && dbSeals.length > 0) setSeals(dbSeals);
        else setSeals(MOCK_DATA);

        if (dbUsers && dbUsers.length > 0) setUsers(dbUsers);
        else setUsers(MOCK_USERS);

        if (dbCities && dbCities.length > 0) setCities(dbCities);
        if (dbSettings) {
          setAppSettings(prev => ({
            ...prev,
            ...dbSettings,
            zplConfig: dbSettings.zplConfig || prev.zplConfig 
          }));
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        // Fallback to defaults if everything fails
        setSeals(MOCK_DATA);
        setUsers(MOCK_USERS);
      } finally {
        setIsInitialLoadDone(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => { if (isInitialLoadDone && seals.length > 0) ApiService.saveSeals(seals).then(res => { if (!res.success) setToast({ message: `Error al sincronizar precintos: ${res.errorMessage}`, type: 'error' }); }); }, [seals, isInitialLoadDone]);
  useEffect(() => { if (isInitialLoadDone && users.length > 0) ApiService.saveUsers(users).then(res => { if (!res.success) setToast({ message: `Error al sincronizar usuarios: ${res.errorMessage}`, type: 'error' }); }); }, [users, isInitialLoadDone]);
  useEffect(() => { if (isInitialLoadDone) ApiService.saveCities(cities).then(success => { if (!success) setToast({ message: 'Error al sincronizar ciudades con la nube.', type: 'error' }); }); }, [cities, isInitialLoadDone]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(null), 4000); return () => clearTimeout(timer); } }, [toast]);

  const handleRestoreDB = async (data: any) => {
    if (data.seals) {
      const res = await ApiService.saveSeals(data.seals);
      if (!res.success) alert(`Error al restaurar sellos: ${res.errorMessage}`);
    }
    if (data.users) await ApiService.saveUsers(data.users);
    if (data.cities) await ApiService.saveCities(data.cities);
    if (data.settings) await ApiService.saveSettings(data.settings);
  };

  const handleLogin = (u: User) => { setCurrentUser(u); localStorage.setItem('selloUser', JSON.stringify(u)); setIsSearchPerformed(false); setFilteredSeals([]); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('selloUser'); setActiveTab('dashboard'); setIsSearchPerformed(false); setIsDeleteModeActive(false); };
  const handleUpdateSettings = async (s: AppSettings) => { setAppSettings(s); await ApiService.saveSettings(s); };
  const handleAddUser = (u: User) => {
    setUsers([...users, u]);
    setToast({ message: `Usuario "${u.fullName}" registrado exitosamente`, type: 'success' });
  };
  const handleUpdateUser = (updatedUser: User) => {
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
    setToast({ message: `Usuario "${updatedUser.fullName}" actualizado exitosamente`, type: 'success' });
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('selloUser', JSON.stringify(updatedUser));
    }
  };
  const handleDeleteUser = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este usuario?')) {
      const success = await ApiService.deleteUser(id);
      if (success) {
        setUsers(users.filter(u => u.id !== id));
        setToast({message: "Usuario eliminado", type: 'success'});
      }
    }
  };
  const handleAddCity = (city: string) => setCities([...cities, city.toUpperCase()]);
  const handleDeleteCity = async (city: string) => { 
    if (users.some(u => u.city?.toUpperCase() === city.toUpperCase())) return alert('No se puede eliminar una ciudad que tiene usuarios asociados.'); 
    if (window.confirm(`¿Eliminar la ciudad ${city}?`)) {
      const success = await ApiService.deleteCity(city.toUpperCase());
      if (success) {
        setCities(cities.filter(c => c.toUpperCase() !== city.toUpperCase())); 
        setToast({message: "Ciudad eliminada", type: 'success'});
      }
    }
  };
  const handleUpdateCity = (oldCity: string, newCity: string) => { 
    setCities(cities.map(c => c.toUpperCase() === oldCity.toUpperCase() ? newCity.toUpperCase() : c.toUpperCase())); 
    setUsers(users.map(u => u.city?.toUpperCase() === oldCity.toUpperCase() ? { ...u, city: newCity.toUpperCase() } : u)); 
    setSeals(seals.map(s => s.city?.toUpperCase() === oldCity.toUpperCase() ? { ...s, city: newCity.toUpperCase() } : s)); 
  };

  const handleConfirmExit = (ids: string | string[]) => {
    const now = new Date().toLocaleString('es-ES');
    const idArray = Array.isArray(ids) ? ids.map(id => id.toUpperCase()) : [ids.toUpperCase()];
    
    setSeals(prev => prev.map(s => 
      idArray.includes(s.id.toUpperCase()) 
        ? { 
            ...s, 
            status: SealStatus.DESPACHADO, 
            lastMovement: now,
            history: [{ date: now, fromStatus: s.status, toStatus: SealStatus.DESPACHADO, user: currentUser?.fullName || 'CONTROL SALIDA', details: 'Salida de fábrica confirmada vía escaneo QR' }, ...s.history]
          } 
        : s
    ));
    setToast({message: `SALIDA CONFIRMADA: ${idArray.join(', ')}`, type: 'success'});
  };
  
  const checkSealDuplicate = (id: string, type: string) => seals.some(s => s.id.toUpperCase() === id.toUpperCase() && s.type.toUpperCase() === type.toUpperCase());
  
  const handleAddSeal = (s: Seal) => { 
    if (checkSealDuplicate(s.id, s.type)) { setToast({message: "Sello ya existe, favor verificar", type: 'error'}); return false; } 
    const sealWithCity = { ...s, city: currentUser?.city.toUpperCase() || 'SEDE CENTRAL' }; 
    setSeals([sealWithCity, ...seals]); 
    return true; 
  };

  const handleDeleteSeal = async (id: string) => { 
    if (window.confirm(`¿Está seguro de eliminar permanentemente el sello ${id}? Esta acción no se puede deshacer.`)) { 
      const success = await ApiService.deleteSeal(id);
      if (success) {
        const updatedSeals = seals.filter(s => s.id.toUpperCase() !== id.toUpperCase()); 
        setSeals(updatedSeals); 
        if (isSearchPerformed) setFilteredSeals(filteredSeals.filter(s => s.id.toUpperCase() !== id.toUpperCase())); 
        setToast({message: "Sello eliminado con éxito", type: 'success'}); 
      } else {
        setToast({message: "Error al eliminar de la base de datos", type: 'error'});
      }
    } 
  };

  const handleInventoryDownload = () => { 
    const exportData = (isSearchPerformed ? filteredSeals : seals)
      .filter(s => s.city?.toUpperCase() === currentUser?.city.toUpperCase())
      .map(s => ({ ID: s.id, Estado: s.status, Tipo: s.type, "Fecha Alta": s.creationDate, "Último Movimiento": s.lastMovement, Operador: s.entryUser })); 
    exportToExcel(exportData, `Inventario_GestionSellos_${currentUser?.city}`); 
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (!file || !currentUser) return; 
    const reader = new FileReader(); 
    reader.onload = (evt) => { 
      const bstr = evt.target?.result; 
      const wb = XLSX.read(bstr, { type: 'binary' }); 
      const wsname = wb.SheetNames[0]; 
      const ws = wb.Sheets[wsname]; 
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]; 
      const now = new Date().toLocaleString('es-ES'); 
      const newSealsBatch: Seal[] = []; 
      let duplicateCount = 0; 
      for (let i = 1; i < data.length; i++) { 
        const sealId = String(data[i][0] || '').toUpperCase(); 
        const sealType = appSettings.sealTypes[0] || 'Genérico'; 
        if (sealId) { 
          const isDuplicate = seals.some(s => s.id.toUpperCase() === sealId) || newSealsBatch.some(s => s.id === sealId); 
          if (!isDuplicate) newSealsBatch.push({ 
            id: sealId, 
            type: sealType, 
            status: SealStatus.ENTRADA_INVENTARIO, 
            creationDate: now, 
            lastMovement: now, 
            entryUser: currentUser.fullName, 
            orderNumber: '-', 
            containerId: '-', 
            notes: 'Carga Masiva Excel', 
            city: currentUser.city.toUpperCase(), 
            history: [{ date: now, fromStatus: null, toStatus: SealStatus.ENTRADA_INVENTARIO, user: currentUser.fullName, details: `Alta masiva Excel en ${currentUser.city}` }] 
          }); 
          else duplicateCount++; 
        } 
      } 
      if (newSealsBatch.length > 0) { 
        setSeals([...newSealsBatch, ...seals]); 
        let msg = "SELLOS CARGADOS EXITOSAMENTE"; 
        if (duplicateCount > 0) msg += ` (${duplicateCount} omitidos por duplicidad)`; 
        setToast({message: msg, type: duplicateCount > 0 ? 'error' : 'success'}); 
      } else if (duplicateCount > 0) setToast({message: "Sello ya existe, favor verificar (Todos los registros del Excel ya existen)", type: 'error'}); 
      else alert("No se encontraron registros válidos en el archivo."); 
    }; 
    reader.readAsBinaryString(file); 
    if (fileExcelRef.current) fileExcelRef.current.value = ''; 
  };

  const handleInventorySearch = (filters: FilterOptions) => { 
    if (!currentUser) return; 
    let result = seals.filter(s => s.city?.toUpperCase() === currentUser.city.toUpperCase()); 
    if (filters.idSello) result = result.filter(s => s.id.toUpperCase().includes(filters.idSello.toUpperCase())); 
    if (filters.estado) result = result.filter(s => s.status === filters.estado); 
    if (filters.tipo !== 'Todos') result = result.filter(s => s.type === filters.tipo); 
    setFilteredSeals(result); 
    setIsSearchPerformed(true); 
  };

  const initiateMovement = (selectedBatch: Seal[], status: SealStatus) => { setSelectedSeals(selectedBatch); setTargetStatus(status); setMoveData({ requester: '', observations: '', vehiclePlate: '', trailerContainer: '', deliveredSub: '', containerId: '' }); setIsMoveFormOpen(true); };
  
  const handleConfirmMovement = async () => { 
    if (selectedSeals.length === 0 || !targetStatus) return; 
    let details = ""; 

    if (targetStatus === SealStatus.SALIDA_FABRICA) { 
      if (!moveData.vehiclePlate || !moveData.trailerContainer) {
        setToast({message: "Placa y Remolque obligatorios", type: 'error'});
        return;
      }
      details = `RECEPTOR: ${moveData.requester || '-'} | PLACA: ${moveData.vehiclePlate} | REMOLQUE: ${moveData.trailerContainer} | CONTENEDOR: ${moveData.containerId || '-'} | TRANSPORTE: ${moveData.deliveredSub || '-'} | OBS: ${moveData.observations || '-'}`;
      
      // Abrir ventana de impresión optimizada para etiquetas con pre-carga de imágenes
      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const logoHtml = appSettings.logo 
            ? `<img src="${appSettings.logo}" style="height: 10mm; max-width: 45mm; object-fit: contain;" referrerPolicy="no-referrer" />`
            : `<div style="font-size: 14px; font-weight: 900; color: #003594; letter-spacing: 0.05em; text-transform: uppercase;">${appSettings.title.toUpperCase()}</div>`;

          let labelsHtml = "";
          if (singleLabelPerBatch && selectedSeals.length > 1) {
            const combinedIds = selectedSeals.map(s => s.id).join(', ');
            const combinedTypes = Array.from(new Set(selectedSeals.map(s => s.type))).join(', ');
            const qrData = `SELLO: ${combinedIds}
TIPO: ${combinedTypes}
PLACA: ${moveData.vehiclePlate || '-'}
REMOLQUE: ${moveData.trailerContainer || '-'}
CONTENEDOR: ${moveData.containerId || '-'}
TRANSPORTE: ${moveData.deliveredSub || '-'}
RECEPTOR: ${moveData.requester || '-'}
FECHA: ${new Date().toLocaleString('es-ES')}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
            labelsHtml = `
              <div class="label-tag">
                <!-- CABECERA -->
                <div class="label-header">
                  <div class="logo-area">
                    ${logoHtml}
                  </div>
                  <div class="placa-title">
                    PLACA: ${moveData.vehiclePlate ? moveData.vehiclePlate.toUpperCase() : '-'}
                  </div>
                  <div class="badge-area">
                    <span class="label-badge">LOTE (${selectedSeals.length})</span>
                  </div>
                </div>

                <!-- CONTENIDO PRINCIPAL -->
                <div class="label-body" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%; height: 36mm; gap: 4mm;">
                  <div class="qr-box" style="width: 32mm; height: 32mm; flex-shrink: 0;">
                    <img src="${qrUrl}" class="qr-image" referrerPolicy="no-referrer" />
                  </div>
                  <div class="batch-details" style="flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: left; font-size: 10px; line-height: 1.3;">
                    <div style="font-weight: 900; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 4px; font-size: 11px; text-transform: uppercase;">Detalle de Sellos:</div>
                    <div class="seals-list" style="font-family: monospace; font-weight: 900; font-size: 10px; color: #000; word-break: break-all; max-height: 22mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical;">
                      ${combinedIds}
                    </div>
                    <div style="margin-top: 4px; font-size: 8px; font-weight: bold; color: #555;">TIPO: ${combinedTypes.toUpperCase()}</div>
                  </div>
                </div>

                <!-- PIE DE PAGINA -->
                <div class="label-footer">
                  <span class="footer-system">AUXILIARES | NUTRESA</span>
                  <span class="footer-date">${new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            `;
          } else {
            labelsHtml = selectedSeals.map((seal, i) => {
              const qrData = `SELLO: ${seal.id}
TIPO: ${seal.type}
PLACA: ${moveData.vehiclePlate || '-'}
REMOLQUE: ${moveData.trailerContainer || '-'}
CONTENEDOR: ${moveData.containerId || '-'}
TRANSPORTE: ${moveData.deliveredSub || '-'}
RECEPTOR: ${moveData.requester || '-'}
FECHA: ${new Date().toLocaleString('es-ES')}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
              return `
                <div class="label-tag">
                  <!-- CABECERA -->
                  <div class="label-header">
                    <div class="logo-area">
                      ${logoHtml}
                    </div>
                    <div class="placa-title">
                      PLACA: ${moveData.vehiclePlate ? moveData.vehiclePlate.toUpperCase() : '-'}
                    </div>
                    <div class="badge-area">
                      <span class="label-badge">${seal.type.toUpperCase()}</span>
                    </div>
                  </div>

                  <!-- CONTENIDO PRINCIPAL -->
                  <div class="label-body">
                    <div class="qr-box">
                      <img src="${qrUrl}" class="qr-image" referrerPolicy="no-referrer" />
                    </div>
                  </div>

                  <!-- PIE DE PAGINA -->
                  <div class="label-footer">
                    <span class="footer-system">AUXILIARES | NUTRESA</span>
                    <span class="footer-date">${new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              `;
            }).join('');
          }

          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Impresión de Etiquetas - ${appSettings.title}</title>
                <style>
                  * {
                    box-sizing: border-box;
                  }
                  body {
                    margin: 0;
                    padding: 20px;
                    background-color: #f1f5f9;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  }
                  .label-tag {
                    width: 100mm;
                    height: 60mm;
                    border: 2px dashed #64748b;
                    padding: 3mm 4mm;
                    margin: 15px auto;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    page-break-after: always;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    position: relative;
                    box-sizing: border-box;
                    color: black;
                  }
                  .label-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #000;
                    padding-bottom: 1.5mm;
                    margin-bottom: 2mm;
                    height: 12mm;
                  }
                  .logo-area {
                    display: flex;
                    align-items: center;
                    max-width: 24mm;
                    flex-shrink: 0;
                  }
                  .logo-area img {
                    height: 8mm;
                    max-width: 24mm;
                    object-fit: contain;
                  }
                  .placa-title {
                    font-size: 16px;
                    font-weight: 900;
                    color: #000;
                    text-align: center;
                    flex: 1;
                    font-family: inherit;
                    letter-spacing: -0.01em;
                    white-space: nowrap;
                  }
                  .badge-area {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    max-width: 20mm;
                    flex-shrink: 0;
                  }
                  .label-badge {
                    font-size: 8.5px;
                    font-weight: 900;
                    background: #000;
                    color: #fff;
                    padding: 2px 7px;
                    border-radius: 3px;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    display: inline-block;
                  }
                  .label-body {
                    display: flex;
                    flex: 1;
                    align-items: center;
                    justify-content: center;
                    height: 36mm;
                  }
                  .qr-box {
                    width: 32mm;
                    height: 32mm;
                    border: 1px solid #e4e4e7;
                    padding: 1.2mm;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  }
                  .qr-image {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                  }
                  .label-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 2px solid #000;
                    padding-top: 1mm;
                    margin-top: 2mm;
                    height: 5mm;
                  }
                  .footer-system {
                    font-size: 7.5px;
                    font-weight: 800;
                    color: #000;
                    letter-spacing: 0.03em;
                  }
                  .footer-date {
                    font-size: 7.5px;
                    font-weight: 800;
                    color: #000;
                  }
                  
                  @media print {
                    @page {
                      size: 100mm 60mm;
                      margin: 0;
                    }
                    body {
                      background: white;
                      padding: 0;
                      margin: 0;
                    }
                    .label-tag {
                      width: 100mm;
                      height: 60mm;
                      border: none;
                      margin: 0;
                      box-shadow: none;
                      page-break-after: always;
                    }
                    .label-tag:last-child {
                      page-break-after: avoid;
                    }
                    .no-print {
                      display: none !important;
                    }
                  }
                  
                  .print-bar {
                    background: #1e293b;
                    color: white;
                    padding: 12px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    max-width: 100mm;
                    margin: 0 auto 10px auto;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                  }
                  .btn-action {
                    background: ${appSettings.themeColor || '#003594'};
                    color: white;
                    border: none;
                    padding: 6px 14px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    cursor: pointer;
                    letter-spacing: 0.05em;
                  }
                </style>
              </head>
              <body>
                <div class="print-bar no-print">
                  <span style="font-size: 11px; font-weight: 600;">Impresión lista (${singleLabelPerBatch && selectedSeals.length > 1 ? '1' : selectedSeals.length} etiquetas)</span>
                  <button class="btn-action" onclick="window.print()">Imprimir de nuevo</button>
                </div>

                <div id="labels-container">
                  ${labelsHtml}
                </div>

                <script>
                  window.addEventListener('load', function() {
                    // Esperar a que se carguen el logo y los códigos QR
                    var images = Array.from(document.querySelectorAll('img'));
                    var promises = images.map(function(img) {
                      if (img.complete) return Promise.resolve();
                      return new Promise(function(resolve) {
                        img.onload = resolve;
                        img.onerror = resolve; // no bloquear en caso de error de imagen
                      });
                    });

                    Promise.all(promises).then(function() {
                      // Pequeña espera para renderizado completo e invocar la ventana de impresión estándar
                      setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                          window.close();
                        }, 200);
                      }, 400);
                    });
                  });
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      } catch (err) {
        console.error("Error al abrir ventana de impresión:", err);
        setToast({message: "Fallo al abrir ventana de impresión. Compruebe los permisos de ventanas emergentes.", type: 'error'});
      }
    } else if (targetStatus === SealStatus.DESTRUIDO) { 
      if (!moveData.observations) return alert("El Motivo es obligatorio."); 
      details = `MOTIVO DESTRUCCIÓN: ${moveData.observations}`; 
    } else details = moveData.observations || `Cambio de estado a ${targetStatus.replace('_', ' ')}`; 
    
    const now = new Date().toLocaleString('es-ES'); 
    const selectedIds = selectedSeals.map(s => s.id.toUpperCase()); 
    const updated = seals.map(s => { 
      if (selectedIds.includes(s.id.toUpperCase())) return { 
        ...s, 
        status: targetStatus, 
        lastMovement: now, 
        entryUser: currentUser?.fullName || 'SISTEMA', 
        containerId: targetStatus === SealStatus.SALIDA_FABRICA ? (moveData.containerId || s.containerId || '-') : s.containerId,
        history: [{ date: now, fromStatus: s.status, toStatus: targetStatus, user: currentUser?.fullName || 'SISTEMA', details: selectedSeals.length > 1 ? `[MASIVO] ${details}` : details }, ...s.history] 
      }; 
      return s; 
    }); 
    setSeals(updated); 
    if (isSearchPerformed) setFilteredSeals(prev => prev.map(s => { 
      const match = updated.find(u => u.id.toUpperCase() === s.id.toUpperCase()); 
      return match ? match : s; 
    })); 
    const wasDispatch = targetStatus === SealStatus.SALIDA_FABRICA;
    setIsMoveFormOpen(false); 
    setSelectedSeals([]); 
    setTargetStatus(null); 
    
    if (wasDispatch) {
      setToast({message: "Movimiento exitoso. Etiquetas enviadas a impresión", type: 'success'}); 
    } else {
      setToast({message: "Movimiento procesado correctamente", type: 'success'}); 
    }
  };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} users={users} settings={appSettings} />;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-top-4"><div className={`px-8 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'}`}><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">{toast.type === 'success' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>}</div><p className="text-xs font-black uppercase tracking-widest">{toast.message}</p></div></div>}
      <aside className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 overflow-y-auto hidden md:block border-r border-slate-800 shadow-2xl z-20">
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center gap-4 mb-12">
            <div className="bg-custom-blue p-2 rounded-xl shadow-lg w-22 h-11 flex items-center justify-center shrink-0 border border-blue-400/30">
              {appSettings.logo ? <img src={appSettings.logo} className="w-full h-full object-contain" /> : <ICONS.Truck className="text-white" />}
            </div>
            <h1 className="text-sm font-black tracking-tight leading-tight uppercase italic text-white">{appSettings.title}</h1>
          </div>
          <nav className="space-y-1.5 flex-1">
            {currentUser.role !== UserRole.AUXILIAR_SALIDA ? (
              <>
                <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'dashboard' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.Dashboard className="w-5 h-5" /> Dashboard</button>
                <button onClick={() => { setActiveTab('inventory'); setIsSearchPerformed(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'inventory' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.Search className="w-5 h-5" /> Inventario</button>
                <button onClick={() => setActiveTab('movements')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'movements' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.Move className="w-5 h-5" /> Movimientos</button>
                <button onClick={() => setActiveTab('traceability')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'traceability' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.History className="w-5 h-5" /> Trazabilidad</button>
              </>
            ) : (
              <button onClick={() => setActiveTab('despacho')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'despacho' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.Move className="w-5 h-5" /> Escáner Salida</button>
            )}
            {currentUser.role === UserRole.ADMIN && (
              <>
                <div className="h-px bg-slate-800 my-6"></div>
                <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'users' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.Users className="w-5 h-5" /> Usuarios</button>
                <button onClick={() => setActiveTab('cities')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'cities' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><ICONS.Map className="w-5 h-5" /> Ciudades</button>
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-xs uppercase tracking-widest ${activeTab === 'settings' ? 'bg-custom-blue text-white shadow-xl translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Configuración</button>
              </>
            )}
          </nav>
          <div className="pt-8 border-t border-slate-800 mt-auto text-center">
            <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Sede: {currentUser.city}</p>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-red-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest hover:bg-red-900/20"><ICONS.Logout className="w-4 h-4" /> Salir del Sistema</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 md:ml-64 pt-16 min-w-0 bg-slate-50 min-h-screen"><header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-0 md:left-64 z-10 flex items-center justify-between px-10"><h2 className="text-sm font-black text-custom-blue uppercase tracking-[0.2em]">{activeTab.toUpperCase()}</h2><div className="flex items-center gap-6">{currentUser.role === UserRole.ADMIN && activeTab === 'inventory' && <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Modo Seguro (Borrado)</span><button onClick={() => setIsDeleteModeActive(!isDeleteModeActive)} className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isDeleteModeActive ? 'bg-red-500' : 'bg-slate-200'}`}><span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isDeleteModeActive ? 'translate-x-5' : 'translate-x-0'}`}></span></button></div>}<div className="flex items-center gap-3"><span className="text-[10px] font-bold text-custom-blue uppercase tracking-widest">Sede {currentUser.city}</span><div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse border border-white"></div></div></div></header>
        <div className="p-8 sm:p-12">
          {activeTab === 'dashboard' && <DashboardView seals={seals} user={currentUser} cities={cities} />}
          {activeTab === 'inventory' && <div className="space-y-8 animate-in fade-in duration-500"><div className="flex flex-wrap items-center justify-between bg-white p-5 rounded-3xl border border-slate-200 shadow-sm gap-4"><div className="flex flex-wrap gap-4"><button onClick={() => setIsNewSealModalOpen(true)} className="bg-custom-blue text-white px-7 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-custom-blue-dark transition-all shadow-lg">Nuevo Sello</button><button onClick={() => fileExcelRef.current?.click()} className="bg-white text-custom-blue border border-custom-blue px-7 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2"><ICONS.Import className="w-4 h-4" /> Carga Masiva</button><button onClick={() => setIsSearchModalOpen(true)} className="bg-white text-custom-blue border border-custom-blue px-7 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2"><ICONS.Search className="w-4 h-4" /> Búsqueda</button></div><button onClick={handleInventoryDownload} className="bg-emerald-600 text-white px-7 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg"><ICONS.Excel className="w-4 h-4" /> Exportar Inventario</button><input ref={fileExcelRef} type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" /></div>{isSearchPerformed ? <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300"><div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resultados: <span className="text-custom-blue">{filteredSeals.length} precintos encontrados</span></p><button onClick={() => setIsSearchPerformed(false)} className="text-[10px] font-black text-custom-blue uppercase hover:underline">Limpiar Resultados</button></div><div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black uppercase tracking-widest"><tr><th className="px-8 py-6 text-custom-blue">ID Sello</th><th className="px-8 py-6 text-custom-blue">Estado Logístico</th><th className="px-8 py-6 text-custom-blue">Tipo</th><th className="px-8 py-6 text-custom-blue">Operador</th><th className="px-8 py-6 text-custom-blue">Ciudad</th>{isDeleteModeActive && currentUser.role === UserRole.ADMIN && <th className="px-8 py-6 text-red-600 text-right">Acciones</th>}</tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-900">{filteredSeals.length > 0 ? filteredSeals.map(s => (<tr key={s.id} onClick={() => !isDeleteModeActive && initiateMovement([s], s.status)} className={`group transition-all ${!isDeleteModeActive ? 'hover:bg-blue-50/30 cursor-pointer' : ''}`}><td className="px-8 py-5 font-black font-mono text-[14px] text-custom-blue group-hover:text-blue-600 uppercase">{s.id}</td><td className="px-8 py-5"><span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${getStatusStyles(s.status).split('icon-bg-')[0]}`}>{s.status.replace('_', ' ')}</span></td><td className="px-8 py-5 text-slate-700 font-bold uppercase text-[9px]">{s.type}</td><td className="px-8 py-5 uppercase font-black text-[10px] text-slate-700">{s.entryUser}</td><td className="px-8 py-5 text-custom-blue font-black text-[10px] uppercase">{s.city}</td>{isDeleteModeActive && currentUser.role === UserRole.ADMIN && (<td className="px-8 py-5 text-right"><button onClick={(e) => { e.stopPropagation(); handleDeleteSeal(s.id); }} className="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar Precinto Permanentemente"><ICONS.Trash className="w-4 h-4" /></button></td>)}</tr>)) : (<tr><td colSpan={isDeleteModeActive ? 6 : 5} className="px-8 py-20 text-center font-bold text-slate-400 uppercase tracking-widest">No se encontraron registros</td></tr>)}</tbody></table></div></div> : <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-32 text-center space-y-4"><div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm"><ICONS.Search className="w-8 h-8 text-blue-100 opacity-50" /></div><p className="font-black text-slate-300 uppercase text-xs tracking-[0.3em]">Utilice el botón "Búsqueda" para consultar el inventario de {currentUser.city}</p></div>}</div>}
          {activeTab === 'movements' && <MovementsView seals={seals} onInitiateMove={initiateMovement} user={currentUser} />}
          {activeTab === 'traceability' && <TraceabilityView seals={seals} user={currentUser} />}
          {activeTab === 'despacho' && <DespachoScannerView seals={seals} onConfirmExit={handleConfirmExit} user={currentUser} setActiveTab={setActiveTab} />}
          {activeTab === 'users' && currentUser.role === UserRole.ADMIN && <UserManagement users={users} cities={cities} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />}
          {activeTab === 'cities' && currentUser.role === UserRole.ADMIN && <CityManagement cities={cities} onAddCity={handleAddCity} onDeleteCity={handleDeleteCity} onUpdateCity={handleUpdateCity} />}
          {activeTab === 'settings' && currentUser.role === UserRole.ADMIN && <SettingsView settings={appSettings} onUpdate={handleUpdateSettings} onRestoreDB={handleRestoreDB} />}
        </div>
      </main>

      {/* Modal Alta Precinto */}
      {isNewSealModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in duration-200">
            <div className="bg-custom-blue px-8 py-5 text-white font-black text-[10px] uppercase tracking-[0.2em] flex justify-between items-center">
              <span>Nuevo Precinto - {currentUser.city}</span>
              <button onClick={() => setIsNewSealModalOpen(false)} className="hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">ID Precinto</label>
                  <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-2xl p-4 text-sm font-mono font-bold text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase" placeholder="Ej: BOG-4432" id="new-seal-id" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">Tipo de Precinto</label>
                  <div className="relative">
                    <select className="w-full border border-slate-200 bg-slate-50 rounded-2xl p-4 text-sm font-bold text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all appearance-none" id="new-seal-type">
                      {appSettings.sealTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-custom-blue">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-6 pt-4">
                <button onClick={() => setIsNewSealModalOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button 
                  onClick={() => { 
                    const idEl = document.getElementById('new-seal-id') as HTMLInputElement; 
                    const typeEl = document.getElementById('new-seal-type') as HTMLSelectElement; 
                    const id = idEl.value.toUpperCase(); 
                    const type = typeEl.value; 
                    if (!id) return alert('ID obligatorio'); 
                    const now = new Date().toLocaleString('es-ES'); 
                    const success = handleAddSeal({ 
                      id, 
                      type, 
                      status: SealStatus.ENTRADA_INVENTARIO, 
                      creationDate: now, 
                      lastMovement: now, 
                      entryUser: currentUser.fullName, 
                      orderNumber: '-', 
                      containerId: '-', 
                      notes: 'Alta Sede', 
                      city: currentUser.city.toUpperCase(), 
                      history: [{ date: now, fromStatus: null, toStatus: SealStatus.ENTRADA_INVENTARIO, user: currentUser.fullName, details: `Alta inicial en ${currentUser.city}` }] 
                    }); 
                    if (success) { 
                      setIsNewSealModalOpen(false); 
                      setToast({message: "PRECINTO REGISTRADO", type: 'success'}); 
                    } 
                  }} 
                  className="bg-custom-blue text-white px-12 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black hover:-translate-y-1 transition-all active:scale-95"
                >
                  Registrar Precinto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Movimiento */}
      {isMoveFormOpen && selectedSeals.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-custom-blue px-6 py-4 flex justify-between items-center text-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest">
                {selectedSeals.length > 1 ? `GESTIÓN MASIVA: ${selectedSeals.length} UNIDADES` : `GESTIONAR: ${selectedSeals[0].id}`}
              </h3>
              <button onClick={() => setIsMoveFormOpen(false)} className="hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {targetStatus === selectedSeals[0].status ? (
                <div className="space-y-4 text-center">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${getStatusTextColor(selectedSeals[0].status)}`}>
                    Estado Actual: {selectedSeals[0].status.replace('_', ' ')}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedSeals[0].status === SealStatus.ENTRADA_INVENTARIO && (
                      <button onClick={() => setTargetStatus(SealStatus.SALIDA_FABRICA)} className="bg-sky-600 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-sky-700 transition-all">Asignación e Instalación Sello</button>
                    )}
                    <button onClick={() => setTargetStatus(SealStatus.DESTRUIDO)} className="bg-red-600 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all">Mover a Destruido</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border bg-white shadow-sm ${getStatusStyles(selectedSeals[0].status).split('icon-bg-')[0]}`}>
                      {selectedSeals[0].status.replace('_', ' ')}
                    </span>
                    <ICONS.ArrowRightTiny className="text-slate-300 w-3.5 h-3.5" />
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border bg-white shadow-sm ${targetStatus ? getStatusStyles(targetStatus).split('icon-bg-')[0] : ''}`}>
                      {targetStatus?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                    {targetStatus === SealStatus.SALIDA_FABRICA ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">Nombre del Receptor</label>
                          <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase" value={moveData.requester} onChange={e => setMoveData({...moveData, requester: e.target.value.toUpperCase()})} placeholder="Nombre del receptor" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">Placa (Obligatorio)</label>
                            <input type="text" required className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-black font-mono text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase" value={moveData.vehiclePlate} onChange={e => setMoveData({...moveData, vehiclePlate: e.target.value.toUpperCase()})} placeholder="ABC-123" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">Remolque (Obligatorio)</label>
                            <input type="text" required className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-black font-mono text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase" value={moveData.trailerContainer} onChange={e => setMoveData({...moveData, trailerContainer: e.target.value.toUpperCase()})} placeholder="Nro Remolque" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">Número de Transporte</label>
                            <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase" value={moveData.deliveredSub} onChange={e => setMoveData({...moveData, deliveredSub: e.target.value.toUpperCase()})} placeholder="Nro transporte" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">ID Contenedor</label>
                            <input type="text" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm font-bold text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase" value={moveData.containerId} onChange={e => setMoveData({...moveData, containerId: e.target.value.toUpperCase()})} placeholder="ID contenedor" />
                          </div>
                        </div>
                        {selectedSeals.length > 1 && (
                          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 p-3 rounded-xl">
                            <input 
                              type="checkbox" 
                              id="toggle-single-label" 
                              checked={singleLabelPerBatch} 
                              onChange={e => setSingleLabelPerBatch(e.target.checked)} 
                              className="w-4 h-4 text-custom-blue rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="toggle-single-label" className="text-[10px] font-black text-custom-blue uppercase tracking-wider cursor-pointer select-none">
                              Generar una sola etiqueta para todo el lote
                            </label>
                          </div>
                        )}
                      </>
                    ) : null}
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-custom-blue uppercase tracking-widest ml-1">Observaciones</label>
                      <textarea className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2 text-sm font-bold text-custom-blue outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all uppercase min-h-[60px] resize-none" value={moveData.observations} onChange={e => setMoveData({...moveData, observations: e.target.value.toUpperCase()})} placeholder="Detalles adicionales..." />
                    </div>
                  </div>
                  
                  <div className="flex gap-4 pt-1">
                    <button type="button" onClick={() => setTargetStatus(selectedSeals[0]?.status || null)} className="flex-1 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Atrás</button>
                    <button onClick={handleConfirmMovement} className={`flex-1 text-white py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all hover:-translate-y-0.5 active:scale-95 ${targetStatus === SealStatus.DESTRUIDO ? 'bg-red-600' : 'bg-custom-blue'}`}>Confirmar Sello</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }`}</style>
      <InventorySearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} onSearch={handleInventorySearch} sealTypes={appSettings.sealTypes} />
    </div>
  );
}
