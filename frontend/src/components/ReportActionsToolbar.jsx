import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Printer, FileDown, Image as ImageIcon, ChevronDown, CheckSquare, Loader2 } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const resolveImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    let clean = path.replace(/\\/g, '/');
    if (clean.startsWith('.')) clean = clean.substring(1);
    if (!clean.startsWith('/')) clean = '/' + clean;
    return `${BASE_URL}${clean}`;
};

const loadJSZip = () => {
    return new Promise((resolve, reject) => {
        if (window.JSZip) return resolve(window.JSZip);
        const existingScript = document.getElementById('jszip-cdn-script');
        if (existingScript) {
            existingScript.onload = () => resolve(window.JSZip);
            return;
        }
        const script = document.createElement('script');
        script.id = 'jszip-cdn-script';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.async = true;
        script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('JSZip init failed'));
        script.onerror = () => reject(new Error('Failed to load ZIP script'));
        document.head.appendChild(script);
    });
};

// Converts image to Base64 with timeout guard so it never freezes
const getBase64Image = (rawUrl) => {
    return new Promise((resolve) => {
        const url = resolveImageUrl(rawUrl);
        if (!url) return resolve(null);
        if (url.startsWith('data:image')) return resolve(url);

        const timeout = setTimeout(() => {
            resolve(url);
        }, 2000);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || 640;
                canvas.height = img.naturalHeight || 360;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(dataUrl);
            } catch (e) {
                fetch(url)
                    .then(r => r.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => resolve(url);
                        reader.readAsDataURL(blob);
                    })
                    .catch(() => resolve(url));
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            fetch(url)
                .then(r => r.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => resolve(url);
                    reader.readAsDataURL(blob);
                })
                .catch(() => resolve(url));
        };

        img.src = url;
    });
};

export const urlToJpegBlob = async (rawImageUrl) => {
    const b64 = await getBase64Image(rawImageUrl);
    if (!b64) throw new Error("Image URL is empty");

    if (b64.startsWith('data:image')) {
        const parts = b64.split(';base64,');
        const contentType = parts[0].replace('data:', '') || 'image/jpeg';
        const rawBase64 = parts[1].replace(/\s/g, '');
        const byteCharacters = atob(rawBase64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
            byteArray[j] = byteCharacters.charCodeAt(j);
        }
        return new Blob([byteArray], { type: contentType });
    }

    const res = await fetch(b64);
    return await res.blob();
};

const sanitizeFolderName = (str) => {
    if (!str || typeof str !== 'string') return 'Unclassified';
    return str.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'Unclassified';
};

