/**
 * Device Detection Utility
 * Based on the detection logic from saveContact.html, adapted for server-side use
 * 
 * @param {string} userAgent - The User-Agent string from the request
 * @returns {Object} Object with 'os' property indicating detected operating system
 */
function detectOS(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
        return { os: 'unknown' };
    }
    
    const ua = userAgent.toLowerCase();

    // Check for mobile/tablet devices first (more specific)
    if (ua.includes('huawei') || ua.includes('honor')) return { os: 'huawei' };
    if (ua.includes('android')) return { os: 'android' };
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return { os: 'ios' };
    
    // Check for desktop OS (less specific, but needed for proper fallback)
    if (ua.includes('windows')) return { os: 'windows' };
    if (ua.includes('mac os x') || ua.includes('macintosh')) return { os: 'mac' };
    if (ua.includes('linux')) return { os: 'linux' };
    
    // If we get here, it's unknown - will trigger fallback to show both links
    return { os: 'unknown' };
}

/**
 * Get the appropriate app store link based on detected OS
 * @param {string} userAgent - The User-Agent string from the request
 * @returns {string} App Store or Play Store URL
 */
function getStoreLink(userAgent) {
    const { os } = detectOS(userAgent);
    const iosAppStoreLink = process.env.IOS_APP_STORE_URL || 'https://apps.apple.com/us/app/xs-card/id6742452317?uo=4';
    const androidPlayStoreLink = process.env.ANDROID_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.p.zzles.xscard';
    
    if (os === 'ios') return iosAppStoreLink;
    if (os === 'android') return androidPlayStoreLink;
    // For unknown/other platforms, return both links (will be handled in email template)
    return null;
}

/**
 * Get both store links (for fallback when OS is unknown)
 * @returns {Object} Object with ios and android store links
 */
function getBothStoreLinks() {
    return {
        ios: process.env.IOS_APP_STORE_URL || 'https://apps.apple.com/us/app/xs-card/id6742452317?uo=4',
        android: process.env.ANDROID_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.p.zzles.xscard'
    };
}

module.exports = {
    detectOS,
    getStoreLink,
    getBothStoreLinks
};

