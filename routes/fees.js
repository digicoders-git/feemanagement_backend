const express = require('express');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const auth = require('../middleware/auth');
const {
  checkEmployeePermission,
  filterByDepartmentAccess
} = require('../middleware/role');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

// Get all fees with department filtering
router.get('/', auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;
    
    // Apply department filter based on user access
    let studentFilter = filterByDepartmentAccess(user, {});
    
    const students = await Student.find(studentFilter).select('_id');
    const studentIds = students.map(s => s._id);

    const fees = await Fee.find({ studentId: { $in: studentIds } })
      .populate({
        path: 'studentId', 
        select: 'name rollNumber department class email phone',
        populate: {
          path: 'department',
          select: 'name'
        }
      })
      .populate('addedBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: `Found ${fees.length} fee records`,
      count: fees.length,
      data: fees
    });
  } catch (error) {
    // console.error('Error fetching fees:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch fees', 
      error: error.message 
    });
  }
});

// Add fee
router.post('/', auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;
    
    // console.log('Fee creation request received:', {
    //   body: req.body,
    //   user: user.id || user._id
    // });
    
    // Check department access for employees
    if (user.role === 'employee') {
      const student = await Student.findById(req.body.studentId);
      if (student) {
        const hasAccess = user.departments.some(dep => 
          (dep._id ? dep._id.toString() : dep.toString()) === student.department.toString()
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied for this department'
          });
        }
      }
    }
    
    const feeData = {
      ...req.body,
      addedBy: user.id || user._id
    };

    // console.log('Processed fee data:', feeData);

    // Convert DD-MM-YYYY to Date
    ['dueDate', 'paidDate'].forEach(field => {
      if (feeData[field] && typeof feeData[field] === 'string') {
        const [day, month, year] = feeData[field].split('-');
        feeData[field] = new Date(year, month - 1, day);
      }
    });

    // Status logic
    if (feeData.paidAmount && feeData.paidAmount > 0) {
      feeData.status = 'paid';
      feeData.paidDate = feeData.paidDate || new Date();
    } else {
      feeData.status = 'pending';
      feeData.paidAmount = 0;
    }

    const fee = new Fee(feeData);
    await fee.save();
    
    // console.log('Fee saved successfully:', fee._id);
    
    // Properly populate the fee with student and admin details
    await fee.populate([
      { path: 'studentId', select: 'name rollNumber email phone class department' },
      { path: 'addedBy', select: 'name email' }
    ]);

    // console.log('Fee populated successfully:', {
    //   feeId: fee._id,
    //   studentName: fee.studentId?.name,
    //   addedBy: fee.addedBy?.name
    // });

    res.status(201).json({
      success: true,
      message: `Fee '${fee.feeType}' added successfully for ${fee.studentId.name}`,
      data: fee
    });
  } catch (error) {
    // console.error('Fee creation error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Failed to add fee', 
      error: error.message 
    });
  }
});

// Get due fees
router.get('/due', auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;
    
    let studentFilter = filterByDepartmentAccess(user, {});
    const students = await Student.find(studentFilter).select('_id');
    const studentIds = students.map(s => s._id);

    const dueFees = await Fee.find({
      studentId: { $in: studentIds },
      status: { $ne: 'paid' }
    }).populate('studentId', 'name rollNumber email phone')
      .populate('addedBy', 'name email');

    res.json({
      success: true,
      data: dueFees
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Get upcoming fees
router.get('/upcoming', auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    let studentFilter = filterByDepartmentAccess(user, {});
    const students = await Student.find(studentFilter).select('_id');
    const studentIds = students.map(s => s._id);

    const upcomingFees = await Fee.find({
      studentId: { $in: studentIds },
      status: 'pending',
      dueDate: { $gte: new Date(), $lte: nextWeek }
    }).populate('studentId', 'name rollNumber email phone')
      .populate('addedBy', 'name email');

    res.json({
      success: true,
      data: upcomingFees
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

// Update fee
router.put('/:id', csrfProtection, auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;

    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

    // Check department access for employees
    if (user.role === 'employee') {
      const student = await Student.findById(fee.studentId);
      if (student) {
        const hasAccess = user.departments.some(dep => 
          (dep._id ? dep._id.toString() : dep.toString()) === student.department.toString()
        );
        
        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied for this department'
          });
        }
      }
    }

    Object.assign(fee, req.body, { updatedBy: user._id || user.id, updatedAt: new Date() });
    await fee.save();

    res.json({ 
      success: true,
      message: 'Fee updated successfully', 
      data: fee 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      message: 'Failed to update fee', 
      error: error.message 
    });
  }
});

// Mark fee as paid
router.put('/:id/pay', csrfProtection, auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;

    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

    const student = await Student.findById(fee.studentId);
    
    // Check department access for employees
    if (user.role === 'employee') {
      const hasAccess = user.departments.some(dep => 
        (dep._id ? dep._id.toString() : dep.toString()) === student.department.toString()
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this department'
        });
      }
    }

    fee.status = 'paid';
    fee.paidAmount = fee.amount;
    fee.paidDate = new Date();
    fee.updatedBy = user._id || user.id;
    await fee.save();

    res.json({ 
      success: true,
      message: `Payment received for ${student.name}`, 
      data: fee 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to process payment', 
      error: error.message 
    });
  }
});

// Delete fee
router.delete('/:id', csrfProtection, auth, checkEmployeePermission('feeManagement'), async (req, res) => {
  try {
    const user = req.admin || req.user;

    const fee = await Fee.findById(req.params.id).populate('studentId', 'name department');
    if (!fee) return res.status(404).json({ success: false, message: 'Fee not found' });

    // Check department access for employees
    if (user.role === 'employee') {
      const hasAccess = user.departments.some(dep => 
        (dep._id ? dep._id.toString() : dep.toString()) === fee.studentId.department.toString()
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this department'
        });
      }
    }

    await Fee.findByIdAndDelete(req.params.id);
    res.json({ 
      success: true,
      message: `Fee record deleted for ${fee.studentId.name}` 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete fee', 
      error: error.message 
    });
  }
});

module.exports = router;