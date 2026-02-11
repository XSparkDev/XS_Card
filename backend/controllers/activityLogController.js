const { db, admin } = require('../firebase');
const { getActivitiesByAction, getActivitiesByResource, ACTIONS, RESOURCES, logActivity } = require('../utils/logger');

// Helper function for standardized error responses
const sendError = (res, status, message, error = null) => {
  console.error(`${message}:`, error);
  res.status(status).json({ 
    success: false,
    message,
    ...(error && { error: error.message }),
    timestamp: new Date().toISOString()
  });
};

// Add debug request information
const logRequestInfo = (req) => {
  console.log('------ Activity Log Request ------');
  console.log(`Path: ${req.path}`);
  console.log(`Method: ${req.method}`);
  console.log('Query parameters:', req.query);
  console.log('Headers:', req.headers);
  console.log('User:', req.user?.uid || 'Not authenticated');
  console.log('----------------------------------');
};

/**
 * Get activities by action
 */
exports.getByAction = async (req, res) => {
  try {
    logRequestInfo(req);
    const { action } = req.params;
    
    // Validate action
    if (!action || !Object.values(ACTIONS).includes(action)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or missing action parameter',
        validActions: Object.values(ACTIONS)
      });
    }
    
    // Build options from query parameters
    const options = {
      userId: req.query.userId,
      resource: req.query.resource,
      status: req.query.status,
      limit: req.query.limit,
      orderDirection: req.query.order,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    
    console.log('Querying activities with options:', options);
    
    // Validate resource if provided
    if (options.resource && !Object.values(RESOURCES).includes(options.resource)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid resource parameter',
        validResources: Object.values(RESOURCES)
      });
    }
    
    try {
      // Try with normal query first
      const activities = await getActivitiesByAction(action, options);
      
      console.log(`Found ${activities.length} activities for action: ${action}`);
      
      // Log this activity view
      await logActivity({
        action: ACTIONS.VIEW,
        resource: RESOURCES.ACTIVITY_LOG,
        userId: req.user?.uid,
        details: {
          operation: 'get_activities_by_action',
          action: action,
          count: activities.length,
          filters: options
        }
      });
      
      res.status(200).json({
        success: true,
        count: activities.length,
        action,
        filters: options,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('action', '==', action);
        
        // Add limit
        const limit = options.limit ? parseInt(options.limit) : 50;
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        // Process results
        const activities = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            action: data.action,
            resource: data.resource,
            userId: data.userId,
            resourceId: data.resourceId,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            status: data.status || 'success',
            details: data.details || {}
          });
        });
        
        // Sort manually (client-side) since we can't use server-side sorting
        activities.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          // Sort descending by default (newest first)
          return options.orderDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });
        
        // Log this activity view with fallback
        await logActivity({
          action: ACTIONS.VIEW,
          resource: RESOURCES.ACTIVITY_LOG,
          userId: req.user?.uid,
          details: {
            operation: 'get_activities_by_action_fallback',
            action: action,
            count: activities.length,
            filters: options,
            note: 'Used client-side sorting due to missing index'
          }
        });
        
        const indexUrlMatch = queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        return res.status(200).json({
          success: true,
          count: activities.length,
          action,
          filters: options,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          ...(indexUrlMatch && { indexUrl: indexUrlMatch[0] })
        });
      }
      
      // If it's not an index issue or fallback fails, re-throw the error
      throw queryError;
    }
    
  } catch (error) {
    // Log the error
    await logActivity({
      action: ACTIONS.ERROR,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      status: 'error',
      details: {
        operation: 'get_activities_by_action',
        error: error.message,
        action: req.params.action
      }
    });
    
    sendError(res, 500, 'Failed to retrieve activity logs', error);
  }
};

/**
 * Get activities by resource
 */
