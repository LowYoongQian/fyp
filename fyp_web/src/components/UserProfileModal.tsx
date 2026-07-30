import React, { useState, useEffect, useRef } from 'react';
import { apiService, clearApiCache } from '../services/api';
import { swalSuccess } from '../utils/swal';
import {
  User, Mail, ShieldCheck, Lock, Camera, Clock,
  CheckCircle, Loader2, X, KeyRound, Shield, AlertTriangle, Pencil, Save,
  Eye, EyeOff, UploadCloud, Trash2
} from 'lucide-react';
import { ShimmerProfileModal } from './Shimmer';
import { THEME_TOKENS } from '../theme/themeTokens';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: string;
  initialEmail?: string;
}

const FileFormatIcon: React.FC<{ extension: string }> = ({ extension }) => {
  const ext = (extension || 'JPG').toUpperCase();
  let badgeBg = 'bg-[#7c3aed]'; // purple for JPG/JPEG
  if (ext === 'PNG') badgeBg = 'bg-[#2563eb]'; // blue
  if (ext === 'WEBP') badgeBg = 'bg-[#0284c7]'; // sky blue
  if (ext === 'GIF') badgeBg = 'bg-[#059669]'; // green
  if (ext === 'SVG') badgeBg = 'bg-[#d97706]'; // amber

  return (
    <div className="relative w-9 h-11 shrink-0 flex items-center justify-center select-none">
      <svg className="w-full h-full text-slate-300 dark:text-slate-600 drop-shadow-xs" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 4C4 1.79086 5.79086 0 8 0H22L34 12V40C34 42.2091 32.2091 44 30 44H8C5.79086 44 4 42.2091 4 40V4Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
        <path d="M22 0V12H34" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className={`absolute bottom-1.5 left-1 px-1 py-0.5 rounded-[3px] text-[7.5px] font-black text-white tracking-wider uppercase leading-none shadow-xs ${badgeBg}`}>
        {ext.slice(0, 4)}
      </span>
    </div>
  );
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  initialRole,
  initialEmail
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  // Avatar Photo Upload State with Loading & Error Feedback
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    type: string;
    formattedSize: string;
    extension: string;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (file: File) => {
    setAvatarError(null);
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (PNG, JPG, WEBP, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image file size must be less than 5MB');
      return;
    }

    const formattedSize = file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const ext = file.name.split('.').pop() || 'JPG';

    setSelectedFile({
      name: file.name,
      size: file.size,
      type: file.type,
      formattedSize,
      extension: ext,
    });

    setUploadProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 20) + 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setUploadProgress(progress);
    }, 60);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setAvatarUrl(result);
      }
    };
    reader.onerror = () => {
      setAvatarError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Only an administrator can edit the identity stored on their own account.
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityForm, setIdentityForm] = useState({ name: '', email: '', code: '' });

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      clearApiCache();
      const res = await apiService.getUserProfile();
      setProfile(res);
      setAvatarUrl(res.avatar_url || '');
      setIdentityForm({ name: res.name || '', email: res.email || '', code: res.code || '' });
    } catch {
      setProfile({
        name: 'User',
        email: initialEmail || 'user@school.edu',
        role: initialRole || 'user',
        code: 'N/A',
        status: 'Active',
        last_login_at: new Date().toISOString(),
      });
      setIdentityForm({ name: 'User', email: initialEmail || 'user@school.edu', code: 'N/A' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    if (!currentPassword) {
      setPassError('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPassError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await apiService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await swalSuccess('Password Updated', 'Your account password was updated successfully.');
    } catch (err: any) {
      setPassError(err.response?.data?.detail || 'Current password is incorrect.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Avatar Upload with Feedback Spinner & Error handling
  const handleSaveAvatar = async () => {
    setAvatarError(null);
    if (!avatarUrl.trim()) {
      setAvatarError('Please enter a valid photo URL');
      return;
    }
    setUploadingAvatar(true);
    try {
      await apiService.updateUserAvatar(avatarUrl.trim());
      setProfile((prev: any) => ({ ...prev, avatar_url: avatarUrl.trim() }));
      setIsEditingAvatar(false);
      await swalSuccess('Avatar Updated', 'Profile photo updated successfully.');
    } catch (err: any) {
      setAvatarError(err.response?.data?.detail || 'Failed to update avatar. Check image URL.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const beginIdentityEdit = () => {
    setIdentityForm({
      name: profile?.name || '',
      email: profile?.email || '',
      code: profile?.code || '',
    });
    setIdentityError(null);
    setIsEditingIdentity(true);
  };

  const handleSaveIdentity = async (event: React.FormEvent) => {
    event.preventDefault();
    setIdentityError(null);
    if (!identityForm.name.trim() || !identityForm.email.trim() || !identityForm.code.trim()) {
      setIdentityError('Name, email, and ID code are required.');
      return;
    }

    setIdentitySaving(true);
    try {
      const updated = await apiService.updateAdminProfile({
        name: identityForm.name.trim(),
        email: identityForm.email.trim(),
        code: identityForm.code.trim(),
      });
      setProfile((current: any) => ({ ...current, name: updated.name, email: updated.email, code: updated.code }));
      setIsEditingIdentity(false);
      await swalSuccess('Profile Updated', 'Your administrator profile details have been saved.');
    } catch (err: any) {
      setIdentityError(err.response?.data?.detail || 'Could not update your profile.');
    } finally {
      setIdentitySaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div
        style={{
          backgroundColor: THEME_TOKENS.bg,
          color: THEME_TOKENS.textPrimary,
          borderColor: THEME_TOKENS.border,
        }}
        className="max-w-xl w-full h-[88vh] max-h-[680px] border relative z-10 flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        
        {/* Sticky Header */}
        <div
          style={{
            borderColor: THEME_TOKENS.border,
            backgroundColor: THEME_TOKENS.bg,
          }}
          className="flex items-center justify-between p-5 border-b shrink-0"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: THEME_TOKENS.accentLight,
                color: THEME_TOKENS.accent,
              }}
              className="p-2.5 rounded-xl"
            >
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 style={{ color: THEME_TOKENS.textPrimary }} className="font-display font-bold text-base">User Profile</h3>
              <p style={{ color: THEME_TOKENS.textSecondary }} className="text-xs">Identity details and security options</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            style={{ color: THEME_TOKENS.textSecondary }}
            className="h-11 w-11 flex items-center justify-center transition-colors cursor-pointer rounded-xl hover:bg-[#252525] focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 shrink-0">
          <div
            style={{
              backgroundColor: THEME_TOKENS.surface,
              borderColor: THEME_TOKENS.border,
            }}
            className="grid grid-cols-2 gap-1 p-1 border rounded-xl text-xs font-semibold"
          >
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                backgroundColor: activeTab === 'profile' ? THEME_TOKENS.accent : 'transparent',
                color: activeTab === 'profile' ? '#ffffff' : THEME_TOKENS.textPrimary,
              }}
              className="min-h-[40px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 font-bold"
            >
              <User className="h-4 w-4" />
              <span>Identity Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              style={{
                backgroundColor: activeTab === 'security' ? THEME_TOKENS.accent : 'transparent',
                color: activeTab === 'security' ? '#ffffff' : THEME_TOKENS.textPrimary,
              }}
              className="min-h-[40px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 font-bold"
            >
              <KeyRound className="h-4 w-4" />
              <span>Security & Password</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-sans text-xs">
          {loading ? (
            <ShimmerProfileModal />
          ) : activeTab === 'profile' ? (
            <div className="space-y-4 font-sans text-xs">
              {/* Profile Card Header */}
              <div
                style={{
                  backgroundColor: THEME_TOKENS.surface,
                  borderColor: THEME_TOKENS.border,
                }}
                className="flex items-center gap-4 p-4 border rounded-2xl shadow-xs"
              >
                <div className="relative shrink-0">
                  {uploadingAvatar ? (
                    <div
                      style={{
                        backgroundColor: THEME_TOKENS.accentLight,
                        borderColor: THEME_TOKENS.accent,
                      }}
                      className="w-16 h-16 rounded-full flex items-center justify-center border-2"
                    >
                      <Loader2 style={{ color: THEME_TOKENS.accent }} className="h-6 w-6 animate-spin" />
                    </div>
                  ) : profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      style={{ borderColor: THEME_TOKENS.accent }}
                      className="w-16 h-16 rounded-full object-cover border-2 shadow-sm"
                    />
                  ) : (
                    <div
                      style={{
                        backgroundColor: THEME_TOKENS.accentLight,
                        color: THEME_TOKENS.accent,
                        borderColor: THEME_TOKENS.accent,
                      }}
                      className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-2"
                    >
                      {(profile?.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditingAvatar(true)}
                    style={{
                      backgroundColor: THEME_TOKENS.accent,
                      color: '#ffffff',
                    }}
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full shadow-md transition-colors cursor-pointer flex items-center justify-center"
                    title="Upload profile photo"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 style={{ color: THEME_TOKENS.textPrimary }} className="font-bold text-base truncate">{profile?.name || 'User'}</h4>
                    <span
                      style={{
                        backgroundColor: THEME_TOKENS.surfaceElevated,
                        color: THEME_TOKENS.textPrimary,
                      }}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    >
                      {profile?.role}
                    </span>
                  </div>
                  <p style={{ color: THEME_TOKENS.textSecondary }} className="text-xs font-mono truncate">{profile?.email}</p>
                  <p style={{ color: THEME_TOKENS.textSecondary }} className="text-xs">ID Code: <strong style={{ color: THEME_TOKENS.textPrimary }}>{profile?.code || 'N/A'}</strong></p>
                </div>

                {profile?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={beginIdentityEdit}
                    style={{
                      backgroundColor: THEME_TOKENS.accentLight,
                      color: THEME_TOKENS.accent,
                      borderColor: THEME_TOKENS.accent,
                    }}
                    className="shrink-0 min-h-[36px] px-3 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 cursor-pointer"
                    title="Edit administrator profile"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
              </div>

              {profile?.role === 'admin' && isEditingIdentity && (
                <form
                  onSubmit={handleSaveIdentity}
                  style={{ backgroundColor: THEME_TOKENS.surface, borderColor: THEME_TOKENS.border }}
                  className="p-4 border rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h5 style={{ color: THEME_TOKENS.textPrimary }} className="text-xs font-bold">Edit administrator profile</h5>
                      <p style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] mt-0.5">Only your administrator account can change these details.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsEditingIdentity(false); setIdentityError(null); }}
                      style={{ color: THEME_TOKENS.textSecondary }}
                      className="p-1 rounded-lg hover:opacity-70 cursor-pointer"
                      aria-label="Cancel identity editing"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {identityError && (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-600">{identityError}</p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span style={{ color: THEME_TOKENS.textSecondary }} className="block text-[10px] font-bold uppercase tracking-wider">Name</span>
                      <input
                        value={identityForm.name}
                        onChange={(event) => setIdentityForm((form) => ({ ...form, name: event.target.value }))}
                        style={{ backgroundColor: THEME_TOKENS.bg, color: THEME_TOKENS.textPrimary, borderColor: THEME_TOKENS.border }}
                        className="w-full min-h-[40px] rounded-lg border px-3 text-xs focus:outline-none focus:border-blue-500"
                        autoComplete="name"
                      />
                    </label>
                    <label className="space-y-1">
                      <span style={{ color: THEME_TOKENS.textSecondary }} className="block text-[10px] font-bold uppercase tracking-wider">ID code</span>
                      <input
                        value={identityForm.code}
                        onChange={(event) => setIdentityForm((form) => ({ ...form, code: event.target.value }))}
                        style={{ backgroundColor: THEME_TOKENS.bg, color: THEME_TOKENS.textPrimary, borderColor: THEME_TOKENS.border }}
                        className="w-full min-h-[40px] rounded-lg border px-3 text-xs font-mono focus:outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span style={{ color: THEME_TOKENS.textSecondary }} className="block text-[10px] font-bold uppercase tracking-wider">Email address</span>
                    <input
                      type="email"
                      value={identityForm.email}
                      onChange={(event) => setIdentityForm((form) => ({ ...form, email: event.target.value }))}
                      style={{ backgroundColor: THEME_TOKENS.bg, color: THEME_TOKENS.textPrimary, borderColor: THEME_TOKENS.border }}
                      className="w-full min-h-[40px] rounded-lg border px-3 text-xs focus:outline-none focus:border-blue-500"
                      autoComplete="email"
                    />
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setIsEditingIdentity(false); setIdentityError(null); }}
                      style={{ backgroundColor: THEME_TOKENS.surfaceElevated, color: THEME_TOKENS.textPrimary }}
                      className="min-h-[38px] px-3 rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={identitySaving}
                      style={{ backgroundColor: THEME_TOKENS.accent, color: '#ffffff' }}
                      className="min-h-[38px] px-3 rounded-lg text-[11px] font-bold disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      {identitySaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save changes
                    </button>
                  </div>
                </form>
              )}

              {/* Read-Only Identity Info Block */}
              <div className="space-y-2 pt-1">
                <span style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider block px-1">Account Verification & Status</span>
                
                <div
                  style={{
                    backgroundColor: THEME_TOKENS.surface,
                    borderColor: THEME_TOKENS.border,
                  }}
                  className="p-4 border rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Mail style={{ color: THEME_TOKENS.textSecondary }} className="h-4.5 w-4.5" />
                    <span style={{ color: THEME_TOKENS.textPrimary }} className="font-semibold text-xs">Email Verification Status</span>
                  </div>
                  <span
                    style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: THEME_TOKENS.success,
                      borderColor: 'rgba(16, 185, 129, 0.4)',
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: THEME_TOKENS.surface,
                    borderColor: THEME_TOKENS.border,
                  }}
                  className="p-4 border rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Shield style={{ color: THEME_TOKENS.textSecondary }} className="h-4.5 w-4.5" />
                    <span style={{ color: THEME_TOKENS.textPrimary }} className="font-semibold text-xs">Account Status</span>
                  </div>
                  <span
                    style={{
                      backgroundColor: profile?.status === 'Suspended' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: profile?.status === 'Suspended' ? THEME_TOKENS.danger : THEME_TOKENS.success,
                      borderColor: profile?.status === 'Suspended' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> {profile?.status || 'Active'}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: THEME_TOKENS.surface,
                    borderColor: THEME_TOKENS.border,
                  }}
                  className="p-4 border rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Clock style={{ color: THEME_TOKENS.textSecondary }} className="h-4.5 w-4.5" />
                    <span style={{ color: THEME_TOKENS.textPrimary }} className="font-semibold text-xs">Last Login Timestamp</span>
                  </div>
                  <span style={{ color: THEME_TOKENS.textPrimary }} className="font-mono text-xs font-semibold">
                    {profile?.last_login_at
                      ? (() => {
                          const str = String(profile.last_login_at);
                          const normalized = (str.endsWith('Z') || str.includes('+') || (str.includes('-') && str.length > 19))
                            ? str
                            : `${str}Z`;
                          const d = new Date(normalized);
                          return isNaN(d.getTime()) ? str : d.toLocaleString();
                        })()
                      : 'Just now'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 font-sans text-xs">
              {/* Actionable Item 1: Security Change Password Form with Blue Accent Left Border */}
              <form
                onSubmit={handleChangePassword}
                style={{
                  backgroundColor: THEME_TOKENS.surface,
                  borderColor: THEME_TOKENS.border,
                  borderLeftColor: THEME_TOKENS.accent,
                }}
                className="p-5 border-l-4 border-t border-r border-b rounded-2xl space-y-4 shadow-sm"
              >
                <h4 style={{ color: THEME_TOKENS.textPrimary }} className="font-bold text-xs flex items-center gap-2">
                  <Lock style={{ color: THEME_TOKENS.accent }} className="h-4 w-4" /> Change Security Password
                </h4>

                {passError && (
                  <div
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: THEME_TOKENS.danger,
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                    }}
                    className="p-3 text-xs rounded-xl border flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{passError}</span>
                  </div>
                )}

                <div>
                  <label style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider block mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        backgroundColor: THEME_TOKENS.bg,
                        color: THEME_TOKENS.textPrimary,
                        borderColor: THEME_TOKENS.border,
                      }}
                      className="w-full min-h-[44px] border rounded-xl pl-4 pr-11 text-xs focus:outline-none focus:border-[#2563eb]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      style={{ color: THEME_TOKENS.textSecondary }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center"
                      title={showCurrentPassword ? 'Hide password' : 'Show password'}
                      aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider block mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        style={{
                          backgroundColor: THEME_TOKENS.bg,
                          color: THEME_TOKENS.textPrimary,
                          borderColor: THEME_TOKENS.border,
                        }}
                        className="w-full min-h-[44px] border rounded-xl pl-4 pr-11 text-xs focus:outline-none focus:border-[#2563eb]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ color: THEME_TOKENS.textSecondary }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center"
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                        aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider block mb-1">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{
                          backgroundColor: THEME_TOKENS.bg,
                          color: THEME_TOKENS.textPrimary,
                          borderColor: THEME_TOKENS.border,
                        }}
                        className="w-full min-h-[44px] border rounded-xl pl-4 pr-11 text-xs focus:outline-none focus:border-[#2563eb]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ color: THEME_TOKENS.textSecondary }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  style={{
                    backgroundColor: THEME_TOKENS.accent,
                    color: '#ffffff',
                  }}
                  className="w-full min-h-[44px] rounded-xl font-bold disabled:opacity-50 text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
                >
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  <span>Update Password</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Sticky Footer Bar */}
        <div
          style={{
            borderColor: THEME_TOKENS.border,
            backgroundColor: THEME_TOKENS.bg,
          }}
          className="flex items-center justify-end gap-3 p-4 border-t shrink-0"
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: THEME_TOKENS.surface,
              color: THEME_TOKENS.textPrimary,
            }}
            className="min-h-[44px] px-6 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Avatar Modal Overlay with Drag & Drop, File Picker, & Live Image Preview */}
      {isEditingAvatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
            style={{
              backgroundColor: THEME_TOKENS.surface,
              borderColor: THEME_TOKENS.border,
              color: THEME_TOKENS.textPrimary,
            }}
            className="border rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">Update Profile Photo</h4>
                <p style={{ color: THEME_TOKENS.textSecondary }} className="text-[11px] mt-0.5">
                  Pick an image file, drag & drop, or paste a photo URL
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAvatar(false)}
                style={{ color: THEME_TOKENS.textSecondary }}
                className="p-1 rounded-lg hover:opacity-70 transition-opacity cursor-pointer"
                aria-label="Close photo picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Banner */}
            {avatarError && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: THEME_TOKENS.danger,
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                }}
                className="p-3 text-xs rounded-xl border flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{avatarError}</span>
              </div>
            )}

            {/* LIVE IMAGE PREVIEW SECTION */}
            <div className="flex flex-col items-center justify-center space-y-2 py-1">
              <span style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider">
                Live Photo Preview
              </span>
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Photo Preview"
                    style={{ borderColor: THEME_TOKENS.accent }}
                    className="w-24 h-24 rounded-full object-cover border-4 shadow-md transition-all group-hover:opacity-90"
                    onError={() => setAvatarError('Could not load image from this URL/file')}
                  />
                ) : (
                  <div
                    style={{
                      backgroundColor: THEME_TOKENS.accentLight,
                      color: THEME_TOKENS.accent,
                      borderColor: THEME_TOKENS.accent,
                    }}
                    className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl border-4 shadow-md"
                  >
                    {(profile?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      setAvatarError(null);
                    }}
                    className="absolute -top-1 -right-1 p-1.5 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors cursor-pointer"
                    title="Remove selected image"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* DRAG & DROP ZONE WITH FILE INPUT */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                borderColor: isDragging ? THEME_TOKENS.accent : THEME_TOKENS.border,
                backgroundColor: isDragging ? THEME_TOKENS.accentLight : THEME_TOKENS.bg,
              }}
              className="border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-200 hover:border-[#2563eb] group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <div className="flex flex-col items-center space-y-2">
                <div
                  style={{
                    backgroundColor: THEME_TOKENS.accentLight,
                    color: THEME_TOKENS.accent,
                  }}
                  className="p-3 rounded-xl group-hover:scale-105 transition-transform"
                >
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p style={{ color: THEME_TOKENS.textPrimary }} className="text-xs font-bold">
                    Drag & drop your photo here
                  </p>
                  <p style={{ color: THEME_TOKENS.textSecondary }} className="text-[11px] mt-0.5">
                    or <span style={{ color: THEME_TOKENS.accent }} className="font-semibold underline">Browse Files</span> from device
                  </p>
                </div>
                <span style={{ color: THEME_TOKENS.textSecondary }} className="text-[9.5px]">
                  Supports PNG, JPG, WEBP, or GIF (Max 5MB)
                </span>
              </div>
            </div>

            {/* UNTITLED UI FILE UPLOAD PROGRESS BAR CARD */}
            {selectedFile && (
              <div className="p-3.5 border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#1c1c1c] rounded-2xl space-y-2.5 shadow-xs transition-all animate-in fade-in zoom-in-95">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileFormatIcon extension={selectedFile.extension} />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{selectedFile.formattedSize}</span>
                        <span>•</span>
                        {uploadProgress < 100 ? (
                          <span className="flex items-center gap-1 text-[#7c3aed] font-medium">
                            <UploadCloud className="h-3 w-3 animate-pulse" /> Uploading...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle className="h-3 w-3" /> Complete
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setAvatarUrl('');
                      setUploadProgress(0);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-[#282828] transition-colors cursor-pointer shrink-0"
                    title="Remove file"
                    aria-label="Remove file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Progress Bar Track */}
                <div className="flex items-center gap-3 pt-0.5">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-[#282828] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7c3aed] transition-all duration-200 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                    {uploadProgress}%
                  </span>
                </div>
              </div>
            )}

            {/* MODAL FOOTER BUTTONS */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#333333]">
              <button
                type="button"
                onClick={() => setIsEditingAvatar(false)}
                style={{
                  backgroundColor: THEME_TOKENS.surfaceElevated,
                  color: THEME_TOKENS.textPrimary,
                }}
                className="min-h-[44px] px-5 rounded-xl text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAvatar}
                disabled={uploadingAvatar}
                style={{
                  backgroundColor: THEME_TOKENS.accent,
                  color: '#ffffff',
                }}
                className="min-h-[44px] px-6 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-md hover:opacity-90 transition-all"
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
