/**
 * Department / org structure routes (Group 2).
 * Mount at "/" so paths are /api/enterprise/:enterpriseId/departments/...
 */

const express = require('express');
const router = express.Router();
const departmentsController = require('../controllers/enterprise/departmentsController');
const teamsController = require('../controllers/enterprise/teamsController');
const exportController = require('../controllers/enterprise/exportController');
const contactAggregationController = require('../controllers/enterprise/contactAggregationController');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

// Group 3: Contact aggregation & cache (global cache routes first so "cache" is not matched as enterpriseId)
router.get('/api/enterprise/cache/stats', contactAggregationController.getCacheStats);
router.delete('/api/enterprise/cache/clear', contactAggregationController.clearAllCache);
router.delete('/api/enterprise/cache/departments/clear', contactAggregationController.invalidateAllDepartmentCaches);
router.post('/api/enterprise/cache/warm', contactAggregationController.warmCacheForEnterprises);
router.put('/api/enterprise/cache/config', contactAggregationController.updateCacheConfig);
router.get('/api/enterprise/cache/config', contactAggregationController.getCacheConfig);
router.get('/api/enterprise/cache/analytics', contactAggregationController.getCacheAnalytics);

// Group 3: Contact aggregation (enterprise/department scoped)
router.get('/api/enterprise/:enterpriseId/contacts/summary', contactAggregationController.getEnterpriseContactsSummary);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/contacts/summary', contactAggregationController.getDepartmentContactsSummary);
router.get('/api/enterprise/:enterpriseId/contacts/details', contactAggregationController.getEnterpriseContactsWithDetails);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/contacts/details', contactAggregationController.getDepartmentContactsWithDetails);

// Departments
router.get('/api/enterprise/:enterpriseId/departments', departmentsController.getAllDepartments);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId', departmentsController.getDepartmentById);
router.post('/api/enterprise/:enterpriseId/departments', departmentsController.createDepartment);
router.put('/api/enterprise/:enterpriseId/departments/:departmentId', departmentsController.updateDepartment);
router.delete('/api/enterprise/:enterpriseId/departments/:departmentId', departmentsController.deleteDepartment);

// Teams
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/teams', teamsController.getAllTeams);
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/teams', teamsController.createTeam);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.getTeamById);
router.put('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.updateTeam);
router.patch('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.patchTeam);
router.delete('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId', teamsController.deleteTeam);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/members', teamsController.getTeamMembers);
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/members/bulk-add', teamsController.bulkAddEmployeesToTeam);
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/members/bulk-remove', teamsController.bulkRemoveEmployeesFromTeam);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/employees/unassigned', teamsController.getEmployeesNotInTeam);

// Export
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/exports/teams', exportController.exportTeams);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/exports/teams/:teamId', exportController.exportIndividualTeam);
router.get('/api/enterprise/:enterpriseId/exports/teams', exportController.exportTeams);

// Employees
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/employees', departmentsController.getDepartmentEmployees);
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/employees', departmentsController.addEmployee);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.getEmployeeById);
router.put('/api/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.updateEmployee);
router.patch('/api/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId/role', departmentsController.updateEmployeeRole);
router.delete('/api/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId', departmentsController.deleteEmployee);
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId/unassign', departmentsController.unassignEmployee);
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/employees/unassign-all', departmentsController.unassignAllEmployees);

// Team member assign
router.post('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/employees', teamsController.addEmployeeToTeam);
router.delete('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/employees/:employeeId', teamsController.removeEmployeeFromTeam);

router.get('/api/enterprise/:enterpriseId/departments/:departmentId/employees/:employeeId/card', departmentsController.getEmployeeCard);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/query-employee', departmentsController.queryEmployee);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/managers', departmentsController.getDepartmentManagers);

router.get('/api/enterprise/:enterpriseId/employees', departmentsController.getAllEnterpriseEmployees);
router.get('/api/enterprise/:enterpriseId/cards', departmentsController.getAllEnterpriseCards);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/cards', departmentsController.getDepartmentCards);
router.get('/api/enterprise/:enterpriseId/departments/:departmentId/teams/:teamId/cards', departmentsController.getTeamCards);

module.exports = router;