exports.getByResource = async (req, res) => {
  try {
    logRequestInfo(req);
    const { resource } = req.params;
    
    // Validate resource
    if (!resource || !Object.values(RESOURCES).includes(resource)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or missing resource parameter',
        validResources: Object.values(RESOURCES)
      });
    }
    
    // Build options from query parameters
    const options = {
      userId: req.query.userId,
      action: req.query.action,
      status: req.query.status,
      limit: req.query.limit,
      orderDirection: req.query.order,
      startTime: req.query.startTime,
      endTime: req.query.endTime
    };
    
    console.log('Querying activities with options:', options);
    
    // Validate action if provided
    if (options.action && !Object.values(ACTIONS).includes(options.action)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid action parameter',
        validActions: Object.values(ACTIONS)
      });
    }
    
    try {
      const activities = await getActivitiesByResource(resource, options);
      
      console.log(`Found ${activities.length} activities for resource: ${resource}`);
      
      // Log this activity view
      await logActivity({
        action: ACTIONS.VIEW,
        resource: RESOURCES.ACTIVITY_LOG,
        userId: req.user?.uid,
        details: {
          operation: 'get_activities_by_resource',
          resource: resource,
          count: activities.length,
          filters: options
        }
      });
      
      res.status(200).json({
        success: true,
        count: activities.length,
        resource,
        filters: options,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('resource', '==', resource);
        
        // Add additional filters if needed
        if (options.action) {
          query = query.where('action', '==', options.action);
        }
        
        if (options.userId) {
          query = query.where('userId', '==', options.userId);
        }
        
        // Add limit
        const limit = options.limit ? parseInt(options.limit) : 50;
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        // Process results
        const activities = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            action: data.action,
            resource: data.resource,
            userId: data.userId,
            resourceId: data.resourceId,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            status: data.status || 'success',
            details: data.details || {}
          });
        });
        
        // Sort manually (client-side) since we can't use server-side sorting
        activities.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          // Sort descending by default (newest first)
          return options.orderDirection === 'asc' ? timeA - timeB : timeB - timeA;
        });
        
        // Log this activity view with fallback
        await logActivity({
          action: ACTIONS.VIEW,
          resource: RESOURCES.ACTIVITY_LOG,
          userId: req.user?.uid,
          details: {
            operation: 'get_activities_by_resource_fallback',
            resource: resource,
            count: activities.length,
            filters: options,
            note: 'Used client-side sorting due to missing index'
          }
        });
        
        const indexUrlMatch = queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        return res.status(200).json({
          success: true,
          count: activities.length,
          resource,
          filters: options,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          ...(indexUrlMatch && { indexUrl: indexUrlMatch[0] })
        });
      }
      
      // If it's not an index issue or fallback fails, re-throw the error
      throw queryError;
    }
    
  } catch (error) {
    // Log the error
    await logActivity({
      action: ACTIONS.ERROR,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      status: 'error',
      details: {
        operation: 'get_activities_by_resource',
        error: error.message,
        resource: req.params.resource
      }
    });
    
    sendError(res, 500, 'Failed to retrieve activity logs', error);
  }
};

/**
 * Get user activity history
 */
exports.getByUser = async (req, res) => {
  try {
    logRequestInfo(req);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Verify the user exists
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }
    
    try {
      // Create query for user's activities
      let query = db.collection('activityLogs')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(req.query.limit ? parseInt(req.query.limit) : 50);
      
      // Execute query
      const snapshot = await query.get();
      
      // Process results
      const activities = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          action: data.action,
          resource: data.resource,
          timestamp: data.timestamp?.toDate?.() || data.timestamp,
          status: data.status,
          details: data.details
        });
      });
      
      console.log(`Found ${activities.length} activities for user: ${userId}`);
      
      // Log this activity view
      await logActivity({
        action: ACTIONS.VIEW,
        resource: RESOURCES.ACTIVITY_LOG,
        userId: req.user?.uid,
        details: {
          operation: 'get_user_history',
          targetUserId: userId,
          count: activities.length
        }
      });
      
      res.status(200).json({
        success: true,
        userId,
        count: activities.length,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('userId', '==', userId);
        
        // Add limit
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        // Process results
        const activities = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            action: data.action,
            resource: data.resource,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            status: data.status,
            details: data.details
          });
        });
        
        // Sort manually by timestamp (newest first)
        activities.sort((a, b) => {
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          return timeB - timeA;
        });
        
        console.log(`Found ${activities.length} activities for user: ${userId} (client-side sorting)`);
        
        // Log this activity view with fallback
        await logActivity({
          action: ACTIONS.VIEW,
          resource: RESOURCES.ACTIVITY_LOG,
          userId: req.user?.uid,
          details: {
            operation: 'get_user_history_fallback',
            targetUserId: userId,
            count: activities.length,
            note: 'Used client-side sorting due to missing index'
          }
        });
        
        const indexUrlMatch = queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        return res.status(200).json({
          success: true,
          userId,
          count: activities.length,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          ...(indexUrlMatch && { indexUrl: indexUrlMatch[0] })
        });
      }
      
      throw queryError;
    }
    
  } catch (error) {
    // Log the error
    await logActivity({
      action: ACTIONS.ERROR,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      status: 'error',
      details: {
        operation: 'get_user_history',
        error: error.message,
        targetUserId: req.params.userId
      }
    });
    
    sendError(res, 500, 'Failed to retrieve user activity history', error);
  }
};

/**
 * Get activities by enterprise
 */
