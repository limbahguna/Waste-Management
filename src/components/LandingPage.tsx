import { Camera, Bot, Recycle, ArrowRight, CheckCircle, Zap, Globe, Leaf, BarChart3, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans scroll-smooth">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <span className="font-bold text-lg tracking-tight text-white">Limbahguna</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <button onClick={() => scrollToSection('problem')} className="hover:text-white transition-colors">Solution</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('impact')} className="hover:text-white transition-colors">Impact</button>
          </div>
          <button
            onClick={onGetStarted}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5"
          >
            Open Web App
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-emerald-700/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] bg-teal-500/8 rounded-full blur-3xl" />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(hsl(160,60%,45%) 1px, transparent 1px), linear-gradient(90deg, hsl(160,60%,45%) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5" />
            Climate-Tech · AI · Circular Economy
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="text-white">Revolutionizing the</span>
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
              Circular Economy
            </span>
            <br />
            <span className="text-white">with AI</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
            We solve the waste sorting bottleneck. From agricultural biomass to complex e-waste,
            our Computer Vision AI identifies, grades, and connects your waste to the recycling
            industry in <span className="text-slate-200 font-medium">real-time</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onGetStarted}
              className="group bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base px-8 py-4 rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-1 flex items-center gap-2"
            >
              Open Web App
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-slate-400 hover:text-white font-medium text-base px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 hover:bg-white/5"
            >
              See How It Works
            </button>
          </div>

          {/* Social proof */}
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>95% Classification Accuracy</span>
            </div>
            <div className="w-px h-4 bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Biomass · Plastic · E-Waste</span>
            </div>
            <div className="w-px h-4 bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Real-Time CO₂ Tracking</span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={() => scrollToSection('problem')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-600 hover:text-slate-400 transition-colors animate-bounce"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </section>

      {/* ── PROBLEM & SOLUTION ── */}
      <section id="problem" className="py-24 px-6 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">The Challenge & Our Answer</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">From Problem to Profit</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Problem */}
            <div className="relative bg-slate-800/60 border border-red-500/15 rounded-2xl p-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
                  ⚠ The Problem
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 leading-tight">
                  The Sorting Bottleneck
                </h3>
                <p className="text-slate-400 text-base leading-relaxed mb-6">
                  Millions of tons of valuable materials end up in landfills every year due to slow,
                  expensive, and error-prone <span className="text-slate-200">manual sorting processes</span>.
                  Recyclable materials are lost, CO₂ emissions rise, and industries lose access to
                  critical secondary raw materials.
                </p>
                <ul className="space-y-3 text-slate-400 text-sm">
                  {['Costly and slow human-based sorting', 'High error rates reduce material value', 'No digital traceability in the supply chain'].map((item) => (
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
                  ✓ Our Solution
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 leading-tight">
                  AI-Powered Clarity
                </h3>
                <p className="text-slate-400 text-base leading-relaxed mb-6">
                  Limbahguna turns chaos into data. With <span className="text-emerald-400 font-semibold">95% accuracy</span>,
                  we digitize waste quality and ensure it returns to the industrial supply chain
                  with the highest standards — instantly and verifiably.
                </p>
                <ul className="space-y-3 text-slate-400 text-sm">
                  {['Real-time AI classification in seconds', 'Automated grading removes human bias', 'Full digital traceability and CO₂ accounting'].map((item) => (
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
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">The Process</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">Three Steps to a Circular Future</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              Our end-to-end platform handles everything from identification to verified impact — in minutes, not days.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Camera,
                emoji: '📸',
                step: '01',
                title: 'Scan',
                subtitle: 'Instant Identification',
                desc: 'Point your camera at the waste. Our Computer Vision AI recognizes the material type — from Rice Husks and Palm Shells to PCBs and lithium cells — in seconds.',
                color: 'from-sky-500/20 to-sky-600/5',
                border: 'border-sky-500/20',
                iconColor: 'text-sky-400',
                badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
              },
              {
                icon: Bot,
                emoji: '🤖',
                step: '02',
                title: 'Grade',
                subtitle: 'Automated Quality Control',
                desc: 'The system automatically locks in the quality grade and moisture level, generating a standardized data record that eliminates human bias and maximises material value.',
                color: 'from-violet-500/20 to-violet-600/5',
                border: 'border-violet-500/20',
                iconColor: 'text-violet-400',
                badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
              },
              {
                icon: Recycle,
                emoji: '♻️',
                step: '03',
                title: 'Submit & Track',
                subtitle: 'Real Impact, Verified',
                desc: 'Input the estimated weight and submit. The platform records your contribution, calculates prevented CO₂ emissions, and rewards you with points redeemable in the ecosystem.',
                color: 'from-emerald-500/20 to-emerald-600/5',
                border: 'border-emerald-500/20',
                iconColor: 'text-emerald-400',
                badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className={`relative bg-gradient-to-b ${s.color} border ${s.border} rounded-2xl p-8 hover:scale-[1.02] transition-all duration-300 group`}>
                  {/* Step number */}
                  <div className="absolute top-6 right-6 text-5xl font-black text-white/5 leading-none select-none group-hover:text-white/8 transition-colors">
                    {s.step}
                  </div>

                  <div className={`inline-flex items-center gap-2 ${s.badge} border text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-wide`}>
                    Step {i + 1}
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
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-widest">Sustainability Impact</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">Numbers That Matter</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                metric: '95%',
                label: 'Classification Accuracy',
                sub: 'Across 20+ waste material types including agricultural biomass, plastics, and e-waste.',
                color: 'text-emerald-400',
                glow: 'bg-emerald-500/5',
                border: 'border-emerald-500/15',
              },
              {
                icon: Leaf,
                metric: '2.5–5.0 kg',
                label: 'CO₂ Saved per 1 kg',
                sub: 'Of critical material recovered from landfill and returned to the industrial supply chain.',
                color: 'text-teal-400',
                glow: 'bg-teal-500/5',
                border: 'border-teal-500/15',
              },
              {
                icon: Globe,
                metric: 'Net Zero',
                label: 'Operations Target by 2030',
                sub: 'Our commitment — verified, tracked, and published annually in our sustainability report.',
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
            Join the Circular Economy
          </div>

          <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
            Ready to turn waste<br />into value?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Join our ecosystem. Whether you are a biomass producer or a material recovery facility,
            the circular future starts here.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onGetStarted}
              className="group bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base px-8 py-4 rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/30 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              Create Free Account
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onGetStarted}
              className="text-slate-300 hover:text-white font-semibold text-base px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-200 hover:bg-white/5"
            >
              Sign In to Your Account
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
          <p className="text-slate-500 text-sm">© 2026 Limbahguna. All rights reserved.</p>
          <div className="flex items-center gap-2 text-slate-600 text-xs">
            <Leaf className="w-3.5 h-3.5 text-emerald-700" />
            <span>Committed to Net Zero by 2030</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
