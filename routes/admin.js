const express = require('express');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const auth = require('../middleware/auth');
const Admin = require('../models/Admin');
const { superAdminOnly } = require('../middleware/role');
const bcrypt = require('bcryptjs');

const router = express.Router();

/* =========================
   DASHBOARD STATS (RBAC ENABLED)
========================= */
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = req.admin || req.user;

    // Allow all authenticated users to access dashboard
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 🏥 Department filter
    let departmentFilter = {};
    if (user.role !== 'super_admin') {
      const departmentIds = user.departments?.map(dep => dep._id || dep) || [];
      departmentFilter = {
        department: { $in: departmentIds }
      };
    }

    // 👨‍🎓 Students
    const studentsQuery = user.role === 'super_admin' || user.permissions?.studentManagement
      ? departmentFilter
      : { _id: null };

    const students = await Student.find(studentsQuery);
    const totalStudents = students.length;

    // 💰 Fees - Get student IDs first for department filtering
    let studentIds = [];
    if (user.role !== 'super_admin') {
      studentIds = students.map(s => s._id);
    }

    const feeQuery = user.role === 'super_admin' 
      ? {} 
      : { studentId: { $in: studentIds } };

    const totalFees = await Fee.countDocuments(feeQuery);
    const pendingFees = await Fee.countDocuments({ ...feeQuery, status: { $ne: 'paid' } });
    const overdueFees = await Fee.countDocuments({ ...feeQuery, status: 'overdue' });
    const paidFees = await Fee.countDocuments({ ...feeQuery, status: 'paid' });

    // 🎯 Full / Pending students
    let fullFeesPaidStudents = 0;
    let pendingStudents = 0;

    for (const student of students) {
      const studentFees = await Fee.find({ studentId: student._id });
      const totalPaidAmount = studentFees
        .filter(fee => fee.status === 'paid')
        .reduce((sum, fee) => sum + (fee.paidAmount || fee.amount || 0), 0);

      const totalFeeAmount = student.totalFee || 0;

      if (totalPaidAmount >= totalFeeAmount && totalFeeAmount > 0) {
        fullFeesPaidStudents++;
      } else if (totalFeeAmount > 0) {
        pendingStudents++;
      }
    }

    // 💵 Total amount collected
    const totalAmountResult = await Fee.aggregate([
      { $match: { ...feeQuery, status: 'paid' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$paidAmount', '$amount'] } } } }
    ]);
    const totalAmountCollected = totalAmountResult[0]?.total || 0;

    // ⏳ Pending amount
    const pendingAmountResult = await Fee.aggregate([
      { $match: { ...feeQuery, status: { $ne: 'paid' } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pendingAmount = pendingAmountResult[0]?.total || 0;

    res.json({
      success: true,
      role: user.role,
      permissions: user.permissions,
      totalStudents,
      totalFees,
      pendingFees,
      overdueFees,
      paidFees,
      fullFeesPaidStudents,
      pendingStudents,
      totalAmountCollected,
      pendingAmount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // console.error('Dashboard stats error:', error);
    res.status(500).json({ message: error.message });
  }
});

/* =========================
   ADMIN CRUD (Super Admin APIs)
   - Create / Update / Delete / List Admins
========================= */

// Create admin
router.post('/create-admin', auth, superAdminOnly, async (req, res) => {
  try {
    const { email, password, role, departments, permissions } = req.body;

    if (!email || !role) {
      return res.status(400).json({ message: 'Email and role are required' });
    }

    const existing = await Admin.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Admin with this email already exists' });

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash('admin123', 10);

    const newAdmin = new Admin({
      email,
      password: hashedPassword,
      role,
      departments: departments || [],
      permissions: permissions || { student: false, fee: false }
    });

    await newAdmin.save();

    res.status(201).json({
      message: `Admin '${email}' created successfully`,
      success: true,
      data: {
        id: newAdmin._id,
        email: newAdmin.email,
        role: newAdmin.role,
        departments: newAdmin.departments,
        permissions: newAdmin.permissions
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create admin', error: error.message });
  }
});

// Get all admins
router.get('/all', auth, superAdminOnly, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json({ message: `Found ${admins.length} admins`, count: admins.length, data: admins });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch admins', error: error.message });
  }
});

// Update admin
router.put('/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { password, departments, permissions, role } = req.body;
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    if (password) admin.password = await bcrypt.hash(password, 10);
    if (departments) admin.departments = departments;
    if (permissions) admin.permissions = permissions;
    if (role) admin.role = role;

    await admin.save();

    res.json({ message: `Admin '${admin.email}' updated successfully`, success: true, data: admin });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update admin', error: error.message });
  }
});

// Delete admin
router.delete('/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    await admin.deleteOne();
    res.json({ message: `Admin '${admin.email}' deleted successfully`, success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete admin', error: error.message });
  }
});

module.exports = router;

