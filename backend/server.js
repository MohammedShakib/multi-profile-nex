import express from 'express';
import cors from 'cors';
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

function rewriteTextResponse(body, profileBasePath) {
  const escapedTarget = TARGET_ORIGIN.replace(/\//g, '\\/');
  const escapedProfilePath = profileBasePath.replace(/\//g, '\\/');

  return body
    .replaceAll(`${TARGET_ORIGIN}/`, `${profileBasePath}/`)
    .replaceAll(`${escapedTarget}\\/`, `${escapedProfilePath}\\/`)
    .replace(
      /\b(href|src|action)=("|')\/(?!\/|proxy\/|#)/gi,
      (_match, attribute, quote) => `${attribute}=${quote}${profileBasePath}/`,
    )
    .replace(
      /\burl\((["']?)\/(?!\/|proxy\/|#)/gi,
      (_match, quote) => `url(${quote}${profileBasePath}/`,
    );
}

function shouldRewriteResponseBody(proxyRes) {
  const contentType = proxyRes.headers['content-type'] || '';

  return /(text\/html|text\/css|application\/javascript|text\/javascript|application\/json)/i.test(
    contentType,
  );
}

function createProfileProxy(profileName) {
  const profileBasePath = `/proxy/${profileName}`;
  const interceptResponseBody = responseInterceptor(async (responseBuffer, proxyRes) => {
    if (!shouldRewriteResponseBody(proxyRes)) {
      return responseBuffer;
    }

    return rewriteTextResponse(responseBuffer.toString('utf8'), profileBasePath);
  });

  return createProxyMiddleware({
    target: TARGET_URL,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    secure: true,
    selfHandleResponse: true,
    on: {
      proxyReq(proxyReq) {
        // Keep upstream compression negotiable; responseInterceptor can decode
        // common encodings and will update response headers before sending.
        proxyReq.setHeader('accept-encoding', 'gzip, br, deflate');
      },
      proxyRes(proxyRes, req, res) {
        // Critical isolation: every Set-Cookie returned from NexCourses is
        // rewritten to the active profile route, so profile cookies do not
        // overlap in the same mobile browser.
        rewriteSetCookieHeader(proxyRes, profileBasePath);
        rewriteLocationHeader(proxyRes, profileBasePath);

        return interceptResponseBody(proxyRes, req, res);
      },
      error(error, req, res) {
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
      },
    },
  });
}

app.use('/proxy/p1', createProfileProxy('p1'));
app.use('/proxy/p2', createProfileProxy('p2'));

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