exports.getByEnterprise = async (req, res) => {
  try {
    logRequestInfo(req);
    const { enterpriseId } = req.params;
    
    if (!enterpriseId) {
      return res.status(400).json({ 
        success: false,
        message: 'Enterprise ID is required'
      });
    }
    
    // Verify the enterprise exists
    const enterpriseDoc = await db.collection('enterprise').doc(enterpriseId).get();
    if (!enterpriseDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'Enterprise not found'
      });
    }
    
    try {
      // Create query for enterprise activities
      let query = db.collection('activityLogs')
        .where('enterpriseId', '==', enterpriseId)
        .orderBy('timestamp', 'desc')
        .limit(req.query.limit ? parseInt(req.query.limit) : 50);
      
      // Execute query
      const snapshot = await query.get();
      
      // Process results
      const activities = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          action: data.action,
          resource: data.resource,
          userId: data.userId,
          resourceId: data.resourceId,
          timestamp: data.timestamp?.toDate?.() || data.timestamp,
          status: data.status,
          details: data.details
        });
      });
      
      console.log(`Found ${activities.length} activities for enterprise: ${enterpriseId}`);
      
      // Log this activity view
      await logActivity({
        action: ACTIONS.VIEW,
        resource: RESOURCES.ACTIVITY_LOG,
        userId: req.user?.uid,
        details: {
          operation: 'get_enterprise_activities',
          enterpriseId: enterpriseId,
          count: activities.length
        }
      });
      
      res.status(200).json({
        success: true,
        enterpriseId,
        count: activities.length,
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback to a simpler query without sorting
        let query = db.collection('activityLogs').where('enterpriseId', '==', enterpriseId);
        
        // Add limit
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        // Process results
        const activities = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          activities.push({
            id: doc.id,
            action: data.action,
            resource: data.resource,
            userId: data.userId,
            resourceId: data.resourceId,
            timestamp: data.timestamp?.toDate?.() || data.timestamp,
            status: data.status,
            details: data.details
          });
        });
        
        // Sort manually by timestamp (newest first)
        activities.sort((a, b) => {
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          const timeA = getTime(a.timestamp);
          const timeB = getTime(b.timestamp);
          
          return timeB - timeA;
        });
        
        console.log(`Found ${activities.length} activities for enterprise: ${enterpriseId} (client-side sorting)`);
        
        // Log this activity view with fallback
        await logActivity({
          action: ACTIONS.VIEW,
          resource: RESOURCES.ACTIVITY_LOG,
          userId: req.user?.uid,
          details: {
            operation: 'get_enterprise_activities_fallback',
            enterpriseId: enterpriseId,
            count: activities.length,
            note: 'Used client-side sorting due to missing index'
          }
        });
        
        const indexUrlMatch = queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        return res.status(200).json({
          success: true,
          enterpriseId,
          count: activities.length,
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side sorting due to missing index. Please create the required index for server-side sorting.',
          ...(indexUrlMatch && { indexUrl: indexUrlMatch[0] })
        });
      }
      
      throw queryError;
    }
    
  } catch (error) {
    // Log the error
    await logActivity({
      action: ACTIONS.ERROR,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      status: 'error',
      details: {
        operation: 'get_enterprise_activities',
        error: error.message,
        enterpriseId: req.params.enterpriseId
      }
    });
    
    sendError(res, 500, 'Failed to retrieve enterprise activity logs', error);
  }
};

/**
 * Get activities by time range
 */
