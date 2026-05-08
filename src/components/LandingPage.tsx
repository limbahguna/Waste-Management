import { Camera, Bot, Recycle, ArrowRight, CheckCircle, Zap, Globe, Leaf, BarChart3, ChevronDown, Languages, PlayCircle, Eye, AlertTriangle, Cpu, Scale, MapPin, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { useLanguage } from '../contexts/LanguageContext';

interface LandingPageProps {
  onGetStarted: () => void;
}

const landingTranslations = {
  en: {
    navSolution: 'Solution',
    navHowItWorks: 'How It Works',
    navImpact: 'Impact',
    openWebApp: 'Open Web App',
    badge: 'Climate-Tech · AI · Circular Economy',
    heroTitle1: 'Building the Digital Infrastructure for',
    heroTitle2: 'Sustainable Waste Management',
    heroTitle3: '',
    heroDesc: 'Limbahguna empowers recycling ecosystems with AI-driven intelligence. We eliminate supply chain contamination and maximize circular value for industrial partners.',
    heroDescHighlight: '',
    seeHowItWorks: 'Watch AI Demo',
    requestPilot: 'Request Pilot Program',
    proofAccuracy: '95% Classification Accuracy',
    proofTypes: 'Biomass · Plastic · E-Waste',
    proofTracking: 'Real-Time CO₂ Tracking',
    visionLabel: 'Inside the Vision Engine',
    visionTitle: 'Decentralized Quality Grading',
    visionDesc: 'Our Computer Vision AI provides instant grading, moisture detection, and sorting decisions directly in the hands of our partners.',
    challengeLabel: 'The Challenge & Our Answer',
    challengeTitle: 'From Problem to Profit',
    problemBadge: '⚠ The Problem',
    problemTitle: 'The Sorting Bottleneck',
    problemDesc: 'Millions of tons of valuable materials end up in landfills every year due to slow, expensive, and error-prone',
    problemDescHighlight: 'manual sorting processes',
    problemDescEnd: '. Recyclable materials are lost, CO₂ emissions rise, and industries lose access to critical secondary raw materials.',
    problemItem1: 'Costly and slow human-based sorting',
    problemItem2: 'High error rates reduce material value',
    problemItem3: 'No digital traceability in the supply chain',
    solutionBadge: '✓ Our Solution',
    solutionTitle: 'AI-Powered Clarity',
    solutionDesc1: 'Limbahguna turns chaos into data. With',
    solutionDescHighlight: '95% accuracy',
    solutionDesc2: ', we digitize waste quality and ensure it returns to the industrial supply chain with the highest standards — instantly and verifiably.',
    solutionItem1: 'Real-time AI classification in seconds',
    solutionItem2: 'Automated grading removes human bias',
    solutionItem3: 'Full digital traceability and CO₂ accounting',
    processLabel: 'The Process',
    processTitle: 'Three Steps to a Circular Future',
    processDesc: 'Our end-to-end platform handles everything from identification to verified impact — in minutes, not days.',
    step: 'Step',
    scanTitle: 'Scan',
    scanSubtitle: 'Instant Identification',
    scanDesc: 'Point your camera at the waste. Our Computer Vision AI recognizes the material type — from Rice Husks and Palm Shells to PCBs and lithium cells — in seconds.',
    gradeTitle: 'Grade',
    gradeSubtitle: 'Automated Quality Control',
    gradeDesc: 'The system automatically locks in the quality grade and moisture level, generating a standardized data record that eliminates human bias and maximises material value.',
    submitTitle: 'Submit & Track',
    submitSubtitle: 'Real Impact, Verified',
    submitDesc: 'Input the estimated weight and submit. The platform records your contribution, calculates prevented CO₂ emissions, and rewards you with points redeemable in the ecosystem.',
    impactLabel: 'Sustainability Impact',
    impactTitle: 'Numbers That Matter',
    metric1: '95%',
    metric1Label: 'Classification Accuracy',
    metric1Sub: 'Across 20+ waste material types including agricultural biomass, plastics, and e-waste.',
    metric2: '2.5–5.0 kg',
    metric2Label: 'CO₂ Saved per 1 kg',
    metric2Sub: 'Of critical material recovered from landfill and returned to the industrial supply chain.',
    metric3: 'Net Zero',
    metric3Label: 'Operations Target by 2030',
    metric3Sub: 'Our commitment — verified, tracked, and published annually in our sustainability report.',
    ctaBadge: 'Join the Circular Economy',
    ctaTitle1: 'Ready to turn waste',
    ctaTitle2: 'into value?',
    ctaDesc: 'Join our ecosystem. Whether you are a biomass producer or a material recovery facility, the circular future starts here.',
    createAccount: 'Create Free Account',
    signIn: 'Sign In to Your Account',
    footerCopyright: '© 2026 Limbahguna. All rights reserved.',
    footerNetZero: 'Committed to Net Zero by 2030',
  },
  id: {
    navSolution: 'Solusi',
    navHowItWorks: 'Cara Kerja',
    navImpact: 'Dampak',
    openWebApp: 'Buka Aplikasi',
    badge: 'Teknologi Iklim · AI · Ekonomi Sirkular',
    heroTitle1: 'Membangun Infrastruktur Digital untuk',
    heroTitle2: 'Pengelolaan Limbah Berkelanjutan',
    heroTitle3: '',
    heroDesc: 'Limbahguna memberdayakan ekosistem daur ulang dengan kecerdasan berbasis AI. Kami menghilangkan kontaminasi rantai pasok dan memaksimalkan nilai sirkular bagi mitra industri.',
    heroDescHighlight: '',
    seeHowItWorks: 'Tonton Demo AI',
    requestPilot: 'Ajukan Program Pilot',
    proofAccuracy: 'Akurasi Klasifikasi 95%',
    proofTypes: 'Biomassa · Plastik · E-Waste',
    proofTracking: 'Pelacakan CO₂ Real-Time',
    visionLabel: 'Di Dalam Mesin Visi',
    visionTitle: 'Penilaian Kualitas Terdesentralisasi',
    visionDesc: 'AI Computer Vision kami memberikan penilaian instan, deteksi kelembapan, dan keputusan pemilahan langsung di tangan mitra kami.',
    challengeLabel: 'Tantangan & Jawaban Kami',
    challengeTitle: 'Dari Masalah ke Keuntungan',
    problemBadge: '⚠ Masalah',
    problemTitle: 'Hambatan Pemilahan',
    problemDesc: 'Jutaan ton material berharga berakhir di tempat pembuangan akhir setiap tahun karena proses',
    problemDescHighlight: 'pemilahan manual',
    problemDescEnd: ' yang lambat, mahal, dan rentan kesalahan. Material daur ulang hilang, emisi CO₂ meningkat, dan industri kehilangan akses ke bahan baku sekunder penting.',
    problemItem1: 'Pemilahan manual yang mahal dan lambat',
    problemItem2: 'Tingkat kesalahan tinggi menurunkan nilai material',
    problemItem3: 'Tidak ada ketertelusuran digital dalam rantai pasok',
    solutionBadge: '✓ Solusi Kami',
    solutionTitle: 'Kejelasan Berbasis AI',
    solutionDesc1: 'Limbahguna mengubah kekacauan menjadi data. Dengan',
    solutionDescHighlight: 'akurasi 95%',
    solutionDesc2: ', kami mendigitalisasi kualitas limbah dan memastikan kembali ke rantai pasok industri dengan standar tertinggi — secara instan dan terverifikasi.',
    solutionItem1: 'Klasifikasi AI real-time dalam hitungan detik',
    solutionItem2: 'Penilaian otomatis menghilangkan bias manusia',
    solutionItem3: 'Ketertelusuran digital penuh dan akuntansi CO₂',
    processLabel: 'Prosesnya',
    processTitle: 'Tiga Langkah Menuju Masa Depan Sirkular',
    processDesc: 'Platform end-to-end kami menangani segalanya dari identifikasi hingga dampak terverifikasi — dalam hitungan menit, bukan hari.',
    step: 'Langkah',
    scanTitle: 'Pindai',
    scanSubtitle: 'Identifikasi Instan',
    scanDesc: 'Arahkan kamera ke limbah. AI Computer Vision kami mengenali jenis material — dari Sekam Padi dan Cangkang Sawit hingga PCB dan sel litium — dalam hitungan detik.',
    gradeTitle: 'Nilai',
    gradeSubtitle: 'Kontrol Kualitas Otomatis',
    gradeDesc: 'Sistem secara otomatis mengunci grade kualitas dan kadar air, menghasilkan catatan data standar yang menghilangkan bias manusia dan memaksimalkan nilai material.',
    submitTitle: 'Kirim & Lacak',
    submitSubtitle: 'Dampak Nyata, Terverifikasi',
    submitDesc: 'Masukkan estimasi berat dan kirim. Platform mencatat kontribusi Anda, menghitung emisi CO₂ yang dicegah, dan memberi Anda poin yang dapat ditukarkan dalam ekosistem.',
    impactLabel: 'Dampak Keberlanjutan',
    impactTitle: 'Angka yang Berarti',
    metric1: '95%',
    metric1Label: 'Akurasi Klasifikasi',
    metric1Sub: 'Di lebih dari 20+ jenis material limbah termasuk biomassa pertanian, plastik, dan e-waste.',
    metric2: '2,5–5,0 kg',
    metric2Label: 'CO₂ Terselamatkan per 1 kg',
    metric2Sub: 'Material kritis yang dipulihkan dari TPA dan dikembalikan ke rantai pasok industri.',
    metric3: 'Net Zero',
    metric3Label: 'Target Operasi 2030',
    metric3Sub: 'Komitmen kami — diverifikasi, dilacak, dan dipublikasikan setiap tahun dalam laporan keberlanjutan.',
    ctaBadge: 'Bergabung dengan Ekonomi Sirkular',
    ctaTitle1: 'Siap mengubah limbah',
    ctaTitle2: 'menjadi nilai?',
    ctaDesc: 'Bergabunglah dengan ekosistem kami. Baik Anda produsen biomassa atau fasilitas pemulihan material, masa depan sirkular dimulai di sini.',
    createAccount: 'Buat Akun Gratis',
    signIn: 'Masuk ke Akun Anda',
    footerCopyright: '© 2026 Limbahguna. Hak cipta dilindungi.',
    footerNetZero: 'Berkomitmen pada Net Zero 2030',
  },
};

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { language, toggleLanguage } = useLanguage();
  const lt = landingTranslations[language];

  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hero background slider
  const heroSlides = [
    '/eco-partner-with-app.jpg',
    '/warehouse-2.jpg',
    '/warehouse-3.jpeg',
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setActiveSlide((i) => (i + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans scroll-smooth">
      <style>{`
        @keyframes lg-float-y { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-22px); } }
        @keyframes lg-float-y-rev { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(22px); } }
        .lg-float { animation: lg-float-y 14s ease-in-out infinite; }
        .lg-float-rev { animation: lg-float-y-rev 16s ease-in-out infinite; }
        .lg-emerald-glow { box-shadow: 0 0 40px -8px rgba(16,185,129,0.45), 0 0 80px -20px rgba(16,185,129,0.25); }
        .lg-emerald-glow-xl {
          box-shadow:
            0 0 0 2px rgba(16,185,129,0.55),
            0 0 60px -4px rgba(16,185,129,0.65),
            0 0 140px -20px rgba(16,185,129,0.55),
            0 0 220px -40px rgba(16,185,129,0.35);
        }
        @keyframes lg-hero-zoom { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }
        .lg-hero-zoom { animation: lg-hero-zoom 12s ease-out forwards; transform-origin: center; }
        .lg-hero-text-shadow { text-shadow: 0 2px 20px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.6); }
        .lg-hero-slide { transition: opacity 1.4s ease-in-out; }
      `}</style>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <span className="font-bold text-lg tracking-tight text-white">Limbahguna</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <button onClick={() => scrollToSection('problem')} className="hover:text-white transition-colors">{lt.navSolution}</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">{lt.navHowItWorks}</button>
            <button onClick={() => scrollToSection('impact')} className="hover:text-white transition-colors">{lt.navImpact}</button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm px-3 py-2 rounded-lg transition-colors text-sm font-semibold text-slate-300 hover:text-white"
              aria-label="Toggle language"
            >
              <Languages className="w-4 h-4" />
              {language === 'en' ? 'EN' : 'ID'}
            </button>
            <button
              onClick={onGetStarted}
              className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
            >
              {lt.openWebApp}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 overflow-hidden">
        {/* Full-width background slider */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-slate-950">
          {heroSlides.map((src, i) => (
            <div
              key={src}
              className="lg-hero-slide absolute inset-0"
              style={{ opacity: i === activeSlide ? 1 : 0 }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center lg-hero-zoom"
                style={{
                  backgroundImage: `url('${src}')`,
                  filter: 'brightness(0.65)',
                  transform: `scale(1.05) translateY(${scrollY * 0.15}px)`,
                }}
              />
            </div>
          ))}
          {/* Soft bottom gradient for text legibility & section blend */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(2,6,23,0.35) 0%, rgba(2,6,23,0.15) 40%, rgba(2,6,23,0.85) 100%)',
            }}
          />
          {/* Very subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(160,60%,45%) 1px, transparent 1px), linear-gradient(90deg, hsl(160,60%,45%) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center lg-hero-text-shadow">
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" />
            {lt.badge}
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="text-white">{lt.heroTitle1}</span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              {lt.heroTitle2}
            </span>
            <br />
            <span className="text-white">{lt.heroTitle3}</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-200/90 max-w-2xl mx-auto leading-relaxed mb-10">
            {lt.heroDesc} <span className="text-white font-medium">{lt.heroDescHighlight}</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="group bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base px-8 py-4 rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-1 flex items-center gap-2"
            >
              <PlayCircle className="w-5 h-5" />
              {lt.seeHowItWorks}
            </button>
            <button
              onClick={onGetStarted}
              className="group text-white font-semibold text-base px-8 py-4 rounded-xl border-2 border-emerald-400/60 hover:border-emerald-400 hover:bg-emerald-500/10 transition-all duration-200 backdrop-blur-sm flex items-center gap-2"
            >
              {lt.requestPilot}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-200/80">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{lt.proofAccuracy}</span>
            </div>
            <div className="w-px h-4 bg-white/30 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{lt.proofTypes}</span>
            </div>
            <div className="w-px h-4 bg-white/30 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{lt.proofTracking}</span>
            </div>
          </div>
        </div>

        {/* Slider navigation dots */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`transition-all duration-300 rounded-full ${
                i === activeSlide
                  ? 'w-8 h-2 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => scrollToSection('problem')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 hover:text-white transition-colors animate-bounce z-20"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </section>

      {/* ── INSIDE THE VISION ENGINE ── */}
      <section className="relative py-24 px-6 bg-slate-950 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(hsl(160,60%,45%) 1px, transparent 1px), linear-gradient(90deg, hsl(160,60%,45%) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="relative max-w-7xl mx-auto grid md:grid-cols-5 gap-12 items-center">
          {/* Visual stack — 60% (3/5) */}
          <div className="relative h-[640px] md:col-span-3">
            <div className="absolute top-0 left-0 w-[82%] aspect-[4/3] rounded-2xl overflow-hidden lg-emerald-glow-xl border-2 border-emerald-500/60 lg-float">
              <img
                src="/ai-scan-analysis.jpg"
                alt="AI scan analysis"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 w-[78%] aspect-[4/3] rounded-2xl overflow-hidden lg-emerald-glow-xl border-2 border-emerald-500/70 lg-float-rev">
              <img
                src="/ai-scan-result.jpg"
                alt="AI scan result"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Content — 40% (2/5) */}
          <div className="md:col-span-2">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">{lt.visionLabel}</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-6 leading-tight">
              {lt.visionTitle}
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              {lt.visionDesc}
            </p>
          </div>
        </div>
      </section>

      {/* ── PROBLEM & SOLUTION ── */}
      <section id="problem" className="py-24 px-6 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">{lt.challengeLabel}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">{lt.challengeTitle}</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Problem */}
            <div className="relative bg-slate-800/60 border border-red-500/15 rounded-2xl p-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
                  {lt.problemBadge}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 leading-tight">{lt.problemTitle}</h3>
                <p className="text-slate-400 text-base leading-relaxed mb-6">
                  {lt.problemDesc} <span className="text-slate-200">{lt.problemDescHighlight}</span>{lt.problemDescEnd}
                </p>
                <ul className="space-y-3 text-slate-400 text-sm">
                  {[lt.problemItem1, lt.problemItem2, lt.problemItem3].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Solution */}
            <div className="relative bg-slate-800/60 border border-emerald-500/20 rounded-2xl p-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/8 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
                  {lt.solutionBadge}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 leading-tight">{lt.solutionTitle}</h3>
                <p className="text-slate-400 text-base leading-relaxed mb-6">
                  {lt.solutionDesc1} <span className="text-emerald-400 font-semibold">{lt.solutionDescHighlight}</span>{lt.solutionDesc2}
                </p>
                <ul className="space-y-3 text-slate-400 text-sm">
                  {[lt.solutionItem1, lt.solutionItem2, lt.solutionItem3].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">{lt.processLabel}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">{lt.processTitle}</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">{lt.processDesc}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Camera,
                emoji: '📸',
                step: '01',
                title: lt.scanTitle,
                subtitle: lt.scanSubtitle,
                desc: lt.scanDesc,
                color: 'from-sky-500/20 to-sky-600/5',
                border: 'border-sky-500/20',
                iconColor: 'text-sky-400',
                badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
              },
              {
                icon: Bot,
                emoji: '🤖',
                step: '02',
                title: lt.gradeTitle,
                subtitle: lt.gradeSubtitle,
                desc: lt.gradeDesc,
                color: 'from-violet-500/20 to-violet-600/5',
                border: 'border-violet-500/20',
                iconColor: 'text-violet-400',
                badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
              },
              {
                icon: Recycle,
                emoji: '♻️',
                step: '03',
                title: lt.submitTitle,
                subtitle: lt.submitSubtitle,
                desc: lt.submitDesc,
                color: 'from-emerald-500/20 to-emerald-600/5',
                border: 'border-emerald-500/20',
                iconColor: 'text-emerald-400',
                badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className={`relative bg-gradient-to-b ${s.color} border ${s.border} rounded-2xl p-8 hover:scale-[1.02] transition-all duration-300 group`}>
                  <div className="absolute top-6 right-6 text-5xl font-black text-white/5 leading-none select-none group-hover:text-white/8 transition-colors">
                    {s.step}
                  </div>
                  <div className={`inline-flex items-center gap-2 ${s.badge} border text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide`}>
                    {lt.step} {i + 1}
                  </div>
                  <div className="bg-white/5 w-14 h-14 rounded-xl flex items-center justify-center mb-6">
                    <Icon className={`w-7 h-7 ${s.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{s.emoji} {s.title}</h3>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${s.iconColor} mb-3`}>{s.subtitle}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── IMPACT METRICS ── */}
      <section id="impact" className="py-24 px-6 bg-gradient-to-b from-emerald-950/40 to-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">{lt.impactLabel}</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">{lt.impactTitle}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                metric: lt.metric1,
                label: lt.metric1Label,
                sub: lt.metric1Sub,
                color: 'text-emerald-400',
                glow: 'bg-emerald-500/5',
                border: 'border-emerald-500/15',
              },
              {
                icon: Leaf,
                metric: lt.metric2,
                label: lt.metric2Label,
                sub: lt.metric2Sub,
                color: 'text-teal-400',
                glow: 'bg-teal-500/5',
                border: 'border-teal-500/15',
              },
              {
                icon: Globe,
                metric: lt.metric3,
                label: lt.metric3Label,
                sub: lt.metric3Sub,
                color: 'text-sky-400',
                glow: 'bg-sky-500/5',
                border: 'border-sky-500/15',
              },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className={`${m.glow} border ${m.border} rounded-2xl p-8 text-center hover:scale-[1.02] transition-all duration-300`}>
                  <div className="flex justify-center mb-4">
                    <div className="bg-white/5 w-12 h-12 rounded-xl flex items-center justify-center">
                      <Icon className={`w-6 h-6 ${m.color}`} />
                    </div>
                  </div>
                  <div className={`text-4xl md:text-5xl font-black ${m.color} mb-2 leading-none`}>{m.metric}</div>
                  <div className="text-white font-semibold text-base mb-3">{m.label}</div>
                  <p className="text-slate-500 text-sm leading-relaxed">{m.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-24 px-6 bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-4 py-1.5 rounded-full mb-8 uppercase tracking-wide">
            <Recycle className="w-3.5 h-3.5" />
            {lt.ctaBadge}
          </div>

          <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
            {lt.ctaTitle1}<br />{lt.ctaTitle2}
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">{lt.ctaDesc}</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onGetStarted}
              className="group bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base px-8 py-4 rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              {lt.createAccount}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onGetStarted}
              className="text-slate-300 hover:text-white font-semibold text-base px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 hover:bg-white/5"
            >
              {lt.signIn}
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
            <span className="font-bold text-white">Limbahguna</span>
          </div>
          <p className="text-slate-500 text-sm">{lt.footerCopyright}</p>
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            <span>{lt.footerNetZero}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
