import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || '';

const profiles = [
  {
    id: 'profile_1',
    title: 'Personal Profile',
    email: import.meta.env.VITE_PROFILE_1_EMAIL || 'ayemshakib2018@gmail.com',
    proxyPath: '/proxy/p1/',
    accent: 'indigo',
  },
  {
    id: 'profile_2',
    title: 'Shared',
    email: import.meta.env.VITE_PROFILE_2_EMAIL || 'theaicircle01@gmail.com',
    proxyPath: '/proxy/p2/',
    accent: 'emerald',
  },
];

const accentStyles = {
  indigo: {
    active: 'border-indigo-400 bg-indigo-500/15 shadow-indigo-950/30',
    icon: 'bg-indigo-500 text-white',
    hover: 'group-hover:border-indigo-300 group-hover:bg-indigo-500/10',
    text: 'text-indigo-200',
  },
  emerald: {
    active: 'border-emerald-400 bg-emerald-500/15 shadow-emerald-950/30',
    icon: 'bg-emerald-500 text-white',
    hover: 'group-hover:border-emerald-300 group-hover:bg-emerald-500/10',
    text: 'text-emerald-200',
  },
};

const ProfileSelection = () => {
  const [loadingProfile, setLoadingProfile] = useState(null);
  const navigationTimeoutRef = useRef(null);

  useEffect(() => {
    const resetLoadingState = () => {
      setLoadingProfile(null);
    };

    const resetWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        resetLoadingState();
      }
    };

    window.addEventListener('pageshow', resetLoadingState);
    window.addEventListener('focus', resetLoadingState);
    document.addEventListener('visibilitychange', resetWhenVisible);

    return () => {
      window.removeEventListener('pageshow', resetLoadingState);
      window.removeEventListener('focus', resetLoadingState);
      document.removeEventListener('visibilitychange', resetWhenVisible);
      window.clearTimeout(navigationTimeoutRef.current);
    };
  }, []);

  const handleProfileSelect = (profile) => {
    if (loadingProfile) {
      return;
    }

    setLoadingProfile(profile.id);
    window.clearTimeout(navigationTimeoutRef.current);

    navigationTimeoutRef.current = window.setTimeout(() => {
      window.location.assign(`${PROXY_BASE_URL}${profile.proxyPath}`);
    }, 220);
  };

  return (
    <main className="min-h-screen w-full bg-[#111827] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[480px] flex-col items-center justify-center">
        <div className="mb-8 w-full text-center">
          <div className="mx-auto mb-6 w-full max-w-[260px] rounded-lg bg-white px-6 py-4 shadow-2xl shadow-black/25">
            <img src="/novonex-logo.png" alt="NovoNex" className="h-auto w-full" />
          </div>

          <h1 className="text-[28px] font-bold leading-tight text-white sm:text-[32px]">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-300">
            Select a saved profile to continue
          </p>
        </div>

        <div className="w-full space-y-3">
          {profiles.map((profile) => {
            const isLoading = loadingProfile === profile.id;
            const isDisabled = loadingProfile !== null && !isLoading;
            const styles = accentStyles[profile.accent];

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleProfileSelect(profile)}
                disabled={loadingProfile !== null}
                aria-busy={isLoading}
                className={`group grid min-h-[92px] w-full grid-cols-[56px_minmax(0,1fr)_36px] items-center gap-4 rounded-lg border p-4 text-left shadow-lg transition duration-200 ease-out active:scale-[0.99] sm:min-h-[98px] sm:p-5
                  ${
                    isLoading
                      ? styles.active
                      : `border-white/10 bg-white/[0.055] hover:shadow-xl ${styles.hover}`
                  }
                  ${isDisabled ? 'opacity-45 grayscale' : ''}
                `}
              >
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isLoading ? styles.icon : 'bg-white/8 text-slate-200 group-hover:bg-white/12'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.2} />
                  ) : (
                    <UserRound className="h-6 w-6" strokeWidth={1.8} />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="mb-1 flex items-center gap-2">
                    <span className="truncate text-base font-semibold text-white sm:text-lg">
                      {profile.title}
                    </span>
                    {!isLoading && (
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${styles.text}`} strokeWidth={2.1} />
                    )}
                  </span>

                  <span className="flex min-w-0 items-center gap-2 text-sm text-slate-300">
                    <Mail className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.8} />
                    <span className="truncate">{profile.email}</span>
                  </span>
                </span>

                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/8 text-slate-100 transition group-hover:bg-white/12">
                  {isLoading ? (
                    <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                  ) : (
                    <ArrowRight className="h-5 w-5" strokeWidth={2} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs font-medium text-slate-400">
          <ShieldCheck className="h-4 w-4 text-slate-500" strokeWidth={1.8} />
          <span>Secure profile connection</span>
        </div>
      </section>
    </main>
  );
};

export default ProfileSelection;
