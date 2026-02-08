import { useState, useEffect } from 'react';
import { User, Phone, MapPin, LogOut, Edit2, BadgeCheck, Headphones, Lock, Shield, Save, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    address: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (profile) {
      setEditForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address: profile.address || ''
      });
    }
  }, [profile]);

  const handleLogout = async () => {
    if (confirm(t('profile.logoutConfirm'))) {
      await signOut();
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      if (profile) {
        setEditForm({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          address: profile.address || ''
        });
      }
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) {
      showMessage('error', t('profile.profileUpdateFailed'));
      return;
    }

    if (!editForm.full_name.trim()) {
      showMessage('error', t('profile.nameRequired'));
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      showMessage('success', t('profile.profileUpdated'));
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showMessage('error', t('profile.profileUpdateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showMessage('error', t('profile.allFieldsRequired'));
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showMessage('error', t('profile.passwordMinLength'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', t('profile.passwordNotMatch'));
      return;
    }

    if (!profile?.email) {
      showMessage('error', 'Email tidak ditemukan');
      return;
    }

    setIsSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordForm.oldPassword
      });

      if (signInError) {
        showMessage('error', t('profile.oldPasswordWrong'));
        setIsSaving(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) throw updateError;

      setShowPasswordModal(false);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      showMessage('success', t('profile.passwordSuccess'));
    } catch (error: any) {
      console.error('Error changing password:', error);
      showMessage('error', t('profile.passwordError'));
    } finally {
      setIsSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
    : '';

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {message && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg ${
          message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white font-semibold`}>
          {message.text}
        </div>
      )}

      <div className="bg-gradient-to-b from-green-600 to-green-800 px-6 py-8 rounded-b-3xl shadow-md text-white flex justify-between items-center">
        <div className="text-left">
          <h1 className="text-2xl font-bold">
            {profile.full_name || user?.email || 'User'}
          </h1>
          <p className="text-green-100 text-sm opacity-90 mt-1">
            {t('profile.memberSince')} {memberSince}
          </p>
        </div>

        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold border-2 border-white/30">
            {profile.full_name ? (
              <span>{getInitials(profile.full_name)}</span>
            ) : (
              <User className="w-8 h-8" />
            )}
          </div>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4">
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">{t('profile.contactInfo')}</h2>
            {!isEditing ? (
              <button
                onClick={handleEditToggle}
                className="flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold text-sm"
              >
                <Edit2 className="w-4 h-4" />
                {t('profile.editProfile')}
              </button>
            ) : (
              <button
                onClick={handleEditToggle}
                className="flex items-center gap-1 text-gray-600 hover:text-gray-700 font-semibold text-sm"
              >
                <X className="w-4 h-4" />
                {t('profile.cancel')}
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-700">
                <BadgeCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{t('profile.accountType')}</p>
                  <span className="text-sm font-semibold">
                    {profile.role === 'producer' ? t('profile.roleProducer') : t('profile.rolePublic')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <Phone className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{t('profile.phone')}</p>
                  <span className="text-sm">{profile.phone || t('profile.emptyPhone')}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{t('profile.address')}</p>
                  <span className="text-sm">{profile.address || t('profile.emptyAddress')}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.fullName')}
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none"
                  placeholder={t('profile.enterFullName')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.phoneNumber')}
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none"
                  placeholder={t('profile.phoneExample')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.fullAddress')}
                </label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none resize-none"
                  placeholder={t('profile.enterFullAddress')}
                  rows={3}
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  t('profile.saving')
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {t('profile.saveChanges')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            {t('profile.securityTitle')}
          </h2>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-700">{t('profile.changePassword')}</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100">
          <button
            onClick={() => {
              window.open('https://wa.me/6287871812860?text=Halo%20Tim%20LimbahGuna%2C%20saya%20membutuhkan%20bantuan%20terkait%20aplikasi.', '_blank');
            }}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Headphones className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-700">{t('profile.contactUs')}</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-500">{t('profile.logout')}</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">{t('profile.changePassword')}</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.oldPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none"
                  placeholder={t('profile.oldPassword')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.newPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none"
                  placeholder={t('profile.passwordMinLength')}
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('profile.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-400 focus:outline-none"
                  placeholder={t('profile.confirmPassword')}
                  minLength={6}
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={isSaving}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  t('profile.processing')
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    {t('profile.savePassword')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
