import React, { useState, useEffect } from 'react';
import { apiService, clearApiCache } from '../services/api';
import { swalSuccess, swalError } from '../utils/swal';
import {
  User, Mail, ShieldCheck, Lock, Camera, Clock,
  CheckCircle, Loader2, X, KeyRound, Smartphone, Shield, AlertTriangle, Pencil, Save,
  Eye, EyeOff
} from 'lucide-react';
import { ShimmerProfileModal } from './Shimmer';
import { THEME_TOKENS } from '../theme/themeTokens';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: string;
  initialEmail?: string;
}

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

  // Only an administrator can edit the identity stored on their own account.
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityForm, setIdentityForm] = useState({ name: '', email: '', code: '' });

  // Active Sessions state
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      loadSessions();
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

  const loadSessions = async () => {
    try {
      const list = await apiService.getUserActiveSessions();
      setSessions(list);
    } catch (e) {
      console.error('Failed to load active sessions', e);
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

  const handleLogoutSession = async (sessId: string) => {
    try {
      await apiService.logoutSession(sessId);
      setSessions(prev => prev.filter(s => s.id !== sessId));
      await swalSuccess('Session Ended', 'Device session logged out.');
    } catch {
      await swalError('Failed', 'Could not terminate session.');
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
                    {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString() : 'Just now'}
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

              {/* Actionable Item 2: Active Device Sessions */}
              <div
                style={{
                  backgroundColor: THEME_TOKENS.surface,
                  borderColor: THEME_TOKENS.border,
                }}
                className="p-5 border rounded-2xl space-y-3"
              >
                <h4 style={{ color: THEME_TOKENS.textPrimary }} className="font-bold text-xs flex items-center gap-2">
                  <Smartphone style={{ color: THEME_TOKENS.accent }} className="h-4 w-4" /> Active Device Sessions
                </h4>

                <div className="space-y-2 pt-1">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      style={{
                        backgroundColor: THEME_TOKENS.bg,
                        borderColor: THEME_TOKENS.border,
                      }}
                      className="p-3 rounded-xl border flex items-center justify-between"
                    >
                      <div>
                        <p style={{ color: THEME_TOKENS.textPrimary }} className="font-semibold text-xs">{sess.device_name}</p>
                        <p style={{ color: THEME_TOKENS.textSecondary }} className="text-[10px] font-mono">Platform: {sess.platform}</p>
                      </div>
                      {sess.is_current ? (
                        <span
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: THEME_TOKENS.success,
                            borderColor: 'rgba(16, 185, 129, 0.4)',
                          }}
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                        >
                          Current Device
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLogoutSession(sess.id)}
                          style={{ color: THEME_TOKENS.danger }}
                          className="min-h-[36px] px-3 rounded-lg text-[11px] font-bold transition-colors cursor-pointer hover:bg-[#252525]"
                        >
                          Log out
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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

      {/* Edit Avatar Modal Overlay with Uploading Spinner & Error State */}
      {isEditingAvatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            style={{
              backgroundColor: THEME_TOKENS.surface,
              borderColor: THEME_TOKENS.border,
              color: THEME_TOKENS.textPrimary,
            }}
            className="border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <h4 className="font-bold text-sm">Upload Profile Photo URL</h4>
            
            {avatarError && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: THEME_TOKENS.danger,
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                }}
                className="p-2.5 text-xs rounded-xl border"
              >
                {avatarError}
              </div>
            )}

            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              style={{
                backgroundColor: THEME_TOKENS.bg,
                color: THEME_TOKENS.textPrimary,
                borderColor: THEME_TOKENS.border,
              }}
              className="w-full min-h-[44px] border rounded-xl px-4 text-xs focus:outline-none focus:border-[#2563eb]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingAvatar(false)}
                style={{
                  backgroundColor: THEME_TOKENS.surfaceElevated,
                  color: THEME_TOKENS.textPrimary,
                }}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
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
                className="min-h-[44px] px-5 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
