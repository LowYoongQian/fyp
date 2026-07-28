import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { AuditLogEntry } from '../../services/api';
import {
  ShieldCheck,
  Search,
  Shield,
  Briefcase,
  Eye,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';

export const AuditManager: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'admin' | 'staff'>('admin');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  useEffect(() => {
    loadAuditLogs();
  }, [activeCategory]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAdminAuditLogs(activeCategory, search);
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAuditLogs();
  };

  // Local filtering
  const filteredLogs = logs.filter(log =>
    log.user_name.toLowerCase().includes(search.toLowerCase()) ||
    log.action.toLowerCase().includes(search.toLowerCase()) ||
    (log.details || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.ip_address || '').includes(search)
  );

  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('ADD')) return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50';
    if (act.includes('UPDATE') || act.includes('OVERRIDE')) return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50';
    if (act.includes('DELETE') || act.includes('REMOVE')) return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/50';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="uipro-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md relative overflow-hidden border border-slate-200/60 dark:border-slate-800 p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <ShieldCheck className="h-6 w-6 text-brand-blue" />
              System Audit Logs
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track and audit administrative operations, staff actions, system configuration updates, and manual security overrides.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shrink-0">
            <button
              onClick={() => { setActiveCategory('admin'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeCategory === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-brand-blue shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="h-4 w-4" />
              Admin Actions
            </button>
            <button
              onClick={() => { setActiveCategory('staff'); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeCategory === 'staff'
                  ? 'bg-white dark:bg-slate-900 text-brand-blue shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Staff / Lecturer Actions
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="uipro-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 space-y-6">
        {/* Search Header */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeCategory === 'admin' ? 'Admin' : 'Staff'} action, user name, IP...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Activity className="h-4 w-4 text-brand-blue" />
            <span>Category: <strong className="text-slate-800 dark:text-slate-200 capitalize">{activeCategory} Category</strong></span>
          </div>
        </form>

        {/* Shimmer Loader */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 w-full rounded-xl shimmer-placeholder" />
            ))}
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <ShieldCheck className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No audit log entries recorded for this category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Operation Details</th>
                  <th className="py-3 px-4">Client IP</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {log.user_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{log.user_name}</div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">{log.user_role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-300 max-w-sm truncate">
                      {log.details || "No metadata details provided"}
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                      {log.ip_address || "127.0.0.1"}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</span> to{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{Math.min(currentPage * rowsPerPage, filteredLogs.length)}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{filteredLogs.length}</span> audit logs
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* AUDIT LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-blue" />
                Audit Log Details
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">User Identity</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedLog.user_name} ({selectedLog.user_role})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Category</span>
                  <span className="font-mono uppercase font-bold text-brand-blue">{selectedLog.category}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Action Code</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{selectedLog.action}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Client IP Address</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedLog.ip_address}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Timestamp</span>
                  <span className="font-mono text-slate-500">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">Full Operation Payload / Details</label>
                <div className="p-3.5 bg-slate-950 text-slate-200 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedLog.details || "No additional metadata recorded."}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
