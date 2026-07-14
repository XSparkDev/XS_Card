/**
 * Formats a stored social media value (usually a bare username/handle, but
 * users can also paste a full URL) into a short, recognizable display string
 * for the card — e.g. "www.linkedin.com/xol…" — without ever changing the
 * underlying stored value or the full URL used to actually open the link
 * (see handleSocialPress in CardsScreen.tsx, which is untouched by this).
 */

// How many characters of the profile path to show before the ellipsis.
const PATH_PREVIEW_LENGTH = 3;

// Platforms whose stored value is a profile path under a fixed base domain.
// WhatsApp is intentionally excluded — its value is a phone number, not a
// profile path, and showing the number as-is is more useful than a link preview.
const PLATFORM_DOMAINS: Record<string, string> = {
  linkedin: 'www.linkedin.com',
  instagram: 'www.instagram.com',
  facebook: 'www.facebook.com',
  x: 'www.x.com',
  tiktok: 'www.tiktok.com',
};

// Strips a platform's own domain/path conventions off a value in case the
// user pasted a full URL instead of a bare username (e.g.
// "https://www.linkedin.com/in/john-smith" -> "john-smith").
const extractProfilePath = (platform: string, rawValue: string): string => {
  let value = rawValue.trim();

  // Strip protocol.
  value = value.replace(/^https?:\/\//i, '');
  // Strip a leading www.
  value = value.replace(/^www\./i, '');
  // Strip this platform's own domain, and LinkedIn/TikTok's extra path segment.
  value = value.replace(/^linkedin\.com\/in\//i, '');
  value = value.replace(/^tiktok\.com\/@?/i, '');
  value = value.replace(/^(instagram|facebook|x|twitter)\.com\//i, '');
  // Strip a leading @ (handles) or / (leftover path separator).
  value = value.replace(/^[@/]/, '');
  // Drop everything after the first remaining slash (query strings, extra path segments).
  value = value.split('/')[0].split('?')[0];

  return value;
};

const truncate = (value: string, length: number): string =>
  value.length > length ? `${value.slice(0, length)}…` : value;

/**
 * Returns the short display string for a social value, or the raw value
 * unchanged for platforms this doesn't apply to (currently just WhatsApp).
 */
export const formatSocialLinkDisplay = (platform: string, rawValue: string): string => {
  const value = (rawValue ?? '').trim();
  if (!value) return value;

  if (platform === 'website') {
    // Website is a real arbitrary URL — shorten using its own hostname + path,
    // not a fixed platform domain.
    try {
      const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const parsed = new URL(withScheme);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname.replace(/^\//, '');
      return path ? `www.${host}/${truncate(path, PATH_PREVIEW_LENGTH)}` : `www.${host}`;
    } catch {
      return truncate(value, PATH_PREVIEW_LENGTH + 15); // fallback if not a parseable URL
    }
  }

  const domain = PLATFORM_DOMAINS[platform];
  if (!domain) return value; // unknown platform (or whatsapp) — leave untouched

  const path = extractProfilePath(platform, value);
  return path ? `${domain}/${truncate(path, PATH_PREVIEW_LENGTH)}` : domain;
};
