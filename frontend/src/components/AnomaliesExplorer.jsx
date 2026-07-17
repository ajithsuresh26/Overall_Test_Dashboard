// src/components/AnomaliesExplorer.jsx
import React, { useState, useEffect } from 'react';
import { Grid, Table2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

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
    filteredAnomalies,
    selectedAnomaly,
    setSelectedAnomaly,
    setLightboxImg,
    reAlertAnomaly,
    sending,
    AnomalyCard,
    AnomalyTable
}) {
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 52;

    // CRITICAL FIX: Ensure anomalies are sorted by timestamp (newest first) before rendering
    const sortedAnomalies = [...filteredAnomalies].sort((a, b) => {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    // Reset to page 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [robotFilter, typeFilter, dateFilter]);

    // Calculate pagination slices
    const totalPages = Math.max(1, Math.ceil(sortedAnomalies.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedAnomalies = sortedAnomalies.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // HELPER: Generate clean truncated page numbers array (e.g., [1, '...', 12, 13, 14, '...', 27])
    const getPageNumbers = () => {
        const totalNumbers = 5; // Total active page blocks to show around current page
        const sideNeighbors = 1; // Number of pages to show on each side of active page

        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const showLeftDots = currentPage > 3;
        const showRightDots = currentPage < totalPages - 2;

        if (!showLeftDots && showRightDots) {
            let leftItemCount = 3 + sideNeighbors;
            let leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
            return [...leftRange, '...', totalPages];
        }

        if (showLeftDots && !showRightDots) {
            let rightItemCount = 3 + sideNeighbors;
            let rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
            return [1, '...', ...rightRange];
        }

        if (showLeftDots && showRightDots) {
            let middleRange = Array.from(
                { length: sideNeighbors * 2 + 1 },
                (_, i) => currentPage - sideNeighbors + i
            );
            return [1, '...', ...middleRange, '...', totalPages];
        }
    };

    return (
        <div className="space-y-4 w-full">
            {/* Filter Toolbar */}
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-4 flex-wrap gap-4">
                <div className="flex flex-1 gap-3 min-w-[250px] flex-col md:flex-row">
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Filter Robot ID Fleet</label>
                        <select value={robotFilter} onChange={e => setRobotFilter(e.target.value)} className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700">
                            {robotIds.map(id => <option key={`robot-opt-${id}`} value={id}>{id === 'All' ? 'All Assigned Robots' : `Robot ID: ${id}`}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Filter Detection Signatures</label>
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700">
                            {anomalyTypes.map(type => <option key={`type-opt-${type}`} value={type}>{type === 'All' ? 'All Incident Types' : type}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block">Filter Logged Date</label>
                            {dateFilter && (
                                <button onClick={() => setDateFilter('')} className="text-[9px] text-red-500 font-bold hover:underline">Clear Filter</button>
                            )}
                        </div>
                        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full p-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium text-slate-700 focus:border-slate-400 focus:bg-white transition-all" />
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mt-2 sm:mt-0">
                    <button onClick={() => setLayoutMode('cards')} className={`px-3 py-1.5 text-[10px] font-bold rounded flex items-center gap-1.5 transition-all ${layoutMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Grid size={13}/> Cards
                    </button>
                    <button onClick={() => setLayoutMode('table')} className={`px-3 py-1.5 text-[10px] font-bold rounded flex items-center gap-1.5 transition-all ${layoutMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Table2 size={13}/> Table
                    </button>
                </div>
            </div>

            {/* Content Display */}
            <div className="w-full space-y-4">
                {layoutMode === 'cards' ? (
                    paginatedAnomalies.length === 0 ? (
                        <div className="bg-white border border-slate-200 border-dashed rounded-xl py-14 text-center w-full col-span-full">
                            <CheckCircle size={32} className="mx-auto text-emerald-500 opacity-30 mb-3" />
                            <p className="text-slate-800 text-xs font-bold">No Match Found</p>
                            <p className="text-[11px] text-slate-400">No anomalies matches your current structural filter combination sets.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {paginatedAnomalies.map(anoItem => (
                                <AnomalyCard 
                                    key={`card-${anoItem.id || Math.random()}-${anoItem.timestamp}`} 
                                    a={anoItem} 
                                    isSelected={selectedAnomaly?.id === anoItem.id} 
                                    onSelect={clickedItem => setSelectedAnomaly(selectedAnomaly?.id === clickedItem.id ? null : clickedItem)} 
                                    onLightbox={setLightboxImg} 
                                    onReAlert={reAlertAnomaly} 
                                    sending={sending} 
                                />
                            ))}
                        </div>
                    )
                ) : (
                    <AnomalyTable anomalies={paginatedAnomalies} onLightbox={setLightboxImg} />
                )}
            </div>

            {/* Pagination Footer Controls (Fixed to prevent UI Overflow) */}
            {sortedAnomalies.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white border border-slate-200 rounded-xl p-3 shadow-sm mt-4 gap-3 text-xs font-medium text-slate-600">
                    <div>
                        Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{' '}
                        <span className="font-bold text-slate-900">
                            {Math.min(startIndex + ITEMS_PER_PAGE, sortedAnomalies.length)}
                        </span>{' '}
                        of <span className="font-bold text-slate-900">{sortedAnomalies.length}</span> entries
                    </div>
                    
                    <div className="flex items-center gap-1 flex-wrap justify-center">
                        {/* Previous Button */}
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all text-slate-700"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        {/* Smart Truncated Pages */}
                        {getPageNumbers().map((page, idx) => {
                            if (page === '...') {
                                return (
                                    <span key={`dots-${idx}`} className="px-2 text-slate-400 font-bold select-none text-[11px]">
                                        ...
                                    </span>
                                );
                            }
                            return (
                                <button
                                    key={`page-btn-${page}`}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                                        currentPage === page
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {page}
                                </button>
                            );
                        })}

                        {/* Next Button */}
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all text-slate-700"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}