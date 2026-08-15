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
    profiles: ['/proxy/p1', '/proxy/p2'],
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
  const isPersonal = profileBasePath.endsWith('/p1');
  const currentLabel = isPersonal ? 'Personal' : 'Shared';
  const currentEmail = isPersonal ? 'ayemshakib2018@gmail.com' : 'theaicircle01@gmail.com';
  const targetBasePath = isPersonal ? '/proxy/p2' : '/proxy/p1';
  const currentInitial = isPersonal ? 'P' : 'S';
  const accentColor = isPersonal ? '#6366f1' : '#10b981';

  return `<div id="profile-switcher-root" style="position:fixed;right:18px;bottom:18px;z-index:2147483647;font-family:Inter,Arial,Helvetica,sans-serif;">
  <button type="button" id="profile-switcher-button" title="Switch profile" style="display:flex;align-items:center;gap:8px;max-width:min(92vw,260px);border:1px solid rgba(148,163,184,.32);background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(30,41,59,.96));color:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08);padding:7px;cursor:pointer;font-size:12px;font-weight:700;line-height:1;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);">
    <span style="display:flex;align-items:center;gap:7px;min-width:0;padding:5px 9px 5px 5px;border-radius:12px;background:rgba(255,255,255,.08);">
      <span style="display:inline-flex;height:26px;min-width:26px;align-items:center;justify-content:center;border-radius:9px;background:${accentColor};box-shadow:0 8px 18px ${accentColor}55;font-size:12px;font-weight:800;">${currentInitial}</span>
      <span style="display:flex;min-width:0;flex-direction:column;gap:3px;text-align:left;">
        <span style="font-size:13px;color:#fff;white-space:nowrap;">${currentLabel}</span>
        <span style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;color:#cbd5e1;">${currentEmail}</span>
      </span>
    </span>
    <span aria-hidden="true" style="display:inline-flex;height:32px;min-width:32px;align-items:center;justify-content:center;border-radius:12px;background:rgba(255,255,255,.1);color:#e2e8f0;font-size:16px;">⇄</span>
  </button>
  <script>
    (function () {
      var button = document.getElementById('profile-switcher-button');
      if (!button) return;
      button.addEventListener('mouseenter', function () {
        button.style.transform = 'translateY(-1px)';
        button.style.borderColor = 'rgba(226,232,240,.5)';
      });
      button.addEventListener('mouseleave', function () {
        button.style.transform = '';
        button.style.borderColor = 'rgba(148,163,184,.32)';
      });
      button.addEventListener('click', function () {
        var targetBase = '${targetBasePath}';
        var sourceBase = '${profileBasePath}';
        var nextPath = window.location.pathname.indexOf(sourceBase) === 0
          ? targetBase + window.location.pathname.slice(sourceBase.length)
          : targetBase + '/dashboard/';
        window.location.href = nextPath + window.location.search + window.location.hash;
      });
    })();
  </script>
</div>`;
}

function rewriteTextResponse(body, profileBasePath, contentType = '') {
  const escapedTarget = TARGET_ORIGIN.replace(/\//g, '\\/');
  const escapedProfilePath = profileBasePath.replace(/\//g, '\\/');

  const rewrittenBody = body
    .replace(/<base\b[^>]*>/gi, '')
    .replaceAll(`${TARGET_ORIGIN}/`, `${profileBasePath}/`)
    .replaceAll(TARGET_ORIGIN, profileBasePath)
    .replaceAll(`${escapedTarget}\\/`, `${escapedProfilePath}\\/`)
    .replaceAll(escapedTarget, escapedProfilePath)
    .replace(
      /\b(href|src|action)=("|')\/(?!\/|proxy\/|#)/gi,
      (_match, attribute, quote) => `${attribute}=${quote}${profileBasePath}/`,
    )
    .replace(
      /(["'`])\/(?!\/|proxy\/|#)/g,
      (_match, quote) => `${quote}${profileBasePath}/`,
    )
    .replace(
      /(["'`])\\\/(?!\\\/|proxy\\\/|#)/g,
      (_match, quote) => `${quote}${escapedProfilePath}\\/`,
    )
    .replace(
      /\burl\((["']?)\/(?!\/|proxy\/|#)/gi,
      (_match, quote) => `url(${quote}${profileBasePath}/`,
    );

  if (/text\/html/i.test(contentType) && /<\/body>/i.test(rewrittenBody)) {
    return rewrittenBody.replace(/<\/body>/i, `${createProfileSwitcher(profileBasePath)}</body>`);
  }

  return rewrittenBody;
}

function shouldRewriteResponseBody(proxyRes) {
  const contentType = proxyRes.headers['content-type'] || '';

  return /(text\/html|text\/css|application\/javascript|text\/javascript|application\/json|text\/json)/i.test(
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

app.use('/proxy/p1', createProfileProxyRouter('p1'));
app.use('/proxy/p2', createProfileProxyRouter('p2'));

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
