import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Grid, Table2, CheckCircle, ChevronLeft, ChevronRight, Search, X, Download, Check } from 'lucide-react';
import ReportActionsToolbar, { urlToJpegBlob } from './ReportActionsToolbar';

export default function AnomaliesExplorer({
    robotFilter,
    setRobotFilter,
    typeFilter,
    setTypeFilter,
    dateFilter,
    setDateFilter,
    layoutMode,
    setLayoutMode,
    robotIds,
    anomalyTypes,
    filteredAnomalies = [],
    selectedAnomaly,
    setSelectedAnomaly,
    setLightboxImg,
    reAlertAnomaly,
    sending,
    AnomalyCard,
    AnomalyTable
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 52;
    const [selectedIds, setSelectedIds] = useState([]);
    const [activityFilter, setActivityFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const inlineInputRef = useRef(null);

    // Reset activity selection when anomaly classification type changes
    useEffect(() => {
        setActivityFilter('All');
    }, [typeFilter]);

    useEffect(() => {
        if (isSearchOpen && inlineInputRef.current) {
            inlineInputRef.current.focus();
        }
    }, [isSearchOpen]);

    // Robust activity extraction that handles raw signatures & formatted labels
    const activityOptions = useMemo(() => {
        const uniqueActivities = new Set();
        const normalizedTypeFilter = typeFilter.toLowerCase().trim();

        filteredAnomalies.forEach((ano) => {
            const rawType = String(ano.observation_type || ano.type || '').toLowerCase().trim();
            
            // Check if matches 'All' or matches direct string / partial signature
            const isMatch = normalizedTypeFilter === 'all' || 
                            rawType === normalizedTypeFilter ||
                            rawType.includes(normalizedTypeFilter) || 
                            normalizedTypeFilter.includes(rawType);

            if (isMatch) {
                const act = ano.activity;
                if (act && typeof act === 'string' && act.trim() !== '' && act.trim().toUpperCase() !== 'N/A') {
                    uniqueActivities.add(act.trim());
                }
            }
        });

        // Fallback: If no activities exist under this specific type, list site-wide activities
        if (uniqueActivities.size === 0) {
            filteredAnomalies.forEach((ano) => {
                const act = ano.activity;
                if (act && typeof act === 'string' && act.trim() !== '' && act.trim().toUpperCase() !== 'N/A') {
                    uniqueActivities.add(act.trim());
                }
            });
        }

        return ['All', ...Array.from(uniqueActivities)];
    }, [filteredAnomalies, typeFilter]);

    // Process dataset filters
    const processedAnomalies = useMemo(() => {
        return filteredAnomalies.filter((a) => {
            if (activityFilter !== 'All') {
                const actText = (a.activity || '').trim();
                if (actText.toLowerCase() !== activityFilter.toLowerCase()) return false;
            }

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const matchActivity = (a.activity || '').toLowerCase().includes(query);
                const matchDescription = (a.description || '').toLowerCase().includes(query);
                const matchType = (a.observation_type || a.type || '').toLowerCase().includes(query);
                const matchRobot = (a.project_id || a.robot_id || '').toLowerCase().includes(query);
                const matchId = String(a.id || '').toLowerCase().includes(query);

                if (!matchActivity && !matchDescription && !matchType && !matchRobot && !matchId) {
                    return false;
                }
            }
            return true;
        });
    }, [filteredAnomalies, activityFilter, searchQuery]);

    const sortedAnomalies = useMemo(() => {
        return [...processedAnomalies].sort((a, b) => {
            const timeB = new Date(b.observation_date || b.timestamp || 0);
            const timeA = new Date(a.observation_date || a.timestamp || 0);
            return timeB - timeA;
        });
    }, [processedAnomalies]);

    useEffect(() => {
        setCurrentPage(1);
    }, [robotFilter, typeFilter, dateFilter, activityFilter, searchQuery]);

    const toggleSelectItem = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        setSelectedIds(sortedAnomalies.map(a => a.id));
    };

    const handleClearSelection = () => {
        setSelectedIds([]);
    };

    const handleDownloadSinglePhoto = async (item, e) => {
        if (e) e.stopPropagation();
        if (!item || !item.image_url) return alert('No valid image URL found.');
        try {
            const fileName = `Frame_${item.id || 'RAW'}_${item.robot_id || 'ROB'}.jpg`;
            const blob = await urlToJpegBlob(item.image_url);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Single download error:', err);
            alert('Failed to download image file.');
        }
    };

    const totalPages = Math.max(1, Math.ceil(sortedAnomalies.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedAnomalies = sortedAnomalies.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const getPageNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
        if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    return (
        <div className="space-y-4 w-full">
            <ReportActionsToolbar 
                filteredAnomalies={sortedAnomalies} 
                selectedDate={dateFilter}
                selectedType={typeFilter}
                selectedRobot={robotFilter}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                onSelectAll={handleSelectAll}
                onClearSelection={handleClearSelection}
            />

            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm mb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 flex-wrap min-w-[280px]">
                        {!isSearchOpen ? (
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                    searchQuery ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Search size={14} />
                                <span>{searchQuery ? `"${searchQuery}"` : 'Search'}</span>
                            </button>
                        ) : (
                            <div className="relative flex items-center">
                                <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                                <input
                                    ref={inlineInputRef}
                                    type="text"
                                    placeholder="Search keywords..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-medium text-slate-800 w-56 sm:w-64 focus:bg-white"
                                />
                                <button onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }} className="absolute right-2 text-slate-400 hover:text-slate-600">
                                    <X size={13} />
                                </button>
                            </div>
                        )}

                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                        {/* Fleet Robot Selector */}
                        <div className="flex-1 min-w-[130px] max-w-[190px]">
                            <select value={robotFilter} onChange={e => setRobotFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700">
                                {robotIds.map(id => <option key={`robot-${id}`} value={id}>{id === 'All' ? 'All Robots' : `Robot: ${id}`}</option>)}
                            </select>
                        </div>

                        {/* Observation Classification Type */}
                        <div className="flex-1 min-w-[130px] max-w-[190px]">
                            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700">
                                {anomalyTypes.map(type => <option key={`type-${type}`} value={type}>{type === 'All' ? 'All Incident Types' : type}</option>)}
                            </select>
                        </div>

                        {/* Activity Selection Filter (Always Available & Populated) */}
                        <div className="flex-1 min-w-[130px] max-w-[190px]">
                            <select value={activityFilter} onChange={e => setActivityFilter(e.target.value)} className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700">
                                {activityOptions.map((act, idx) => (
                                    <option key={`act-${idx}`} value={act}>{act === 'All' ? 'All Activities' : act}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div className="flex items-center gap-1">
                            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-700" />
                            {dateFilter && (
                                <button onClick={() => setDateFilter('')} className="p-1 text-red-500 hover:text-red-700">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button onClick={() => setLayoutMode('cards')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 ${layoutMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                            <Grid size={13}/> Cards
                        </button>
                        <button onClick={() => setLayoutMode('table')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 ${layoutMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                            <Table2 size={13}/> Table
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full space-y-4">
                {layoutMode === 'cards' ? (
                    paginatedAnomalies.length === 0 ? (
                        <div className="bg-white border border-slate-200 border-dashed rounded-xl py-14 text-center">
                            <CheckCircle size={32} className="mx-auto text-emerald-500 opacity-30 mb-3" />
                            <p className="text-slate-800 text-xs font-bold">No Match Found</p>
                            <p className="text-[11px] text-slate-400">No anomalies match your current filters.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {paginatedAnomalies.map(anoItem => {
                                const isChecked = selectedIds.includes(anoItem.id);
                                return (
                                    <div key={`card-${anoItem.id}`} className="relative group">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleSelectItem(anoItem.id); }}
                                            className={`absolute top-3 left-3 z-20 w-6 h-6 rounded-md border flex items-center justify-center transition-all ${isChecked ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white/90 border-slate-300'}`}
                                        >
                                            <Check size={14} className={isChecked ? 'opacity-100' : 'opacity-0'} />
                                        </button>

                                        <button
                                            onClick={(e) => handleDownloadSinglePhoto(anoItem, e)}
                                            className="absolute top-3 right-3 z-20 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md"
                                        >
                                            <Download size={14} />
                                        </button>

                                        <AnomalyCard 
                                            a={anoItem} 
                                            isSelected={selectedAnomaly?.id === anoItem.id} 
                                            onSelect={clickedItem => setSelectedAnomaly(selectedAnomaly?.id === clickedItem.id ? null : clickedItem)} 
                                            onLightbox={setLightboxImg} 
                                            onReAlert={reAlertAnomaly} 
                                            sending={sending} 
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <AnomalyTable anomalies={paginatedAnomalies} onLightbox={setLightboxImg} />
                )}
            </div>

            {sortedAnomalies.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm mt-4 gap-3 text-xs font-medium text-slate-600">
                    <div>
                        Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{' '}
                        <span className="font-bold text-slate-900">{Math.min(startIndex + ITEMS_PER_PAGE, sortedAnomalies.length)}</span> of{' '}
                        <span className="font-bold text-slate-900">{sortedAnomalies.length}</span> entries
                    </div>
                    
                    <div className="flex items-center gap-1 flex-wrap justify-center">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                            <ChevronLeft size={16} />
                        </button>
                        {getPageNumbers().map((page, idx) => (
                            <button
                                key={`page-${idx}`}
                                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                                disabled={typeof page !== 'number'}
                                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold transition-all ${currentPage === page ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}