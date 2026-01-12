const express = require('express');
const Department = require('../models/Department');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all departments
router.get('/', auth, async (req, res) => {
  try {
    const user = req.admin || req.user;
    
    let departments;
    
    // If employee, only return their assigned departments
    if (user.role === 'employee') {
      const departmentIds = user.departments?.map(dep => dep._id || dep) || [];
      departments = await Department.find({ _id: { $in: departmentIds } }).sort({ name: 1 });
    } else {
      // Super admin gets all departments
      departments = await Department.find().sort({ name: 1 });
    }
    
    res.json({ data: departments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add department (super admin only)
router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const existingDept = await Department.findOne({ name });
    if (existingDept) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const department = new Department({ name, description });
    await department.save();
    
    res.status(201).json({ 
      message: 'Department added successfully',
      data: department 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update department
router.put('/:id', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );
    
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    
    res.json({ 
      message: 'Department updated successfully',
      data: department 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete department
router.delete('/:id', auth, async (req, res) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;