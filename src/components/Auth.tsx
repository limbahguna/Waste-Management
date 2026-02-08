import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, Factory, Home, Check, LogIn, UserPlus, Globe } from 'lucide-react';
import { Logo } from './Logo';

type ViewState = 'role-selection' | 'register-form' | 'login';

interface AuthProps {
  onBack?: () => void;
}

export default function Auth({ onBack }: AuthProps) {
  const { signIn, signUp } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [view, setView] = useState<ViewState>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'producer' | 'public' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelection = (role: 'producer' | 'public') => {
    setSelectedRole(role);
    setView('register-form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (view === 'register-form') {
        if (!fullName.trim()) {
          setError(language === 'id' ? 'Nama lengkap harus diisi' : 'Full name is required');
          setLoading(false);
          return;
        }
        if (!selectedRole) {
          setError(language === 'id' ? 'Pilih peran Anda terlebih dahulu' : 'Select your role first');
          setLoading(false);
          return;
        }
        await signUp(email, password, fullName, selectedRole);
        alert(t('auth.regSuccess'));
        setView('login');
        setEmail('');
        setPassword('');
        setFullName('');
        setSelectedRole(null);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || (language === 'id' ? 'Terjadi kesalahan' : 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  if (view === 'role-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#006837] to-[#004d28] text-white px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                setView('login');
              }
            }}
            className="flex items-center gap-2 text-white hover:text-green-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">{t('auth.back')}</span>
          </button>
          <button
            onClick={toggleLanguage}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors font-semibold text-sm flex items-center gap-2 border border-white/30"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'id' ? 'ID' : 'EN'}</span>
            <span className="text-white/60">|</span>
            <span className="text-white/80">{language === 'id' ? 'EN' : 'ID'}</span>
          </button>
        </div>

        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Logo className="w-36 h-36" />
          </div>
          <h1 className="text-3xl font-bold mb-3">{t('auth.roleTitle')}</h1>
          <p className="text-white/80 text-sm max-w-md mx-auto">
            {t('auth.roleSubtitle')}
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-4 mb-8">
          <button
            onClick={() => handleRoleSelection('producer')}
            className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/15 hover:border-white/30 transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="bg-green-600/40 p-4 rounded-xl flex-shrink-0">
                <Factory className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{t('auth.producerTitle')}</h3>
                <p className="text-white/80 text-sm mb-4">
                  {t('auth.producerDesc')}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-200" />
                    <span className="text-white/80">{t('auth.producerFeature1')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-200" />
                    <span className="text-white/80">{t('auth.producerFeature2')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-200" />
                    <span className="text-white/80">{t('auth.producerFeature3')}</span>
                  </div>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleRoleSelection('public')}
            className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:bg-white/15 hover:border-white/30 transition-all text-left"
          >
            <div className="flex items-start gap-4">
              <div className="bg-green-600/40 p-4 rounded-xl flex-shrink-0">
                <Home className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{t('auth.publicTitle')}</h3>
                <p className="text-white/80 text-sm mb-4">
                  {t('auth.publicDesc')}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-200" />
                    <span className="text-white/80">{t('auth.publicFeature1')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-200" />
                    <span className="text-white/80">{t('auth.publicFeature2')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-200" />
                    <span className="text-white/80">{t('auth.publicFeature3')}</span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="text-center">
          <p className="text-white/80">
            {t('auth.haveAccount')}{' '}
            <button
              onClick={() => setView('login')}
              className="font-bold text-white underline hover:text-green-100"
            >
              {t('auth.linkLogin')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (view === 'register-form') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#006837] to-[#004d28] flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setView('role-selection')}
              className="flex items-center gap-2 text-white hover:text-green-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">{t('auth.back')}</span>
            </button>
            <button
              onClick={toggleLanguage}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors font-semibold text-sm flex items-center gap-2 border border-white/30"
            >
              <Globe className="w-4 h-4" />
              <span>{language === 'id' ? 'ID' : 'EN'}</span>
              <span className="text-white/60">|</span>
              <span className="text-white/80">{language === 'id' ? 'EN' : 'ID'}</span>
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <Logo className="w-36 h-36" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {selectedRole === 'producer' ? t('auth.producerTitle') : t('auth.publicTitle')}
              </h2>
              <p className="text-white/80 text-sm">{t('auth.registerTitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  {t('auth.labelName')}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-green-900/50 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-green-900/60 focus:border-white/40 focus:outline-none"
                  placeholder={t('auth.placeholderName')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  {t('auth.labelEmail')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-green-900/50 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-green-900/60 focus:border-white/40 focus:outline-none"
                  placeholder={t('auth.placeholderEmail')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  {t('auth.labelPassword')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-green-900/50 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-green-900/60 focus:border-white/40 focus:outline-none"
                  placeholder={t('auth.placeholderPassword')}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-300/50 rounded-xl p-3">
                  <p className="text-white text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white text-green-700 font-bold py-3 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  t('auth.btnProcessing')
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    {t('auth.btnRegister')}
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-white/80 text-sm">
                {t('auth.haveAccount')}{' '}
                <button
                  onClick={() => setView('login')}
                  className="font-bold text-white underline hover:text-green-100"
                >
                  {t('auth.linkLogin')}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#006837] to-[#004d28] flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-green-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">{t('auth.back')}</span>
            </button>
          )}
          {!onBack && <div></div>}
          <button
            onClick={toggleLanguage}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors font-semibold text-sm flex items-center gap-2 border border-white/30"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'id' ? 'ID' : 'EN'}</span>
            <span className="text-white/60">|</span>
            <span className="text-white/80">{language === 'id' ? 'EN' : 'ID'}</span>
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Logo className="w-36 h-36" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t('auth.welcomeTitle')}</h1>
            <p className="text-white/80">{t('auth.welcomeSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                {t('auth.labelEmail')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-green-900/50 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-green-900/60 focus:border-white/40 focus:outline-none"
                placeholder={t('auth.placeholderEmail')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                {t('auth.labelPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-green-900/50 border border-white/20 rounded-xl text-white placeholder-white/50 focus:bg-green-900/60 focus:border-white/40 focus:outline-none"
                placeholder={t('auth.placeholderPassword')}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-300/50 rounded-xl p-3">
                <p className="text-white text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-green-700 font-bold py-3 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                t('auth.btnProcessing')
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {t('auth.btnLogin')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/80 text-sm">
              {t('auth.noAccount')}{' '}
              <button
                onClick={() => setView('role-selection')}
                className="font-bold text-white underline hover:text-green-100"
              >
                {t('auth.linkRegister')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
