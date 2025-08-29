const { db } = require('../firebase');
const admin = require('firebase-admin');
const { sendMailWithStatus } = require('../public/Utils/emailService');

/**
 * Get all contact requests and inquiries with filtering and pagination
 */
const getAllContactRequests = async (req, res) => {
    try {
        const {
            status,
            type,
            page = 1,
            limit = 20,
            sortBy = 'submittedAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        let query = db.collection('messages');

        // Apply filters
        if (type) {
            // Map frontend types to database types
            let dbType = type;
            if (type === 'call') {
                dbType = 'contact'; // Map 'call' to 'contact' in database
            } else if (type === 'demo') {
                dbType = 'inquiry'; // Map 'demo' to 'inquiry' in database
            }
            query = query.where('type', '==', dbType);
        }

        // Note: We'll handle status filtering in the response transformation
        // since we need to map multiple database statuses to frontend statuses

        // Apply sorting
        if (sortBy === 'submittedAt') {
            query = query.orderBy('submittedAt', sortOrder);
        } else if (sortBy === 'createdAt') {
            query = query.orderBy('createdAt', sortOrder);
        } else if (sortBy === 'updatedAt') {
            query = query.orderBy('updatedAt', sortOrder);
        } else {
            query = query.orderBy('submittedAt', 'desc');
        }

        // Apply pagination
        const pageSize = parseInt(limit);
        const offset = (parseInt(page) - 1) * pageSize;
        
        // Get total count for pagination
        const countSnapshot = await query.get();
        const total = countSnapshot.size;

        // Get paginated results
        const snapshot = await query.limit(pageSize).offset(offset).get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page: parseInt(page),
                    limit: pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            });
        }

        const contactRequests = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Transform to simplified format
            const request = {
                id: doc.id,
                type: data.type || 'contact',
                name: data.name,
                email: data.email,
                company: data.company || null,
                message: data.message,
                date: data.submittedAt ? data.submittedAt.toDate().toISOString().split('T')[0] : null, // YYYY-MM-DD format
                status: data.status || 'pending',
                statusHistory: data.statusHistory || []
            };

            // Add admin information to each status history entry
            if (request.statusHistory && request.statusHistory.length > 0) {
                request.statusHistory = await Promise.all(
                    request.statusHistory.map(async (entry) => {
                        if (entry.updatedBy) {
                            try {
                                const adminDoc = await db.collection('users').doc(entry.updatedBy).get();
                                if (adminDoc.exists) {
                                    const adminData = adminDoc.data();
                                    return {
                                        ...entry,
                                        admin: {
                                            id: entry.updatedBy,
                                            email: adminData.email || 'Unknown'
                                        }
                                    };
                                }
                            } catch (error) {
                                console.error('Error fetching admin info:', error);
                            }
                        }
                        return {
                            ...entry,
                            admin: {
                                id: entry.updatedBy || 'Unknown',
                                email: 'Unknown'
                            }
                        };
                    })
                );
            }

            // Map different types to your format
            if (data.type === 'inquiry') {
                request.type = 'inquiry';
            } else if (data.type === 'contact') {
                request.type = 'call';
            }

            // Map status to your simplified format
            if (!data.status || data.status === 'open' || data.status === 'pending') {
                request.status = 'pending';
            } else if (data.status === 'responded' || data.status === 'resolved') {
                request.status = 'responded';
            }

            // Apply status filter if specified
            if (status && request.status !== status) {
                continue; // Skip this request if it doesn't match the status filter
            }

            contactRequests.push(request);
        }

        res.status(200).json({
            success: true,
            data: contactRequests,
            pagination: {
                page: parseInt(page),
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });

    } catch (error) {
        console.error('Error fetching contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact requests',
            error: error.message
        });
    }
};

/**
 * Get a single contact request by ID
 */
const getContactRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const doc = await db.collection('messages').doc(id).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Contact request not found'
            });
        }

        const data = doc.data();
        
        // Transform to simplified format
        const contactRequest = {
            id: doc.id,
            type: data.type || 'contact',
            name: data.name,
            email: data.email,
            company: data.company || null,
            message: data.message,
            date: data.submittedAt ? data.submittedAt.toDate().toISOString().split('T')[0] : null, // YYYY-MM-DD format
            status: data.status || 'pending',
            statusHistory: data.statusHistory || []
        };

        // Add admin information to each status history entry
        if (contactRequest.statusHistory && contactRequest.statusHistory.length > 0) {
            contactRequest.statusHistory = await Promise.all(
                contactRequest.statusHistory.map(async (entry) => {
                    if (entry.updatedBy) {
                        try {
                            const adminDoc = await db.collection('users').doc(entry.updatedBy).get();
                            if (adminDoc.exists) {
                                const adminData = adminDoc.data();
                                return {
                                    ...entry,
                                    admin: {
                                        id: entry.updatedBy,
                                        email: adminData.email || 'Unknown'
                                    }
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching admin info:', error);
                        }
                    }
                    return {
                        ...entry,
                        admin: {
                            id: entry.updatedBy || 'Unknown',
                            email: 'Unknown'
                        }
                    };
                })
            );
        }

        // Map different types to your format
        if (data.type === 'inquiry') {
            contactRequest.type = 'inquiry';
        } else if (data.type === 'contact') {
            contactRequest.type = 'call';
        }

                    // Map status to your simplified format
            if (!data.status || data.status === 'open' || data.status === 'pending') {
                contactRequest.status = 'pending';
            } else if (data.status === 'responded' || data.status === 'resolved') {
                contactRequest.status = 'responded';
            }

        res.status(200).json({
            success: true,
            data: contactRequest
        });

    } catch (error) {
        console.error('Error fetching contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact request',
            error: error.message
        });
    }
};

/**
 * Update contact request status and add response
 */
const updateContactRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, response, notes, assignedTo } = req.body;
        const updatedBy = req.user.uid;

        // Validate required fields
        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        // Validate status values
        const validStatuses = ['open', 'pending', 'in_progress', 'responded', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        const docRef = db.collection('messages').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Contact request not found'
            });
        }

        const currentData = doc.data();
        const currentStatus = currentData.status || 'open';

        // Prepare update data
        const updateData = {
            status,
            updatedAt: admin.firestore.Timestamp.now()
        };

        if (notes !== undefined) {
            updateData.notes = notes;
        }

        if (assignedTo !== undefined) {
            updateData.assignedTo = assignedTo;
        }

        // Add to status history with response included
        const statusHistory = currentData.statusHistory || [];
        const historyEntry = {
            status,
            timestamp: admin.firestore.Timestamp.now(),
            updatedBy,
            notes: notes || null
        };

        // Include response in history entry if provided
        if (response !== undefined) {
            historyEntry.response = response;
        }

        statusHistory.push(historyEntry);
        updateData.statusHistory = statusHistory;

        // Update the document
        await docRef.update(updateData);

        // Send email response if status changed to 'responded' and response is provided
        if (status === 'responded' && response && currentData.email) {
            try {
                const mailOptions = {
                    from: process.env.EMAIL_FROM || 'noreply@xscard.com',
                    to: currentData.email,
                    subject: `Response to your ${currentData.type === 'inquiry' ? 'inquiry' : 'contact'} request`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">Response to Your Request</h2>
                            <p>Dear ${currentData.name},</p>
                            <p>Thank you for reaching out to us. Here is our response to your request:</p>
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 0; line-height: 1.6;">${response}</p>
                            </div>
                            <p>If you have any further questions, please don't hesitate to contact us.</p>
                            <p>Best regards,<br>The XS Card Team</p>
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                            <p style="font-size: 12px; color: #666;">
                                Original message: ${currentData.message}
                            </p>
                        </div>
                    `
                };

                const emailResult = await sendMailWithStatus(mailOptions);
                console.log('Response email sent:', emailResult);
            } catch (emailError) {
                console.error('Failed to send response email:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.status(200).json({
            success: true,
            message: 'Contact request updated successfully',
            data: {
                id,
                status,
                response,
                notes,
                assignedTo,
                updatedAt: updateData.updatedAt.toDate().toISOString()
            }
        });

    } catch (error) {
        console.error('Error updating contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact request',
            error: error.message
        });
    }
};

/**
 * Fix existing contact requests that don't have a status
 */
const fixExistingContactRequests = async (req, res) => {
    try {
        // Get all messages without a status field
        const snapshot = await db.collection('messages').get();
        
        let updatedCount = 0;
        const batch = db.batch();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.status) {
                // Update documents without status to have 'open' status
                const docRef = db.collection('messages').doc(doc.id);
                batch.update(docRef, { 
                    status: 'open',
                    updatedAt: admin.firestore.Timestamp.now()
                });
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            await batch.commit();
        }
        
        res.status(200).json({
            success: true,
            message: `Fixed ${updatedCount} contact requests by setting status to 'open'`,
            updatedCount
        });
        
    } catch (error) {
        console.error('Error fixing existing contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fix existing contact requests',
            error: error.message
        });
    }
};

/**
 * Add test contact requests for development/testing
 */
const addTestContactRequests = async (req, res) => {
    try {
        const testRequests = [
            {
                type: 'contact',
                name: 'Alice Johnson',
                email: 'alice@startup.com',
                company: 'TechStart Inc',
                message: 'Interested in XS Card for our 25-person startup team. Looking for pricing and implementation timeline.',
                status: 'open',
                submittedAt: admin.firestore.Timestamp.now()
            },
            {
                type: 'inquiry',
                name: 'Bob Smith',
                email: 'bob@enterprise.com',
                company: 'Enterprise Corp',
                message: 'We need digital business cards for our 500+ employees. Can you provide a demo and enterprise pricing?',
                status: 'pending',
                submittedAt: admin.firestore.Timestamp.now()
            },
            {
                type: 'contact',
                name: 'Carol Davis',
                email: 'carol@agency.com',
                company: 'Creative Agency',
                message: 'Looking for a solution for our creative team. Need to see how it integrates with our existing tools.',
                status: 'open',
                submittedAt: admin.firestore.Timestamp.now()
            },
            {
                type: 'inquiry',
                name: 'David Wilson',
                email: 'david@consulting.com',
                company: 'Global Consulting',
                message: 'Interested in enterprise features and bulk deployment options for our international offices.',
                status: 'pending',
                submittedAt: admin.firestore.Timestamp.now()
            }
        ];

        const results = [];
        for (const request of testRequests) {
            const docRef = await db.collection('messages').add(request);
            results.push({
                id: docRef.id,
                ...request
            });
        }

        res.status(201).json({
            success: true,
            message: 'Test contact requests added successfully',
            data: results
        });

    } catch (error) {
        console.error('Error adding test contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add test contact requests',
            error: error.message
        });
    }
};

/**
 * Get contact requests in frontend format (exactly as requested)
 */
const getFrontendContactRequests = async (req, res) => {
    try {
        const { type, status } = req.query;

        // Build query
        let query = db.collection('messages');

        // Apply type filter
        if (type) {
            let dbType = type;
            if (type === 'call') {
                dbType = 'contact';
            } else if (type === 'demo') {
                dbType = 'inquiry';
            }
            query = query.where('type', '==', dbType);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const requests = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Transform to your exact format
            const request = {
                id: doc.id,
                type: data.type === 'inquiry' ? 'inquiry' : 'call', // Map to your types
                name: data.name,
                email: data.email,
                company: data.company || null,
                message: data.message,
                date: data.submittedAt ? data.submittedAt.toDate().toISOString().split('T')[0] : null,
                status: (!data.status || data.status === 'open' || data.status === 'pending') ? 'pending' : 'responded',
                statusHistory: data.statusHistory || []
            };

            // Add admin information to each status history entry
            if (request.statusHistory && request.statusHistory.length > 0) {
                request.statusHistory = await Promise.all(
                    request.statusHistory.map(async (entry) => {
                        if (entry.updatedBy) {
                            try {
                                const adminDoc = await db.collection('users').doc(entry.updatedBy).get();
                                if (adminDoc.exists) {
                                    const adminData = adminDoc.data();
                                    return {
                                        ...entry,
                                        admin: {
                                            id: entry.updatedBy,
                                            email: adminData.email || 'Unknown'
                                        }
                                    };
                                }
                            } catch (error) {
                                console.error('Error fetching admin info:', error);
                            }
                        }
                        return {
                            ...entry,
                            admin: {
                                id: entry.updatedBy || 'Unknown',
                                email: 'Unknown'
                            }
                        };
                    })
                );
            }

            // Apply status filter if specified
            if (status && request.status !== status) {
                return;
            }

            requests.push(request);
        }

        res.status(200).json({
            success: true,
            data: requests
        });

    } catch (error) {
        console.error('Error fetching frontend contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact requests',
            error: error.message
        });
    }
};

/**
 * Get contact request statistics
 */
const getContactRequestStats = async (req, res) => {
    try {
        const { type } = req.query;

        // Build base query
        let query = db.collection('messages');

        // Apply type filter if provided
        if (type) {
            query = query.where('type', '==', type);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return res.status(200).json({
                success: true,
                data: {
                    total: 0,
                    recent: 0,
                    byType: {},
                    byStatus: {
                        open: 0,
                        pending: 0,
                        in_progress: 0,
                        responded: 0,
                        resolved: 0,
                        closed: 0
                    }
                }
            });
        }

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        let total = 0;
        let recent = 0;
        const byType = {};
        const byStatus = {
            open: 0,
            pending: 0,
            in_progress: 0,
            responded: 0,
            resolved: 0,
            closed: 0
        };

        snapshot.forEach(doc => {
            const data = doc.data();
            total++;

            // Count by type
            const messageType = data.type || 'contact';
            byType[messageType] = (byType[messageType] || 0) + 1;

            // Count by status
            const status = data.status || 'open';
            byStatus[status] = (byStatus[status] || 0) + 1;

            // Count recent (last 7 days)
            if (data.submittedAt) {
                const submittedDate = data.submittedAt.toDate();
                if (submittedDate >= oneWeekAgo) {
                    recent++;
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                total,
                recent,
                byType,
                byStatus
            }
        });

    } catch (error) {
        console.error('Error fetching contact request stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contact request statistics',
            error: error.message
        });
    }
};

/**
 * Delete a contact request
 */
const deleteContactRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const docRef = db.collection('messages').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: 'Contact request not found'
            });
        }

        await docRef.delete();

        res.status(200).json({
            success: true,
            message: 'Contact request deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contact request',
            error: error.message
        });
    }
};

/**
 * Bulk update contact requests
 */
const bulkUpdateContactRequests = async (req, res) => {
    try {
        const { ids, status, assignedTo, notes, response } = req.body;
        const updatedBy = req.user.uid;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'IDs array is required'
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const validStatuses = ['open', 'pending', 'in_progress', 'responded', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        const batch = db.batch();
        const results = [];

        for (const id of ids) {
            const docRef = db.collection('messages').doc(id);
            const doc = await docRef.get();

            if (doc.exists) {
                const currentData = doc.data();
                const statusHistory = currentData.statusHistory || [];
                
                statusHistory.push({
                    status,
                    timestamp: admin.firestore.Timestamp.now(),
                    updatedBy,
                    notes: notes || null
                });

                const updateData = {
                    status,
                    statusHistory,
                    updatedAt: admin.firestore.Timestamp.now()
                };

                if (assignedTo !== undefined) {
                    updateData.assignedTo = assignedTo;
                }

                // Include response in history entry if provided
                if (response !== undefined) {
                    // Add response to the latest history entry
                    if (statusHistory.length > 0) {
                        statusHistory[statusHistory.length - 1].response = response;
                    }
                }

                batch.update(docRef, updateData);
                results.push({ id, success: true });
            } else {
                results.push({ id, success: false, error: 'Not found' });
            }
        }

        await batch.commit();

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;

        res.status(200).json({
            success: true,
            message: `Updated ${successCount} contact requests${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
            data: {
                total: results.length,
                success: successCount,
                failed: failureCount,
                results
            }
        });

    } catch (error) {
        console.error('Error bulk updating contact requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to bulk update contact requests',
            error: error.message
        });
    }
};

module.exports = {
    getAllContactRequests,
    getContactRequestById,
    updateContactRequest,
    getContactRequestStats,
    deleteContactRequest,
    bulkUpdateContactRequests,
    getFrontendContactRequests,
    addTestContactRequests,
    fixExistingContactRequests
}; 