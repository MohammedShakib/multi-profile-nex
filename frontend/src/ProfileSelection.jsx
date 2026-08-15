import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';

const PROXY_BASE_URL = import.meta.env.VITE_PROXY_BASE_URL || '';
const PROFILE_STORAGE_KEY = 'novonex_profiles';

const defaultProfiles = [
  {
    id: 'profile_1',
    title: 'Personal Profile',
    label: 'Personal',
    email: import.meta.env.VITE_PROFILE_1_EMAIL || 'nayemshakib2018@gmail.com',
    basePath: '/proxy/p1',
    proxyPath: '/proxy/p1/dashboard/',
    accent: 'indigo',
    color: '#6366f1',
    description: 'Personal learning space',
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
    description: 'Shared workspace',
  },
];

const customAccents = ['sky', 'rose', 'amber'];

const accentStyles = {
  amber: {
    avatar: 'bg-amber-500 text-white shadow-amber-500/25',
    border: 'hover:border-amber-300/55',
    dot: 'bg-amber-300',
    focus: 'focus-visible:outline-amber-300',
    glow: 'group-hover:shadow-amber-500/10',
    text: 'text-amber-200',
  },
  emerald: {
    avatar: 'bg-emerald-500 text-white shadow-emerald-500/25',
    border: 'hover:border-emerald-300/55',
    dot: 'bg-emerald-300',
    focus: 'focus-visible:outline-emerald-300',
    glow: 'group-hover:shadow-emerald-500/10',
    text: 'text-emerald-200',
  },
  indigo: {
    avatar: 'bg-indigo-500 text-white shadow-indigo-500/25',
    border: 'hover:border-indigo-300/55',
    dot: 'bg-indigo-300',
    focus: 'focus-visible:outline-indigo-300',
    glow: 'group-hover:shadow-indigo-500/10',
    text: 'text-indigo-200',
  },
  rose: {
    avatar: 'bg-rose-500 text-white shadow-rose-500/25',
    border: 'hover:border-rose-300/55',
    dot: 'bg-rose-300',
    focus: 'focus-visible:outline-rose-300',
    glow: 'group-hover:shadow-rose-500/10',
    text: 'text-rose-200',
  },
  sky: {
    avatar: 'bg-sky-500 text-white shadow-sky-500/25',
    border: 'hover:border-sky-300/55',
    dot: 'bg-sky-300',
    focus: 'focus-visible:outline-sky-300',
    glow: 'group-hover:shadow-sky-500/10',
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

function getInitials(profile) {
  if (profile.id === 'profile_1') {
    return 'AR';
  }

  const source = profile.label || profile.title || profile.email || 'P';
  const words = source
    .replace(/profile/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
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
    }, 180);
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
      description: 'Isolated learning profile',
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
    <main className="relative min-h-[100svh] w-full overflow-hidden bg-[#080d17] px-3 py-4 text-white sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(46,93,167,0.24),transparent_38%),linear-gradient(180deg,rgba(18,26,42,0.92)_0%,rgba(8,13,23,1)_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-2rem)] w-full max-w-[560px] flex-col items-center justify-center sm:min-h-[calc(100svh-4rem)]">
        <div className="w-full rounded-[22px] border border-white/[0.08] bg-[#141c2b]/80 px-4 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:rounded-[24px] sm:px-8 sm:py-9">
          <div className="text-center">
            <div className="mx-auto mb-6 flex justify-center drop-shadow-[0_18px_34px_rgba(244,63,94,0.18)] sm:mb-7">
              <img src="/novonex-logo.png" alt="NovoNex" className="h-auto w-[185px] max-w-full sm:w-[220px]" />
            </div>

            <h1 className="text-[28px] font-semibold leading-tight text-white sm:text-[32px]">
              Welcome back
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-300">
              Choose a profile to continue
            </p>
          </div>

          <div className="mt-7 space-y-3 sm:mt-8">
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
                  className={`group grid min-h-[82px] w-full grid-cols-[44px_minmax(0,1fr)_22px] items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.045] px-3.5 py-3.5 text-left shadow-lg shadow-black/10 outline-none transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.07] hover:shadow-2xl active:translate-y-0 active:scale-[0.99] sm:min-h-[88px] sm:grid-cols-[52px_minmax(0,1fr)_28px] sm:gap-4 sm:px-5 sm:py-4 ${styles.border} ${styles.glow} ${styles.focus} ${isDisabled ? 'opacity-45 grayscale' : ''}`}
                >
                  <span
                    className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold shadow-lg transition sm:h-13 sm:w-13 ${
                      isLoading ? 'bg-slate-700 text-white' : styles.avatar
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.2} />
                    ) : (
                      getInitials(profile)
                    )}
                    {!isLoading && (
                      <span
                        className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#141c2b] ${styles.dot}`}
                      />
                    )}
                  </span>

                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-white sm:text-lg">
                        {profile.title}
                      </span>
                    </span>

                    <span className="mt-1 block truncate text-[13px] font-medium text-slate-300 sm:text-sm">
                      {profile.email}
                    </span>
                    <span className={`mt-1.5 block text-[11px] font-semibold sm:mt-2 sm:text-xs ${styles.text}`}>
                      {profile.description || `${profile.label} profile`}
                    </span>
                  </span>

                  <span className="flex justify-end text-slate-300 transition duration-200 group-hover:translate-x-1 group-hover:text-white">
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.1} />
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="mx-auto mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.045] px-5 text-sm font-semibold text-slate-200 outline-none transition hover:border-white/20 hover:bg-white/[0.075] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:w-auto"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Add profile
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
            <ShieldCheck className="h-4 w-4 text-slate-500" strokeWidth={1.8} />
            <span>Secure profile isolation</span>
          </div>
        </div>
      </section>

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm sm:items-center sm:px-4 sm:pb-0">
          <form
            onSubmit={handleAddProfile}
            className="w-full max-w-[430px] rounded-[22px] border border-white/[0.09] bg-[#141c2b] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-6"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Add profile</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Create another isolated login session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-200 transition hover:bg-white/[0.1]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">Profile name</span>
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Tanvir"
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.055] px-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300"
              />
            </label>

            <label className="mb-6 block">
              <span className="mb-2 block text-sm font-semibold text-slate-300">Email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="tanvir@email.com"
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-white/[0.055] px-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-sky-300"
              />
            </label>

            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-sky-500 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400"
            >
              Add and open dashboard
            </button>
          </form>
        </div>
      )}
    </main>
  );
};

export default ProfileSelection;
