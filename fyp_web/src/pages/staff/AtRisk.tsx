import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { RiskScore, AlertLog } from '../../services/api';
import { swalSuccess, swalError, swalInfo } from '../../utils/swal';
import { AlertTriangle, Mail, Send, CheckCircle2, User, RefreshCw, Cpu, BookOpen } from 'lucide-react';

export const AtRisk: React.FC = () => {
  const [riskList, setRiskList] = useState<RiskScore[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  
  // Modal for draft dispatch
  const [selectedStudentForAlert, setSelectedStudentForAlert] = useState<RiskScore | null>(null);
  const [customDraft, setCustomDraft] = useState('');
  const [sendingAlert, setSendingAlert] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskData, alertData] = await Promise.all([
        apiService.getRiskScores(),
        apiService.getAlertLogs()
      ]);
      setRiskList(riskData);
      setAlertLogs(alertData);
    } catch (err) {
      console.error("Failed to load risk dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunNightlyJob = async () => {
    setLoading(true);
    try {
      await apiService.runNightlyRiskScorerJob();
      await loadData();
      await swalInfo(
        'ML Job Completed',
        'Evaluated enrolled student attendance rates, updated risk_scores table, and generated automated alert emails for High Risk students.'
      );
    } catch (err) {
      console.error(err);
      await swalError('Execution Failed', 'Failed to recompute risk scores.');
    } finally {
      setLoading(false);
    }
  };

  const openAlertModal = (score: RiskScore) => {
    setSelectedStudentForAlert(score);
    const body = `DEAR ${score.student_name?.toUpperCase()},\n\nThis is an official warning regarding your low attendance in ${score.course_code}. Your current attendance rate is ${Math.round(score.attendance_rate * 100)}%, which falls below the university's 80% minimum requirement.\n\nContinued absences may result in a bar from final examinations. Please contact your lecturer or academic office immediately to discuss your status.\n\nBest regards,\nDepartment of Computing\nAcademic Counseling Office`;
    setCustomDraft(body);
  };

  const handleSendManualAlert = async () => {
    if (!selectedStudentForAlert) return;
    setSendingAlert(true);
    try {
      await apiService.triggerManualAlert(selectedStudentForAlert.student_id, selectedStudentForAlert.course_id);
      loadData();
      setSelectedStudentForAlert(null);
      await swalSuccess('Alert Dispatched', 'Warning email sent to student and CC\'d to academic advisor.');
    } catch (err) {
      console.error(err);
      await swalError('Dispatch Failed', 'Failed to send alert. Please try again.');
    } finally {
      setSendingAlert(false);
    }
  };

  const filteredRisk = riskList.filter(item => {
    if (activeFilter === 'all') return true;
    return item.risk_label === activeFilter;
  });

  return (
    <div className="space-y-8">
      {/* Overview Banner with Trigger */}
      <div className="uipro-card bg-white/75 relative overflow-hidden">
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-brand-blue" />
              At-Risk Intelligence & Alert Engine
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Person B's ML Random Forest classifier runs nightly to compute student risk scores. View students falling below the safety threshold, manually dispatch alert templates, or simulate the nightly ML processor.
            </p>
          </div>
          
          <button
            onClick={handleRunNightlyJob}
            disabled={loading}
            className="uipro-button uipro-button-primary shrink-0"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Cpu className="h-4 w-4 mr-2" />
            )}
            Run Nightly ML Job
          </button>
        </div>
      </div>

      {/* Main Grid: At-Risk Table vs Dispatch Logs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* At-Risk Students Panel */}
        <div className="xl:col-span-2 uipro-card space-y-4 bg-white/70">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-100">
            <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enrolled Students Risk Ledger
            </h3>
            
            {/* Filter Buttons */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 text-xs">
              {(['all', 'high', 'medium', 'low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3.5 py-1.5 font-semibold rounded-lg transition-all uppercase tracking-wider cursor-pointer ${
                    activeFilter === f
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Student</th>
                  <th className="py-3 px-2">Course</th>
                  <th className="py-3 px-2 text-center">Attendance</th>
                  <th className="py-3 px-2 text-center">Risk Factor</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRisk.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 uppercase tracking-wider font-semibold">
                      No matching student risk registers.
                    </td>
                  </tr>
                ) : (
                  filteredRisk.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-800">{item.student_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.student_code}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-brand-blue font-bold">{item.course_code}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`font-bold ${item.attendance_rate < 0.75 ? 'text-danger-red' : 'text-slate-850'}`}>
                          {Math.round(item.attendance_rate * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`uipro-badge ${
                          item.risk_label === 'high'
                            ? 'uipro-badge-danger'
                            : item.risk_label === 'medium'
                            ? 'bg-warning-orange-light text-warning-orange border-warning-orange/10'
                            : 'uipro-badge-success'
                        }`}>
                          {item.risk_label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          onClick={() => openAlertModal(item)}
                          className="uipro-button uipro-button-secondary py-1.5 px-3 rounded-lg text-xs ml-auto"
                        >
                          <Mail className="h-3.5 w-3.5 text-brand-blue mr-1.5" />
                          <span>Alert</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alert History Panel */}
        <div className="uipro-card flex flex-col justify-between bg-white/70">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Send className="h-4.5 w-4.5 text-success-green" />
              <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider">
                Email Dispatch Logs
              </h3>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {alertLogs.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-sans uppercase text-[10px] font-bold">No logs recorded.</div>
              ) : (
                alertLogs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl space-y-2 text-xs font-sans">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-slate-800 block">{log.student_name}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <BookOpen className="h-3 w-3 text-brand-blue" />
                          {log.course_code}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        log.triggered_by === 'system'
                          ? 'bg-success-green-light text-success-green border-success-green/10'
                          : 'bg-brand-blue-light text-brand-blue border-brand-blue/10'
                      }`}>
                        {log.triggered_by.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-100 line-clamp-2">
                      {log.email_body}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>Sent: {new Date(log.triggered_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 text-success-green font-bold">
                        <CheckCircle2 className="h-3 w-3" />
                        Delivered
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Dispatch Manual Alert Modal Draft */}
      {selectedStudentForAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 p-6 rounded-2xl space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-sans text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Mail className="h-4.5 w-4.5 text-brand-blue" />
                Customize Warning Email Dispatch
              </h3>
              <button
                onClick={() => setSelectedStudentForAlert(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3 text-xs font-sans">
              <User className="h-7 w-7 text-brand-blue bg-brand-blue-light p-1.5 rounded-lg border border-brand-blue/10" />
              <div>
                <p className="font-bold text-slate-800">
                  Recipient: {selectedStudentForAlert.student_name} ({selectedStudentForAlert.student_code})
                </p>
                <p className="text-slate-400 mt-0.5">Course Target: {selectedStudentForAlert.course_code}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-sans">
              <label className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Jinja2 Template Body</label>
              <textarea
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                rows={8}
                className="w-full uipro-input resize-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedStudentForAlert(null)}
                className="uipro-button uipro-button-secondary py-2 px-4 text-xs"
              >
                Cancel Draft
              </button>
              <button
                type="button"
                onClick={handleSendManualAlert}
                disabled={sendingAlert}
                className="uipro-button uipro-button-primary py-2 px-4 text-xs"
              >
                {sendingAlert ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Dispatch Warning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
