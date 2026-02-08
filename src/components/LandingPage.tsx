import { Leaf, TrendingUp, Wind, Shield } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Logo } from './Logo';
import HowItWorks from './HowItWorks';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#006837] to-[#004d28] text-white flex flex-col">
      <header className="flex justify-end items-center p-6">
        <button
          onClick={toggleLanguage}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors font-semibold text-sm flex items-center gap-2 border border-white/30"
        >
          <span>{language === 'id' ? 'ID' : 'EN'}</span>
          <span className="text-white/60">|</span>
          <span className="text-white/80">{language === 'id' ? 'EN' : 'ID'}</span>
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center text-center mb-12 gap-0">
          <Logo className="w-72 h-72 mb-0" />
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-white -mt-6">
            {t('landing.heroTitle')}
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl text-center font-normal mt-2">
            {t('landing.heroSubtitle')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="w-full max-w-5xl mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex items-start gap-5 hover:bg-white/15 transition-all">
              <div className="bg-green-600/40 p-4 rounded-xl flex-shrink-0">
                <Leaf className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-2">{t('landing.feature1Title')}</h3>
                <p className="text-white/80 text-base">
                  {t('landing.feature1Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex items-start gap-5 hover:bg-white/15 transition-all">
              <div className="bg-green-600/40 p-4 rounded-xl flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-2">{t('landing.feature2Title')}</h3>
                <p className="text-white/80 text-base">
                  {t('landing.feature2Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex items-start gap-5 hover:bg-white/15 transition-all">
              <div className="bg-green-600/40 p-4 rounded-xl flex-shrink-0">
                <Wind className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-2">{t('landing.feature3Title')}</h3>
                <p className="text-white/80 text-base">
                  {t('landing.feature3Desc')}
                </p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 flex items-start gap-5 hover:bg-white/15 transition-all">
              <div className="bg-green-600/40 p-4 rounded-xl flex-shrink-0">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-2">{t('landing.feature4Title')}</h3>
                <p className="text-white/80 text-base">
                  {t('landing.feature4Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onGetStarted}
          className="bg-white text-green-700 font-bold text-lg py-4 px-12 rounded-full shadow-2xl hover:bg-green-50 hover:scale-105 transition-all duration-300 mb-12"
        >
          {t('landing.btnCta')}
        </button>
      </div>

      {/* How It Works Section - Below CTA */}
      <HowItWorks />

      <footer className="text-center py-6 text-white/80 bg-gradient-to-b from-[#004d28] to-[#003d20]">
        <p className="text-sm">{t('landing.footerText')}</p>
        <p className="text-sm">{t('landing.footerBy')}</p>
      </footer>
    </div>
  );
}
