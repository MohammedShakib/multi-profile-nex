import express from 'express';
import cors from 'cors';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProxyMiddleware,
  responseInterceptor,
} from 'http-proxy-middleware';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'frontend', 'dist');

const PORT = Number(process.env.PORT || 3001);
const TARGET_ORIGIN = 'https://nexcourses.com';
const TARGET_URL = `${TARGET_ORIGIN}/`;
const upstreamAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 60000,
});
const cacheableAssetExtensions = new Set([
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.png',
  '.svg',
  '.ttf',
  '.webp',
  '.woff',
  '.woff2',
]);
const defaultProfiles = [
  {
    basePath: '/proxy/p1',
    label: 'Personal',
    email: 'nayemshakib2018@gmail.com',
    initial: 'P',
    color: '#6366f1',
  },
  {
    basePath: '/proxy/p2',
    label: 'Shared',
    email: 'theaicircle01@gmail.com',
    initial: 'S',
    color: '#10b981',
  },
];
const profileProxyRouters = new Map();

// Configure the frontend origins that are allowed to call this backend.
// Example: CORS_ORIGINS="http://localhost:5173,https://app.example.com"
const allowedOrigins = (process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,https://multi-profile-nex.onrender.com')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Allow same-origin requests, mobile browser navigation, health checks,
      // and configured React frontend origins.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  }),
);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    target: TARGET_URL,
    profiles: defaultProfiles.map((profile) => profile.basePath),
  });
});

function rewriteSetCookieHeader(proxyRes, profileBasePath) {
  const setCookie = proxyRes.headers['set-cookie'];

  if (!setCookie) {
    return;
  }

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

  proxyRes.headers['set-cookie'] = cookies.map((cookie) =>
    rewriteCookieForProfile(cookie, profileBasePath),
  );
}

function rewriteCookieForProfile(cookie, profileBasePath) {
  const parts = cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  let hasPath = false;

  const rewrittenParts = parts.reduce((acc, part, index) => {
    if (index === 0) {
      acc.push(part);
      return acc;
    }

    const [rawName] = part.split('=');
    const attributeName = rawName.trim().toLowerCase();

    if (attributeName === 'path') {
      hasPath = true;
      acc.push(`Path=${profileBasePath}`);
      return acc;
    }

    // A Domain attribute for nexcourses.com would be rejected by browsers when
    // this proxy runs on your own backend host. Removing it creates a host-only
    // cookie for the proxy domain.
    if (attributeName === 'domain') {
      return acc;
    }

    acc.push(part);
    return acc;
  }, []);

  if (!hasPath) {
    rewrittenParts.push(`Path=${profileBasePath}`);
  }

  return rewrittenParts.join('; ');
}

function rewriteLocationHeader(proxyRes, profileBasePath) {
  const location = proxyRes.headers.location;

  if (!location) {
    return;
  }

  if (location.startsWith('//proxy/')) {
    proxyRes.headers.location = location.slice(1);
    return;
  }

  if (location.startsWith('https://proxy/') || location.startsWith('http://proxy/')) {
    proxyRes.headers.location = location.replace(/^https?:\/\/proxy/i, '');
    return;
  }

  if (location.startsWith('proxy/')) {
    proxyRes.headers.location = `/${location}`;
    return;
  }

  if (location.startsWith('./proxy/')) {
    proxyRes.headers.location = `/${location.slice(2)}`;
    return;
  }

  if (location.startsWith(TARGET_ORIGIN)) {
    proxyRes.headers.location = location.replace(TARGET_ORIGIN, profileBasePath);
    return;
  }

  if (location.startsWith('/') && !location.startsWith(profileBasePath)) {
    proxyRes.headers.location = `${profileBasePath}${location}`;
  }
}

function isCacheableAssetRequest(req) {
  return cacheableAssetExtensions.has(path.extname(req.path || '').toLowerCase());
}

function prepareProxyResponse(proxyRes, req, profileBasePath) {
  rewriteSetCookieHeader(proxyRes, profileBasePath);
  rewriteLocationHeader(proxyRes, profileBasePath);

  if (isCacheableAssetRequest(req) && !proxyRes.headers['set-cookie']) {
    proxyRes.headers['cache-control'] =
      'private, max-age=86400, stale-while-revalidate=604800';
  }
}

