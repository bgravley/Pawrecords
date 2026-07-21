// api/_cors.js
// Every API endpoint was previously setting Access-Control-Allow-Origin to
// '*' -- any website in the world could call these from a visitor's
// browser. Lower-severity than it would be with cookie-based auth (this
// app uses bearer tokens, which a malicious site can't get the browser to
// auto-attach the way it would a cookie), but still sloppy: no other site
// has any legitimate reason to call these endpoints directly.
//
// Reflects the request's Origin back only if it's on the allowlist, which
// is the correct pattern for supporting more than one valid origin (with
// vs without "www"). If Origin isn't allowed (or isn't sent at all, as
// with a same-origin request, a server-to-server call, or curl), the
// header is simply omitted -- Vercel/GoTrue cron and same-origin app
// calls are unaffected either way; only cross-origin browser JS from an
// unlisted site gets blocked from reading the response.
const ALLOWED_ORIGINS = [
  'https://yourpetpass.com',
  'https://www.yourpetpass.com',
];

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
}
