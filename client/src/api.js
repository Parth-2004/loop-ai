export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const PLATFORM_LABEL = { x: 'X', linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', meta: 'Facebook & Instagram' };
export const STATUS_LABEL = {
  generating: 'Generating',
  pending_approval: 'Awaiting approval',
  changes_requested: 'Revising',
  approved: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  rejected: 'Rejected',
  draft: 'Draft',
};
export const BUSY = ['generating', 'changes_requested', 'publishing'];
export const CHAR_LIMIT = { x: 280, linkedin: 3000, facebook: 63206, instagram: 2200 };

export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function fmtDate(d, tz) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(d));
  } catch {
    return new Date(d).toLocaleString();
  }
}

// datetime-local <-> ISO helpers (in the browser's local time)
export function toLocalInput(d) {
  if (!d) return '';
  const dt = new Date(d);
  const off = dt.getTimezoneOffset() * 60_000;
  return new Date(dt.getTime() - off).toISOString().slice(0, 16);
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
