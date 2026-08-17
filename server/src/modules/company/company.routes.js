'use strict';
const express = require('express');
const router = express.Router();
const {
  User, Department, Team, Role, StaffTask, Target, CompanyAnnouncement,
  CompanyMeeting, StaffChatMessage, StaffRequest, CompanyConfig, Attendance, AuditLog, Notification
} = require('../../models');
const { authenticate, authorize, requirePermission } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { emitToUser, getIO } = require('../../socket');

// All company management routes require authentication and staff/admin/manager/team_leader roles
router.use(authenticate);

// ── Helper: Log Audit Trail ──────────────────────────────────────────────────
async function createAuditLog(action, performedBy, details) {
  try {
    await AuditLog.create({
      action,
      performedBy,
      details,
    });
  } catch (err) {
    logger.warn('Failed to record company audit log:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. COMPANY CONFIG & ORGANIZATION HIERARCHY
// ══════════════════════════════════════════════════════════════════════════════
router.get('/config', async (req, res) => {
  let config = await CompanyConfig.findOne({ key: 'global' }).lean();
  if (!config) {
    config = await CompanyConfig.create({
      key: 'global',
      companyName: 'ONEWAYFIX',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      holidays: [
        { date: '2026-01-26', name: 'Republic Day' },
        { date: '2026-08-15', name: 'Independence Day' },
        { date: '2026-10-02', name: 'Gandhi Jayanti' },
      ],
      branches: [
        { name: 'Headquarters', city: 'Hyderabad', address: 'Hitech City, Hyderabad, Telangana 500081' },
        { name: 'Bangalore Hub', city: 'Bangalore', address: 'Koramangala, Bangalore, Karnataka 560034' },
      ],
      designations: [
        'Chief Executive Officer', 'Vice President', 'General Manager', 'HR Manager',
        'Operations Manager', 'Finance Manager', 'Support Manager', 'Team Lead', 'Senior Executive', 'Staff', 'Intern'
      ],
      policies: [
        { title: 'Attendance & Leave Policy', content: 'Employees are entitled to 2 paid leaves per month after probation.' },
        { title: 'Workplace Conduct', content: 'ONEWAYFIX maintains zero tolerance for harassment and discrimination.' },
      ],
    });
  }
  res.json({ success: true, data: config });
});

router.put('/config', authorize('admin'), async (req, res) => {
  const updated = await CompanyConfig.findOneAndUpdate(
    { key: 'global' },
    { $set: req.body },
    { new: true, upsert: true }
  );
  await createAuditLog('Company Settings Updated', req.userId, { updatedBy: req.userId });
  res.json({ success: true, message: 'Company settings saved successfully', data: updated });
});

// Organization Tree Chart
router.get('/org-chart', async (req, res) => {
  const staff = await User.find({
    role: { $in: ['admin', 'manager', 'team_leader', 'staff', 'intern'] },
    status: { $ne: 'blocked' },
  }).select('_id name role email phone designation department managerId teamId isOnline avatar').lean();

  const ceo = staff.filter(s => s.role === 'admin');
  const managers = staff.filter(s => s.role === 'manager');
  const teamLeads = staff.filter(s => s.role === 'team_leader');
  const members = staff.filter(s => ['staff', 'intern'].includes(s.role));

  res.json({
    success: true,
    data: { ceo, managers, teamLeads, members, total: staff.length }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. ROLES & PERMISSION MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_ROLES = [
  { name: 'Super Admin', code: 'admin', description: 'Full system control & company settings', isCustom: false, permissions: ['*'] },
  { name: 'HR Manager', code: 'hr_manager', description: 'Manages employee hiring, leave & documents', isCustom: false, permissions: ['manage_users', 'manage_staff', 'manage_leaves'] },
  { name: 'Operations Manager', code: 'ops_manager', description: 'Monitors booking queues & provider dispatch', isCustom: false, permissions: ['manage_bookings', 'manage_providers', 'manage_tasks'] },
  { name: 'Customer Support Manager', code: 'support_manager', description: 'Handles disputes & customer satisfaction', isCustom: false, permissions: ['manage_complaints', 'manage_users'] },
  { name: 'Team Leader', code: 'team_leader', description: 'Leads operational teams & daily targets', isCustom: false, permissions: ['manage_tasks', 'view_team_reports'] },
  { name: 'Senior Staff', code: 'senior_staff', description: 'Experienced operations staff', isCustom: false, permissions: ['manage_bookings', 'manage_providers'] },
  { name: 'Staff', code: 'staff', description: 'General operational employee', isCustom: false, permissions: ['manage_providers'] },
];

router.get('/roles', async (req, res) => {
  let customRoles = await Role.find({}).lean();
  res.json({ success: true, data: { defaultRoles: DEFAULT_ROLES, customRoles } });
});

router.post('/roles', authorize('admin', 'staff', 'manager'), async (req, res) => {
  const { name, code, description, permissions } = req.body;
  if (!name || !code) throw new AppError('Name and code are required', 400);

  const existing = await Role.findOne({ code: code.toLowerCase() });
  if (existing) throw new AppError('Role code already exists', 400);

  const newRole = await Role.create({
    name,
    code: code.toLowerCase(),
    description,
    permissions: permissions || [],
    isCustom: true,
  });

  await createAuditLog('Custom Role Created', req.userId, { roleName: name, code });
  res.status(201).json({ success: true, message: 'Role created successfully', data: newRole });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. DEPARTMENT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/departments', async (req, res) => {
  const depts = await Department.find({}).populate('managerId', 'name email phone avatar').lean();
  res.json({ success: true, data: depts });
});

router.post('/departments', authorize('admin', 'staff', 'manager'), async (req, res) => {
  const { name, code, description, managerId, branch, monthlyTarget } = req.body;
  if (!name || !code) throw new AppError('Name and code are required', 400);

  const dept = await Department.create({
    name, code: code.toUpperCase(), description, managerId, branch, monthlyTarget,
  });

  await createAuditLog('Department Created', req.userId, { departmentName: name });
  res.status(201).json({ success: true, message: 'Department created', data: dept });
});

router.put('/departments/:id', authorize('admin', 'staff', 'manager'), async (req, res) => {
  const updated = await Department.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  res.json({ success: true, message: 'Department updated', data: updated });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. TEAM MANAGEMENT & TRANSFERS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/teams', async (req, res) => {
  const teams = await Team.find({})
    .populate('managerId', 'name phone email avatar')
    .populate('teamLeaderId', 'name phone email avatar')
    .populate('members', 'name phone email role isOnline status')
    .lean();

  res.json({ success: true, data: teams });
});

router.post('/teams', authorize('admin', 'manager'), async (req, res) => {
  const { name, code, department, managerId, teamLeaderId, branch, description, monthlyTarget } = req.body;
  if (!name) throw new AppError('Team name is required', 400);

  const newTeam = await Team.create({
    name,
    code: code || name.substring(0, 3).toUpperCase(),
    department,
    managerId,
    teamLeaderId,
    branch: branch || 'Headquarters',
    description,
    monthlyTarget: monthlyTarget || 0,
  });

  if (teamLeaderId) {
    await User.findByIdAndUpdate(teamLeaderId, { role: 'team_leader', teamId: newTeam._id });
  }

  await createAuditLog('Team Created', req.userId, { teamName: name });
  res.status(201).json({ success: true, message: 'Team created', data: newTeam });
});

router.post('/teams/transfer', authorize('admin', 'manager'), async (req, res) => {
  const { userId, toTeamId, reason } = req.body;
  if (!userId || !toTeamId) throw new AppError('User and destination team required', 400);

  const [user, team] = await Promise.all([
    User.findById(userId),
    Team.findById(toTeamId),
  ]);

  if (!user || !team) throw new AppError('User or Team not found', 404);

  const oldTeamId = user.teamId;
  const oldTeam = oldTeamId ? await Team.findById(oldTeamId) : null;

  // Remove from old team
  if (oldTeam) {
    await Team.findByIdAndUpdate(oldTeamId, { $pull: { members: userId } });
  }

  // Add to new team
  await Team.findByIdAndUpdate(toTeamId, {
    $addToSet: { members: userId },
    $push: {
      transferHistory: {
        userId,
        fromTeam: oldTeam?.name || 'Unassigned',
        toTeam: team.name,
        transferredBy: req.userId,
        reason: reason || 'Operational rebalancing',
      },
    },
  });

  user.teamId = toTeamId;
  await user.save();

  await createAuditLog('Employee Transferred', req.userId, {
    userName: user.name,
    from: oldTeam?.name || 'None',
    to: team.name,
  });

  res.json({ success: true, message: `Successfully transferred ${user.name} to ${team.name}` });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. TARGETS & GOALS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/targets', async (req, res) => {
  const targets = await Target.find({}).sort({ endDate: 1 }).lean();
  res.json({ success: true, data: targets });
});

router.post('/targets', authorize('admin', 'manager'), async (req, res) => {
  const { title, targetType, period, targetValue, assignedType, assignedTo, startDate, endDate, priority, teamName } = req.body;
  if (!title || !targetValue || !startDate || !endDate) {
    throw new AppError('Title, target value, start and end dates are required', 400);
  }

  const target = await Target.create({
    title,
    targetType,
    period: period || 'monthly',
    targetValue,
    currentValue: 0,
    assignedType: assignedType || 'team',
    assignedTo,
    teamName,
    startDate,
    endDate,
    priority: priority || 'normal',
  });

  // Notify team/staff members about the target
  await Notification.create({
    userId: req.userId,
    title: '🎯 New Team Target Created',
    body: `Target "${title}" (${targetValue} units) set for deadline ${new Date(endDate).toLocaleDateString()}.`,
    type: 'system',
  });

  res.status(201).json({ success: true, message: 'Target created', data: target });
});

router.put('/targets/:id', async (req, res) => {
  const target = await Target.findById(req.params.id);
  if (!target) throw new AppError('Target not found', 404);

  if (req.body.currentValue !== undefined) {
    target.currentValue = req.body.currentValue;
    if (target.currentValue >= target.targetValue) {
      target.status = 'completed';
    }
  }
  if (req.body.status) target.status = req.body.status;

  await target.save();
  res.json({ success: true, message: 'Target updated', data: target });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. INTERNAL TASK MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/tasks', async (req, res) => {
  const { filter = 'all' } = req.query;
  let query = {};

  if (filter === 'my_tasks') {
    query.assignedTo = req.userId;
  } else if (req.userRole === 'team_leader' || req.userRole === 'manager') {
    // Show tasks created by or assigned to team
    query.$or = [{ assignedTo: req.userId }, { assignedBy: req.userId }];
  }

  const tasks = await StaffTask.find(query)
    .populate('assignedTo', 'name phone email avatar role')
    .populate('assignedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: tasks });
});

router.post('/tasks', async (req, res) => {
  const { title, description, assignedTo, priority, dueDate, checklist } = req.body;
  if (!title || !assignedTo) throw new AppError('Title and assignee are required', 400);

  const task = await StaffTask.create({
    title,
    description,
    assignedTo,
    assignedBy: req.userId,
    priority: priority || 'medium',
    dueDate: dueDate || new Date(Date.now() + 86400000 * 2), // Default 2 days
    checklist: checklist || [],
  });

  // Real-time socket notification to assignee
  emitToUser(assignedTo.toString(), 'notification:push', {
    title: '📋 New Task Assigned',
    body: `Task "${title}" has been assigned to you. Due by ${new Date(dueDate).toLocaleDateString()}`,
    type: 'system',
  });

  await Notification.create({
    userId: assignedTo,
    title: '📋 New Task Assigned',
    body: `Task "${title}" assigned to you by ${req.user.name || 'Manager'}. Priority: ${priority}.`,
    type: 'system',
    referenceId: task._id,
  });

  res.status(201).json({ success: true, message: 'Task assigned successfully', data: task });
});

router.put('/tasks/:id', async (req, res) => {
  const { status, comment, checklistIndex, checklistDone } = req.body;
  const task = await StaffTask.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  if (status) task.status = status;
  if (comment) {
    task.comments.push({ author: req.userId, text: comment });
  }
  if (checklistIndex !== undefined && task.checklist[checklistIndex]) {
    task.checklist[checklistIndex].done = checklistDone;
  }

  await task.save();

  // If completed, notify task creator
  if (status === 'completed') {
    emitToUser(task.assignedBy.toString(), 'notification:push', {
      title: '✅ Task Completed',
      body: `Task "${task.title}" has been marked completed.`,
      type: 'system',
    });
  }

  res.json({ success: true, message: 'Task updated', data: task });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. ANNOUNCEMENTS MODULE
// ══════════════════════════════════════════════════════════════════════════════
router.get('/announcements', async (req, res) => {
  const announcements = await CompanyAnnouncement.find({})
    .populate('authorId', 'name role avatar')
    .sort({ isPinned: -1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: announcements });
});

router.post('/announcements', authorize('admin', 'manager'), async (req, res) => {
  const { title, message, priority, audience, isPinned, expiryDate } = req.body;
  if (!title || !message) throw new AppError('Title and message required', 400);

  const announcement = await CompanyAnnouncement.create({
    title,
    message,
    priority: priority || 'normal',
    audience: audience || 'all',
    authorId: req.userId,
    isPinned: !!isPinned,
    expiryDate,
  });

  // Push to all active staff members
  const staff = await User.find({ role: { $in: ['admin', 'manager', 'team_leader', 'staff'] } }).select('_id').lean();
  for (const member of staff) {
    await Notification.create({
      userId: member._id,
      title: `📢 Announcement: ${title}`,
      body: message.substring(0, 120),
      type: 'announcement',
      referenceId: announcement._id,
    });
  }

  res.status(201).json({ success: true, message: 'Announcement published', data: announcement });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. INTERNAL MEETINGS MODULE
// ══════════════════════════════════════════════════════════════════════════════
router.get('/meetings', async (req, res) => {
  const meetings = await CompanyMeeting.find({})
    .populate('organizerId', 'name role avatar')
    .populate('participants', 'name role email avatar')
    .sort({ date: 1, time: 1 })
    .lean();

  res.json({ success: true, data: meetings });
});

router.post('/meetings', authorize('admin', 'manager', 'team_leader'), async (req, res) => {
  const { title, date, time, location, meetingLink, participants, agenda } = req.body;
  if (!title || !date || !time) throw new AppError('Title, date, and time required', 400);

  const meeting = await CompanyMeeting.create({
    title,
    date,
    time,
    location: location || 'Online Meeting',
    meetingLink,
    organizerId: req.userId,
    participants: participants || [],
    agenda,
  });

  // Notify participants
  if (participants && participants.length) {
    for (const pId of participants) {
      emitToUser(pId.toString(), 'notification:push', {
        title: '📅 New Meeting Scheduled',
        body: `"${title}" on ${date} at ${time}.`,
        type: 'system',
      });
    }
  }

  res.status(201).json({ success: true, message: 'Meeting scheduled', data: meeting });
});

// ══════════════════════════════════════════════════════════════════════════════
// 9. COMPANY REAL-TIME CHAT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/chat', async (req, res) => {
  const { targetId, chatType = 'direct' } = req.query;

  let query = {};
  if (chatType === 'direct' && targetId) {
    query = {
      $or: [
        { senderId: req.userId, receiverId: targetId },
        { senderId: targetId, receiverId: req.userId },
      ],
    };
  } else if (targetId) {
    query = { targetId, chatType };
  } else {
    query = { chatType: 'announcement' };
  }

  const messages = await StaffChatMessage.find(query)
    .populate('senderId', 'name role avatar')
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  res.json({ success: true, data: messages });
});

router.post('/chat', async (req, res) => {
  const { receiverId, targetId, chatType, message } = req.body;
  if (!message) throw new AppError('Message body required', 400);

  const msg = await StaffChatMessage.create({
    senderId: req.userId,
    receiverId,
    targetId,
    chatType: chatType || 'direct',
    message,
  });

  const populated = await StaffChatMessage.findById(msg._id).populate('senderId', 'name role avatar').lean();

  // Socket IO real-time chat broadcast
  if (receiverId) {
    emitToUser(receiverId.toString(), 'company:chat:message', populated);
  } else {
    // Broadcast to room
    try {
      const io = getIO();
      if (io) io.emit('company:chat:message', populated);
    } catch {}
  }

  res.status(201).json({ success: true, data: populated });
});

// ══════════════════════════════════════════════════════════════════════════════
// 10. ATTENDANCE & LEAVE REQUEST WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════
router.get('/attendance', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const list = await Attendance.find({ date: today }).populate('userId', 'name role department designation').lean();
  res.json({ success: true, data: list });
});

router.post('/attendance/check', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  let rec = await Attendance.findOne({ userId: req.userId, date: today });
  if (!rec) {
    const isLate = now.getHours() >= 10; // After 10:00 AM marked as late
    rec = await Attendance.create({
      userId: req.userId,
      userModel: 'User',
      date: today,
      checkIn: now,
      status: isLate ? 'late' : 'present',
    });
    return res.json({ success: true, message: `Checked in successfully (${rec.status.toUpperCase()})`, data: rec });
  } else {
    rec.checkOut = now;
    await rec.save();
    return res.json({ success: true, message: 'Checked out successfully', data: rec });
  }
});

// Leave / Request management
router.get('/requests', async (req, res) => {
  let query = {};
  if (req.userRole === 'staff' || req.userRole === 'intern') {
    query.userId = req.userId;
  }
  const requests = await StaffRequest.find(query)
    .populate('userId', 'name role department phone email')
    .populate('approvedBy', 'name role')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: requests });
});

router.post('/requests', async (req, res) => {
  const { type, startDate, endDate, reason } = req.body;
  if (!type || !startDate || !endDate || !reason) {
    throw new AppError('Type, dates, and reason are required', 400);
  }

  const newReq = await StaffRequest.create({
    userId: req.userId,
    type,
    startDate,
    endDate,
    reason,
  });

  res.status(201).json({ success: true, message: 'Request submitted for manager approval', data: newReq });
});

router.put('/requests/:id/action', authorize('admin', 'manager', 'team_leader'), async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw new AppError('Invalid status', 400);

  const reqObj = await StaffRequest.findById(req.params.id);
  if (!reqObj) throw new AppError('Request not found', 404);

  reqObj.status = status;
  reqObj.approvedBy = req.userId;
  if (rejectionReason) reqObj.rejectionReason = rejectionReason;

  await reqObj.save();

  // If approved leave, create attendance record as leave
  if (status === 'approved' && reqObj.type === 'leave') {
    const dStr = new Date(reqObj.startDate).toISOString().split('T')[0];
    await Attendance.create({
      userId: reqObj.userId,
      userModel: 'User',
      date: dStr,
      status: 'leave',
    });
  }

  emitToUser(reqObj.userId.toString(), 'notification:push', {
    title: `Request ${status.toUpperCase()}`,
    body: `Your ${reqObj.type.toUpperCase()} request has been ${status}.`,
    type: 'system',
  });

  res.json({ success: true, message: `Request ${status}`, data: reqObj });
});

// ══════════════════════════════════════════════════════════════════════════════
// 11. AUDIT LOGS & WORKFORCE PERFORMANCE ANALYTICS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/audit-logs', authorize('admin'), async (req, res) => {
  const logs = await AuditLog.find({})
    .populate('performedBy', 'name role email')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, data: logs });
});

router.get('/analytics', async (req, res) => {
  const [totalStaff, activeStaff, managers, teamsCount, deptsCount, tasksCompleted, targetsCount] = await Promise.all([
    User.countDocuments({ role: { $in: ['admin', 'staff', 'manager', 'team_leader', 'intern'] } }),
    User.countDocuments({ role: { $in: ['admin', 'staff', 'manager', 'team_leader', 'intern'] }, status: 'active' }),
    User.countDocuments({ role: 'manager' }),
    Team.countDocuments({}),
    Department.countDocuments({}),
    StaffTask.countDocuments({ status: 'completed' }),
    Target.countDocuments({ status: 'active' }),
  ]);

  res.json({
    success: true,
    data: {
      totalStaff,
      activeStaff,
      managers,
      teamsCount,
      deptsCount,
      tasksCompleted,
      targetsCount,
    },
  });
});

module.exports = router;
