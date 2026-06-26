import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import type { CampusNetwork, SecuritySettings } from '../../services/api';
import { swalSuccess, swalError, swalConfirmDelete } from '../../utils/swal';
import {
  ShieldAlert, Wifi, Plus, Trash2, Loader2, Network,
  ToggleLeft, ToggleRight, Save, Globe, X, Router
} from 'lucide-react';

export const CampusNetworkManager: React.FC = () => {
  const [networks, setNetworks] = useState<CampusNetwork[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>({});
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create form fields
  const [label, setLabel] = useState('');
  const [cidr, setCidr] = useState('');
  const [ssid, setSsid] = useState('');
  const [bssidPrefix, setBssidPrefix] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [nets, cfg] = await Promise.all([
        apiService.adminGetCampusNetworks(),
        apiService.adminGetSecuritySettings()
      ]);
      setNetworks(nets);
      setSettings(cfg);
    } catch {
      await swalError('Load Failed', 'Could not load network security configuration.');
    } finally {
      setLoading(false);
    }
  };

  const truthy = (v?: string) => String(v).toLowerCase() === 'true';

  const resetForm = () => {
    setLabel(''); setCidr(''); setSsid(''); setBssidPrefix(''); setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!label.trim()) { setFormError('Label is required.'); return; }
    if (!cidr.trim() && !ssid.trim() && !bssidPrefix.trim()) {
      setFormError('Provide at least one rule: CIDR, SSID, or BSSID prefix.');
      return;
    }
    setCreating(true);
    try {
      await apiService.adminCreateCampusNetwork({
        label: label.trim(),
        cidr: cidr.trim() || null,
        ssid: ssid.trim() || null,
        bssid_prefix: bssidPrefix.trim() || null,
        is_active: true
      });
      setIsCreateOpen(false);
      resetForm();
      fetchAll();
      await swalSuccess('Rule Added', 'Campus network rule created.');
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create network rule.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (net: CampusNetwork) => {
    try {
      await apiService.adminUpdateCampusNetwork(net.id, { is_active: !net.is_active });
      setNetworks(prev => prev.map(n => n.id === net.id ? { ...n, is_active: !n.is_active } : n));
    } catch {
      await swalError('Update Failed', 'Could not toggle the rule.');
    }
  };

  const handleDelete = async (net: CampusNetwork) => {
    const confirmed = await swalConfirmDelete(net.label, 'Students on this network will no longer be auto-verified.');
    if (!confirmed) return;
    try {
      await apiService.adminDeleteCampusNetwork(net.id);
      fetchAll();
      await swalSuccess('Rule Deleted', 'Campus network rule removed.');
    } catch {
      await swalError('Deletion Failed', 'Could not delete the rule.');
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updated = await apiService.adminUpdateSecuritySettings(settings);
      setSettings(updated);
      await swalSuccess('Settings Saved', 'Security policy updated.');
    } catch (err: any) {
      await swalError('Save Failed', err.response?.data?.detail || 'Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const ToggleRow: React.FC<{ keyName: string; title: string; desc: string }> = ({ keyName, title, desc }) => {
    const on = truthy(settings[keyName]);
    return (
      <button
        type="button"
        onClick={() => handleSettingChange(keyName, on ? 'false' : 'true')}
        className="w-full flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-left cursor-pointer"
      >
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-400 leading-relaxed">{desc}</p>
        </div>
        {on
          ? <ToggleRight className="h-6 w-6 text-brand-blue shrink-0" />
          : <ToggleLeft className="h-6 w-6 text-slate-300 shrink-0" />}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="uipro-card bg-white/75">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl font-display font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-brand-blue" />
              Network Location Security
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Attendance is verified against the campus network. The server-observed source IP is the authoritative check (cannot be spoofed by the app); reported SSID / BSSID / gateway are corroborating signals. Configure allowed networks and policy below.
            </p>
          </div>
          <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="uipro-button uipro-button-primary shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Add Network Rule
          </button>
        </div>
      </div>

      {/* Security Policy */}
      <div className="uipro-card bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <Network className="h-4.5 w-4.5 text-brand-blue" /> Verification Policy
          </h3>
          <button onClick={handleSaveSettings} disabled={savingSettings} className="uipro-button uipro-button-primary py-2 px-4 text-[11px]">
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Save Policy
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <ToggleRow keyName="network_check_enabled" title="Enable network verification" desc="Master switch. When off, check-ins skip all network checks." />
          <ToggleRow keyName="fail_closed" title="Fail-closed (block off-campus)" desc="Reject check-in when the network can't be verified. Off = allow but flag." />
          <ToggleRow keyName="trust_proxy_header" title="Trust X-Forwarded-For" desc="Only enable when behind a trusted reverse proxy. Otherwise leave OFF." />
          <ToggleRow keyName="demo_simulate_network" title="Demo: simulate campus IP" desc="Override the observed IP with the simulated IP below. For localhost demos only." />
        </div>
        {truthy(settings.demo_simulate_network) && (
          <div className="mt-3 p-3 bg-warning-orange-light border border-warning-orange/20 rounded-xl">
            <label className="text-[10px] font-bold text-warning-orange uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Globe className="h-3.5 w-3.5" /> Simulated source IP (demo mode)
            </label>
            <input
              type="text"
              value={settings.demo_simulated_ip || ''}
              onChange={(e) => handleSettingChange('demo_simulated_ip', e.target.value)}
              placeholder="10.52.13.77"
              className="uipro-input font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">Set this inside a configured CIDR range to simulate an on-campus check-in, or outside it to simulate rejection.</p>
          </div>
        )}
      </div>

      {/* Whitelist table */}
      <div className="uipro-card bg-white p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <Wifi className="h-4.5 w-4.5 text-brand-blue" /> Allowed Campus Networks
          </h3>
        </div>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2 text-xs">
            <Loader2 className="h-6 w-6 text-brand-blue animate-spin" />
            <span>Loading networks...</span>
          </div>
        ) : networks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No network rules yet. Add a CIDR range (e.g. <span className="font-mono">10.52.0.0/16</span>) to start enforcing.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Label</th>
                <th className="py-2.5 px-4">CIDR / Subnet</th>
                <th className="py-2.5 px-4">SSID</th>
                <th className="py-2.5 px-4">BSSID Prefix</th>
                <th className="py-2.5 px-4 text-center">Active</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {networks.map((net) => (
                <tr key={net.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{net.label}</td>
                  <td className="py-3 px-4 font-mono text-brand-blue">{net.cidr || <span className="text-slate-300">—</span>}</td>
                  <td className="py-3 px-4 text-slate-500">{net.ssid || <span className="text-slate-300">—</span>}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{net.bssid_prefix || <span className="text-slate-300">—</span>}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => handleToggleActive(net)} className="cursor-pointer">
                      {net.is_active
                        ? <ToggleRight className="h-6 w-6 text-success-green inline" />
                        : <ToggleLeft className="h-6 w-6 text-slate-300 inline" />}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => handleDelete(net)} className="p-2 rounded-lg text-danger-red hover:bg-danger-red-light transition-colors cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Router className="h-5 w-5 text-brand-blue" /> Add Network Rule
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Label *</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Main Campus Student VLAN" className="uipro-input mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CIDR / Subnet</label>
                <input value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="10.52.0.0/16" className="uipro-input mt-1 font-mono" />
                <p className="text-[10px] text-slate-400 mt-1">The authoritative rule. The server checks the real source IP against this range.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SSID</label>
                  <input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="UniWiFi-Student" className="uipro-input mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">BSSID Prefix</label>
                  <input value={bssidPrefix} onChange={(e) => setBssidPrefix(e.target.value)} placeholder="AC:DE:48" className="uipro-input mt-1 font-mono" />
                </div>
              </div>
              {formError && <p className="text-xs text-danger-red bg-danger-red-light p-2.5 rounded-lg">{formError}</p>}
              <button type="submit" disabled={creating} className="uipro-button uipro-button-primary w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Rule
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};




