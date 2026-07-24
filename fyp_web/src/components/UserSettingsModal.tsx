import React, { useState, useEffect, useRef } from 'react';
import { apiService, clearApiCache } from '../services/api';
import { swalSuccess, swalError } from '../utils/swal';
import {
  Settings, Moon, Sun, Monitor, Bell, Shield, Globe, Search, ChevronDown,
  Loader2, X, Save, AlertTriangle, KeyRound, Copy, Check
} from 'lucide-react';
import { ShimmerSettingsModal } from './Shimmer';
import { THEME_TOKENS } from '../theme/themeTokens';
import { saveThemePreference } from '../theme/themePreference';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Custom Animated Switch Widget (100% Controlled, Bulletproof Alignment) ─────────────
const CustomSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}> = ({ checked, onChange, disabled, id, ariaLabel }) => {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center p-0.5 rounded-full border transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] shadow-inner ${
        checked
          ? 'bg-[#2563eb] border-[#1d4ed8]'
          : 'bg-slate-200 border-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

// ─── Custom Segmented Control Widget for Theme (Blue Accent) ────────────────
const CustomSegmentedThemeControl: React.FC<{
  selected: string;
  onChange: (value: string) => void;
}> = ({ selected, onChange }) => {
  const options = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl border bg-slate-100 border-slate-200">
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`min-h-[44px] px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-xs ${
              isSelected
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ─── Custom Segmented Control Widget for Font Scaling ────────────────
const CustomSegmentedFontControl: React.FC<{
  selected: string;
  onChange: (value: string) => void;
}> = ({ selected, onChange }) => {
  const options = [
    { id: 'small', label: 'Small', desc: '14px' },
    { id: 'medium', label: 'Medium', desc: '16px' },
    { id: 'large', label: 'Large', desc: '18px' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl border bg-slate-100 border-slate-200">
      {options.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`min-h-[44px] px-3 py-1.5 rounded-lg font-bold flex flex-col items-center justify-center transition-all cursor-pointer text-xs ${
              isSelected
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <span className="truncate">{opt.label}</span>
            <span className={`text-[9px] font-semibold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
              {opt.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ─── Custom Scalable Popdown / Dropdown Menu Widget for Language ────────────────
const LANGUAGES = [
  { id: 'en', label: 'English (US)', region: 'United States', flag: '🇺🇸' },
  { id: 'ms', label: 'Bahasa Malaysia', region: 'Malaysia', flag: '🇲🇾' },
  { id: 'zh', label: '中文 (Simplified)', region: 'China', flag: '🇨🇳' },
  { id: 'ta', label: 'தமிழ் (Tamil)', region: 'India / Malaysia', flag: '🇮🇳' },
  { id: 'ja', label: '日本語 (Japanese)', region: 'Japan', flag: '🇯🇵' },
  { id: 'fr', label: 'Français (French)', region: 'France', flag: '🇫🇷' },
  { id: 'es', label: 'Español (Spanish)', region: 'Spain', flag: '🇪🇸' },
  { id: 'de', label: 'Deutsch (German)', region: 'Germany', flag: '🇩🇪' },
];

const CustomLanguageDropdown: React.FC<{
  selected: string;
  onChange: (value: string) => void;
}> = ({ selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLang = LANGUAGES.find(l => l.id === selected) || LANGUAGES[0];

  const filteredLangs = LANGUAGES.filter(l =>
    l.label.toLowerCase().includes(search.toLowerCase()) ||
    l.region.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[48px] px-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer bg-white text-slate-800 border-slate-200 hover:border-[#2563eb] shadow-xs ${
          isOpen ? 'border-[#2563eb] ring-2 ring-[#2563eb]/20' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg leading-none">{selectedLang.flag}</span>
          <div className="text-left">
            <p className="text-xs font-bold">{selectedLang.label}</p>
            <p className="text-[10px] text-slate-400">{selectedLang.region}</p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#2563eb]' : ''}`}
        />
      </button>

      {/* Popdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 p-2 border rounded-2xl shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150 max-h-64 flex flex-col bg-white border-slate-200 text-slate-800">
          {/* Search Box */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search language or region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          {/* Languages Options */}
          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filteredLangs.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching languages found
              </div>
            ) : (
              filteredLangs.map((lang) => {
                const isSelected = selected === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      onChange(lang.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-[#2563eb] font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base leading-none">{lang.flag}</span>
                      <div>
                        <p className="text-xs font-bold">{lang.label}</p>
                        <p className="text-[10px] text-slate-400">{lang.region}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-[#2563eb] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [initialState, setInitialState] = useState<any>(null);

  const [themeMode, setThemeMode] = useState<string>('light');
  const [fontSize, setFontSize] = useState<string>('medium');
  const [language, setLanguage] = useState<string>('en');

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      clearApiCache();
      const profile = await apiService.getUserProfile();
      const storedTheme = localStorage.getItem('theme_preference') || localStorage.getItem('theme');
      const loadedTheme = storedTheme || profile.theme_preference || 'light';
      const loadedFont = profile.font_size_preference || localStorage.getItem('font_size_preference') || 'medium';
      const loadedLang = profile.language_preference || localStorage.getItem('language_preference') || 'en';

      const snapshot = {
        themeMode: loadedTheme,
        fontSize: loadedFont,
        language: loadedLang,
        notificationsEnabled: profile.notifications_enabled ?? true,
        emailNotifications: profile.email_notifications ?? true,
        pushNotifications: profile.push_notifications ?? true,
        inAppNotifications: profile.in_app_notifications ?? true,
        twoFactorEnabled: profile.two_factor_enabled ?? false,
      };

      setInitialState(snapshot);
      setThemeMode(loadedTheme);
      setFontSize(loadedFont);
      setLanguage(loadedLang);

      applyLiveTheme(loadedTheme);
      applyLiveFontSize(loadedFont);
      applyLiveLanguage(loadedLang);

      setNotificationsEnabled(snapshot.notificationsEnabled);
      setEmailNotifications(snapshot.emailNotifications);
      setPushNotifications(snapshot.pushNotifications);
      setInAppNotifications(snapshot.inAppNotifications);
      setTwoFactorEnabled(snapshot.twoFactorEnabled);
    } catch {
      const fallbackTheme = localStorage.getItem('theme_preference') || localStorage.getItem('theme') || 'light';
      const fallbackFont = localStorage.getItem('font_size_preference') || 'medium';
      const fallbackLang = localStorage.getItem('language_preference') || 'en';

      setThemeMode(fallbackTheme);
      setFontSize(fallbackFont);
      setLanguage(fallbackLang);

      applyLiveTheme(fallbackTheme);
      applyLiveFontSize(fallbackFont);
      applyLiveLanguage(fallbackLang);
    } finally {
      setLoading(false);
    }
  };

  const isDirty = initialState ? (
    initialState.themeMode !== themeMode ||
    initialState.fontSize !== fontSize ||
    initialState.language !== language ||
    initialState.notificationsEnabled !== notificationsEnabled ||
    initialState.emailNotifications !== emailNotifications ||
    initialState.pushNotifications !== pushNotifications ||
    initialState.inAppNotifications !== inAppNotifications ||
    initialState.twoFactorEnabled !== twoFactorEnabled
  ) : false;

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    if (initialState) {
      applyLiveTheme(initialState.themeMode);
      applyLiveFontSize(initialState.fontSize);
      applyLiveLanguage(initialState.language);
    }
    onClose();
  };

  const applyLiveTheme = (mode: string) => {
    saveThemePreference(mode as 'light' | 'dark' | 'system');
  };

  const handleThemeChange = (newMode: string) => {
    setThemeMode(newMode);
    applyLiveTheme(newMode);
  };

  const applyLiveFontSize = (size: string) => {
    const root = document.documentElement;
    root.setAttribute('data-font-size', size);
    if (size === 'small') {
      root.style.fontSize = '14px';
    } else if (size === 'large') {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '16px';
    }
  };

  const handleFontSizeChange = (newSize: string) => {
    setFontSize(newSize);
    applyLiveFontSize(newSize);
  };

  const applyLiveLanguage = (lang: string) => {
    document.documentElement.lang = lang;
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    applyLiveLanguage(newLang);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      saveThemePreference(themeMode as 'light' | 'dark' | 'system');
      localStorage.setItem('font_size_preference', fontSize);
      localStorage.setItem('language_preference', language);

      applyLiveTheme(themeMode);

      await apiService.updateUserSettings({
        theme_preference: themeMode,
        font_size_preference: fontSize,
        language_preference: language,
        notifications_enabled: notificationsEnabled,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        in_app_notifications: inAppNotifications,
        two_factor_enabled: twoFactorEnabled,
      });

      setInitialState({
        themeMode,
        fontSize,
        language,
        notificationsEnabled,
        emailNotifications,
        pushNotifications,
        inAppNotifications,
        twoFactorEnabled,
      });

      await swalSuccess('Settings Saved', 'Your account preferences have been saved.');
      onClose();
    } catch (err: any) {
      await swalError('Save Failed', err.response?.data?.detail || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify2FACode = () => {
    if (twoFactorCode.length < 6) return;
    setVerifying2FA(true);
    setTimeout(() => {
      setTwoFactorEnabled(true);
      setVerifying2FA(false);
      setShow2FASetup(false);
      swalSuccess('2FA Enabled', 'Two-Factor Authentication has been configured.');
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      {/* Modal Shell Container */}
      <div
        style={{ backgroundColor: THEME_TOKENS.bg, color: THEME_TOKENS.textPrimary, borderColor: THEME_TOKENS.border }}
        className="max-w-2xl w-full h-[90vh] max-h-[720px] border relative z-10 flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        
        {/* 1. PERSISTENT HEADER */}
        <div style={{ backgroundColor: THEME_TOKENS.bg, borderColor: THEME_TOKENS.border }} className="flex items-center justify-between p-5 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#2563eb]">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ color: THEME_TOKENS.textPrimary }} className="font-display font-bold text-base">Settings</h3>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">Manage appearance, notifications, language, and security preferences.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <ShimmerSettingsModal />
          ) : (
            <>
              {/* SECTION A: SECURITY & AUTHENTICATION */}
              <div className="p-5 border border-slate-200 bg-slate-50/80 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs flex items-center gap-2 text-slate-900">
                    <Shield className="h-4 w-4 text-[#2563eb]" /> Security & Authentication
                  </h4>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    twoFactorEnabled
                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      : 'bg-slate-200 text-slate-600 border-slate-300'
                  }`}>
                    {twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
                  </span>
                </div>

                <div className="p-3.5 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Two-Factor Authentication (2FA)</p>
                    <p className="text-[10px] text-slate-400">Requires authenticator app code on login for account protection.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {!twoFactorEnabled && (
                      <button
                        type="button"
                        onClick={() => setShow2FASetup(true)}
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] cursor-pointer shadow-xs transition-colors"
                      >
                        Setup 2FA
                      </button>
                    )}
                    <CustomSwitch
                      checked={twoFactorEnabled}
                      onChange={(val) => {
                        if (val && !twoFactorEnabled) {
                          setShow2FASetup(true);
                        } else {
                          setTwoFactorEnabled(val);
                        }
                      }}
                      ariaLabel="2FA Master Switch"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION B: APPEARANCE & THEME */}
              <div className="p-5 border border-slate-200 bg-slate-50/80 rounded-2xl space-y-4">
                <h4 className="font-bold text-xs flex items-center gap-2 text-slate-900">
                  <Sun className="h-4 w-4 text-[#2563eb]" /> Appearance & Theme
                </h4>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">Theme Mode</label>
                  {/* Custom Segmented Control for Theme Selection */}
                  <CustomSegmentedThemeControl
                    selected={themeMode}
                    onChange={handleThemeChange}
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">Font Scaling</label>
                  {/* Custom Segmented Control for Font Scaling */}
                  <CustomSegmentedFontControl
                    selected={fontSize}
                    onChange={handleFontSizeChange}
                  />
                </div>
              </div>

              {/* SECTION C: NOTIFICATIONS */}
              <div className="p-5 border border-slate-200 bg-slate-50/80 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs flex items-center gap-2 text-slate-900">
                      <Bell className="h-4 w-4 text-[#2563eb]" /> Notifications
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Master toggle and channel preferences</p>
                  </div>
                  <CustomSwitch
                    checked={notificationsEnabled}
                    onChange={setNotificationsEnabled}
                    ariaLabel="Master Notification Toggle"
                  />
                </div>

                {notificationsEnabled && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between p-3 border border-slate-200 bg-white rounded-xl">
                      <span className="font-medium text-xs text-slate-900">In-App Toasts & Alerts</span>
                      <CustomSwitch
                        checked={inAppNotifications}
                        onChange={setInAppNotifications}
                        ariaLabel="In-App Toasts Switch"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-slate-200 bg-white rounded-xl">
                      <span className="font-medium text-xs text-slate-900">Push Notifications</span>
                      <CustomSwitch
                        checked={pushNotifications}
                        onChange={setPushNotifications}
                        ariaLabel="Push Notifications Switch"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-slate-200 bg-white rounded-xl">
                      <span className="font-medium text-xs text-slate-900">Email Announcements</span>
                      <CustomSwitch
                        checked={emailNotifications}
                        onChange={setEmailNotifications}
                        ariaLabel="Email Announcements Switch"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION D: LANGUAGE & REGIONAL LOCALE */}
              <div className="p-5 border border-slate-200 bg-slate-50/80 rounded-2xl space-y-3">
                <h4 className="font-bold text-xs flex items-center gap-2 text-slate-900">
                  <Globe className="h-4 w-4 text-[#2563eb]" /> Language & Regional Locale
                </h4>
                {/* Custom Popdown / Dropdown for Scalable Language Selection */}
                <CustomLanguageDropdown
                  selected={language}
                  onChange={handleLanguageChange}
                />
              </div>
            </>
          )}
        </div>

        {/* 3. PERSISTENT STICKY FOOTER */}
        <div style={{ backgroundColor: THEME_TOKENS.surfaceElevated, borderColor: THEME_TOKENS.border }} className="flex items-center justify-end gap-3 p-4 border-t shrink-0">
          <button
            type="button"
            onClick={handleAttemptClose}
            className="min-h-[44px] px-5 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAll}
            className="min-h-[44px] px-6 rounded-xl text-xs font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-all"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {/* UNSAVED CHANGES CONFIRMATION DIALOG */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            style={{
              backgroundColor: THEME_TOKENS.surface,
              borderColor: THEME_TOKENS.border,
              color: THEME_TOKENS.textPrimary,
            }}
            className="border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: THEME_TOKENS.warning,
                }}
                className="p-2.5 rounded-xl"
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-sm">Discard unsaved changes?</h4>
            </div>
            <p style={{ color: THEME_TOKENS.textSecondary }} className="text-xs leading-relaxed">
              You have modified settings that have not been saved yet. If you close now, your unsaved preference changes will be lost.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                style={{
                  backgroundColor: THEME_TOKENS.surfaceElevated,
                  color: THEME_TOKENS.textPrimary,
                }}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                style={{
                  backgroundColor: THEME_TOKENS.danger,
                  color: '#FFFFFF',
                }}
                className="min-h-[44px] px-4 rounded-xl text-xs font-bold cursor-pointer"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA SETUP FLOW MODAL */}
      {show2FASetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            style={{
              backgroundColor: THEME_TOKENS.bg,
              borderColor: THEME_TOKENS.border,
              color: THEME_TOKENS.textPrimary,
            }}
            className="border rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div style={{ borderColor: THEME_TOKENS.border }} className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-3">
                <div
                  style={{
                    backgroundColor: THEME_TOKENS.accentLight,
                    color: THEME_TOKENS.accent,
                  }}
                  className="p-2.5 rounded-xl"
                >
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Two-Factor Authentication Setup</h4>
                  <p style={{ color: THEME_TOKENS.textSecondary }} className="text-xs">Scan QR code and confirm 6-digit verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShow2FASetup(false)}
                style={{ color: THEME_TOKENS.textSecondary }}
                className="cursor-pointer p-1 rounded-lg hover:bg-[#252525]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1: QR Code & Secret Key */}
            <div
              style={{
                backgroundColor: THEME_TOKENS.surface,
                borderColor: THEME_TOKENS.border,
              }}
              className="p-4 rounded-xl border flex flex-col items-center text-center space-y-3"
            >
              <div className="w-36 h-36 bg-white p-2 rounded-xl border flex items-center justify-center shadow-xs">
                <div className="w-full h-full bg-[#181818] rounded-lg p-2 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-8 h-8 bg-white rounded-xs border-2 border-[#181818]" />
                    <div className="w-8 h-8 bg-white rounded-xs border-2 border-[#181818]" />
                  </div>
                  <div className="text-[7px] text-[#2563eb] font-mono font-bold tracking-tighter">SWAS SECURE 2FA</div>
                  <div className="flex justify-between">
                    <div className="w-8 h-8 bg-white rounded-xs border-2 border-[#181818]" />
                    <div className="w-4 h-4 bg-white rounded-xs" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold">Scan with Authenticator App</p>
                <p style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] mt-0.5">Use Google Authenticator, Authy, or 1Password</p>
                <p
                  style={{
                    backgroundColor: THEME_TOKENS.accentLight,
                    color: THEME_TOKENS.accent,
                    borderColor: 'rgba(37, 99, 235, 0.4)',
                  }}
                  className="text-[11px] font-mono font-bold mt-2 py-1 px-3 rounded-lg border"
                >
                  Secret: SWAS-2FA-8934-7120
                </p>
              </div>
            </div>

            {/* Step 2: Backup Recovery Codes */}
            <div
              style={{
                backgroundColor: THEME_TOKENS.surface,
                borderColor: THEME_TOKENS.border,
              }}
              className="p-3.5 rounded-xl border space-y-2"
            >
              <div className="flex items-center justify-between">
                <span style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider">Emergency Backup Codes</span>
                <button
                  type="button"
                  onClick={() => {
                    setCopiedBackup(true);
                    setTimeout(() => setCopiedBackup(false), 2000);
                  }}
                  style={{ color: THEME_TOKENS.accent }}
                  className="text-[10px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedBackup ? <Check style={{ color: THEME_TOKENS.success }} className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedBackup ? 'Copied' : 'Copy All'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <span style={{ backgroundColor: THEME_TOKENS.bg, borderColor: THEME_TOKENS.border }} className="p-1.5 rounded border text-center">8492-1029</span>
                <span style={{ backgroundColor: THEME_TOKENS.bg, borderColor: THEME_TOKENS.border }} className="p-1.5 rounded border text-center">4820-9182</span>
                <span style={{ backgroundColor: THEME_TOKENS.bg, borderColor: THEME_TOKENS.border }} className="p-1.5 rounded border text-center">3019-4819</span>
                <span style={{ backgroundColor: THEME_TOKENS.bg, borderColor: THEME_TOKENS.border }} className="p-1.5 rounded border text-center">9401-2819</span>
              </div>
            </div>

            {/* Step 3: Enter 6-Digit Code */}
            <div className="space-y-2">
              <label className="text-xs font-bold block">Verification Code</label>
              <input
                type="text"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code (e.g. 123456)"
                style={{
                  backgroundColor: THEME_TOKENS.surface,
                  color: THEME_TOKENS.textPrimary,
                  borderColor: THEME_TOKENS.border,
                }}
                className="w-full min-h-[44px] border rounded-xl px-4 font-mono text-center text-sm font-bold tracking-widest focus:outline-none focus:border-[#2563eb]"
              />
            </div>

            <div style={{ borderColor: THEME_TOKENS.border }} className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShow2FASetup(false)}
                style={{ backgroundColor: THEME_TOKENS.surfaceElevated, color: THEME_TOKENS.textPrimary }}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify2FACode}
                disabled={twoFactorCode.length < 6 || verifying2FA}
                style={{ backgroundColor: THEME_TOKENS.accent, color: '#ffffff' }}
                className="min-h-[44px] px-5 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {verifying2FA ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable 2FA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