function createProfileSwitcher(profileBasePath) {
  const profileId = profileBasePath.split('/').pop() || 'p1';
  const currentProfile = defaultProfiles.find((profile) => profile.basePath === profileBasePath) || {
    basePath: profileBasePath,
    label: `Profile ${profileId.replace(/^p/, '')}`,
    email: 'Custom profile',
    initial: profileId.slice(0, 1).toUpperCase(),
    color: '#64748b',
  };
  const profileRows = defaultProfiles
    .map((profile) => {
      const isActive = profile.basePath === profileBasePath;

      return `<button type="button" class="profile-switcher-option" data-profile-base="${profile.basePath}" style="display:flex;width:100%;align-items:center;gap:10px;border:0;border-radius:12px;background:${isActive ? 'rgba(255,255,255,.1)' : 'transparent'};color:#fff;cursor:pointer;padding:9px 10px;text-align:left;">
        <span style="display:inline-flex;height:28px;min-width:28px;align-items:center;justify-content:center;border-radius:10px;background:${profile.color};box-shadow:0 8px 18px ${profile.color}55;font-size:12px;font-weight:800;">${profile.initial}</span>
        <span style="display:flex;min-width:0;flex:1;flex-direction:column;gap:4px;">
          <span style="font-size:13px;font-weight:800;line-height:1;color:#fff;">${profile.label}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;line-height:1;color:#cbd5e1;">${profile.email}</span>
        </span>
        <span style="width:18px;text-align:center;color:${isActive ? '#e2e8f0' : 'transparent'};font-size:13px;font-weight:900;">✓</span>
      </button>`;
    })
    .join('');

  return `<style id="profile-switcher-styles">
    #profile-switcher-root.profile-switcher-dock { position:fixed;right:18px;bottom:18px;z-index:2147483647;display:flex;align-items:center;gap:8px;max-width:min(92vw,360px);min-height:58px;border:1px solid rgba(148,163,184,.3);background:linear-gradient(135deg,rgba(15,23,42,.9),rgba(30,41,59,.86));border-radius:20px;box-shadow:0 18px 48px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08);padding:8px;font-family:Inter,Arial,Helvetica,sans-serif;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px); }
    #profile-switcher-root.profile-switcher-dock.profile-dock-positioned { right:auto;bottom:auto; }
    #profile-switcher-root #profile-switcher-button { touch-action:none; }
    @media (max-width:640px) {
      #profile-switcher-root.profile-switcher-dock { width:58px; height:58px;min-width:58px;max-width:58px;min-height:58px;padding:4px;border-radius:20px; }
      #profile-switcher-root #profile-switcher-button { width:48px !important;height:48px !important;min-width:48px !important;max-width:48px !important;min-height:48px !important;padding:3px !important;justify-content:center;border-radius:16px; }
      #profile-switcher-root #profile-switcher-button .profile-switcher-avatar { width:42px !important;height:42px !important;min-width:42px !important;border-radius:14px;font-size:14px; }
      #profile-switcher-root #profile-switcher-button .profile-switcher-details { display:none !important; }
      #profile-switcher-root #profile-switcher-menu { position:fixed !important;right:auto !important;bottom:auto !important;width:min(86vw,292px); }
    }
  </style>
  <div id="profile-switcher-root" class="profile-switcher-dock">
  <div id="profile-switcher-menu" style="position:absolute;right:0;bottom:72px;display:none;width:min(86vw,292px);border:1px solid rgba(148,163,184,.32);background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(30,41,59,.96));border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);padding:8px;color:#fff;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);">
    <button type="button" id="profile-home-button" title="Home" style="display:flex;width:100%;align-items:center;gap:10px;border:0;border-radius:12px;background:rgba(255,255,255,.07);color:#e2e8f0;cursor:pointer;padding:9px 10px;text-align:left;font-size:12px;font-weight:800;">
      <span style="display:inline-flex;height:28px;min-width:28px;align-items:center;justify-content:center;border-radius:10px;background:rgba(148,163,184,.16);font-size:14px;">⌂</span>
      <span>Home</span>
    </button>
    <div style="height:1px;margin:8px 4px;background:rgba(148,163,184,.24);"></div>
    <div style="padding:6px 9px 8px;color:#94a3b8;font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;">Switch profile</div>
    <div id="profile-switcher-options" style="display:flex;flex-direction:column;gap:3px;">${profileRows}</div>
    <div style="height:1px;margin:8px 4px;background:rgba(148,163,184,.24);"></div>
    <button type="button" id="profile-add-button" title="Add profile" style="display:flex;width:100%;align-items:center;gap:10px;border:0;border-radius:12px;background:transparent;color:#cbd5e1;cursor:pointer;padding:9px 10px;text-align:left;font-size:12px;font-weight:800;">
      <span style="display:inline-flex;height:28px;min-width:28px;align-items:center;justify-content:center;border-radius:10px;background:rgba(148,163,184,.16);font-size:16px;">+</span>
      <span>Add profile</span>
    </button>
  </div>
  <button type="button" id="profile-switcher-button" title="Open profile switcher" aria-label="Open profile switcher" style="display:flex;align-items:center;gap:10px;min-width:0;max-width:280px;min-height:42px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.075);color:#fff;border-radius:14px;padding:7px 10px 7px 8px;cursor:pointer;font-size:12px;font-weight:700;line-height:1;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);">
    <span class="profile-switcher-avatar" style="display:inline-flex;height:32px;min-width:32px;align-items:center;justify-content:center;border-radius:12px;background:${currentProfile.color};box-shadow:0 10px 22px ${currentProfile.color}55;font-size:13px;font-weight:800;">${currentProfile.initial}</span>
    <span class="profile-switcher-details" style="display:flex;min-width:0;flex:1;flex-direction:column;gap:4px;text-align:left;">
      <span style="display:flex;align-items:center;gap:6px;font-size:13px;color:#fff;white-space:nowrap;">
        <span>${currentProfile.label}</span>
        <span style="color:#94a3b8;font-size:10px;">⌄</span>
      </span>
      <span style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;color:#cbd5e1;">${currentProfile.email}</span>
    </span>
  </button>
  <script>
    (function () {
      var defaultProfiles = ${JSON.stringify(defaultProfiles)};
      var currentBase = '${profileBasePath}';
      var button = document.getElementById('profile-switcher-button');
      var root = document.getElementById('profile-switcher-root');
      var homeButton = document.getElementById('profile-home-button');
      var menu = document.getElementById('profile-switcher-menu');
      var addButton = document.getElementById('profile-add-button');
      var dockPositionKey = 'novonex_profile_dock_position';
      var suppressClick = false;

      function isMobileDock() {
        return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
      }

      function clampDockPosition(left, top) {
        if (!root) return { left: left, top: top };
        var margin = 8;
        var maxLeft = Math.max(margin, window.innerWidth - root.offsetWidth - margin);
        var maxTop = Math.max(margin, window.innerHeight - root.offsetHeight - margin);
        return {
          left: Math.min(Math.max(left, margin), maxLeft),
          top: Math.min(Math.max(top, margin), maxTop),
        };
      }

      function applyDockPosition(position) {
        if (!root || !isMobileDock() || !position) return;
        var clamped = clampDockPosition(Number(position.left), Number(position.top));
        if (!Number.isFinite(clamped.left) || !Number.isFinite(clamped.top)) return;
        root.classList.add('profile-dock-positioned');
        root.style.left = clamped.left + 'px';
        root.style.top = clamped.top + 'px';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
      }

      function loadDockPosition() {
        if (!isMobileDock()) return;
        try {
          var stored = JSON.parse(window.localStorage.getItem(dockPositionKey) || 'null');
          applyDockPosition(stored);
        } catch (error) {}
      }

      function saveDockPosition() {
        if (!root || !isMobileDock()) return;
        var rect = root.getBoundingClientRect();
        try {
          window.localStorage.setItem(dockPositionKey, JSON.stringify({ left: rect.left, top: rect.top }));
        } catch (error) {}
      }

      function positionMobileMenu() {
        if (!root || !menu || !isMobileDock() || menu.style.display === 'none') return;
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        var rootRect = root.getBoundingClientRect();
        var menuRect = menu.getBoundingClientRect();
        var margin = 8;
        var left = Math.min(Math.max(rootRect.left, margin), window.innerWidth - menuRect.width - margin);
        var top = rootRect.top - menuRect.height - 10;
        if (top < margin) top = rootRect.bottom + 10;
        if (top + menuRect.height > window.innerHeight - margin) {
          top = Math.max(margin, window.innerHeight - menuRect.height - margin);
        }
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        menu.style.visibility = 'visible';
      }

      function toggleMenu() {
        if (!menu) return;
        var isOpen = menu.style.display !== 'none' && menu.style.display !== '';
        if (isOpen) {
          menu.style.display = 'none';
          menu.style.visibility = '';
          return;
        }
        menu.style.display = 'block';
        if (isMobileDock()) positionMobileMenu();
      }

      function setupMobileDrag() {
        if (!root || !button) return;
        var drag = null;
        button.addEventListener('pointerdown', function (event) {
          if (!isMobileDock() || event.button === 2) return;
          var rect = root.getBoundingClientRect();
          drag = {
            startX: event.clientX,
            startY: event.clientY,
            originLeft: rect.left,
            originTop: rect.top,
            moved: false,
          };
          button.setPointerCapture(event.pointerId);
        });
        button.addEventListener('pointermove', function (event) {
          if (!drag || !isMobileDock()) return;
          var deltaX = event.clientX - drag.startX;
          var deltaY = event.clientY - drag.startY;
          if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;
          drag.moved = true;
          var position = clampDockPosition(drag.originLeft + deltaX, drag.originTop + deltaY);
          root.classList.add('profile-dock-positioned');
          root.style.left = position.left + 'px';
          root.style.top = position.top + 'px';
          root.style.right = 'auto';
          root.style.bottom = 'auto';
          if (menu && menu.style.display !== 'none') positionMobileMenu();
          event.preventDefault();
        });
        function finishDrag() {
          if (!drag) return;
          suppressClick = drag.moved;
          if (drag.moved) saveDockPosition();
          drag = null;
        }
        button.addEventListener('pointerup', finishDrag);
        button.addEventListener('pointercancel', finishDrag);
      }
      function getStoredProfiles() {
        try {
          return JSON.parse(window.localStorage.getItem('novonex_profiles') || '[]');
        } catch (error) {
          return [];
        }
      }
      function normalizeProfile(profile) {
        var basePath = profile.basePath || (profile.proxyPath ? profile.proxyPath.replace(/\\/dashboard\\/$|\\/$/, '') : '');
        if (!basePath || basePath.indexOf('/proxy/') !== 0) return null;
        var label = profile.label || profile.title || 'Profile';
        return {
          basePath: basePath,
          label: label.replace(/ Profile$/, ''),
          email: profile.email || 'Custom profile',
          initial: profile.initial || label.slice(0, 1).toUpperCase(),
          color: profile.color || '#64748b'
        };
      }
      function getProfiles() {
        var merged = defaultProfiles.concat(getStoredProfiles().map(normalizeProfile).filter(Boolean));
        return merged.filter(function (profile, index, list) {
          return list.findIndex(function (item) { return item.basePath === profile.basePath; }) === index;
        });
      }
      function renderProfiles() {
        var list = document.getElementById('profile-switcher-options');
        if (!list) return;
        list.innerHTML = getProfiles().map(function (profile) {
          var active = profile.basePath === currentBase;
          return '<button type="button" class="profile-switcher-option" data-profile-base="' + profile.basePath + '" style="display:flex;width:100%;align-items:center;gap:10px;border:0;border-radius:12px;background:' + (active ? 'rgba(255,255,255,.1)' : 'transparent') + ';color:#fff;cursor:pointer;padding:9px 10px;text-align:left;">'
            + '<span style="display:inline-flex;height:28px;min-width:28px;align-items:center;justify-content:center;border-radius:10px;background:' + profile.color + ';box-shadow:0 8px 18px ' + profile.color + '55;font-size:12px;font-weight:800;">' + profile.initial + '</span>'
            + '<span style="display:flex;min-width:0;flex:1;flex-direction:column;gap:4px;">'
            + '<span style="font-size:13px;font-weight:800;line-height:1;color:#fff;">' + profile.label + '</span>'
            + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:600;line-height:1;color:#cbd5e1;">' + profile.email + '</span>'
            + '</span>'
            + '<span style="width:18px;text-align:center;color:' + (active ? '#e2e8f0' : 'transparent') + ';font-size:13px;font-weight:900;">✓</span>'
            + '</button>';
        }).join('');
        list.querySelectorAll('.profile-switcher-option').forEach(function (option) {
          option.addEventListener('click', function () {
            var targetBase = option.getAttribute('data-profile-base');
            if (!targetBase || targetBase === currentBase) {
              if (menu) menu.style.display = 'none';
              return;
            }
            switchToProfile(targetBase);
          });
        });
      }
      function switchToProfile(targetBase) {
        var nextPath = window.location.pathname.indexOf(currentBase) === 0
          ? targetBase + window.location.pathname.slice(currentBase.length)
          : targetBase + '/dashboard/';
        window.location.href = nextPath + window.location.search + window.location.hash;
      }
      if (homeButton) {
        homeButton.addEventListener('mouseenter', function () {
          homeButton.style.background = 'rgba(255,255,255,.13)';
        });
        homeButton.addEventListener('mouseleave', function () {
          homeButton.style.background = 'rgba(255,255,255,.07)';
        });
        homeButton.addEventListener('click', function () {
          window.location.href = '/';
        });
      }
      if (!button) return;
      renderProfiles();
      loadDockPosition();
      setupMobileDrag();
      window.addEventListener('resize', function () {
        if (!isMobileDock()) {
          root.classList.remove('profile-dock-positioned');
          root.style.left = '';
          root.style.top = '';
          root.style.right = '';
          root.style.bottom = '';
          if (menu) menu.style.display = 'none';
          return;
        }
        if (root.classList.contains('profile-dock-positioned')) {
          applyDockPosition({ left: root.getBoundingClientRect().left, top: root.getBoundingClientRect().top });
        }
        positionMobileMenu();
      });
      button.addEventListener('mouseenter', function () {
        button.style.transform = 'translateY(-1px)';
        button.style.background = 'rgba(255,255,255,.13)';
        button.style.borderColor = 'rgba(226,232,240,.22)';
      });
      button.addEventListener('mouseleave', function () {
        button.style.transform = '';
        button.style.background = 'rgba(255,255,255,.075)';
        button.style.borderColor = 'rgba(255,255,255,.06)';
      });
      button.addEventListener('click', function () {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        toggleMenu();
      });
      if (addButton) {
        addButton.addEventListener('click', function () {
          window.location.href = '/?addProfile=1';
        });
      }
      document.addEventListener('click', function (event) {
        if (!menu || !menu.style.display || menu.style.display === 'none') return;
        if (!document.getElementById('profile-switcher-root').contains(event.target)) {
          menu.style.display = 'none';
        }
      });
    })();
  </script>
</div>`;
}