export default function ReportActionsToolbar({ 
    filteredAnomalies = [], 
    selectedDate, 
    selectedRobot,
    selectedIds = [],
    setSelectedIds,
    onSelectAll,
    onClearSelection
}) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isProcessingZip, setIsDownloadingZip] = useState(false);
    const [zipProgress, setZipProgress] = useState({ current: 0, total: 0, percent: 0, label: '' });
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const reportDate = selectedDate || new Date().toISOString().split('T')[0];

    const stats = React.useMemo(() => {
        const rowMap = new Map();
        filteredAnomalies.forEach((a) => {
            const rawType = (a.observation_type || a.type || 'Safety Observation').trim();
            const activityStr = (a.activity || 'General Site Operations').trim();
            const descStr = (a.description || a.desc || 'Violation recorded by patrol unit.').trim();
            const compositeKey = `${rawType}|${activityStr}`;

            if (rowMap.has(compositeKey)) {
                rowMap.get(compositeKey).count += 1;
            } else {
                rowMap.set(compositeKey, {
                    type: rawType,
                    description: descStr,
                    activity: activityStr,
                    count: 1
                });
            }
        });

        return { 
            summaryRows: Array.from(rowMap.values()), 
            total: filteredAnomalies.length 
        };
    }, [filteredAnomalies]);

    const renderDynamicPhotoGrid = (items, fallbackType) => {
        if (!items || items.length === 0) {
            return `<p style="font-size: 9.5pt; color: #94a3b8; font-style: italic; margin-bottom: 15px;">No observations recorded in this category.</p>`;
        }

        let html = `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; margin-bottom: 20px;">`;
        for (let i = 0; i < items.length; i += 2) {
            const item1 = items[i];
            const item2 = items[i + 1];

            const renderCard = (item, idx) => {
                if (!item) return `<td width="48%" valign="top" style="width:48%; padding:0 8px 16px 8px;">&nbsp;</td>`;
                const imgSource = item._embeddedBase64 || resolveImageUrl(item.image_url);
                
                return `
                    <td width="48%" valign="top" style="width:48%; padding: 4px 8px 16px 8px;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border:1px solid #334155; border-radius:8px; background-color:#1e293b; border-collapse:separate; overflow:hidden;">
                            <tr>
                                <td align="center" valign="middle" style="padding:10px; background-color:#0f172a; border-bottom:1px solid #334155; text-align:center;">
                                    ${imgSource ? `<img src="${imgSource}" width="260" height="150" style="width:260px; max-width:260px; height:auto; display:block; margin:0 auto; border-radius:4px;" alt="Frame"/>` : '<div style="height:140px;line-height:140px;color:#64748b;font-size:9pt;text-align:center;">No Frame Image</div>'}
                                </td>
                            </tr>
                            <tr>
                                <td align="left" valign="top" style="padding:12px; font-family:'Segoe UI','Calibri',sans-serif; background-color:#1e293b;">
                                    <div style="font-size:10pt; font-weight:bold; color:#f8fafc; margin-bottom:4px;">
                                        ${item.observation_type || item.type || fallbackType} — Frame ${idx + 1}
                                    </div>
                                    <div style="font-size:8.5pt; color:#cbd5e1; line-height:1.4; margin-bottom:4px;">
                                        <strong>Activity:</strong> ${item.activity || 'General Operations'}
                                    </div>
                                    <div style="font-size:8.5pt; color:#cbd5e1; line-height:1.4;">
                                        ${item.description || 'Patrol unit alert.'}
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                `;
            };

            html += `<tr>${renderCard(item1, i)}<td width="4%">&nbsp;</td>${renderCard(item2, i + 1)}</tr>`;
        }
        html += `</table>`;
        return html;
    };

    const generateReportHTML = (dataset, isPreviewWindow = false) => {
        const dynamicTypeGroups = new Map();
        dataset.forEach((a) => {
            const t = (a.observation_type || a.type || 'General Observations').trim();
            if (!dynamicTypeGroups.has(t)) {
                dynamicTypeGroups.set(t, []);
            }
            dynamicTypeGroups.get(t).push(a);
        });

        const categorySections = Array.from(dynamicTypeGroups.entries()).map(([typeName, items]) => `
            <h2>${typeName.toUpperCase()} OBSERVATIONS (${items.length})</h2>
            ${renderDynamicPhotoGrid(items, typeName)}
        `).join('');

        const summaryBreakdown = Array.from(dynamicTypeGroups.entries()).map(([typeName, items]) => `${typeName}: ${items.length}`).join(' | ');

        return `
            <!DOCTYPE html>
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>Autonomous Patrol Report — ${reportDate}</title>
                <style>
                    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 20px; background-color: #ffffff; }
                    h1 { color: #0f172a; font-size: 15pt; font-weight: bold; text-transform: uppercase; border-bottom: 3px solid #dc2626; padding-bottom: 4px; }
                    h2 { color: #1e293b; font-size: 11.5pt; font-weight: bold; border-left: 4px solid #0284c7; padding-left: 6px; margin-top: 24px; margin-bottom: 12px; }
                    table.meta-table, table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 9.5pt; }
                    table.meta-table td, table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                    table.data-table th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
                    .meta-label { background-color: #f8fafc; font-weight: bold; width: 32%; color: #475569; }
                    .total-row { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
                    .preview-toolbar {
                        position: sticky;
                        top: 0;
                        background: #0f172a;
                        color: #ffffff;
                        padding: 10px 16px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 24px;
                        z-index: 1000;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    }
                    .preview-btn {
                        background: #3b82f6;
                        color: #ffffff;
                        border: none;
                        padding: 8px 16px;
                        font-weight: bold;
                        font-size: 12px;
                        border-radius: 6px;
                        cursor: pointer;
                    }
                    .preview-btn:hover { background: #2563eb; }
                    .preview-btn-close { background: #475569; }
                    .preview-btn-close:hover { background: #334155; }
                    @media print {
                        .preview-toolbar { display: none !important; }
                        body { margin: 0; padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${isPreviewWindow ? `
                    <div class="preview-toolbar">
                        <span style="font-weight: bold; font-size: 13px;">📄 Report Document Preview (${reportDate})</span>
                        <div style="display: flex; gap: 8px;">
                            <button class="preview-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
                            <button class="preview-btn preview-btn-close" onclick="window.close()">Close Preview</button>
                        </div>
                    </div>
                ` : ''}

                <h1>AUTONOMOUS ROBOTIC PATROL INSPECTION REPORT</h1>
                <table class="meta-table" width="100%">
                    <tr><td class="meta-label">Patrol Unit</td><td>${selectedRobot && selectedRobot !== 'All' ? selectedRobot : 'Autonomous Unit'}</td></tr>
                    <tr><td class="meta-label">Inspection Date</td><td>${reportDate}</td></tr>
                    <tr><td class="meta-label">Total Images Captured</td><td>${dataset.length}</td></tr>
                    <tr><td class="meta-label">Observations Summary</td><td>${summaryBreakdown}</td></tr>
                </table>

                <h2>SUMMARY OF FINDINGS</h2>
                <table class="data-table" width="100%">
                    <thead>
                        <tr>
                            <th width="8%">S.No</th>
                            <th width="28%">Observation Type</th>
                            <th width="36%">Description</th>
                            <th width="20%">Activity</th>
                            <th width="8%">Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.summaryRows.map((row, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td><strong>${row.type}</strong></td>
                                <td>${row.description}</td>
                                <td>${row.activity}</td>
                                <td>${row.count}</td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; padding-right: 14px;"><strong>TOTAL OBSERVATIONS RECORDED</strong></td>
                            <td><strong>${stats.total}</strong></td>
                        </tr>
                    </tbody>
                </table>

                ${categorySections}
            </body>
            </html>
        `;
    };

    // Embeds images as Base64 in parallel and saves the Word .doc file
    const handleDownloadWord = async () => {
        setIsDropdownOpen(false);

        const datasetWithImages = await Promise.all(
            filteredAnomalies.map(async (item) => {
                const b64 = item.image_url ? await getBase64Image(item.image_url) : null;
                return { ...item, _embeddedBase64: b64 };
            })
        );

        const htmlContent = generateReportHTML(datasetWithImages, false);
        const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Safety_Patrol_Report_${reportDate}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Opens preview tab immediately to prevent popup blocking
    const handleDownloadPDF = () => {
        setIsDropdownOpen(false);
        const previewTab = window.open('', '_blank');
        if (previewTab) {
            const htmlContent = generateReportHTML(filteredAnomalies, true);
            previewTab.document.open();
            previewTab.document.write(htmlContent);
            previewTab.document.close();
            previewTab.focus();
        }
    };

    const handleDownloadCSV = () => {
        if (filteredAnomalies.length === 0) return alert('No anomaly records found to export.');
        const headers = ['S.No', 'Robot ID', 'Observation Type', 'Activity', 'Timestamp', 'Description', 'Image Reference'];
        const csvRows = [
            headers.join(','),
            ...filteredAnomalies.map((row, idx) => [
                idx + 1,
                row.project_id || row.robot_id || '',
                `"${(row.observation_type || row.type || '').replace(/"/g, '""')}"`,
                `"${(row.activity || 'N/A').replace(/"/g, '""')}"`,
                row.observation_date || row.timestamp || '',
                `"${(row.description || '').replace(/"/g, '""')}"`,
                `"${(resolveImageUrl(row.image_url) || '').replace(/"/g, '""')}"`
            ].join(','))
        ];

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Safety_Report_${reportDate}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blob);
        setIsDropdownOpen(false);
    };

    const handleDownloadPhotosZip = async (onlySelected = false) => {
        let itemsToProcess = [];
        if (onlySelected) {
            const selectedSet = new Set(selectedIds);
            itemsToProcess = filteredAnomalies.filter(item => selectedSet.has(item.id) && item.image_url);
        } else {
            itemsToProcess = filteredAnomalies.filter(item => item.image_url);
        }

        if (itemsToProcess.length === 0) {
            return alert(onlySelected ? 'Please select at least one photo.' : 'No photos found for this dataset.');
        }

        setIsDownloadingZip(true);
        setIsDropdownOpen(false);
        setZipProgress({ current: 0, total: itemsToProcess.length, percent: 0, label: 'Downloading photos in parallel...' });

        try {
            const JSZipClass = await loadJSZip();
            const zip = new JSZipClass();
            const rootFolder = zip.folder(`Patrol_Photos_${reportDate}`);

            let completed = 0;
            const concurrency = 10;
            let index = 0;

            const worker = async () => {
                while (index < itemsToProcess.length) {
                    const currentIndex = index++;
                    const item = itemsToProcess[currentIndex];
                    const obsCategory = sanitizeFolderName(item.observation_type || item.type || 'General_Observations');
                    const actSubfolder = sanitizeFolderName(item.activity || 'General_Activity');
                    const targetFolder = rootFolder.folder(obsCategory).folder(actSubfolder);
                    const fileName = `Frame_${item.id || (currentIndex + 1)}_${item.robot_id || 'ROB'}_${reportDate}.jpg`;

                    try {
                        const jpegBlob = await urlToJpegBlob(item.image_url);
                        targetFolder.file(fileName, jpegBlob);
                    } catch (err) {
                        console.error(`Error adding image ${item.id}:`, err);
                    }

                    completed++;
                    setZipProgress({
                        current: completed,
                        total: itemsToProcess.length,
                        percent: Math.round((completed / itemsToProcess.length) * 85),
                        label: `Downloaded ${completed} of ${itemsToProcess.length} images...`
                    });
                }
            };

            await Promise.all(Array.from({ length: Math.min(concurrency, itemsToProcess.length) }, () => worker()));

            setZipProgress(prev => ({ ...prev, percent: 90, label: 'Compressing archive into ZIP...' }));

            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Patrol_Photos_${reportDate}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('ZIP generation error:', err);
            alert('Could not compile ZIP archive.');
        } finally {
            setIsDownloadingZip(false);
        }
    };

    return (
        <>
            {isProcessingZip && (
                <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white mb-3 shadow-md">
                            <Loader2 size={24} className="animate-spin text-indigo-400" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Compiling ZIP Archive</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">{zipProgress.label}</p>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200 mb-2">
                            <div className="bg-indigo-600 h-full transition-all duration-200" style={{ width: `${zipProgress.percent}%` }} />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                            {zipProgress.current} / {zipProgress.total} Frames ({zipProgress.percent}%)
                        </span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap bg-white border border-slate-200/80 p-3 rounded-xl shadow-sm mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Download size={14} className="text-slate-500" /> Selection:
                    </span>
                    <button
                        onClick={selectedIds.length === filteredAnomalies.length ? onClearSelection : onSelectAll}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                    >
                        <CheckSquare size={13} />
                        <span>{selectedIds.length === filteredAnomalies.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    {selectedIds.length > 0 && (
                        <button
                            onClick={() => handleDownloadPhotosZip(true)}
                            disabled={isProcessingZip}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                            <ImageIcon size={13} />
                            <span>Download Selected ({selectedIds.length})</span>
                        </button>
                    )}
                </div>

                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={isProcessingZip}
                        className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg shadow-sm transition-all"
                    >
                        <FileText size={14} />
                        <span>Generate & Download Report</span>
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Document Reports</div>
                            <button onClick={handleDownloadWord} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <FileDown size={15} className="text-blue-600" /> Download Word (.doc) with Images
                            </button>
                            <button onClick={handleDownloadPDF} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <Printer size={15} className="text-red-600" /> Preview & Print / PDF
                            </button>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-b border-slate-100 mt-1">Media & Archives</div>
                            <button onClick={() => handleDownloadPhotosZip(false)} disabled={isProcessingZip} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <ImageIcon size={15} className="text-emerald-600" /> Download Category Photos (.zip)
                            </button>
                            <button onClick={handleDownloadCSV} className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <Download size={15} className="text-amber-600" /> Export CSV Dataset
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}