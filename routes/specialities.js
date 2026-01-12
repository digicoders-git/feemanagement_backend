const express = require('express');
const Speciality = require('../models/Speciality');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all specialities
router.get('/', auth, async (req, res) => {
  try {
    const user = req.admin || req.user;
    
    let specialities;
    
    // If employee, only return specialities from their assigned departments
    if (user.role === 'employee') {
      const departmentIds = user.departments?.map(dep => dep._id || dep) || [];
      specialities = await Speciality.find({ 
        department: { $in: departmentIds } 
      })
        .populate('department', 'name')
        .sort({ name: 1 });
    } else {
      // Super admin gets all specialities
      specialities = await Speciality.find()
        .populate('department', 'name')
        .sort({ name: 1 });
    }
    
    res.json({ data: specialities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specialities by department
router.get('/department/:departmentId', auth, async (req, res) => {
  try {
    const user = req.admin || req.user;
    const departmentId = req.params.departmentId;
    
    // Check if employee has access to this department
    if (user.role === 'employee') {
      const departmentIds = user.departments?.map(dep => dep._id || dep) || [];
      if (!departmentIds.includes(departmentId)) {
        return res.status(403).json({ 
          message: 'Access denied for this department' 
        });
      }
    }
    
    const specialities = await Speciality.find({ 
      department: departmentId 
    }).sort({ name: 1 });
    
    res.json({ data: specialities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add speciality (super admin only)
router.post('/', auth, async (req, res) => {
  try {
    const { name, department, totalSeats } = req.body;
    
    const existingSpec = await Speciality.findOne({ name, department });
    if (existingSpec) {
      return res.status(400).json({ message: 'Speciality already exists in this department' });
    }

    const speciality = new Speciality({ 
      name, 
      department, 
      totalSeats: totalSeats || 0 
    });
    await speciality.save();
    await speciality.populate('department', 'name');
    
    res.status(201).json({ 
      message: 'Speciality added successfully',
      data: speciality 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update speciality
router.put('/:id', auth, async (req, res) => {
  try {
    const { totalSeats } = req.body;
    const speciality = await Speciality.findByIdAndUpdate(
      req.params.id,
      { totalSeats },
      { new: true }
    ).populate('department', 'name');
    
    if (!speciality) {
      return res.status(404).json({ message: 'Speciality not found' });
    }
    
    res.json({ 
      message: 'Speciality updated successfully',
      data: speciality 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update speciality seats
router.put('/:id/seats', auth, async (req, res) => {
  try {
    const { totalSeats } = req.body;
    const speciality = await Speciality.findByIdAndUpdate(
      req.params.id,
      { totalSeats },
      { new: true }
    ).populate('department', 'name');
    
    if (!speciality) {
      return res.status(404).json({ message: 'Speciality not found' });
    }
    
    res.json({ 
      message: 'Speciality seats updated successfully',
      data: speciality 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete speciality
router.delete('/:id', auth, async (req, res) => {
  try {
    const speciality = await Speciality.findByIdAndDelete(req.params.id);
    if (!speciality) {
      return res.status(404).json({ message: 'Speciality not found' });
    }
    res.json({ message: 'Speciality deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;