function rewriteTextResponse(body, profileBasePath, contentType = '') {
  const escapedTarget = TARGET_ORIGIN.replace(/\//g, '\\/');
  const escapedProfilePath = profileBasePath.replace(/\//g, '\\/');

  const rewrittenBody = rewriteLoginRedirectTargets(body
    .replace(/<base\b[^>]*>/gi, '')
    .replaceAll(`${TARGET_ORIGIN}/`, `${profileBasePath}/`)
    .replaceAll(TARGET_ORIGIN, profileBasePath)
    .replaceAll('//nexcourses.com/', `${profileBasePath}/`)
    .replaceAll('//www.nexcourses.com/', `${profileBasePath}/`)
    .replaceAll(`${escapedTarget}\\/`, `${escapedProfilePath}\\/`)
    .replaceAll(escapedTarget, escapedProfilePath)
    .replaceAll('\\/\\/nexcourses.com\\/', `${escapedProfilePath}\\/`)
    .replaceAll('\\/\\/www.nexcourses.com\\/', `${escapedProfilePath}\\/`)
    .replace(
      /(["'`])dashboard\/(?![A-Za-z0-9_-])/g,
      (_match, quote) => `${quote}${profileBasePath}/dashboard/`,
    )
    .replace(
      /(["'`])\\\/dashboard\\\/(?![A-Za-z0-9_-])/g,
      (_match, quote) => `${quote}${escapedProfilePath}\\/dashboard\\/`,
    )
    .replace(
      /\b(href|src|action)=("|')\/(?!\/|proxy\/|#)/gi,
      (_match, attribute, quote) => `${attribute}=${quote}${profileBasePath}/`,
    )
    .replace(
      /(["'`])\/(?!\/|proxy\/|#|>)/g,
      (_match, quote) => `${quote}${profileBasePath}/`,
    )
    .replace(
      /(["'`])\\\/(?!\\\/|proxy\\\/|#|>)/g,
      (_match, quote) => `${quote}${escapedProfilePath}\\/`,
    )
    .replace(
      /\burl\((["']?)\/(?!\/|proxy\/|#)/gi,
      (_match, quote) => `url(${quote}${profileBasePath}/`,
    )
    .replaceAll('https://proxy/', '/proxy/')
    .replaceAll('http://proxy/', '/proxy/')
    .replaceAll('//proxy/', '/proxy/')
    .replaceAll('https:\\/\\/proxy\\/', '\\/proxy\\/')
    .replaceAll('http:\\/\\/proxy\\/', '\\/proxy\\/')
    .replaceAll('\\/\\/proxy\\/', '\\/proxy\\/')
    .replace(
      'function parse_redirect_url(redirect){',
      String.raw`function parse_redirect_url(redirect){if(typeof redirect==='string'){redirect=redirect.replace(/^https?:\/\/proxy/i,'').replace(/^\/\/proxy/i,'').replace(/^\.\/proxy\//i,'/proxy/').replace(/^proxy\//i,'/proxy/');}if(typeof redirect==='string'&&redirect.indexOf('/proxy/')===0){window.location.href=window.location.origin+redirect;return;}`,
    ), profileBasePath);

  if (/text\/html/i.test(contentType)) {
    const withRedirectSanitizer = /<head\b[^>]*>/i.test(rewrittenBody)
      ? rewrittenBody.replace(
        /<head\b[^>]*>/i,
        (match) => `${match}${createProxyRedirectSanitizer(profileBasePath)}`,
      )
      : `${createProxyRedirectSanitizer(profileBasePath)}${rewrittenBody}`;

    if (/<\/body>/i.test(withRedirectSanitizer)) {
      return withRedirectSanitizer.replace(
        /<\/body>/i,
        `${createLoginRedirectGuard(profileBasePath)}${createProfileSwitcher(profileBasePath)}</body>`,
      );
    }

    return withRedirectSanitizer;
  }

  return rewrittenBody;
}

function rewriteLoginRedirectTargets(body, profileBasePath) {
  const dashboardPath = `${profileBasePath}/dashboard/`;

  return body.replace(
    /<input\b(?=[^>]*\bname=(["'])digits_redirect_page\1)[^>]*>/gi,
    (tag) => {
      if (/\bvalue=(["'])[^"']*\1/i.test(tag)) {
        return tag.replace(/\bvalue=(["'])[^"']*\1/i, `value="${dashboardPath}"`);
      }

      if (/\/\s*>$/.test(tag)) {
        return tag.replace(/\/\s*>$/, ` value="${dashboardPath}"/>`);
      }

      return tag.replace(/>$/, ` value="${dashboardPath}">`);
    },
  );
}

function createProxyRedirectSanitizer(profileBasePath) {
  return `<script>
    (function () {
      var profileBasePath = '${profileBasePath}';
      var dashboardPath = profileBasePath + '/dashboard/';
      function normalizeProxyUrl(value) {
        if (!value || typeof value !== 'string') return value;
        var url = value.trim();
        if (url === 'proxy' || url === '/proxy' || url === './proxy') return dashboardPath;
        if (url.indexOf('https://proxy/') === 0) return url.replace('https://proxy', '');
        if (url.indexOf('http://proxy/') === 0) return url.replace('http://proxy', '');
        if (url.indexOf('//proxy/') === 0) return url.slice(1);
        if (url.indexOf('proxy/') === 0) return '/' + url;
        if (url.indexOf('./proxy/') === 0) return '/' + url.slice(2);
        return value;
      }
      try {
        var NativeURL = window.URL;
        if (NativeURL && window.Proxy && !window.__novonexURLPatch) {
          window.URL = new window.Proxy(NativeURL, {
            construct: function (target, args) {
              if (typeof args[0] === 'string') {
                args[0] = args[0]
                  .replace(/^https?:\/\/proxy\//i, window.location.origin + '/proxy/')
                  .replace(/^https?:\/proxy\//i, window.location.origin + '/proxy/');
              }
              return Reflect.construct(target, args);
            },
          });
          window.__novonexURLPatch = true;
        }
        var originalAssign = window.location.assign.bind(window.location);
        var originalReplace = window.location.replace.bind(window.location);
        window.location.assign = function (url) {
          return originalAssign(normalizeProxyUrl(String(url)));
        };
        window.location.replace = function (url) {
          return originalReplace(normalizeProxyUrl(String(url)));
        };
      } catch (error) {}
    })();
  </script>`;
}

function createLoginRedirectGuard(profileBasePath) {
  return `<script>
    (function () {
      var profileBasePath = '${profileBasePath}';
      var dashboardPath = profileBasePath + '/dashboard/';
      function normalizeProxyUrl(value) {
        if (!value || typeof value !== 'string') return value;
        var url = value.trim();
        if (url === 'proxy' || url === '/proxy' || url === './proxy') return dashboardPath;
        if (url.indexOf('https://proxy/') === 0) return url.replace('https://proxy', '');
        if (url.indexOf('http://proxy/') === 0) return url.replace('http://proxy', '');
        if (url.indexOf('//proxy/') === 0) return url.slice(1);
        if (url.indexOf('proxy/') === 0) return '/' + url;
        if (url.indexOf('./proxy/') === 0) return '/' + url.slice(2);
        if (url.indexOf('/dashboard') === 0 || url.indexOf('dashboard') === 0) return dashboardPath;
        return value;
      }
      function isLoginRoute() {
        return window.location.pathname.indexOf(profileBasePath + '/login') === 0;
      }
      function enforceDashboardTarget() {
        var inputs = document.querySelectorAll('input[name="digits_redirect_page"]');
        for (var index = 0; index < inputs.length; index += 1) {
          inputs[index].value = dashboardPath;
        }
        if (window.dig_log_obj) window.dig_log_obj.uri = dashboardPath;
        if (window.dig_mdet) window.dig_mdet.uri = dashboardPath;
        if (window._tutorobject) window._tutorobject.tutor_frontend_dashboard_url = dashboardPath;
      }
      function normalizeResponseValue(value) {
        if (typeof value !== 'string') return value;
        var normalized = value.trim();
        if (normalized.indexOf('https://proxy/') === 0) return normalized.replace('https://proxy', '');
        if (normalized.indexOf('http://proxy/') === 0) return normalized.replace('http://proxy', '');
        if (normalized.indexOf('//proxy/') === 0) return normalized.slice(1);
        if (normalized.indexOf('./proxy/') === 0) return '/' + normalized.slice(2);
        if (normalized.indexOf('proxy/') === 0) return '/' + normalized;
        return value;
      }
      function normalizeResponseRedirects(value) {
        if (!value || typeof value !== 'object') return value;
        Object.keys(value).forEach(function (key) {
          if (typeof value[key] === 'string') {
            value[key] = normalizeResponseValue(value[key]);
          } else if (value[key] && typeof value[key] === 'object') {
            normalizeResponseRedirects(value[key]);
          }
        });
        return value;
      }
      function patchAjaxRedirects() {
        if (!window.jQuery || !window.jQuery.ajax || window.jQuery.ajax.__novonexRedirectPatch) return;
        var originalAjax = window.jQuery.ajax;
        var patchedAjax = function (options) {
          if (options && typeof options === 'object' && typeof options.success === 'function') {
            var originalSuccess = options.success;
            options = Object.assign({}, options, {
              success: function (response) {
                normalizeResponseRedirects(response);
                return originalSuccess.apply(this, arguments);
              },
            });
          }
          return originalAjax.apply(this, arguments.length > 1 ? arguments : [options]);
        };
        patchedAjax.__novonexRedirectPatch = true;
        window.jQuery.ajax = patchedAjax;
      }
      function hasSuccessMessage() {
        var text = (document.body && document.body.innerText || '').toLowerCase();
        return text.indexOf('login successful') !== -1
          || text.indexOf('redirecting') !== -1 && text.indexOf('yay') !== -1;
      }
      function goDashboard() {
        enforceDashboardTarget();
        if (window.location.pathname !== dashboardPath) {
          window.location.replace(dashboardPath);
        }
      }
      if (!isLoginRoute()) return;
      enforceDashboardTarget();
      patchAjaxRedirects();
      var checks = 0;
      var interval = window.setInterval(function () {
        checks += 1;
        enforceDashboardTarget();
        patchAjaxRedirects();
        if (hasSuccessMessage()) {
          window.clearInterval(interval);
          window.setTimeout(goDashboard, 80);
        }
        if (checks > 80) {
          window.clearInterval(interval);
        }
      }, 100);
      document.addEventListener('submit', function () {
        enforceDashboardTarget();
      }, true);
      document.addEventListener('click', function (event) {
        var target = event.target;
        if (target && target.closest && target.closest('button, input[type="submit"], .digits_login, .digit_send_otp')) {
          enforceDashboardTarget();
        }
      }, true);
      window.addEventListener('beforeunload', function () {
        var normalized = normalizeProxyUrl(window.location.pathname);
        if (normalized !== window.location.pathname && normalized.indexOf('/proxy/') === 0) {
          window.history.replaceState(null, '', normalized);
        }
      });
    })();
  </script>`;
}

function shouldRewriteResponseBody(proxyRes) {
  const contentType = proxyRes.headers['content-type'] || '';

  return /(text\/html|text\/css|application\/javascript|application\/x-javascript|text\/javascript|application\/json|text\/json)/i.test(
    contentType,
  );
}

function shouldInterceptRequest(req) {
  const acceptHeader = req.headers.accept || '';
  const requestPath = req.path || '/';
  const extension = path.extname(requestPath).toLowerCase();
  const originalUrl = req.originalUrl || '';

  if (
    acceptHeader.includes('text/html') ||
    acceptHeader.includes('application/json') ||
    acceptHeader.includes('text/javascript') ||
    acceptHeader.includes('application/javascript')
  ) {
    return true;
  }

  if (
    originalUrl.includes('/wp-admin/admin-ajax.php') ||
    originalUrl.includes('/wp-json/') ||
    originalUrl.includes('wc-ajax=')
  ) {
    return true;
  }

  return ['.html', '.htm', '.css', '.js', '.mjs', '.json'].includes(extension);
}

function handleProxyError(profileName, error, req, res) {
  console.error(
    `[proxy:${profileName}] ${req.method} ${req.originalUrl} failed:`,
    error,
  );

  if (!res.headersSent) {
    res.status(502).json({
      error: 'Bad gateway',
      profile: profileName,
      message: 'Unable to reach the course website through the proxy.',
    });
  }
}

function createProfileProxyOptions(profileName, profileBasePath) {
  return {
    target: TARGET_URL,
    changeOrigin: true,
    agent: upstreamAgent,
    xfwd: true,
    ws: true,
    secure: true,
    on: {
      proxyRes(proxyRes, req) {
        prepareProxyResponse(proxyRes, req, profileBasePath);
      },
      error(error, req, res) {
        handleProxyError(profileName, error, req, res);
      },
    },
  };
}

function createProfileProxyRouter(profileName) {
  const profileBasePath = `/proxy/${profileName}`;
  const streamProxy = createProxyMiddleware(
    createProfileProxyOptions(profileName, profileBasePath),
  );
  const interceptResponseBody = responseInterceptor(async (responseBuffer, proxyRes) => {
    if (!shouldRewriteResponseBody(proxyRes)) {
      return responseBuffer;
    }

    return rewriteTextResponse(
      responseBuffer.toString('utf8'),
      profileBasePath,
      proxyRes.headers['content-type'] || '',
    );
  });
  const rewriteProxy = createProxyMiddleware({
    ...createProfileProxyOptions(profileName, profileBasePath),
    selfHandleResponse: true,
    on: {
      ...createProfileProxyOptions(profileName, profileBasePath).on,
      proxyReq(proxyReq) {
        // Keep upstream compression negotiable; responseInterceptor can decode
        // common encodings and will update response headers before sending.
        proxyReq.setHeader('accept-encoding', 'gzip, br, deflate');
      },
      proxyRes(proxyRes, req, res) {
        // Critical isolation: every Set-Cookie returned from NexCourses is
        // rewritten to the active profile route, so profile cookies do not
        // overlap in the same mobile browser.
        prepareProxyResponse(proxyRes, req, profileBasePath);

        return interceptResponseBody(proxyRes, req, res);
      },
    },
  });

  return (req, res, next) => {
    if (shouldInterceptRequest(req)) {
      rewriteProxy(req, res, next);
      return;
    }

    streamProxy(req, res, next);
  };
}

app.use('/proxy/:profileName', (req, res, next) => {
  const profileName = req.params.profileName;

  if (!/^[a-z0-9-]{1,32}$/i.test(profileName)) {
    res.status(404).json({ error: 'Unknown profile' });
    return;
  }

  if (!profileProxyRouters.has(profileName)) {
    profileProxyRouters.set(profileName, createProfileProxyRouter(profileName));
  }

  profileProxyRouters.get(profileName)(req, res, next);
});

app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.accepts('html')) {
    next();
    return;
  }

  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Profile proxy server listening on http://localhost:${PORT}`);
  console.log(`Profile 1: http://localhost:${PORT}/proxy/p1/`);
  console.log(`Profile 2: http://localhost:${PORT}/proxy/p2/`);
});
