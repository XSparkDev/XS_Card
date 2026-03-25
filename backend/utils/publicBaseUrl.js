/*
  !!!  USED FOR APPLE WALLET passPageUrl + QR LINKS — DO NOT "SIMPLIFY"  !!!
  Breaking X-Forwarded-Proto / host detection => http:// URLs => Safari / Wallet fail.
  Changes here are NOT purely aesthetic; get human review.
*/
/**
 * Public base URL (scheme + host) as seen by the client, including behind reverse proxies
 * (Render, Heroku, nginx, etc.) where req.protocol stays "http" unless trust proxy is set.
 */
function getPublicBaseUrl(req) {
  const protoRaw = req.get('x-forwarded-proto') || req.protocol || 'https';
  const proto = String(protoRaw).split(',')[0].trim();
  const hostRaw = req.get('x-forwarded-host') || req.get('host') || '';
  const host = String(hostRaw).split(',')[0].trim();
  if (!host) {
    return `${proto}://localhost`;
  }
  return `${proto}://${host}`;
}

module.exports = { getPublicBaseUrl };
