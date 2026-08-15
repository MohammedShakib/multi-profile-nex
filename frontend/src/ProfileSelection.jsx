import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Plus,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || '';
const PROFILE_STORAGE_KEY = 'novonex_profiles';

const defaultProfiles = [
  {
    id: 'profile_1',
    title: 'Personal Profile',
    label: 'Personal',
    email: import.meta.env.VITE_PROFILE_1_EMAIL || 'ayemshakib2018@gmail.com',
    basePath: '/proxy/p1',
    proxyPath: '/proxy/p1/dashboard/',
    accent: 'indigo',
    color: '#6366f1',
  },
  {
    id: 'profile_2',
    title: 'Shared',
    label: 'Shared',
    email: import.meta.env.VITE_PROFILE_2_EMAIL || 'theaicircle01@gmail.com',
    basePath: '/proxy/p2',
    proxyPath: '/proxy/p2/dashboard/',
    accent: 'emerald',
    color: '#10b981',
  },
];

const customAccents = ['sky', 'rose', 'amber'];

const accentStyles = {
  amber: {
    active: 'border-amber-400 bg-amber-500/15 shadow-amber-950/30',
    icon: 'bg-amber-500 text-white',
    hover: 'hover:border-amber-300 hover:bg-amber-500/10',
    text: 'text-amber-200',
  },
  emerald: {
    active: 'border-emerald-400 bg-emerald-500/15 shadow-emerald-950/30',
    icon: 'bg-emerald-500 text-white',
    hover: 'hover:border-emerald-300 hover:bg-emerald-500/10',
    text: 'text-emerald-200',
  },
  indigo: {
    active: 'border-indigo-400 bg-indigo-500/15 shadow-indigo-950/30',
    icon: 'bg-indigo-500 text-white',
    hover: 'hover:border-indigo-300 hover:bg-indigo-500/10',
    text: 'text-indigo-200',
  },
  rose: {
    active: 'border-rose-400 bg-rose-500/15 shadow-rose-950/30',
    icon: 'bg-rose-500 text-white',
    hover: 'hover:border-rose-300 hover:bg-rose-500/10',
    text: 'text-rose-200',
  },
  sky: {
    active: 'border-sky-400 bg-sky-500/15 shadow-sky-950/30',
    icon: 'bg-sky-500 text-white',
    hover: 'hover:border-sky-300 hover:bg-sky-500/10',
    text: 'text-sky-200',
  },
};

function readStoredProfiles() {
  try {
    return JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStoredProfiles(profiles) {
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function getNextProxyNumber(profiles) {
  return profiles.reduce((max, profile) => {
    const match = profile.basePath?.match(/\/proxy\/p(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 2) + 1;
}

const ProfileSelection = () => {
  const [storedProfiles, setStoredProfiles] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const navigationTimeoutRef = useRef(null);

  const profiles = useMemo(() => [...defaultProfiles, ...storedProfiles], [storedProfiles]);

  useEffect(() => {
    setStoredProfiles(readStoredProfiles());

    if (new URLSearchParams(window.location.search).get('addProfile') === '1') {
      setIsAddOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

  const handleAddProfile = (event) => {
    event.preventDefault();

    const title = newTitle.trim();
    const email = newEmail.trim();

    if (!title || !email) {
      return;
    }

    const proxyNumber = getNextProxyNumber(profiles);
    const basePath = `/proxy/p${proxyNumber}`;
    const accent = customAccents[(proxyNumber - 3) % customAccents.length];
    const profile = {
      id: `profile_${proxyNumber}`,
      title,
      label: title.replace(/ Profile$/, ''),
      email,
      basePath,
      proxyPath: `${basePath}/dashboard/`,
      accent,
      color: accent === 'sky' ? '#0ea5e9' : accent === 'rose' ? '#f43f5e' : '#f59e0b',
    };
    const nextStoredProfiles = [...storedProfiles, profile];

    saveStoredProfiles(nextStoredProfiles);
    setStoredProfiles(nextStoredProfiles);
    setIsAddOpen(false);
    setNewTitle('');
    setNewEmail('');
    handleProfileSelect(profile);
  };

  return (
    <main className="min-h-screen w-full bg-[#111827] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col items-center justify-center">
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
            const styles = accentStyles[profile.accent] || accentStyles.indigo;

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleProfileSelect(profile)}
                disabled={loadingProfile !== null}
                aria-busy={isLoading}
                className={`grid min-h-[92px] w-full grid-cols-[56px_minmax(0,1fr)_36px] items-center gap-4 rounded-lg border p-4 text-left shadow-lg transition duration-200 ease-out active:scale-[0.99] sm:min-h-[98px] sm:p-5
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
                    isLoading ? styles.icon : 'bg-white/8 text-slate-200'
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

                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/8 text-slate-100 transition">
                  {isLoading ? (
                    <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                  ) : (
                    <ArrowRight className="h-5 w-5" strokeWidth={2} />
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="grid min-h-[78px] w-full grid-cols-[56px_minmax(0,1fr)] items-center gap-4 rounded-lg border border-dashed border-white/15 bg-white/[0.035] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/8 text-slate-200">
              <Plus className="h-6 w-6" strokeWidth={2} />
            </span>
            <span>
              <span className="block text-base font-semibold text-white">Add Profile</span>
              <span className="mt-1 block text-sm text-slate-400">Create another isolated login</span>
            </span>
          </button>
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs font-medium text-slate-400">
          <ShieldCheck className="h-4 w-4 text-slate-500" strokeWidth={1.8} />
          <span>Secure profile connection</span>
        </div>
      </section>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form
            onSubmit={handleAddProfile}
            className="w-full max-w-[420px] rounded-lg border border-white/10 bg-[#111827] p-5 shadow-2xl shadow-black/40"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Add Profile</h2>
                <p className="mt-1 text-sm text-slate-400">A new proxy session will be created.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/8 text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Profile name</span>
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Tanvir"
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-sky-400"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="tanvir@email.com"
                className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-sky-400"
              />
            </label>

            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center rounded-lg bg-sky-500 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Add and Open Dashboard
            </button>
          </form>
        </div>
      )}
    </main>
  );
};

export default ProfileSelection;
