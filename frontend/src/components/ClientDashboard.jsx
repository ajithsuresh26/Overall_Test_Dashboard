import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import AnomaliesExplorer from './AnomaliesExplorer'; 
import {
    ShieldAlert, CheckCircle, AlertTriangle, Clock, Mail,
    Smartphone, MessageSquare, RefreshCw, X, Send, Plus,
    Edit3, Trash2, Settings, Eye, EyeOff, Shield, Activity, Bot, Save,
    User, Flame, Wind, Zap, Lock, Camera, HelpCircle, Filter, Bell,
    LayoutList, Table2, TrendingUp, ChevronRight, ChevronLeft,
    LogOut, BarChart3, PieChart, Calendar as CalendarIcon, ChevronDown, Award,
    Grid, Maximize2, Menu, SlidersHorizontal, Cpu, ShieldCheck, MailOpen
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip, PieChart as RePieChart, Pie, Cell,
    BarChart, Bar
} from 'recharts';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const resolveImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    let clean = path.replace(/\\/g, '/');
    if (clean.startsWith('.')) clean = clean.substring(1);
    if (!clean.startsWith('/')) clean = '/' + clean;
    return `${BASE_URL}${clean}`;
};

const ANOMALY_TYPES = {
    'person': { label: 'Person Detected', icon: <User size={12} />, color: 'bg-violet-50 text-violet-700 border-violet-100', hex: '#6366F1' },
    'person detected': { label: 'Person Detected', icon: <User size={12} />, color: 'bg-violet-50 text-violet-700 border-violet-100', hex: '#6366F1' },
    'intrusion': { label: 'Intrusion', icon: <Lock size={12} />, color: 'bg-red-50 text-red-700 border-red-100', hex: '#EF4444' },
    'fire': { label: 'Fire Explosion', icon: <Flame size={12} />, color: 'bg-orange-50 text-orange-700 border-orange-100', hex: '#F97316' },
    'smoke': { label: 'Thick Smoke', icon: <Wind size={12} />, color: 'bg-slate-100 text-slate-700 border-slate-200', hex: '#4B5563' },
    'equipment failure': { label: 'Equip. Failure', icon: <Zap size={12} />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200', hex: '#EAB308' },
    'manual alert': { label: 'Manual Alert', icon: <Bell size={12} />, color: 'bg-blue-50 text-blue-700 border-blue-100', hex: '#3B82F6' },
    'motion': { label: 'Motion', icon: <Activity size={12} />, color: 'bg-teal-50 text-teal-700 border-teal-100', hex: '#14B8A6' },
    'banksman': { label: 'Banksman Req.', icon: <User size={12} />, color: 'bg-cyan-50 text-cyan-700 border-cyan-100', hex: '#06B6D4' },
    'banksman required': { label: 'Banksman Req.', icon: <User size={12} />, color: 'bg-cyan-50 text-cyan-700 border-cyan-100', hex: '#06B6D4' },
    'no_gloves': { label: 'Missing Gloves', icon: <ShieldAlert size={12} />, color: 'bg-rose-50 text-rose-700 border-rose-100', hex: '#F43F5E' },
    'missing gloves': { label: 'Missing Gloves', icon: <ShieldAlert size={12} />, color: 'bg-rose-50 text-rose-700 border-rose-100', hex: '#F43F5E' },
    'no_mask': { label: 'Missing Mask', icon: <ShieldAlert size={12} />, color: 'bg-amber-50 text-amber-700 border-amber-100', hex: '#D97706' },
    'missing mask': { label: 'Missing Mask', icon: <ShieldAlert size={12} />, color: 'bg-amber-50 text-amber-700 border-amber-100', hex: '#D97706' },
    'no-helmet': { label: 'No Helmet', icon: <ShieldAlert size={12} />, color: 'bg-red-50 text-red-600 border-red-100', hex: '#DC2626' },
    'no vest': { label: 'No Vest', icon: <ShieldAlert size={12} />, color: 'bg-orange-50 text-orange-600 border-orange-100', hex: '#EA580C' }
};

const generateFallbackColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 70%, 55%)`;
};

const getAnomalyType = (type = '') => {
    const key = String(type).toLowerCase().trim();
    if (ANOMALY_TYPES[key]) return ANOMALY_TYPES[key];
    return {
        label: type || 'Unknown Signature',
        icon: <HelpCircle size={12} />,
        color: 'bg-slate-50 text-slate-600 border-slate-100',
        hex: generateFallbackColor(key)
    };
};

const SMTP_PRESETS = {
    gmail: { host: 'smtp.gmail.com', port: 587, label: 'Gmail', hint: 'Use App Password (not login password)' },
    outlook: { host: 'smtp.office365.com', port: 587, label: 'Outlook/Office365', hint: 'Use your Microsoft account password' },
    yahoo: { host: 'smtp.mail.yahoo.com', port: 587, label: 'Yahoo Mail', hint: 'Use App Password from Yahoo Security' },
    zoho: { host: 'smtp.zoho.com', port: 587, label: 'Zoho Mail', hint: 'Use your Zoho password' },
    custom: { host: '', port: 587, label: 'Custom SMTP', hint: 'Enter your custom mail server port details manually below' },
};

const CHANNEL_ICON = {
    email: <Mail size={12} />,
    sms: <Smartphone size={12} />,
    whatsapp: <MessageSquare size={12} />,
};

const CustomChartTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-slate-100 px-3 py-2 rounded-lg shadow-xl border border-slate-800 text-xs">
                <p className="font-bold border-b border-slate-800 pb-1 mb-1">{label}</p>
                <p className="flex items-center gap-2 font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    Incidents: <span className="font-bold text-indigo-300">{payload[0].value}</span>
                </p>
            </div>
        );
    }
    return null;
};

const EmailConfigPanel = ({ clientId, onClose, triggerToast }) => {
    const [preset, setPreset] = useState('gmail');
    const [testing, setTesting] = useState(false);
    const [probing, setProbing] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [probeResult, setProbeResult] = useState(null);
    const [savedConfigRecord, setSavedConfigRecord] = useState(null);

    const [cfg, setCfg] = useState({
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        sender_name: 'Safety Alert',
        use_tls: true,
    });

    const loadConfig = () => {
        if (!clientId) return;
        api.get(`/api/alerts/email-config/${clientId}`)
            .then(r => {
                if (r.data && r.data.smtp_user) {
                    // Populate fields using a mask character proxy for the password
                    setCfg({ ...r.data, smtp_pass: '••••••••' });
                    setSavedConfigRecord(r.data);
                    const matched = Object.entries(SMTP_PRESETS).find(([, v]) => v.host === r.data.smtp_host);
                    setPreset(matched ? matched[0] : 'custom');
                } else {
                    setSavedConfigRecord(null);
                }
            })
            .catch(() => { });
    };

    useEffect(() => {
        loadConfig();
    }, [clientId]);

    const applyPreset = (key) => {
        setPreset(key);
        const p = SMTP_PRESETS[key];
        setCfg(prev => ({ ...prev, smtp_host: p.host, smtp_port: p.port || 587 }));
        setProbeResult(null);
        setTestResult(null);
    };

    const updateField = (field, value) => {
        setCfg(prev => ({ ...prev, [field]: value }));
    };

    const checkPortReachable = async () => {
        const cleanHost = (cfg.smtp_host || '').trim();
        const cleanPort = parseInt(cfg.smtp_port, 10) || 587;
        if (!cleanHost) {
            setProbeResult({ reachable: false, detail: 'Enter an SMTP host first.' });
            return;
        }
        setProbing(true);
        setProbeResult(null);
        try {
            const response = await api.get('/api/debug/smtp-check', {
                params: { host: cleanHost, port: cleanPort }
            });
            setProbeResult(response.data);
        } catch (e) {
            setProbeResult({
                reachable: false,
                detail: e.response?.data?.detail || e.message || 'Connectivity check failed.'
            });
        } finally {
            setProbing(false);
        }
    };

    const testAndSaveConnection = async () => {
        const isPasswordMasked = cfg.smtp_pass === '••••••••';
        const cleanCfg = {
            ...cfg,
            smtp_host: (cfg.smtp_host || '').trim(),
            smtp_user: (cfg.smtp_user || '').trim(),
            smtp_pass: isPasswordMasked ? 'KEEP_EXISTING_PASSWORD' : (cfg.smtp_pass || '').trim(),
            smtp_port: parseInt(cfg.smtp_port, 10) || 587,
        };

        if (!cleanCfg.smtp_user || !cleanCfg.smtp_pass) {
            setTestResult({
                success: false,
                message: "⚠️ Verification Aborted: Input fields must not be empty before testing connection settings."
            });
            return;
        }

        setTesting(true);
        setTestResult(null);
        try {
            const response = await api.post(`/api/alerts/email-config/test/${clientId}`, cleanCfg, {
                params: { test_recipient: cleanCfg.smtp_user }
            });

            if (response.data?.status === 'sent' || response.status === 200) {
                setTestResult({
                    success: true,
                    message: `SMTP Handshake Succeeded! Verification array message targeted to ${cleanCfg.smtp_user}. Settings saved cleanly.`
                });
                await api.post(`/api/alerts/email-config?client_id=${clientId}`, cleanCfg);
                triggerToast('SMTP settings committed.', 'success');
                loadConfig(); // Refresh down list view status
            }
        } catch (e) {
            const status = e.response?.status;
            let prefix = '';
            if (status === 504) prefix = '🌐 Network Layer Blocked: ';
            else if (status === 401) prefix = '🔑 Credentials Rejected: ';

            setTestResult({
                success: false,
                message: prefix + (e.response?.data?.detail || e.message || 'SMTP Handshake Refused.')
            });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Alert Settings Framework</h2>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Configure email & delivery systems</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={16} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Email Provider</label>
                        <div className="grid grid-cols-5 gap-2">
                            {Object.entries(SMTP_PRESETS).map(([key, p]) => (
                                <button key={key} type="button" onClick={() => applyPreset(key)}
                                    className={`py-2 px-1 rounded-xl text-[11px] font-semibold border transition-all truncate text-center ${preset === key ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                                    {p.label.split('/')[0]}
                                </button>
                            ))}
                        </div>
                        {preset && SMTP_PRESETS[preset]?.hint && (
                            <p className="text-[11px] text-indigo-700 bg-indigo-50 rounded-xl px-3 py-2 mt-2 border border-indigo-100 font-medium">
                                💡 {SMTP_PRESETS[preset].hint}
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">SMTP Host</label>
                                <input type="text" value={cfg.smtp_host}
                                    onChange={e => updateField('smtp_host', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all font-medium" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Port</label>
                                <input type="text" value={cfg.smtp_port}
                                    onChange={e => updateField('smtp_port', e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all font-mono font-bold" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <button type="button" onClick={checkPortReachable} disabled={probing}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors">
                                <RefreshCw size={11} className={probing ? 'animate-spin' : ''} />
                                {probing ? 'Checking connection path…' : 'Quick check: Test network port reachability'}
                            </button>
                            {probeResult && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${probeResult.reachable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {probeResult.reachable ? 'Port Reachable' : 'Port Blocked'}
                                </span>
                            )}
                        </div>
                        
                        {probeResult && !probeResult.reachable && (
                            <p className="text-[10px] font-medium bg-rose-50 text-rose-700 p-2 rounded-xl border border-rose-100 leading-relaxed font-mono">
                                {probeResult.detail}
                            </p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Email Username</label>
                                <input type="email" value={cfg.smtp_user}
                                    onChange={e => updateField('smtp_user', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all font-medium" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">App Password / Secret</label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={cfg.smtp_pass || ''}
                                        onChange={e => updateField('smtp_pass', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-10 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all font-medium" />
                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sender Alias Display</label>
                                <input type="text" value={cfg.sender_name} onChange={e => updateField('sender_name', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all font-medium" />
                            </div>
                            <div className="flex items-center h-full pt-4">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input type="checkbox" checked={cfg.use_tls} onChange={e => updateField('use_tls', e.target.checked)} className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900 accent-slate-900" />
                                    <span className="text-xs font-bold text-slate-700">Use Secure TLS Architecture</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {testResult && (
                        <div className={`p-3 rounded-xl border text-xs font-medium flex flex-col gap-1 ${testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                            <div className="font-bold flex items-center gap-1.5">
                                {testResult.success ? '✅ Validation Test Passed' : '❌ Target Validation Failed'}
                            </div>
                            <p className="font-mono text-[10px] leading-relaxed break-all bg-white/60 p-2 rounded border border-black/5 mt-1 whitespace-pre-wrap">
                                {testResult.message}
                            </p>
                        </div>
                    )}

                    {/* ── Saved Configuration Down Side Table ── */}
                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Saved Configuration Registry Active Status</label>
                        {savedConfigRecord ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                                <table className="w-full text-left border-collapse text-[11px]">
                                    <thead>
                                        <tr className="bg-slate-100/80 text-slate-500 font-bold border-b border-slate-200">
                                            <th className="p-2.5">SMTP Server / Host</th>
                                            <th className="p-2.5">Active Account User</th>
                                            <th className="p-2.5 text-center">Port</th>
                                            <th className="p-2.5 text-right">TLS Mode</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="font-medium text-slate-700">
                                            <td className="p-2.5 font-mono font-bold text-slate-900">{savedConfigRecord.smtp_host}</td>
                                            <td className="p-2.5 truncate max-w-[140px]">{savedConfigRecord.smtp_user}</td>
                                            <td className="p-2.5 text-center font-bold text-slate-600">{savedConfigRecord.smtp_port}</td>
                                            <td className="p-2.5 text-right font-bold text-indigo-600">{savedConfigRecord.use_tls ? 'Explicit/On' : 'Implicit'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                                No active delivery configurations committed to local database arrays yet.
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end items-center bg-slate-50 gap-2.5 flex-shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">
                        Cancel
                    </button>
                    <button type="button" onClick={testAndSaveConnection} disabled={testing || !cfg.smtp_user}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-900/40 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                        <RefreshCw size={13} className={testing ? "animate-spin" : ""} />
                        {testing ? 'Performing Verification…' : 'Verify Handshake & Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const OfficerPanel = ({ clientId, onClose, triggerToast }) => {
    const [officers, setOfficers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(undefined);
    const BLANK = { client_id: clientId, name: '', role: 'Safety Officer', email: '', phone: '', whatsapp: '', alert_email: true, alert_sms: false, alert_whatsapp: false, min_severity: 'Low' };
    const [form, setForm] = useState(BLANK);

    const load = async () => {
        setLoading(true);
        try { 
            const r = await api.get(`/api/alerts/officers/${clientId}`); 
            setOfficers(r.data || []); 
        } catch (e) { 
            console.error(e); 
        } finally { 
            setLoading(false); 
        }
    };
    useEffect(() => { load(); }, [clientId]);

    const startEdit = (o) => { setEditingId(o.id); setForm({ ...o, client_id: clientId }); };
    const startNew = () => { setEditingId(null); setForm({ ...BLANK, client_id: clientId }); };
    const cancelEdit = () => { setEditingId(undefined); setForm(BLANK); };

    const save = async () => {
        if (!form.name) return triggerToast('Name field is required.', 'error');
        
        if (form.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(form.email.trim())) {
                return triggerToast('Invalid email structure context format.', 'error');
            }
        }

        if (form.alert_email && !form.email) return triggerToast('Email address required if email path toggled.', 'error');
        setSaving(true);
        try {
            editingId
                ? await api.put(`/api/alerts/officers/${editingId}`, form)
                : await api.post('/api/alerts/officers', form);
            triggerToast(editingId ? 'Officer updated successfully.' : 'Officer added successfully.', 'success');
            cancelEdit(); load();
        } catch (e) { 
            triggerToast(e.response?.data?.detail || 'Failed to save entries.', 'error'); 
        } finally { 
            setSaving(false); 
        }
    };

    const remove = async (id) => {
        if (!window.confirm('Remove this officer profile registry record?')) return;
        try {
            await api.delete(`/api/alerts/officers/${id}`); 
            triggerToast('Safety officer record removed cleanly.', 'success');
            load();
        } catch (err) {
            triggerToast('Failed to execute database purge deletion.', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Safety Officers</h2>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Who receives anomaly alerts</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {editingId === undefined && (
                            <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm">
                                <Plus size={13} /> Add Officer
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={16} /></button>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                    {editingId !== undefined && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-3">
                            <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                {editingId ? 'Edit Officer' : 'New Officer'}
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Full Name</label>
                                    <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Smith"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-900 transition-all" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Role</label>
                                    <input type="text" value={form.role || ''} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Safety Officer"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-slate-900 transition-all" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Email Address</label>
                                    <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="officer@company.com"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Alert Channels</label>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={form.alert_email} onChange={e => setForm({ ...form, alert_email: e.target.checked })} className="w-3.5 h-3.5 border-slate-300 rounded text-slate-900 focus:ring-slate-950" />
                                        <span className="text-xs font-semibold text-slate-600">Email</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={cancelEdit} className="flex-1 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all">Cancel</button>
                                <button onClick={save} disabled={saving} className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                                    {saving ? 'Saving…' : editingId ? 'Update' : 'Add Officer'}
                                </button>
                            </div>
                        </div>
                    )}
                    {loading ? (
                        <div className="py-10 text-center text-slate-400 text-xs font-medium">Loading…</div>
                    ) : officers.length === 0 ? (
                        <div className="py-12 text-center">
                            <Shield size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-500">No officers yet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Add officers to receive anomaly alerts</p>
                        </div>
                    ) : officers.map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3.5 bg-slate-50/60 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-sm">
                                    {o.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-800">{o.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{o.role}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        {o.alert_email && <span className="p-1 bg-slate-100 text-slate-600 rounded" title={o.email}>{CHANNEL_ICON.email}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => startEdit(o)} className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-all"><Edit3 size={13} /></button>
                                <button onClick={() => remove(o.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all"><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-3.5 border-t border-slate-100 flex-shrink-0 bg-slate-50">
                    <button onClick={onClose} className="w-full py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">Done</button>
                </div>
            </div>
        </div>
    );
};

const AnomalyCard = ({ a, isSelected, onSelect, onLightbox, onReAlert, sending }) => {
    const at = getAnomalyType(a.type);
    const imgUrl = resolveImageUrl(a.image_url);

    return (
        <div className={`bg-white border rounded-xl p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md cursor-pointer relative group flex flex-col ${isSelected ? 'border-slate-990 ring-1 ring-slate-900 shadow-sm' : 'border-slate-200/80'}`} onClick={() => onSelect(a)}>
            {imgUrl ? (
                <div onClick={e => { e.stopPropagation(); onLightbox(imgUrl); }} className="w-full h-44 sm:h-56 relative rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex-shrink-0 mb-4 cursor-zoom-in group/img">
                    <img src={imgUrl} alt="Capture payload" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-102" />
                    <div className="absolute inset-0 bg-slate-950/10 opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center">
                        <span className="bg-white/90 text-[10px] font-bold px-2 py-1 rounded shadow-xs text-slate-800 flex items-center gap-1">
                            <Maximize2 size={11} /> Open Image
                        </span>
                    </div>
                </div>
            ) : (
                <div className="w-full h-44 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1.5 flex-shrink-0 mb-4 text-slate-400">
                    <Camera size={20} className="text-slate-300" />
                    <span className="text-[10px] font-semibold">No Image Logged</span>
                </div>
            )}

            <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${at.color}`}>
                            {at.icon} {at.label}
                        </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-1">
                        <Bot size={11} className="text-slate-400" />
                        {a.robot_id}
                    </span>
                </div>

                <p className="text-xs text-slate-600 mt-2.5 font-medium line-clamp-2 leading-relaxed">{a.description}</p>
                
                <div className="flex items-center justify-between gap-2 mt-3 flex-wrap pt-2 border-t border-slate-50">
                    <p className="text-[10px] text-slate-400 font-mono font-medium">
                        {a.timestamp ? new Date(a.timestamp).toLocaleString() : 'N/A'}
                    </p>
                </div>
            </div>

            {isSelected && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-200">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                            <p className="text-slate-400 font-bold uppercase text-[9px]">Anomaly Type</p>
                            <p className="font-bold text-slate-700 flex items-center gap-1 mt-0.5">{at.icon} {at.label}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-end">
                        <button onClick={e => { e.stopPropagation(); onReAlert(a); }} disabled={sending} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm">
                            <Send size={11} /> {sending ? 'Sending…' : 'Re-alert Officers'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const AnomalyTable = ({ anomalies, onLightbox }) => {
    if (anomalies.length === 0) {
        return (
            <div className="bg-white border border-slate-200 border-dashed rounded-xl py-14 text-center">
                <CheckCircle size={32} className="mx-auto text-emerald-500 opacity-30 mb-3" />
                <p className="text-slate-800 text-xs font-bold">Environment Secure</p>
                <p className="text-[11px] text-slate-400">No incidents match your filters.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            <th className="py-3 px-4">Timestamp</th>
                            <th className="py-3 px-4">Robot ID</th>
                            <th className="py-3 px-4">Detection Type</th>
                            <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {anomalies.map((ano) => {
                            const at = getAnomalyType(ano.type);
                            const imgUrl = resolveImageUrl(ano.image_url);
                            return (
                                <tr key={ano.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                                    <td className="py-3 px-4 text-[11px] font-semibold text-slate-500">
                                        {ano.timestamp ? new Date(ano.timestamp).toLocaleString() : 'N/A'}
                                    </td>
                                    <td className="py-3 px-4 text-[11px] font-bold text-slate-800 uppercase tracking-tight">{ano.robot_id}</td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${at.color}`}>
                                            {at.icon} {at.label}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button onClick={() => imgUrl && onLightbox(imgUrl)} disabled={!imgUrl} className={`p-1.5 rounded-lg transition-colors ${imgUrl ? 'hover:bg-slate-100 text-slate-700' : 'text-slate-200 cursor-not-allowed'}`}>
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AdvancedAnalyticsPanel = ({ anomalies, onTriggerFilterRedirect }) => {
    const [timeScale, setTimeScale] = useState('day');
    const [chartMode, setChartMode] = useState('bar');
    const [anchorDate, setAnchorDate] = useState(new Date());
    const dateInputRef = useRef(null);

    const getTypeDistribution = () => {
        const counts = anomalies.reduce((acc, a) => {
            const rawType = a.type || 'Unknown';
            acc[rawType] = (acc[rawType] || 0) + 1;
            return acc;
        }, {});
        
        return Object.entries(counts).map(([rawName, value]) => {
            const config = getAnomalyType(rawName);
            return { name: config.label, rawKey: rawName, value, color: config.hex };
        });
    };

    const getTrendData = () => {
        if (!anomalies || anomalies.length === 0) return [];
        
        const chronologicalAnomalies = [...anomalies].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (timeScale === 'day') {
            const formattedDayTitle = anchorDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const anchorDateStr = anchorDate.toDateString();

            const groupMap = {};
            for (let hour = 0; hour < 24; hour++) {
                const hourString = `${String(hour).padStart(2, '0')}:00`;
                groupMap[`${formattedDayTitle} ${hourString}`] = 0;
            }
            
            chronologicalAnomalies.forEach(a => {
                if (!a.timestamp) return;
                const d = new Date(a.timestamp);
                if (!isNaN(d.getTime()) && d.toDateString() === anchorDateStr) {
                    const hourKey = `${formattedDayTitle} ${String(d.getHours()).padStart(2, '0')}:00`;
                    groupMap[hourKey] = (groupMap[hourKey] || 0) + 1;
                }
            });
            
            return Object.entries(groupMap).map(([name, count]) => ({ name, Incidents: count }));
        }

        if (timeScale === 'week') {
            const groupMap = {};
            chronologicalAnomalies.forEach(a => {
                if (!a.timestamp) return;
                const d = new Date(a.timestamp);
                if (isNaN(d.getTime())) return;
                
                if (d.getMonth() === anchorDate.getMonth() && d.getFullYear() === anchorDate.getFullYear()) {
                    const firstDay = d.getDate() - d.getDay();
                    const weekStart = new Date(d.getFullYear(), d.getMonth(), firstDay);
                    const label = `Wk ${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                    groupMap[label] = (groupMap[label] || 0) + 1;
                }
            });
            return Object.entries(groupMap).map(([name, count]) => ({ name, Incidents: count }));
        }

        const groupMap = {};
        chronologicalAnomalies.forEach(a => {
            if (!a.timestamp) return;
            const d = new Date(a.timestamp);
            if (isNaN(d.getTime())) return; 
            
            let key = '';
            if (timeScale === 'month') {
                if (d.getFullYear() === anchorDate.getFullYear()) {
                    key = d.toLocaleDateString(undefined, { month: 'short' });
                } else {
                    return;
                }
            } else {
                key = String(d.getFullYear());
            }
            groupMap[key] = (groupMap[key] || 0) + 1;
        });
        return Object.entries(groupMap).map(([name, count]) => ({ name, Incidents: count }));
    };

    const handleChartClick = (data) => {
        if (!data || !data.activeLabel) return;
        const clickedLabel = data.activeLabel;

        if (timeScale === 'year') {
            const parsedYear = parseInt(clickedLabel);
            if (!isNaN(parsedYear)) {
                const newDate = new Date(anchorDate);
                newDate.setFullYear(parsedYear);
                setAnchorDate(newDate);
                setTimeScale('month');
            }
        } else if (timeScale === 'month') {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const foundIndex = monthNames.findIndex(m => clickedLabel.includes(m));
            if (foundIndex !== -1) {
                const newDate = new Date(anchorDate);
                newDate.setMonth(foundIndex);
                setAnchorDate(newDate);
                setTimeScale('week');
            }
        } else if (timeScale === 'week') {
            const match = clickedLabel.match(/Wk\s+(\w+)\s+(\d+)/);
            if (match) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIdx = monthNames.indexOf(match[1]);
                const dayNum = parseInt(match[2], 10);
                if (monthIdx !== -1 && !isNaN(dayNum)) {
                    const newDate = new Date(anchorDate.getFullYear(), monthIdx, dayNum);
                    setAnchorDate(newDate);
                }
            }
            setTimeScale('day');
        }
    };

    const shiftAnchorDate = (amount) => {
        const next = new Date(anchorDate);
        if (timeScale === 'day') {
            next.setDate(next.getDate() + amount);
        } else if (timeScale === 'week') {
            next.setDate(next.getDate() + (amount * 7));
        } else if (timeScale === 'month') {
            next.setMonth(next.getMonth() + amount);
        } else {
            next.setFullYear(next.getFullYear() + amount);
        }

        if (next > new Date()) {
            setAnchorDate(new Date());
        } else {
            setAnchorDate(next);
        }
    };

    const handleCalendarSelect = (e) => {
        if (!e.target.value) return;
        const [y, m, d] = e.target.value.split('-').map(Number);
        let newDate = new Date(anchorDate);
        newDate.setFullYear(y);
        newDate.setMonth(m - 1);
        newDate.setDate(d);

        if (newDate > new Date()) {
            newDate = new Date();
        }
        setAnchorDate(newDate);
    };

    const openCalendarPicker = () => {
        if (dateInputRef.current) {
            try {
                dateInputRef.current.showPicker();
            } catch (err) {
                dateInputRef.current.click();
            }
        }
    };

    const trendData = getTrendData();
    const typePieData = getTypeDistribution();
    const totalAnomaliesCount = typePieData.reduce((acc, item) => acc + item.value, 0);

    const getContextTitle = () => {
        if (timeScale === 'day') return anchorDate.toLocaleDateString(undefined, { dateStyle: 'medium' });
        if (timeScale === 'month' || timeScale === 'week') return anchorDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
        return 'System Fleet History';
    };

    const getFormatedHTMLDateValue = () => {
        const y = anchorDate.getFullYear();
        const m = String(anchorDate.getMonth() + 1).padStart(2, '0');
        const d = String(anchorDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const isFutureBlockRestricted = anchorDate.toDateString() === new Date().toDateString() || anchorDate > new Date();

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 space-y-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm min-h-[320px]">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 text-slate-800 rounded-lg"><BarChart3 size={15} /></div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Incident Analytics Framework</h3>
                            <p className="text-[10px] text-slate-400">Drill down levels: Year → Month → Week → Day</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 gap-2 text-xs font-semibold">
                            <button onClick={() => shiftAnchorDate(-1)} className="p-1 hover:bg-slate-200 rounded"><ChevronLeft size={12} /></button>
                            
                            <button onClick={openCalendarPicker} className="flex items-center gap-1 hover:bg-slate-200 px-2 py-1 rounded transition-colors text-slate-600">
                                <CalendarIcon size={12} className="text-slate-400" />
                                <span className="text-[10px] font-mono min-w-[70px] text-center">{getContextTitle()}</span>
                                <input ref={dateInputRef} type="date" max={new Date().toISOString().split("T")[0]} value={getFormatedHTMLDateValue()} onChange={handleCalendarSelect} 
                                    className="w-0 h-0 opacity-0 pointer-events-none absolute" />
                            </button>

                            <button onClick={() => shiftAnchorDate(1)} disabled={isFutureBlockRestricted} 
                                className={`p-1 rounded ${isFutureBlockRestricted ? 'text-slate-300 bg-slate-100 cursor-not-allowed' : 'hover:bg-slate-200'}`}>
                                <ChevronRight size={12} />
                            </button>
                        </div>

                        <div className="flex gap-0.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button onClick={() => setChartMode('bar')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${chartMode === 'bar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>Bar</button>
                            <button onClick={() => setChartMode('area')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${chartMode === 'area' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>Area</button>
                        </div>
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {['day', 'week', 'month', 'year'].map(t => (
                                <button key={t} onClick={() => setTimeScale(t)} className={`px-2.5 py-1 text-[10px] font-bold rounded ${timeScale === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-56 w-full text-[10px] relative block">
                    {trendData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-1.5">
                            <CalendarIcon size={24} className="opacity-40" />
                            <p className="text-xs">No entries mapped onto current date timeline filters</p>
                        </div>
                    ) : chartMode === 'bar' ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} />
                                <YAxis stroke="#94A3B8" fontSize={9} axisLine={false} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Bar dataKey="Incidents" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={24} className="cursor-pointer" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} onClick={handleChartClick} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="incidentColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366F1" stopOpacity={0.15}/><stop offset="95%" stopColor="#6366F1" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} />
                                <YAxis stroke="#94A3B8" fontSize={9} axisLine={false} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Area type="monotone" dataKey="Incidents" stroke="#6366F1" strokeWidth={2} fill="url(#incidentColor)" className="cursor-pointer" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[320px]">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><PieChart size={15} /></div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Classification Profile</h3>
                        <p className="text-[10px] text-slate-400">Anomalies share metrics</p>
                    </div>
                </div>

                <div className="h-40 w-full relative block my-3">
                    {typePieData.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center pt-16">No share signatures logged</p>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie data={typePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">
                                    {typePieData.map((entry, idx) => <Cell key={idx} fill={entry.color} onClick={() => onTriggerFilterRedirect(entry.rawKey)} className="cursor-pointer hover:opacity-85" />)}
                                </Pie>
                                <Tooltip />
                            </RePieChart>
                        </ResponsiveContainer>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-black text-slate-900">{totalAnomaliesCount}</span>
                        <span className="text-[8px] uppercase tracking-widest text-slate-400 font-bold">Signatures</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto text-[11px] pt-3 border-t border-slate-100 pr-1">
                    {typePieData.map((item, idx) => {
                        const percentage = totalAnomaliesCount > 0 ? Math.round((item.value / totalAnomaliesCount) * 100) : 0;
                        return (
                            <div key={idx} onClick={() => onTriggerFilterRedirect(item.rawKey)} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                <div className="flex items-center gap-2 truncate min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-slate-700 truncate font-semibold capitalize">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-900 font-bold">{item.value}</span>
                                    <span style={{ borderColor: `${item.color}30`, backgroundColor: `${item.color}12`, color: item.color }} className="text-[9px] font-mono px-1.5 py-0.2 border rounded font-bold">{percentage}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const ClientDashboard = () => {
    const { user, logout } = useAuth();
    const clientId = user?.client_id ? parseInt(user.client_id) : null;

    const [activeView, setActiveView] = useState('dashboard'); 
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const [anomalies, setAnomalies] = useState([]);
    const [alertLogs, setAlertLogs] = useState([]);
    const [officers, setOfficers] = useState([]);
    const [robots, setRobots] = useState([]);
    const [robotFilter, setRobotFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState(''); 
    const [sending, setSending] = useState(false);
    const [selectedAnomaly, setSelectedAnomaly] = useState(null);
    const [showManual, setShowManual] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [showOfficers, setShowOfficers] = useState(false);
    const [lightboxImg, setLightboxImg] = useState(null);
    const [layoutMode, setLayoutMode] = useState('cards');
    
    const [manualForm, setManualForm] = useState({ officer_ids: [], types: [], custom_type: '', description: '' });
    const [profileOpen, setProfileOpen] = useState(false);

    // ── INTERACTIVE MOBILE TOAST APPLICATION NOTIFICATION STATE VARIABLES ──
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const profileRef = useRef(null);
    const pollRef = useRef(null);

    const computedProfileUsername = user?.name || user?.username || (user?.email ? user.email.split('@')[0] : 'Client Authority');
    const userInitials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'MI';

    const triggerToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4500);
    };

    useEffect(() => {
        if (!clientId) return;
        fetchAll();
        pollRef.current = setInterval(fetchAll, 15000);
        return () => clearInterval(pollRef.current);
    }, [clientId]);

    const fetchAll = async () => {
        if (!clientId) return;
        try {
            const cleanStringClientId = String(clientId).trim();

            const [anom, logs, offs, robs] = await Promise.all([
                api.get(`/api/anomaly/client/${cleanStringClientId}`),
                api.get(`/api/alerts/logs/${cleanStringClientId}`),
                api.get(`/api/alerts/officers/${cleanStringClientId}`),
                api.get('/api/robots/'),
            ]);

            let parsedAnomalies = [];
            if (anom.data && anom.data.anomalies) {
                parsedAnomalies = anom.data.anomalies;
            } else {
                parsedAnomalies = Array.isArray(anom.data) ? anom.data : [];
            }
            const sortedAnomalies = [...parsedAnomalies].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setAnomalies(sortedAnomalies);

            const sortedLogs = (logs.data || []).sort((a, b) => new Date(b.sent_at || b.timestamp) - new Date(a.sent_at || a.timestamp));
            setAlertLogs(sortedLogs);
            setOfficers(offs.data || []);
            setRobots((robs.data || []).filter(r => 
                r.client_id && String(r.client_id).trim() === cleanStringClientId
            ));
        } catch (e) { 
            console.error('Handshake verification down to local core port failed:', e); 
        }
    };

    const handleClassificationRedirect = (targetType) => {
        setTypeFilter(targetType);
        setActiveView('anomalies');
    };

    const handleLogoutClick = async () => {
        if (window.confirm('Securely terminate current safety portal session?')) {
            if (logout) await logout();
        }
    };

    const sendManualAlert = async () => {
        const payloadTypes = [...manualForm.types];
        
        if (payloadTypes.includes('CUSTOM_TYPE_SELECTED')) {
            const cleanCustomText = manualForm.custom_type.trim();
            if (!cleanCustomText) {
                return triggerToast('Please type a descriptive custom text parameter signature value.', 'error');
            }
            const filteredPresetTypes = payloadTypes.filter(t => t !== 'CUSTOM_TYPE_SELECTED');
            payloadTypes.splice(0, payloadTypes.length, ...filteredPresetTypes, cleanCustomText);
        }

        if (manualForm.officer_ids.length === 0 || payloadTypes.length === 0 || !manualForm.description) {
            return triggerToast('All notification checkbox dependencies are required before dispatch.', 'error');
        }
        setSending(true);
        try {
            const selectedOfficersList = officers.filter(o => manualForm.officer_ids.includes(o.id));
            const targetEmails = selectedOfficersList.map(o => o.email);
            
            await api.post('/api/alerts/trigger', { 
                client_id: clientId, 
                robot_id: "MANUAL_BROADCAST",
                types: payloadTypes, 
                description: manualForm.description,
                target_officer_ids: manualForm.officer_ids,
                target_emails: targetEmails
            });
            triggerToast('Announcement distributed successfully.', 'success');
            setShowManual(false);
            setManualForm({ officer_ids: [], types: [], custom_type: '', description: '' });
            fetchAll();
        } catch (e) {
            triggerToast('Failed to dispatch announcement.', 'error');
        } finally { setSending(false); }
    };

    const reAlertAnomaly = async (a) => {
        setSending(true);
        try {
            const { data } = await api.post('/api/alerts/trigger', {
                client_id: clientId, robot_id: a.robot_id, anomaly_id: a.id,
                type: a.type, description: a.description, image_url: a.image_url,
            });
            triggerToast(`Successfully re-routed logs down to ${data.officers_notified} officers.`, 'success');
            fetchAll();
        } catch (err) {
            triggerToast('Alert routing cascade loop failed.', 'error');
        } finally { setSending(false); }
    };

    if (!clientId) {
        return (
            <div className="p-10 text-center text-gray-400">
                <Shield size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-bold text-slate-500">No client profile configuration assigned.</p>
            </div>
        );
    }

    const runningRobotsCount = robots.filter(r => r.is_online).length;
    const stats = {
        total: anomalies.length,
        sent: alertLogs.filter(l => l.status === 'sent').length,
    };

    const robotIds = ['All', ...new Set(anomalies.map(a => a.robot_id).filter(Boolean))];
    const anomalyTypes = ['All', ...new Set(anomalies.map(a => a.type).filter(Boolean))];

    const filteredAnomalies = anomalies.filter(a => {
        if (robotFilter !== 'All' && a.robot_id !== robotFilter) return false;
        if (typeFilter !== 'All' && a.type !== typeFilter) return false;
        if (dateFilter) {
            if (!a.timestamp) return false;
            const d = new Date(a.timestamp);
            if (isNaN(d.getTime())) return false; 

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const localAnomalyDateStr = `${year}-${month}-${day}`;

            if (localAnomalyDateStr !== dateFilter) return false;
        }
        return true;
    });

    const robotAnomalyCounts = robots.reduce((acc, r) => {
        acc[r.id] = anomalies.filter(a => a.robot_id === r.id).length;
        return acc;
    }, {});

    const PRESET_ALERT_SUBJECTS = [
        { value: "CUSTOM_TYPE_SELECTED", label: "Custom Subject Type (Enter Value below)" },
        { value: "Fire", label: "Fire Explosion Incident" },
        { value: "Person Detected", label: "Unauthorized Person Detected" },
        { value: "Smoke", label: "Thick Smoke Leakage" },
        { value: "Equipment Failure", label: "Critical Equipment Failure" },
        { value: "Intrusion", label: "Perimeter Intrusion Breached" },
        { value: "Banksman Required", label: "Banksman Marshalling Required" }
    ];

    return (
        <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-800 font-sans relative">
            
            {/* ── NATIVE APP TOAST NOTIFICATION CONTAINER POPUP OVERLAY ── */}
            {toast.show && (
                <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl font-semibold text-xs transition-all duration-300 transform scale-100 translate-y-0 animate-in fade-in slide-in-from-top-4 ${
                    toast.type === 'error' 
                        ? 'bg-slate-900 border-red-500/30 text-red-400 ring-1 ring-red-500/10' 
                        : 'bg-slate-900 border-emerald-500/30 text-emerald-400 ring-1 ring-emerald-500/10'
                }`}>
                    <div className={`p-1 rounded-full ${toast.type === 'error' ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                        {toast.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                    </div>
                    <p className="tracking-wide">{toast.message}</p>
                    <button onClick={() => setToast({ show: false, message: '', type: 'success' })} className="ml-2 text-slate-400 hover:text-white transition-colors">
                        <X size={13} />
                    </button>
                </div>
            )}

            <aside className={`bg-slate-900 text-slate-300 h-full flex flex-col z-30 transition-all duration-300 border-r border-slate-800 ${sidebarOpen ? 'w-64' : 'w-0 md:w-20'} overflow-hidden`}>
                <div className="p-5 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/20">
                    <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-slate-900 shadow-sm flex-shrink-0"><ShieldAlert size={15} /></div>
                        {sidebarOpen && <span className="font-bold text-sm uppercase tracking-wider text-white">L&T Safety Capitan</span>}
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1 mt-4">
                    {[
                        { id: 'dashboard', label: 'Dashboard Overview', icon: <BarChart3 size={16} /> },
                        { id: 'anomalies', label: 'Anomalies Explorer', icon: <AlertTriangle size={16} /> },
                        { id: 'history', label: 'Alert History', icon: <Clock size={16} /> }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveView(tab.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group relative ${activeView === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
                            <div>{tab.icon}</div>
                            {sidebarOpen && <span className="truncate">{tab.label}</span>}
                        </button>
                    ))}
                    <div className="h-px bg-slate-800/60 my-4 mx-2" />
                    <button onClick={() => setShowOfficers(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded-xl transition-all"><Shield size={16} />{sidebarOpen && <span className="truncate">Officers ({officers.length})</span>}</button>
                    <button onClick={() => setShowEmail(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 rounded-xl transition-all"><Settings size={16} />{sidebarOpen && <span className="truncate">Portal Settings</span>}</button>
                </nav>

                <div className="p-3 border-t border-slate-800/60 bg-slate-950/10">
                    <button onClick={() => { setManualForm({ officer_ids: [], types: [], custom_type: '', description: '' }); setShowManual(true); }} className="w-full bg-blue-800 hover:bg-red-700 text-white rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-md"><Send size={13} />{sidebarOpen && <span className="uppercase tracking-wider">ANNOUNCEMENT</span>}</button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white border-b border-slate-200 h-14 px-5 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg"><Menu size={16} /></button>
                        <div>
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Safety Portal Menu</h2>
                            <p className="text-[11px] font-bold text-emerald-600 uppercase flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> System: Active</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowOfficers(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm"><Plus size={13} /> Add Officer</button>
                        <div className="relative" ref={profileRef}>
                            <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 p-1 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all">
                                <div className="w-7 h-7 bg-slate-900 text-white font-bold text-xs rounded-lg flex items-center justify-center">{userInitials}</div>
                                <div className="text-left hidden md:block max-w-[120px]">
                                    <p className="text-xs font-bold text-slate-800 truncate">{computedProfileUsername}</p>
                                    <p className="text-[9px] font-mono text-slate-400">ID: {clientId || 'N/A'}</p>
                                </div>
                                <ChevronDown size={13} className="text-slate-400 mr-1" />
                            </button>
                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50">
                                    <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Email</p>
                                        <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">{user?.email || 'N/A'}</p>
                                    </div>
                                    <button onClick={() => { setProfileOpen(false); handleLogoutClick(); }} className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"><LogOut size={12} /> Logout</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {officers.length === 0 && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between gap-3 flex-shrink-0">
                        <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle size={14} /> Warning: Add a safety officer to ensure real-time email routing cascades execution logs cleanly.</p>
                        <button onClick={() => setShowOfficers(true)} className="text-[11px] font-bold text-amber-900 underline hover:no-underline">Configure Officer Now</button>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3.5">
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm ring-2 ring-emerald-500/20">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"><Cpu size={11} className="animate-spin" /> Live Fleet Status</p>
                            <p className="text-2xl font-bold mt-1.5 text-emerald-700">{runningRobotsCount} <span className="text-xs font-medium text-slate-400">/ {robots.length}</span></p>
                        </div>
                        {[
                            { label: 'Total Incidents', val: stats.total, color: 'text-slate-900', bg: 'bg-white border-slate-200' },
                            { label: 'Alerts Sent', val: stats.sent, color: 'text-emerald-600', bg: 'bg-emerald-50/40 border-emerald-100' },
                        ].map(card => (
                            <div key={card.label} className={`${card.bg} border rounded-xl p-4 shadow-sm`}>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                                <p className={`text-2xl font-bold mt-1.5 ${card.color}`}>{card.val}</p>
                            </div>
                        ))}
                    </div>

                    {activeView === 'dashboard' && (
                        <div className="space-y-6">
                            <AdvancedAnalyticsPanel anomalies={anomalies} onTriggerFilterRedirect={handleClassificationRedirect} />
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2"><Bot size={14} /> Operational Fleet Metrics (Running Profiles)</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {robots.map(r => (
                                        <div key={r.id} onClick={() => { setRobotFilter(r.id); setActiveView('anomalies'); }} className="border rounded-xl p-3 bg-slate-50/50 hover:border-slate-400 cursor-pointer">
                                            <div className="flex justify-between"><h4 className="text-xs font-bold text-slate-800 truncate">{r.name || r.id}</h4><span className={`w-2 h-2 rounded-full mt-1 ${r.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} /></div>
                                            <div className="flex justify-between mt-4 text-[10px]"><span className="text-slate-400">Total Anomaly Logs</span><span className="font-bold text-slate-700">{robotAnomalyCounts[r.id] || 0} hits</span></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-4">
                                    <AnomalyTable anomalies={anomalies.slice(0, 5)} onLightbox={setLightboxImg} />
                                </div>
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm self-start">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Live Notification Logs</h3>
                                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                                        {alertLogs.slice(0, 6).map(log => (
                                            <div key={log.id} className="flex gap-2.5 pb-2.5 border-b border-slate-100 last:border-0">
                                                <div className={`mt-0.5 p-1 rounded-full ${log.status === 'sent' ? 'text-emerald-600 bg-emerald-50' : 'bg-red-50 text-red-600'}`}>
                                                    {log.is_read ? <MailOpen size={11} className="text-blue-600" /> : <Mail size={11} />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[11px] font-bold text-slate-700 truncate">{log.recipient}</p>
                                                        <span className={`text-[8px] font-bold px-1 rounded ${log.is_read ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {log.is_read ? 'Read' : 'Delivered'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                        {log.channel} · {log.sent_at ? new Date(log.sent_at).toLocaleTimeString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'anomalies' && (
                        <AnomaliesExplorer
                            robotFilter={robotFilter}
                            setRobotFilter={setRobotFilter}
                            typeFilter={typeFilter}
                            setTypeFilter={setTypeFilter}
                            dateFilter={dateFilter}
                            setDateFilter={setDateFilter}
                            layoutMode={layoutMode}
                            setLayoutMode={setLayoutMode}
                            robotIds={robotIds}
                            anomalyTypes={anomalyTypes}
                            filteredAnomalies={filteredAnomalies}
                            selectedAnomaly={selectedAnomaly}
                            setSelectedAnomaly={setSelectedAnomaly}
                            setLightboxImg={setLightboxImg}
                            reAlertAnomaly={reAlertAnomaly}
                            sending={sending}
                            AnomalyCard={AnomalyCard}
                            AnomalyTable={AnomalyTable}
                        />
                    )}

                    {activeView === 'history' && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            <div className="divide-y divide-slate-100">
                                {alertLogs.map(logItem => (
                                    <div key={logItem.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/50">
                                        <span className={`mt-0.5 ${logItem.status === 'sent' ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {logItem.is_read ? <MailOpen size={13} className="text-blue-600" /> : <Mail size={13} />}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <p className="text-xs font-bold text-slate-800 truncate">{logItem.recipient}</p>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {logItem.channel} · {logItem.sent_at ? new Date(logItem.sent_at).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {showManual && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl border border-slate-100 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2 flex-shrink-0">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">ANNOUNCEMENT</h2>
                            <button onClick={() => setShowManual(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={16} /></button>
                        </div>
                        
                        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">SELECT OFFICER</label>
                                <div className="max-h-32 overflow-y-auto border border-slate-200 bg-slate-50 rounded-xl p-2.5 space-y-2">
                                    {officers.map(o => {
                                        const isChecked = manualForm.officer_ids.includes(o.id);
                                        return (
                                            <label key={o.id} className="flex items-center gap-2.5 cursor-pointer p-1 hover:bg-white/60 rounded-lg transition-colors select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={() => {
                                                        const updatedIds = isChecked
                                                            ? manualForm.officer_ids.filter(id => id !== o.id)
                                                            : [...manualForm.officer_ids, o.id];
                                                        setManualForm({ ...manualForm, officer_ids: updatedIds });
                                                    }}
                                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 accent-blue-600" 
                                                />
                                                <span className="text-xs font-semibold text-slate-700">{o.name} ({o.role})</span>
                                            </label>
                                        );
                                    })}
                                    {officers.length === 0 && (
                                        <span className="text-[11px] text-slate-400 font-medium italic block p-1">No active security officers configured</span>
                                    )}
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">SUBJECT TYPE SELECTOR</label>
                                <div className="max-h-44 overflow-y-auto border border-slate-200 bg-slate-50 rounded-xl p-2.5 space-y-2">
                                    {PRESET_ALERT_SUBJECTS.map(subject => {
                                        const isTypeChecked = manualForm.types.includes(subject.value);
                                        return (
                                            <label key={subject.value} className="flex items-center gap-2.5 cursor-pointer p-1 hover:bg-white/60 rounded-lg transition-colors select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isTypeChecked} 
                                                    onChange={() => {
                                                        const updatedTypes = isTypeChecked
                                                            ? manualForm.types.filter(t => t !== subject.value)
                                                            : [...manualForm.types, subject.value];
                                                        setManualForm({ ...manualForm, types: updatedTypes });
                                                    }}
                                                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 accent-blue-600" 
                                                />
                                                <span className="text-xs font-semibold text-slate-700">{subject.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>

                                {manualForm.types.includes('CUSTOM_TYPE_SELECTED') && (
                                    <div className="mt-2.5 animate-in slide-in-from-top-2 duration-200">
                                        <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide block mb-1">Enter Custom Subject Title</label>
                                        <input 
                                            type="text" 
                                            value={manualForm.custom_type}
                                            onChange={e => setManualForm({ ...manualForm, custom_type: e.target.value })}
                                            placeholder="e.g. Chemical Leakage, Power Blackout"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:bg-white focus:border-slate-900 transition-all font-medium"
                                        />
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">DESCRIPTION</label>
                                <textarea value={manualForm.description} onChange={e => setManualForm({ ...manualForm, description: e.target.value })} placeholder="What is the emergency?" rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none resize-none" />
                            </div>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-100 flex-shrink-0">
                            <button onClick={sendManualAlert} disabled={sending} className="w-full py-2.5 bg-blue-800 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-1.5"><Send size={13} /> {sending ? 'Dispatching…' : `DISPATCH ALERT → ${manualForm.officer_ids.length} Officer(s)`}</button>
                        </div>
                    </div>
                </div>
            )}

            {showEmail && <EmailConfigPanel clientId={clientId} onClose={() => setShowEmail(false)} triggerToast={triggerToast} />}
            {showOfficers && <OfficerPanel clientId={clientId} onClose={() => { setShowOfficers(false); fetchAll(); }} triggerToast={triggerToast} />}

            {lightboxImg && (
                <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
                    <button className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full"><X size={18} /></button>
                    <img src={lightboxImg} alt="Expanded representation view" className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
};

export default ClientDashboard;