export interface BrowserUserProfile {
  email: string;
  userName: string;
  avatarUrl?: string | null;
  source: 'google_gsi' | 'browser_credentials' | 'google_header' | 'browser_storage' | 'browser_session';
}

const STORAGE_KEY_PROFILE = 'ae_insight_browser_gmail_profile_v1';
const STORAGE_KEY_SESSION_ID = 'ae_insight_live_session_id_v1';
const STORAGE_KEY_STARTED_AT = 'ae_insight_live_started_at_v1';

export function formatNameFromGmail(email: string, explicitName?: string): string {
  if (explicitName && explicitName.trim().length > 0) {
    return explicitName.trim();
  }
  if (!email) return 'Active Gmail User';
  const localPart = email.split('@')[0] || email;
  // Format e.g. "arnabredmi3sprime" or "arnab.roy" nicely
  if (localPart.toLowerCase().startsWith('arnab')) {
    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    return `Arnab (${cleaned})`;
  }
  const words = localPart
    .replace(/[0-9]+$/g, (digits) => (digits ? ` ${digits}` : ''))
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  return words.length > 0 ? words.join(' ') : localPart;
}

export function getOrCreateSessionMeta(): { sessionId: string; startedAt: number } {
  try {
    let sessionId = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
    let startedAtStr = sessionStorage.getItem(STORAGE_KEY_STARTED_AT);
    const now = Date.now();

    if (!sessionId) {
      const rand = Math.random().toString(36).substring(2, 10);
      sessionId = `sess_${now}_${rand}`;
      sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
    }
    if (!startedAtStr) {
      startedAtStr = String(now);
      sessionStorage.setItem(STORAGE_KEY_STARTED_AT, startedAtStr);
    }
    return {
      sessionId,
      startedAt: Number(startedAtStr) || now,
    };
  } catch {
    return {
      sessionId: `sess_fallback_${Date.now()}`,
      startedAt: Date.now(),
    };
  }
}

export function detectBrowserAndOs(): { browserInfo: string; deviceOs: string } {
  if (typeof navigator === 'undefined') {
    return { browserInfo: 'Google Chrome', deviceOs: 'Desktop' };
  }
  const ua = navigator.userAgent || '';
  let browserInfo = 'Google Chrome';
  if (ua.includes('Edg/')) {
    browserInfo = 'Microsoft Edge';
  } else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browserInfo = 'Opera Browser';
  } else if (ua.includes('Chrome/')) {
    browserInfo = 'Google Chrome';
  } else if (ua.includes('Firefox/')) {
    browserInfo = 'Mozilla Firefox';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browserInfo = 'Apple Safari';
  }

  let deviceOs = 'Windows Desktop';
  if (ua.includes('Win')) {
    deviceOs = 'Windows';
  } else if (ua.includes('Mac')) {
    deviceOs = 'macOS';
  } else if (ua.includes('Android')) {
    deviceOs = 'Android Mobile';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    deviceOs = 'iOS';
  } else if (ua.includes('Linux')) {
    deviceOs = 'Linux';
  }

  return { browserInfo, deviceOs };
}

export function decodeJwtPayload(token: string): { email?: string; name?: string; picture?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getSavedBrowserGmailProfile(): BrowserUserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string' && parsed.email.includes('@')) {
      return {
        email: parsed.email.trim().toLowerCase(),
        userName: parsed.userName || formatNameFromGmail(parsed.email),
        avatarUrl: parsed.avatarUrl || null,
        source: parsed.source || 'browser_storage',
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function saveBrowserGmailProfile(profile: BrowserUserProfile): BrowserUserProfile {
  const cleanEmail = profile.email.trim().toLowerCase();
  const normalizedEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@gmail.com`;
  const normalized: BrowserUserProfile = {
    email: normalizedEmail,
    userName: profile.userName?.trim() || formatNameFromGmail(normalizedEmail),
    avatarUrl: profile.avatarUrl || null,
    source: profile.source || 'browser_storage',
  };
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(normalized));
  } catch {
    // ignore
  }
  return normalized;
}

export async function trySilentBrowserCredentialDetection(): Promise<BrowserUserProfile | null> {
  try {
    if (typeof navigator !== 'undefined' && 'credentials' in navigator && typeof (navigator.credentials as any).get === 'function') {
      const cred: any = await Promise.race([
        (navigator.credentials as any).get({
          password: true,
          federated: {
            providers: ['https://accounts.google.com'],
          },
          mediation: 'silent',
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 1200)),
      ]);
      if (cred && cred.id && String(cred.id).includes('@')) {
        const email = String(cred.id).trim().toLowerCase();
        const userName = cred.name ? String(cred.name).trim() : formatNameFromGmail(email);
        return saveBrowserGmailProfile({
          email,
          userName,
          avatarUrl: cred.iconURL || null,
          source: 'browser_credentials',
        });
      }
    }
  } catch {
    // Browser blocked silent credential mediation inside iframe or no saved credential
  }
  return null;
}
