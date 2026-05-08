// Redact secrets from URLs before storing them.
// Returns { url, redacted: boolean, warnings: string[] }.

const SENSITIVE_QUERY_KEYS = [
  'token', 'access_token', 'refresh_token', 'id_token',
  'apikey', 'api_key', 'auth', 'authorization',
  'password', 'pwd', 'secret', 'client_secret',
  'sig', 'signature', 'sas', 'sastoken',
  'key', 'private_key',
];

export function redactUrl(input) {
  const warnings = [];
  let url;
  try {
    url = new URL(input);
  } catch {
    return { url: input, redacted: false, warnings: ['Not a valid URL — stored as-is.'] };
  }

  let redacted = false;

  if (url.username || url.password) {
    url.username = '';
    url.password = '';
    warnings.push('Stripped userinfo (user:pass@) from URL.');
    redacted = true;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase())) {
      url.searchParams.set(key, 'REDACTED');
      warnings.push(`Redacted query parameter: ${key}`);
      redacted = true;
    }
  }

  // Heuristic: hash fragment containing access_token=...
  if (url.hash && /access_token=|id_token=/i.test(url.hash)) {
    url.hash = '#REDACTED';
    warnings.push('Redacted sensitive URL fragment.');
    redacted = true;
  }

  return { url: url.toString(), redacted, warnings };
}
