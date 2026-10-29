import { AccountSecurityPanel } from './AccountSecurityPanel';
import { PushQuietHours } from './PushQuietHours';
import { FloatingPanel } from './FloatingPanel';
import { TextInput } from './LimitedTextField';
import { ModalLayer } from './ModalLayer';
import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { swalSuccess, swalError } from '../utils/swal';
import {
  Settings, Moon, Sun, Monitor, Bell, Globe, Search, ChevronDown,
  Loader2, Save, AlertTriangle, Check, ArrowLeft
} from 'lucide-react';
import { RecordsStatus } from './RecordsStatus';
import { ShimmerSettingsModal } from './Shimmer';
import { useAccountProfile } from '../hooks/useAccountProfile';
import { THEME_TOKENS } from '../theme/themeTokens';
import { applyThemePreference, saveThemePreference, getAccountThemePreference } from '../theme/themePreference';
import { useAuth } from '../context/AuthContext';
import { cacheRecoveryReminder, recoveryReminderPreference } from '../utils/recoveryReminder';
import { setActiveLanguage } from '../i18n/i18n';

interface UserSettingsPageProps {
  onClose: () => void;
  registerLeaveGuard: (guard: (() => Promise<boolean>) | null) => void;
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

import { getSupportedLanguages } from '../i18n/i18n';

// ─── Custom Scalable Popdown / Dropdown Menu Widget for Language ────────────────
const LANGUAGES = getSupportedLanguages().map(l => ({
  id: l.code,
  label: l.name,
  region: l.country,
  flag: l.flag
}));

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
        <FloatingPanel className="absolute left-0 right-0 top-full mt-2 z-50 p-2 border rounded-2xl shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150 max-h-64 flex flex-col bg-white border-slate-200 text-slate-800">
          {/* Search Box */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <TextInput showCounter={false}
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
        </FloatingPanel>
      )}
    </div>
  );
};

