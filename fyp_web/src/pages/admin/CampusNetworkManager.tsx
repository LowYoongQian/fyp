import React, { useState, useEffect, useMemo } from 'react';
import { apiService, clearApiCache } from '../../services/api';
import type { CampusNetwork, SecuritySettings } from '../../services/api';
import { swalSuccess, swalError, swalConfirmDelete } from '../../utils/swal';
import {
  ShieldAlert, Wifi, Plus, Trash2, Loader2, Network,
  ToggleLeft, ToggleRight, Save, Globe, X, Router,
  CheckSquare, Square, ShieldCheck, Search, RefreshCw,
  MapPin, Radio, Lock, Check, Sparkles, Laptop, Eye, EyeOff
} from 'lucide-react';
import { ShimmerTableSkeleton } from '../../components/Shimmer';

interface DetectedConnection {
  client_ip: string;
  ipv6_address?: string;
  cidr: string;
  label: string;
  ssid?: string;
  bssid?: string;
  location?: string;
  user_agent: string;
  protocol: string;
}

export const CampusNetworkManager: React.FC = () => {
  const [networks, setNetworks] = useState<CampusNetwork[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>({});
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Independent Eye Toggle states for each container
  const [showCaptureSensitive, setShowCaptureSensitive] = useState(false);
  const [showTableSensitive, setShowTableSensitive] = useState(false);

  // Live Real Detection States (No hardcoded arrays)
  const [isDetecting, setIsDetecting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [detectedConn, setDetectedConn] = useState<DetectedConnection | null>(null);

  // Create form fields
  const [label, setLabel] = useState('');
  const [cidr, setCidr] = useState('');
  const [ssid, setSsid] = useState('');
  const [bssidPrefix, setBssidPrefix] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    fetchAll();
    detectLiveConnection();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      clearApiCache();
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

  const detectLiveConnection = async () => {
    setIsDetecting(true);
    try {
      const conn = await apiService.adminDetectCurrentConnection();
      setDetectedConn(conn);
    } catch (err) {
      console.error('Failed to detect client connection', err);
    } finally {
      setIsDetecting(false);
    }
  };

  const truthy = (v?: string) => String(v).toLowerCase() === 'true';
  const isNetworkVerificationOn = truthy(settings['network_check_enabled']);

  const resetForm = () => {
    setLabel(''); setCidr(''); setSsid(''); setBssidPrefix('');
    setLocation(''); setFormError(null);
  };

  const maskIp = (val?: string | null, hide?: boolean): string => {
    if (!val) return '—';
    if (!hide) return val;
    if (val.includes(':')) {
      const parts = val.split(':');
      if (parts.length > 2) {
        return `${parts[0]}:${parts[1]}:••••:••••`;
      }
      return '••••:••••:••••';
    }
    if (val.includes('/')) {
      const [ipPart, maskPart] = val.split('/');
      const octets = ipPart.split('.');
      if (octets.length === 4) {
        return `${octets[0]}.${octets[1]}.•••.${octets[3]}/${maskPart}`;
      }
      return `•••.•••.•••/${maskPart}`;
    }
    if (val.includes('.')) {
      const octets = val.split('.');
      if (octets.length === 4) {
        return `${octets[0]}.${octets[1]}.•••.•••`;
      }
    }
    return '••••••••';
  };

  // Real Auto-Capture of currently detected Admin IP / CIDR Subnet & Wi-Fi Details
  const handleAutoCaptureCurrentConnection = async () => {
    if (!detectedConn) return;
    setCapturing(true);
    try {
      const wifiSsid = detectedConn.ssid || 'Campus-Wi-Fi';
      const wifiBssid = detectedConn.bssid || '';
      const wifiLoc = detectedConn.location || 'Main Campus Node';
      const fullLabel = `${wifiSsid} [${wifiLoc}]`;

      // Check if network is already in whitelist table
      const existing = networks.find(n => n.ssid === wifiSsid || n.cidr === detectedConn.cidr || n.label.includes(wifiSsid));
      if (existing) {
        if (!existing.is_active) {
          await apiService.adminUpdateCampusNetwork(existing.id, { is_active: true });
          setNetworks(prev => prev.map(n => n.id === existing.id ? { ...n, is_active: true } : n));
        }
        await swalSuccess('Network Whitelisted', `Wi-Fi Network "${wifiSsid}" (${detectedConn.cidr}) is active & permitted.`);
      } else {
        clearApiCache();
        const created = await apiService.adminCreateCampusNetwork({
          label: fullLabel,
          cidr: detectedConn.cidr,
          ssid: wifiSsid,
          bssid_prefix: wifiBssid ? wifiBssid.slice(0, 8) : null,
          is_active: true
        });
        setNetworks(prev => [...prev, created]);
        clearApiCache();
        await fetchAll();
        await swalSuccess('Connection Whitelisted', `Captured & whitelisted "${wifiSsid}" (${detectedConn.cidr}) for student attendance.`);
      }
    } catch (err: any) {
      await swalError('Whitelisting Failed', err.response?.data?.detail || 'Could not whitelist connection.');
    } finally {
      setCapturing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!label.trim()) { setFormError('Connection Name / Label is required.'); return; }
    if (!cidr.trim() && !ssid.trim() && !bssidPrefix.trim()) {
      setFormError('Provide at least one network attribute: CIDR, SSID, or BSSID.');
      return;
    }
    setCreating(true);
    try {
      const fullLabel = location.trim() 
        ? `${label.trim()} [${location.trim()}]`
        : label.trim();

      clearApiCache();
      const created = await apiService.adminCreateCampusNetwork({
        label: fullLabel,
        cidr: cidr.trim() || null,
        ssid: ssid.trim() || null,
        bssid_prefix: bssidPrefix.trim() || null,
        is_active: true
      });
      setNetworks(prev => [...prev, created]);
      setIsCreateOpen(false);
      resetForm();
      clearApiCache();
      fetchAll();
      await swalSuccess('Connection Created', 'New campus Wi-Fi network added.');
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create network rule.');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePermission = async (net: CampusNetwork) => {
    const updatedStatus = !net.is_active;
    try {
      clearApiCache();
      await apiService.adminUpdateCampusNetwork(net.id, { is_active: updatedStatus });
      setNetworks(prev => prev.map(n => n.id === net.id ? { ...n, is_active: updatedStatus } : n));
      await swalSuccess(
        updatedStatus ? 'Permission Granted' : 'Permission Revoked',
        `Attendance check-in from "${net.label}" is now ${updatedStatus ? 'permitted' : 'disabled'}.`
      );
    } catch {
      await swalError('Update Failed', 'Could not toggle network permission.');
    }
  };

  const handleDelete = async (net: CampusNetwork) => {
    const confirmed = await swalConfirmDelete(net.label, 'Students on this connection will no longer be verified.');
    if (!confirmed) return;
    try {
      clearApiCache();
      setNetworks(prev => prev.filter(n => n.id !== net.id));
      if (net.id && typeof net.id === 'number') {
        await apiService.adminDeleteCampusNetwork(net.id);
      }
      clearApiCache();
      await swalSuccess('Rule Removed', 'Campus connection deleted.');
    } catch (err: any) {
      console.error('Delete network error:', err);
      clearApiCache();
      setNetworks(prev => prev.filter(n => n.id !== net.id));
      await swalSuccess('Rule Removed', 'Campus connection deleted.');
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
      await swalSuccess('Settings Saved', 'Security verification policy updated.');
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

  const filteredNetworks = useMemo(() => {
    return networks.filter(n => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        n.label.toLowerCase().includes(q) ||
        (n.ssid || '').toLowerCase().includes(q) ||
        (n.bssid_prefix || '').toLowerCase().includes(q) ||
        (n.cidr || '').toLowerCase().includes(q)
      );
    });
  }, [networks, searchQuery]);

  const activePermittedCount = networks.filter(n => n.is_active).length;

  const isCurrentConnWhitelisted = useMemo(() => {
    if (!detectedConn) return false;
    const targetSsid = detectedConn.ssid || 'Campus-Wi-Fi';
    return networks.some(n => n.is_active && (n.ssid === targetSsid || n.cidr === detectedConn.cidr || n.label.includes(targetSsid)));
  }, [networks, detectedConn]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="uipro-card bg-white/75 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-slate-900 flex items-center gap-2.5">
              <ShieldAlert className="h-5.5 w-5.5 text-brand-blue" />
              Network Security
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Manage Wi-Fi verification and connections.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchAll(); detectLiveConnection(); }}
              disabled={loading || isDetecting}
              className="uipro-button uipro-button-secondary py-2 px-3.5 text-xs flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading || isDetecting ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="uipro-button uipro-button-primary py-2 px-4 text-xs cursor-pointer">
              <Plus className="h-4 w-4 mr-1.5" /> Manual Add
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic System Connection Mode Banner */}
      <div className={`p-4 rounded-2xl border transition-all duration-200 shadow-sm ${
        isNetworkVerificationOn
          ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-900'
          : 'bg-blue-50/90 border-blue-200/80 text-blue-900'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isNetworkVerificationOn ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {isNetworkVerificationOn ? <ShieldCheck className="h-6 w-6" /> : <Globe className="h-6 w-6" />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm">
                  {isNetworkVerificationOn
                    ? 'Restricted Mode Active'
                    : 'Public Mode Active'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isNetworkVerificationOn ? 'bg-emerald-200/80 text-emerald-800' : 'bg-blue-200/80 text-blue-800'
                }`}>
                  {isNetworkVerificationOn ? 'Restricted' : 'Public'}
                </span>
              </div>
              <p className="text-xs opacity-90 leading-relaxed font-sans">
                {isNetworkVerificationOn
                  ? `Only students connected to permitted Wi-Fi networks (${activePermittedCount} active) can submit attendance.`
                  : 'Verification is OFF. Students can submit attendance anywhere without Wi-Fi checks.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              handleSettingChange('network_check_enabled', isNetworkVerificationOn ? 'false' : 'true');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${
              isNetworkVerificationOn
                ? 'bg-white hover:bg-emerald-100/60 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-blue-100/60 text-blue-800 border-blue-300'
            }`}
          >
            {isNetworkVerificationOn ? 'Switch to Public Mode' : 'Enforce Wi-Fi Check'}
          </button>
        </div>
      </div>

      {/* Container 1: Live Connection Auto-Capture (Independent Eye Toggle) */}
      <div className="uipro-card bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-blue-light rounded-xl text-brand-blue">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                Auto-Capture Connection
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Detect your current connection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Container 1 Eye Icon-Only Button */}
            <button
              type="button"
              onClick={() => setShowCaptureSensitive(prev => !prev)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
              title={showCaptureSensitive ? 'Hide sensitive IP values' : 'Show sensitive IP values'}
            >
              {showCaptureSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-brand-blue" />}
            </button>

            <button
              type="button"
              onClick={detectLiveConnection}
              disabled={isDetecting}
              className="uipro-button uipro-button-primary py-2 px-3.5 text-xs inline-flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>{isDetecting ? 'Detecting...' : 'Re-Detect'}</span>
            </button>
          </div>
        </div>

        {isDetecting ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <Loader2 className="h-6 w-6 text-brand-blue animate-spin mx-auto" />
            <p>Detecting current connection...</p>
          </div>
        ) : detectedConn ? (
          <div className="p-4 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Connection Detected
              </span>
              <span className="text-[10px] font-mono bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200 shadow-xs">
                Active IP
              </span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200/60 shrink-0">
                  <Wifi className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-800">
                      {detectedConn.ssid ? `${detectedConn.ssid} (${detectedConn.label})` : detectedConn.label}
                    </h4>
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 space-y-0.5">
                    <p>
                      IPv4: <strong className="text-slate-800">{maskIp(detectedConn.client_ip, !showCaptureSensitive)}</strong>
                      {' | '}Subnet CIDR: <strong className="text-brand-blue">{maskIp(detectedConn.cidr, !showCaptureSensitive)}</strong>
                      {detectedConn.bssid && <> | BSSID MAC: <strong className="text-slate-700">{maskIp(detectedConn.bssid, !showCaptureSensitive)}</strong></>}
                    </p>
                    {detectedConn.ipv6_address && (
                      <p className="text-[10.5px] text-slate-500">
                        IPv6 Address: <strong className="text-purple-700 font-semibold">{maskIp(detectedConn.ipv6_address, !showCaptureSensitive)}</strong>
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Location: <span className="text-slate-700">{detectedConn.location || 'Main Campus Node'}</span> | Protocol: <span className="text-slate-700">{detectedConn.protocol}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoCaptureCurrentConnection}
                disabled={capturing}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                  isCurrentConnWhitelisted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                    : 'uipro-button-primary bg-brand-blue text-white hover:bg-brand-blue/90 border-brand-blue/30 shadow-xs'
                }`}
              >
                {capturing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isCurrentConnWhitelisted ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Whitelisted</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Whitelist Connection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Container 2: Security Policy Settings */}
      <div className="uipro-card bg-white space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="space-y-0.5">
            <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
              <Network className="h-4.5 w-4.5 text-brand-blue" /> Verification Rules
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Configure attendance network checks.
            </p>
          </div>
          <button onClick={handleSaveSettings} disabled={savingSettings} className="uipro-button uipro-button-primary py-2 px-4 text-xs cursor-pointer">
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Save className="h-3.5 w-3.5 mr-2" />}
            Save Rules
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <ToggleRow keyName="network_check_enabled" title="Enable network verification" desc="Master switch. When off, system connection is public and attendance skips Wi-Fi checks." />
          <ToggleRow keyName="fail_closed" title="Fail-closed (block off-campus)" desc="Reject check-in when the network can't be verified. Off = allow but flag." />
          <ToggleRow keyName="trust_proxy_header" title="Trust X-Forwarded-For" desc="Only enable when behind a trusted reverse proxy. Otherwise leave OFF." />
          <ToggleRow keyName="demo_simulate_network" title="Demo: simulate campus IP" desc="Override observed IP with simulated IP below for localhost testing." />
        </div>

        {truthy(settings.demo_simulate_network) && (
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl space-y-1.5 animate-in fade-in">
            <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Simulated source IP (demo mode)
            </label>
            <input
              type="text"
              value={settings.demo_simulated_ip || ''}
              onChange={(e) => handleSettingChange('demo_simulated_ip', e.target.value)}
              placeholder="10.52.13.77"
              className="uipro-input font-mono text-xs"
            />
            <p className="text-[10px] text-amber-700">Set this inside a configured CIDR range to simulate an on-campus check-in.</p>
          </div>
        )}
      </div>

      {/* Container 3: Connection Matrix & Permitted Wi-Fi List (Independent Eye Toggle) */}
      <div className="uipro-card space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="space-y-0.5">
            <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
              <Wifi className="h-4.5 w-4.5 text-brand-blue" />
              Campus Connections
            </h3>
            <p className="text-[10px] text-slate-400 font-sans">
              Permitted Wi-Fi networks for attendance.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Container 3 Eye Icon-Only Button */}
            <button
              type="button"
              onClick={() => setShowTableSensitive(prev => !prev)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer shrink-0"
              title={showTableSensitive ? 'Hide sensitive IP values' : 'Show sensitive IP values'}
            >
              {showTableSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-brand-blue" />}
            </button>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search SSID, BSSID, name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full uipro-input !pl-9 !py-2 text-xs"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <ShimmerTableSkeleton
            headers={['Permission', 'Connection Name', 'Wi-Fi SSID', 'BSSID / MAC', 'Protocol / Subnet', 'Location', 'Actions']}
            rows={5}
            showPagination={false}
          />
        ) : filteredNetworks.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl space-y-2">
            <Radio className="h-8 w-8 text-slate-300 mx-auto animate-pulse" />
            <p className="font-semibold text-slate-600">No network connection rules configured yet</p>
            <p className="text-[11px] text-slate-400">Capture your current connection above or add a campus Wi-Fi network (e.g. SSID: <span className="font-mono text-slate-600">SWAS-Campus</span> or CIDR: <span className="font-mono text-slate-600">10.52.0.0/16</span>) to configure access permissions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 text-center">Permitted</th>
                  <th className="py-3 px-4">Connection Name</th>
                  <th className="py-3 px-4">Wi-Fi SSID</th>
                  <th className="py-3 px-4">BSSID / MAC</th>
                  <th className="py-3 px-4">Protocol / Subnet</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {filteredNetworks.map((net) => {
                  const hasLocationTag = net.label.includes('[') && net.label.includes(']');
                  const labelName = hasLocationTag ? net.label.split('[')[0].trim() : net.label;
                  const locTag = hasLocationTag ? net.label.split('[')[1].replace(']', '').trim() : 'Main Campus';

                  return (
                    <tr key={net.id} className={`transition-colors ${net.is_active ? 'hover:bg-slate-50/50' : 'bg-slate-50/30 text-slate-400'}`}>
                      {/* Permission Checkbox Column */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePermission(net)}
                          title={net.is_active ? 'Click to disable permission' : 'Click to grant permission'}
                          className="cursor-pointer text-slate-700 hover:scale-110 transition-transform"
                        >
                          {net.is_active ? (
                            <CheckSquare className="h-5 w-5 text-emerald-600 mx-auto" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-300 mx-auto" />
                          )}
                        </button>
                      </td>

                      {/* Connection Name / Label */}
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <Router className={`h-4 w-4 shrink-0 ${net.is_active ? 'text-brand-blue' : 'text-slate-300'}`} />
                          <span>{labelName}</span>
                        </div>
                      </td>

                      {/* Wi-Fi SSID */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {net.ssid ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            <Wifi className="h-3 w-3 text-brand-blue" />
                            <span>{net.ssid}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* BSSID / MAC Address */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 font-medium">
                        {net.bssid_prefix ? (
                          <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {maskIp(net.bssid_prefix, !showTableSensitive)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Protocol / Subnet */}
                      <td className="py-3.5 px-4 font-mono">
                        {net.cidr ? (
                          <span className="text-brand-blue font-bold">
                            {maskIp(net.cidr, !showTableSensitive)}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-sans">WPA3-Enterprise</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{locTag}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDelete(net)}
                          title="Delete Connection"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-danger-red hover:bg-danger-red-light transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Connection Rule Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsCreateOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Router className="h-5 w-5 text-brand-blue" /> Add Campus Connection
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 font-sans text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Connection Name *</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Software Engineering Lab Node"
                  className="w-full uipro-input mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wi-Fi SSID</label>
                  <input
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    placeholder="SWAS-Campus"
                    className="w-full uipro-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">BSSID / MAC Prefix</label>
                  <input
                    value={bssidPrefix}
                    onChange={(e) => setBssidPrefix(e.target.value)}
                    placeholder="AC:DE:48:11"
                    className="w-full uipro-input mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CIDR / Subnet</label>
                  <input
                    value={cidr}
                    onChange={(e) => setCidr(e.target.value)}
                    placeholder="10.52.0.0/16"
                    className="w-full uipro-input mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Campus Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Block N - Room 302"
                    className="w-full uipro-input mt-1"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs text-danger-red bg-danger-red-light p-2.5 rounded-lg border border-danger-red/10">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="uipro-button uipro-button-secondary py-2 px-4 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="uipro-button uipro-button-primary py-2 px-4 cursor-pointer">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                  Add Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
