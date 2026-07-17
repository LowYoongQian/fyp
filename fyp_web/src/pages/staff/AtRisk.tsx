import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../../services/api';
import type { RiskScore, AlertLog } from '../../services/api';
import { swalSuccess, swalError, swalInfo } from '../../utils/swal';
import { AlertTriangle, Mail, Send, CheckCircle2, User, RefreshCw, Cpu, BookOpen, ShieldCheck, Eye, Activity } from 'lucide-react';

type RiskLevel = RiskScore['risk_label'];

export const AtRisk: React.FC = () => {
  const [riskList, setRiskList] = useState<RiskScore[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | RiskLevel>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Modal for draft dispatch (email function — preserved as-is)
  const [selectedStudentForAlert, setSelectedStudentForAlert] = useState<RiskScore | null>(null);
  const [customDraft, setCustomDraft] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskData, alertData] = await Promise.all([
        apiService.getRiskScores(),
        apiService.getAlertLogs(),
      ]);
      setRiskList(riskData);
      setAlertLogs(alertData);
    } catch (err) {
      console.error('Failed to load risk dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunNightlyJob = async () => {
    setLoading(true);
    try {
      await apiService.runNightlyRiskScorerJob();
      await loadData();
      await swalInfo('ML Job Completed', 'Recomputed attendance risk scores and refreshed the risk register.');
    } catch (err) {
      console.error(err);
      await swalError('Execution Failed', 'Failed to recompute risk scores.');
    } finally {
      setLoading(false);
    }
  };

  const openAlertModal = (score: RiskScore) => {
    setSelectedStudentForAlert(score);
    const body = `DEAR ${score.student_name?.toUpperCase()},\n\nThis is an official warning regarding your attendance in ${score.course_code}. Your current attendance rate is ${Math.round(score.attendance_rate * 100)}%${score.risk_factors ? ` (${score.risk_factors})` : ''}, which puts you at risk of falling below the university's 80% minimum requirement.\n\nContinued absences may result in a bar from final examinations. Please contact your lecturer or academic office immediately to discuss your status.\n\nBest regards,\nDepartment of Computing\nAcademic Counseling Office`;
    setCustomDraft(body);
  };

  const handleSendManualAlert = async () => {
    if (!selectedStudentForAlert) return;
    setSendingAlert(true);
    try {
      await apiService.triggerManualAlert(selectedStudentForAlert.student_id, selectedStudentForAlert.course_id);
      loadData();
      setSelectedStudentForAlert(null);
      await swalSuccess('Alert Dispatched', "Warning email sent to student and CC'd to academic advisor.");
    } catch (err) {
      console.error(err);
      await swalError('Dispatch Failed', 'Failed to send alert. Please try again.');
    } finally {
      setSendingAlert(false);
    }
  };

  // Distinct courses for the course filter dropdown.
  const courses = useMemo(() => {
    const map = new Map<string, string>();
    riskList.forEach(r => { if (r.course_code) map.set(r.course_code, r.course_name || r.course_code); });
    return Array.from(map, ([code, name]) => ({ code, name }));
  }, [riskList]);

  const filteredRisk = useMemo(() => riskList
    .filter(item => courseFilter === 'all' || item.course_code === courseFilter)
    .filter(item => activeFilter === 'all' || item.risk_label === activeFilter)
    .sort((a, b) => b.risk_score - a.risk_score),
    [riskList, courseFilter, activeFilter]);

  // Counts respect the current course filter (not the risk-level filter).
  const scoped = useMemo(() => riskList.filter(i => courseFilter === 'all' || i.course_code === courseFilter), [riskList, courseFilter]);
  const counts = {
    high: scoped.filter(i => i.risk_label === 'high').length,
    medium: scoped.filter(i => i.risk_label === 'medium').length,
    low: scoped.filter(i => i.risk_label === 'low').length,
    observing: scoped.filter(i => i.risk_label === 'observing').length,
  };

  const badgeClass = (label: RiskLevel) =>
    label === 'high' ? 'uipro-badge-danger'
    : label === 'medium' ? 'bg-warning-orange-light text-warning-orange border-warning-orange/10'
    : label === 'observing' ? 'bg-slate-100 text-slate-500 border-slate-200'
    : 'uipro-badge-success';

  const attendanceClass = (rate: number) =>
    rate < 0.80 ? 'text-danger-red' : rate < 0.88 ? 'text-warning-orange' : 'text-slate-800';

  const statCards = [
    { key: 'high', label: 'High Risk', value: counts.high, icon: AlertTriangle, color: 'text-danger-red', bg: 'bg-danger-red-light' },
    { key: 'medium', label: 'Medium Risk', value: counts.medium, icon: Activity, color: 'text-warning-orange', bg: 'bg-warning-orange-light' },
    { key: 'low', label: 'Low Risk', value: counts.low, icon: ShieldCheck, color: 'text-success-green', bg: 'bg-success-green-light' },
    { key: 'observing', label: 'Observing', value: counts.observing, icon: Eye, color: 'text-slate-500', bg: 'bg-slate-100' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Overview banner with recompute trigger */}
      <div className="uipro-card bg-white/75 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-brand-blue" />
              At-Risk Early-Warning Dashboard
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              A Random Forest classifier predicts which students risk falling below the 80% attendance bar — not just those already below it — from attendance rate, consecutive absences and trend. Each verdict lists the factors behind it so you can act early and dispatch a warning.
            </p>
          </div>
          <button onClick={handleRunNightlyJob} disabled={loading} className="uipro-button uipro-button-primary shrink-0">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Cpu className="h-4 w-4 mr-2" />}
            Recompute Risk Scores
          </button>
        </div>
      </div>

      {/* Summary stat cards (click to filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveFilter(activeFilter === c.key ? 'all' : c.key)}
            className={`uipro-card bg-white/70 flex items-center gap-4 text-left transition-all ${activeFilter === c.key ? 'ring-2 ring-brand-blue' : 'hover:shadow-md'}`}
          >
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <div className={`text-2xl font-display font-bold ${c.color}`}>{c.value}</div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Main grid: risk ledger + dispatch logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 uipro-card space-y-4 bg-white/70">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-100">
            <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">Student Risk Register</h3>
            <div className="flex flex-wrap items-center gap-2">
              {courses.length > 1 && (
                <select
                  value={courseFilter}
                  onChange={e => setCourseFilter(e.target.value)}
                  className="uipro-input py-1.5 px-3 text-xs rounded-lg"
                >
                  <option value="all">All courses</option>
                  {courses.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              )}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 text-xs">
                {(['all', 'high', 'medium', 'low'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 font-semibold rounded-lg transition-all uppercase tracking-wider cursor-pointer ${activeFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Student</th>
                  <th className="py-3 px-2">Course</th>
                  <th className="py-3 px-2 text-center">Attendance</th>
                  <th className="py-3 px-2 text-center">Risk</th>
                  <th className="py-3 px-2">Why</th>
                  <th className="py-3 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRisk.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400 uppercase tracking-wider font-semibold">No matching students.</td></tr>
                ) : filteredRisk.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors align-top">
                    <td className="py-3 px-2">
                      <div className="font-bold text-slate-800">{item.student_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.student_code}</div>
                    </td>
                    <td className="py-3 px-2"><span className="text-brand-blue font-bold">{item.course_code}</span></td>
                    <td className="py-3 px-2 text-center">
                      <span className={`font-bold ${attendanceClass(item.attendance_rate)}`}>{Math.round(item.attendance_rate * 100)}%</span>
                    </td>
                    <td className="py-3 px-2 text-center"><span className={`uipro-badge ${badgeClass(item.risk_label)}`}>{item.risk_label}</span></td>
                    <td className="py-3 px-2 max-w-[220px]"><span className="text-[11px] text-slate-500 leading-snug">{item.risk_factors || '—'}</span></td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => openAlertModal(item)}
                        disabled={item.risk_label === 'low' || item.risk_label === 'observing'}
                        className="uipro-button uipro-button-secondary py-1.5 px-3 rounded-lg text-xs ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Mail className="h-3.5 w-3.5 text-brand-blue mr-1.5" /><span>Alert</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Email Dispatch Logs (email function — preserved) */}
        <div className="uipro-card flex flex-col justify-between bg-white/70">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Send className="h-4.5 w-4.5 text-success-green" />
              <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">Email Dispatch Logs</h3>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
              {alertLogs.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-sans uppercase text-[10px] font-bold">No logs recorded.</div>
              ) : alertLogs.map(log => (
                <div key={log.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2 text-xs font-sans">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">{log.student_name}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <BookOpen className="h-3 w-3 text-brand-blue" />{log.course_code}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${log.triggered_by === 'system' ? 'bg-success-green-light text-success-green border-success-green/10' : 'bg-brand-blue-light text-brand-blue border-brand-blue/10'}`}>
                      {log.triggered_by.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-100 line-clamp-2">{log.email_body}</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                    <span>Sent: {new Date(log.triggered_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1 text-success-green font-bold">
                      <CheckCircle2 className="h-3 w-3" />Delivered
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Manual Alert Modal (email function — preserved) */}
      {selectedStudentForAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 p-6 rounded-2xl space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-brand-blue" />
                Customize Warning Email Dispatch
              </h3>
              <button onClick={() => setSelectedStudentForAlert(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3 text-xs font-sans">
              <User className="h-7 w-7 text-brand-blue bg-brand-blue-light p-1.5 rounded-lg border border-brand-blue/10" />
              <div>
                <p className="font-bold text-slate-800">Recipient: {selectedStudentForAlert.student_name} ({selectedStudentForAlert.student_code})</p>
                <p className="text-slate-400 mt-0.5">Course: {selectedStudentForAlert.course_code} · {selectedStudentForAlert.risk_factors}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-sans">
              <label className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Email Body</label>
              <textarea value={customDraft} onChange={e => setCustomDraft(e.target.value)} rows={8} className="w-full uipro-input resize-none leading-relaxed" />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedStudentForAlert(null)} className="uipro-button uipro-button-secondary py-2 px-4 text-xs">Cancel</button>
              <button type="button" onClick={handleSendManualAlert} disabled={sendingAlert} className="uipro-button uipro-button-primary py-2 px-4 text-xs">
                {sendingAlert ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Dispatch Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
