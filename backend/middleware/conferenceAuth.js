const conferenceAuth = (req, res, next) => {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const expected = process.env.CONFERENCE_API_KEY;

    if (!expected || !token || token !== expected) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized conference access'
        });
    }

    return next();
};

module.exports = { conferenceAuth };

