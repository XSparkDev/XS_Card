const formatDate = (date) => {
    if (!date) return null;
    
    // If date is a Firestore Timestamp
    if (date?._seconds) {
        date = new Date(date._seconds * 1000);
    }
    
    // If date is a string, convert to Date object
    if (typeof date === 'string') {
        date = new Date(date);
    }

    // Handle invalid dates
    if (!(date instanceof Date) || isNaN(date)) {
        console.error('Invalid date:', date);
        return null;
    }

    // Use UTC timezone to avoid server timezone issues
    return date.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short'
    })
    .replace(',', '')
    .replace(/\s+/g, ' ');
};

const convertToISOString = (date) => {
    if (!date) return null;
    
    // If date is a Firestore Timestamp
    if (date?._seconds) {
        date = new Date(date._seconds * 1000);
    }
    
    // If date is a string, convert to Date object
    if (typeof date === 'string') {
        date = new Date(date);
    }

    // Handle invalid dates
    if (!(date instanceof Date) || isNaN(date)) {
        console.error('Invalid date for ISO conversion:', date);
        return null;
    }

    return date.toISOString();
};

module.exports = { formatDate, convertToISOString };
