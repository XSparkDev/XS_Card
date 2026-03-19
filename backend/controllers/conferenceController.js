const { db } = require('../firebase.js');

const getUserStatus = async (req, res) => {
    const { id } = req.params;

    try {
        if (!id) {
            return res.status(400).json({
                success: false,
                found: false,
                allowed: false,
                message: 'User ID is required'
            });
        }

        const userRef = db.collection('users').doc(id);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(200).json({
                success: true,
                found: false,
                allowed: false
            });
        }

        const userData = userDoc.data() || {};
        const configuredConferenceCode = process.env.CONFERENCE_CODE;
        const isConferenceUser =
            configuredConferenceCode &&
            userData.conferenceCode &&
            userData.conferenceCode === configuredConferenceCode;

        return res.status(200).json({
            success: true,
            found: true,
            allowed: !!isConferenceUser,
            userId: id,
            name: userData.name || '',
            surname: userData.surname || ''
        });
    } catch (error) {
        console.error('[ConferenceUserStatus] Error:', error);
        return res.status(500).json({
            success: false,
            found: false,
            allowed: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

const getConferenceUsers = async (req, res) => {
    try {
        const configuredConferenceCode = process.env.CONFERENCE_CODE;

        if (!configuredConferenceCode) {
            return res.status(500).json({
                success: false,
                message: 'Conference code is not configured on the server'
            });
        }

        const usersRef = db.collection('users');
        const snapshot = await usersRef
            .where('conferenceCode', '==', configuredConferenceCode)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                count: 0,
                users: []
            });
        }

        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data() || {};
            users.push({
                id: doc.id,
                userId: doc.id,
                name: data.name || '',
                surname: data.surname || '',
                email: data.email || '',
                conferenceCode: data.conferenceCode || null
            });
        });

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error('[ConferenceUsersList] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

module.exports = {
    getUserStatus,
    getConferenceUsers
};