export const UserSettingsPage: React.FC<UserSettingsPageProps> = ({
  onClose,
  registerLeaveGuard
}) => {
  const { user } = useAuth();
  const { profile, loading, error, retry } = useAccountProfile();
  const [saving, setSaving] = useState(false);

  const [initialState, setInitialState] = useState<any>(null);

  const [themeMode, setThemeMode] = useState<string>('light');
  const [fontSize, setFontSize] = useState<string>('medium');
  const [language, setLanguage] = useState<string>('en');

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [inAppNotifications, setInAppNotifications] = useState(true);

  const [recoveryPromptDismissed, setRecoveryPromptDismissed] = useState(false);

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const pendingLeave = useRef<((allowed: boolean) => void) | null>(null);





  const isCurrentAccount = (userId?: number | string) => {
    if (!userId) return false;
    try {
      const activeUser = JSON.parse(sessionStorage.getItem('auth_user') || 'null');
      return String(activeUser?.user_id) === String(userId);
    } catch {
      return false;
    }
  };

  const applyLiveTheme = (mode: string) => {
    applyThemePreference(mode as 'light' | 'dark' | 'system');
  };
  const applyLiveFontSize = (size: string) => {
    const root = document.documentElement;
    root.setAttribute('data-font-size', size);
    root.style.fontSize = size === 'small' ? '14px' : size === 'large' ? '18px' : '16px';
  };
  const applyLiveLanguage = (lang: string) => {
    setActiveLanguage(lang);
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
    if (profile && active) {
      const userId = user?.user_id || profile?.user_id;
      if (!isCurrentAccount(userId) || String(profile.user_id) !== String(userId)) return;

      // Account profile theme takes priority over local cache
      const loadedTheme = profile.theme_preference || getAccountThemePreference(userId) || 'light';
      const loadedFont = profile.font_size_preference || localStorage.getItem(`font_size_preference_${userId}`) || 'medium';
      const loadedLang = profile.language_preference || localStorage.getItem(`language_preference_${userId}`) || 'en';

      const snapshot = {
        themeMode: loadedTheme,
        fontSize: loadedFont,
        language: loadedLang,
        notificationsEnabled: profile.notifications_enabled ?? true,
        emailNotifications: profile.email_notifications ?? true,
        pushNotifications: profile.push_notifications ?? true,
        inAppNotifications: profile.in_app_notifications ?? true,

        recoveryPromptDismissed: recoveryReminderPreference(userId).pending
          ? recoveryReminderPreference(userId).dismissed : profile.recovery_prompt_dismissed ?? false,
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

      setRecoveryPromptDismissed(snapshot.recoveryPromptDismissed);
    }
    });
    return () => { active = false; };
  }, [profile, user?.user_id]);

  const isDirty = initialState ? (
    initialState.themeMode !== themeMode ||
    initialState.fontSize !== fontSize ||
    initialState.language !== language ||
    initialState.notificationsEnabled !== notificationsEnabled ||
    initialState.emailNotifications !== emailNotifications ||
    initialState.pushNotifications !== pushNotifications ||
    initialState.inAppNotifications !== inAppNotifications ||

    initialState.recoveryPromptDismissed !== recoveryPromptDismissed
  ) : false;

  useEffect(() => {
    registerLeaveGuard(() => {
      if (saving) return Promise.resolve(false);
      if (!isDirty) return Promise.resolve(true);
      setShowDiscardConfirm(true);
      return new Promise<boolean>(resolve => { pendingLeave.current = resolve; });
    });
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty && !saving) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnOnUnload);
    return () => {
      registerLeaveGuard(null);
      window.removeEventListener('beforeunload', warnOnUnload);
    };
  }, [isDirty, saving, registerLeaveGuard]);

  useEffect(() => () => { pendingLeave.current?.(false); }, []);

  const handleAttemptClose = () => {
    if (!saving) onClose();
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    if (initialState) {
      applyLiveTheme(initialState.themeMode);
      applyLiveFontSize(initialState.fontSize);
      applyLiveLanguage(initialState.language);
    }
    pendingLeave.current?.(true);
    pendingLeave.current = null;
  };

  const handleKeepEditing = () => {
    setShowDiscardConfirm(false);
    pendingLeave.current?.(false);
    pendingLeave.current = null;
  };

  const handleThemeChange = (newMode: string) => {
    setThemeMode(newMode);
    applyLiveTheme(newMode);
  };

  const handleFontSizeChange = (newSize: string) => {
    setFontSize(newSize);
    applyLiveFontSize(newSize);
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    applyLiveLanguage(newLang);
  };

  const handleSaveAll = async () => {
    if (!initialState || loading || error || saving) return;
    setSaving(true);
    try {
      const userId = user?.user_id;
      await apiService.updateUserSettings({
        theme_preference: themeMode,
        font_size_preference: fontSize,
        language_preference: language,
        notifications_enabled: notificationsEnabled,
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        in_app_notifications: inAppNotifications,

        ...(user?.role === 'student' ? { recovery_prompt_dismissed: recoveryPromptDismissed } : {}),
      });

      if (!isCurrentAccount(userId)) return;
      if (user?.role === 'student' && userId) cacheRecoveryReminder(userId, recoveryPromptDismissed);
      saveThemePreference(themeMode as 'light' | 'dark' | 'system', userId);
      localStorage.setItem(`font_size_preference_${userId}`, fontSize);
      localStorage.setItem(`language_preference_${userId}`, language);

      setInitialState({
        themeMode,
        fontSize,
        language,
        notificationsEnabled,
        emailNotifications,
        pushNotifications,
        inAppNotifications,

        recoveryPromptDismissed,
      });

      await swalSuccess('Settings Saved', 'Your account preferences have been saved to your profile.');
    } catch (err: any) {
      await swalError('Save Failed', err.response?.data?.detail || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="max-w-4xl w-full mx-auto">
      {/* Modal Shell Container */}
      <div
        style={{ backgroundColor: THEME_TOKENS.bg, color: THEME_TOKENS.textPrimary, borderColor: THEME_TOKENS.border }}
        className="w-full border flex flex-col shadow-sm rounded-3xl overflow-hidden"
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
            disabled={saving}
            aria-label="Back to dashboard"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        {/* 2. SCROLLABLE BODY */}
        <div className="p-4 sm:p-6 space-y-6">
          {loading || (!initialState && !error) ? (
            <div role="status" aria-label="Loading settings" aria-busy="true"><ShimmerSettingsModal /></div>
          ) : error ? (
            <RecordsStatus loading={false} error={error} retry={retry} />
          ) : (
            <fieldset disabled={saving} className="space-y-6">
              {/* SECTION A: SECURITY & AUTHENTICATION */}
              {user?.role === 'student' && (
                <label className="flex items-start gap-3 p-4 border border-slate-200 bg-slate-50 rounded-2xl cursor-pointer">
                  <input type="checkbox" checked={recoveryPromptDismissed} onChange={event => setRecoveryPromptDismissed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#2563eb]" />
                  <span><span className="block text-xs font-bold text-slate-900">Do not show recovery setup reminders</span>
                    <span className="block mt-1 text-[11px] leading-relaxed text-slate-500">Uncheck and save to show reminders at sign-in again. Recovery email setup remains available in your profile.</span></span>
                </label>
              )}
              <AccountSecurityPanel enabled={profile?.two_factor_enabled ?? false} />
              <PushQuietHours profile={profile} />

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
            </fieldset>
          )}
        </div>

        {/* 3. PERSISTENT STICKY FOOTER */}
        <div style={{ backgroundColor: THEME_TOKENS.surfaceElevated, borderColor: THEME_TOKENS.border }} className="flex items-center justify-end gap-3 p-4 border-t sticky bottom-0">
          <button
            type="button"
            onClick={handleAttemptClose}
            disabled={saving}
            className="min-h-[44px] px-5 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            disabled={saving || loading || !!error || !initialState || !isDirty}
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
        <ModalLayer className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
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
                onClick={handleKeepEditing}
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
        </ModalLayer>
      )}


    </div>
  );
};
