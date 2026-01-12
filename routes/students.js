const express = require('express');
const Student = require('../models/Student');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all active students (only admin added)
router.get('/show-students', auth, async (req, res) => {
  try {
    // Disable caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    let query = { isActive: true };
    
    // If user is employee, filter by their departments
    if (req.user.role === 'employee') {
      const employeeDepartmentIds = req.user.departments.map(dept => dept._id || dept);
      query.department = { $in: employeeDepartmentIds };
    }
    
    const students = await Student.find(query)
      .populate({
        path: 'addedBy',
        select: 'email'
      })
      .populate({
        path: 'department',
        select: 'name description',
        model: 'Department'
      })
      .populate({
        path: 'speciality', 
        select: 'name totalSeats',
        model: 'Speciality'
      })
      .sort({ createdAt: -1 });
    
    // Transform data - only handle null references, no hardcoded values
    const transformedStudents = students.map(student => {
      const studentObj = student.toObject();
      
      // Only set fallback if department is null/undefined
      if (!studentObj.department) {
        studentObj.department = null;
      }
      
      // Only set fallback if speciality is null/undefined  
      if (!studentObj.speciality) {
        studentObj.speciality = null;
      }
      
      return studentObj;
    });
    
    res.json({
      message: `Found ${students.length} active students`,
      count: students.length,
      data: transformedStudents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch students', 
      error: error.message 
    });
  }
});

// Get single student by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: 'addedBy',
        select: 'email'
      })
      .populate({
        path: 'department',
        select: 'name description',
        model: 'Department'
      })
      .populate({
        path: 'speciality',
        select: 'name totalSeats', 
        model: 'Speciality'
      });
    
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found with the provided ID',
        studentId: req.params.id
      });
    }
    
    res.json({
      message: 'Student details retrieved successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch student details', 
      error: error.message 
    });
  }
});

// Add student (admin only)
router.post('/add-student', auth, async (req, res) => {
  try {
    const studentData = {
      ...req.body,
      addedBy: req.admin.id
    };
    const student = new Student(studentData);
    await student.save();
    await student.populate('addedBy', 'email');
    res.status(201).json({
      message: `Student '${student.name}' added successfully`,
      success: true,
      data: student
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      res.status(400).json({ 
        message: `Student with this ${field} already exists`,
        error: `Duplicate ${field}: ${error.keyValue[field]}`
      });
    } else {
      res.status(400).json({ 
        message: 'Failed to add student', 
        error: error.message 
      });
    }
  }
});

// Update student (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    ).populate('addedBy', 'email');
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found for update',
        studentId: req.params.id
      });
    }
    res.json({
      message: `Student '${student.name}' updated successfully`,
      success: true,
      data: student
    });
  } catch (error) {
    res.status(400).json({ 
      message: 'Failed to update student', 
      error: error.message 
    });
  }
});

// Get student fee details
router.get('/:id/fees', auth, async (req, res) => {
  try {
    const Fee = require('../models/Fee');
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found',
        studentId: req.params.id
      });
    }
    
    const fees = await Fee.find({ studentId: req.params.id })
      .populate('addedBy', 'email')
      .sort({ createdAt: -1 });
    
    res.json({
      message: `Found ${fees.length} fee records for ${student.name}`,
      student: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        class: student.class
      },
      fees: fees
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch student fees', 
      error: error.message 
    });
  }
});

// Delete student (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found for deletion',
        studentId: req.params.id
      });
    }
    res.json({ 
      message: `Student '${student.name}' deleted successfully`,
      success: true,
      deletedStudent: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to delete student', 
      error: error.message 
    });
  }
});

module.exports = router;