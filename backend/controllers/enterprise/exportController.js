const { db } = require('../../firebase');
const { logActivity, ACTIONS, RESOURCES } = require('../../utils/logger');

const sendError = (res, status, message, error = null) => {
  console.error(`${message}:`, error);
  res.status(status).send({ success: false, message, ...(error && { error: error.message }) });
};

// Build CSV from rows (array of arrays) without csv-stringify dependency
function toCsv(rows) {
  const escape = (cell) => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`;
  return rows.map(row => row.map(escape).join(',')).join('\r\n');
}

exports.exportTeams = async (req, res) => {
  try {
    const { enterpriseId, departmentId } = req.params;
    if (!enterpriseId) return sendError(res, 400, 'Enterprise ID is required');

    const enterpriseRef = db.collection('enterprise').doc(enterpriseId);
    const enterpriseDoc = await enterpriseRef.get();
    if (!enterpriseDoc.exists) return sendError(res, 404, 'Enterprise not found');

    let teamsSnapshot;
    if (departmentId) {
      const departmentRef = enterpriseRef.collection('departments').doc(departmentId);
      const departmentDoc = await departmentRef.get();
      if (!departmentDoc.exists) return sendError(res, 404, 'Department not found');
      teamsSnapshot = await departmentRef.collection('teams').get();
    } else {
      teamsSnapshot = await db.collectionGroup('teams').get();
    }

    const headers = ['ID', 'Name', 'Description', 'Department', 'Member Count', 'Has Leader', 'Leader Name', 'Created Date', 'Last Updated'];
    const rows = [headers];

    for (const doc of teamsSnapshot.docs) {
      const team = doc.data();
      let departmentName = 'Unknown';
      if (team.departmentRef) {
        try {
          const deptDoc = await team.departmentRef.get();
          departmentName = deptDoc.exists ? deptDoc.data().name : 'Unknown';
        } catch (_) {}
      }
      let leaderName = 'None';
      if (team.leaderRef) {
        try {
          const leaderDoc = await team.leaderRef.get();
          if (leaderDoc.exists) {
            const leader = leaderDoc.data();
            leaderName = `${leader.name || ''} ${leader.surname || ''}`.trim() || `${leader.firstName || ''} ${leader.lastName || ''}`.trim();
          }
        } catch (_) {}
      }
      const createdAt = team.createdAt && team.createdAt.toDate ? team.createdAt.toDate().toISOString().split('T')[0] : 'N/A';
      const updatedAt = team.updatedAt && team.updatedAt.toDate ? team.updatedAt.toDate().toISOString().split('T')[0] : 'N/A';
      rows.push([doc.id, team.name || '', team.description || '', departmentName, team.memberCount || 0, team.leaderId ? 'Yes' : 'No', leaderName, createdAt, updatedAt]);
    }

    const filename = departmentId ? `teams_${enterpriseId}_${departmentId}_${Date.now()}.csv` : `all_teams_${enterpriseId}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    try {
      await logActivity({ action: ACTIONS.EXPORT, resource: RESOURCES.TEAM, userId: req.user?.uid || 'system', resourceId: departmentId || enterpriseId, enterpriseId, departmentId, details: { fileName: filename, teamCount: rows.length - 1 } });
    } catch (_) {}
    res.status(200).send(toCsv(rows));
  } catch (error) {
    sendError(res, 500, 'Error exporting teams', error);
  }
};

exports.exportIndividualTeam = async (req, res) => {
  try {
    const { enterpriseId, departmentId, teamId } = req.params;
    if (!enterpriseId || !departmentId || !teamId) return sendError(res, 400, 'Enterprise ID, Department ID, and Team ID are required');

    const departmentRef = db.collection('enterprise').doc(enterpriseId).collection('departments').doc(departmentId);
    const departmentDoc = await departmentRef.get();
    if (!departmentDoc.exists) return sendError(res, 404, 'Department not found');

    const teamRef = departmentRef.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) return sendError(res, 404, 'Team not found');

    const team = teamDoc.data();
    let leaderName = 'None';
    if (team.leaderRef) {
      try {
        const leaderDoc = await team.leaderRef.get();
        if (leaderDoc.exists) {
          const leader = leaderDoc.data();
          leaderName = `${leader.name || ''} ${leader.surname || ''}`.trim() || `${leader.firstName || ''} ${leader.lastName || ''}`.trim();
        }
      } catch (_) {}
    }
    const createdAt = team.createdAt && team.createdAt.toDate ? team.createdAt.toDate().toISOString().split('T')[0] : 'N/A';
    const updatedAt = team.updatedAt && team.updatedAt.toDate ? team.updatedAt.toDate().toISOString().split('T')[0] : 'N/A';

    const headers = ['ID', 'Name', 'Description', 'Department', 'Member Count', 'Has Leader', 'Leader Name', 'Created Date', 'Last Updated'];
    const rows = [
      headers,
      [teamId, team.name || '', team.description || '', departmentDoc.data().name || 'Unknown', team.memberCount || 0, team.leaderId ? 'Yes' : 'No', leaderName, createdAt, updatedAt]
    ];

    const filename = `team_${teamId}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    try {
      await logActivity({ action: ACTIONS.EXPORT, resource: RESOURCES.TEAM, userId: req.user?.uid || 'system', resourceId: teamId, enterpriseId, departmentId, details: { fileName: filename } });
    } catch (_) {}
    res.status(200).send(toCsv(rows));
  } catch (error) {
    sendError(res, 500, 'Error exporting team', error);
  }
};
