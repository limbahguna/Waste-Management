import { useEffect, useRef, useState } from 'react';
import { Camera, Cloud, Gift } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function HowItWorks() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      icon: Camera,
      titleKey: 'landing.step1Title',
      descKey: 'landing.step1Desc',
    },
    {
      icon: Cloud,
      titleKey: 'landing.step2Title',
      descKey: 'landing.step2Desc',
    },
    {
      icon: Gift,
      titleKey: 'landing.step3Title',
      descKey: 'landing.step3Desc',
    },
  ];

  return (
    <div 
      ref={sectionRef}
      className="w-full bg-emerald-50 py-12 px-6"
    >
      <div className="max-w-5xl mx-auto">
        <h2 className={`text-2xl md:text-3xl font-bold text-center text-emerald-800 mb-10 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          {t('landing.howItWorksTitle')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div 
                key={index}
                className={`bg-white rounded-2xl p-6 text-center shadow-md border border-emerald-100 relative transition-all duration-700 ${
                  isVisible 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                {/* Step number badge */}
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  {index + 1}
                </div>
                
                {/* Icon container */}
                <div className="bg-emerald-100 p-4 rounded-xl w-16 h-16 mx-auto mb-4 mt-2 flex items-center justify-center">
                  <Icon className="w-8 h-8 text-emerald-600" />
                </div>
                
                {/* Title */}
                <h3 className="font-bold text-lg text-emerald-800 mb-2">
                  {t(step.titleKey)}
                </h3>
                
                {/* Description */}
                <p className="text-emerald-700/80 text-sm leading-relaxed">
                  {t(step.descKey)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Connection lines for desktop */}
        <div className="hidden md:flex justify-center items-center mt-6 gap-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <div className="w-24 h-0.5 bg-emerald-300"></div>
            <span className="text-lg">→</span>
            <div className="w-24 h-0.5 bg-emerald-300"></div>
            <span className="text-lg">→</span>
            <div className="w-24 h-0.5 bg-emerald-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