exports.getByTimeRange = async (req, res) => {
  try {
    logRequestInfo(req);
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ 
        success: false,
        message: 'Both startTime and endTime query parameters are required'
      });
    }
    
    try {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startTime));
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endTime));
      
      // Create query for time range
      let query = db.collection('activityLogs')
        .where('timestamp', '>=', startTimestamp)
        .where('timestamp', '<=', endTimestamp)
        .orderBy('timestamp', 'desc')
        .limit(req.query.limit ? parseInt(req.query.limit) : 50);
      
      // Execute query
      const snapshot = await query.get();
      
      // Process results
      const activities = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          action: data.action,
          resource: data.resource,
          userId: data.userId,
          resourceId: data.resourceId,
          timestamp: data.timestamp?.toDate?.() || data.timestamp,
          status: data.status,
          details: data.details
        });
      });
      
      console.log(`Found ${activities.length} activities in time range`);
      
      // Log this activity view
      await logActivity({
        action: ACTIONS.VIEW,
        resource: RESOURCES.ACTIVITY_LOG,
        userId: req.user?.uid,
        details: {
          operation: 'get_activities_by_time_range',
          startTime,
          endTime,
          count: activities.length
        }
      });
      
      res.status(200).json({
        success: true,
        count: activities.length,
        timeRange: { startTime, endTime },
        activities,
        timestamp: new Date().toISOString()
      });
    } catch (queryError) {
      if (queryError.code === 9 && queryError.message.includes('requires an index')) {
        console.log('Missing index detected, using fallback query method');
        
        // Fallback: get all activities and filter client-side
        let query = db.collection('activityLogs');
        const limit = req.query.limit ? parseInt(req.query.limit) : 100; // Get more for filtering
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        // Process and filter results
        const startTimeMs = new Date(startTime).getTime();
        const endTimeMs = new Date(endTime).getTime();
        const activities = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate?.() || data.timestamp;
          const timestampMs = timestamp instanceof Date ? timestamp.getTime() : 
                             (timestamp?._seconds ? timestamp._seconds * 1000 : 0);
          
          if (timestampMs >= startTimeMs && timestampMs <= endTimeMs) {
            activities.push({
              id: doc.id,
              action: data.action,
              resource: data.resource,
              userId: data.userId,
              resourceId: data.resourceId,
              timestamp: timestamp,
              status: data.status,
              details: data.details
            });
          }
        });
        
        // Sort by timestamp (newest first)
        activities.sort((a, b) => {
          const getTime = (timestamp) => {
            if (timestamp instanceof Date) return timestamp.getTime();
            if (timestamp?._seconds) return timestamp._seconds * 1000;
            return 0;
          };
          
          return getTime(b.timestamp) - getTime(a.timestamp);
        });
        
        console.log(`Found ${activities.length} activities in time range (client-side filtering)`);
        
        // Log this activity view with fallback
        await logActivity({
          action: ACTIONS.VIEW,
          resource: RESOURCES.ACTIVITY_LOG,
          userId: req.user?.uid,
          details: {
            operation: 'get_activities_by_time_range_fallback',
            startTime,
            endTime,
            count: activities.length,
            note: 'Used client-side filtering due to missing index'
          }
        });
        
        const indexUrlMatch = queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        return res.status(200).json({
          success: true,
          count: activities.length,
          timeRange: { startTime, endTime },
          activities,
          timestamp: new Date().toISOString(),
          note: 'This response used client-side filtering due to missing index. Please create the required index for server-side filtering.',
          ...(indexUrlMatch && { indexUrl: indexUrlMatch[0] })
        });
      }
      
      throw queryError;
    }
    
  } catch (error) {
    // Log the error
    await logActivity({
      action: ACTIONS.ERROR,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      status: 'error',
      details: {
        operation: 'get_activities_by_time_range',
        error: error.message
      }
    });
    
    sendError(res, 500, 'Failed to retrieve activity logs by time range', error);
  }
};

/**
 * Export activities (CSV format)
 */
exports.exportActivities = async (req, res) => {
  try {
    logRequestInfo(req);
    
    // Build query based on query parameters
    let query = db.collection('activityLogs');
    
    // Add filters
    if (req.query.action && Object.values(ACTIONS).includes(req.query.action)) {
      query = query.where('action', '==', req.query.action);
    }
    
    if (req.query.resource && Object.values(RESOURCES).includes(req.query.resource)) {
      query = query.where('resource', '==', req.query.resource);
    }
    
    if (req.query.userId) {
      query = query.where('userId', '==', req.query.userId);
    }
    
    if (req.query.enterpriseId) {
      query = query.where('enterpriseId', '==', req.query.enterpriseId);
    }
    
    // Add time range filters
    if (req.query.startTime) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(req.query.startTime));
      query = query.where('timestamp', '>=', startTimestamp);
    }
    
    // Limit for export (max 1000 records)
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 1000) : 1000;
    query = query.limit(limit);
    
    // Execute query
    const snapshot = await query.get();
    
    // Build CSV
    const csvRows = ['Timestamp,Action,Resource,User ID,Resource ID,Status,Details'];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate?.() || data.timestamp;
      const timestampStr = timestamp instanceof Date ? timestamp.toISOString() : 
                          (timestamp?._seconds ? new Date(timestamp._seconds * 1000).toISOString() : '');
      
      const detailsStr = JSON.stringify(data.details || {}).replace(/"/g, '""'); // Escape quotes
      
      csvRows.push([
        timestampStr,
        data.action || '',
        data.resource || '',
        data.userId || '',
        data.resourceId || '',
        data.status || '',
        `"${detailsStr}"`
      ].join(','));
    });
    
    const csv = csvRows.join('\n');
    
    // Log this export
    await logActivity({
      action: ACTIONS.EXPORT,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      details: {
        operation: 'export_activities',
        count: snapshot.size,
        filters: req.query
      }
    });
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csv);
    
  } catch (error) {
    // Log the error
    await logActivity({
      action: ACTIONS.ERROR,
      resource: RESOURCES.ACTIVITY_LOG,
      userId: req.user?.uid,
      status: 'error',
      details: {
        operation: 'export_activities',
        error: error.message
      }
    });
    
    sendError(res, 500, 'Failed to export activity logs', error);
  }
};
