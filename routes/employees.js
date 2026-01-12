const express = require('express');
const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all employees
router.get('/', auth, async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true })
      .populate('departments', 'name')
      .select('-password')
      .sort({ createdAt: -1 });
    
    // Add formatted permissions for display
    const formattedEmployees = employees.map(emp => {
      const empObj = emp.toObject();
      
      // Create display permissions array
      const displayPermissions = [];
      if (empObj.permissions?.studentManagement) displayPermissions.push('Student Management');
      if (empObj.permissions?.feeManagement) displayPermissions.push('Fee Management');
      
      empObj.displayPermissions = displayPermissions.length > 0 ? displayPermissions.join(', ') : 'No Permissions';
      
      return empObj;
    });
    
    res.json({
      success: true,
      data: formattedEmployees
    });
  } catch (error) {
    // console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees'
    });
  }
});

// Create new employee
router.post('/', async (req, res) => {
  try {
    const { name, email, password, departments, accessPermissions } = req.body;
    
    // Convert old accessPermissions to new permissions format
    const permissions = {
      studentManagement: accessPermissions?.includes('students') || false,
      feeManagement: accessPermissions?.includes('fees') || false
    };

    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this email already exists'
      });
    }

    const employee = new Employee({
      name,
      email,
      password,
      departments: departments || [],
      permissions
    });

    await employee.save();

    const employeeResponse = employee.toObject();
    delete employeeResponse.password;
    
    // Add display permissions
    const displayPermissions = [];
    if (employeeResponse.permissions?.studentManagement) displayPermissions.push('Student Management');
    if (employeeResponse.permissions?.feeManagement) displayPermissions.push('Fee Management');
    employeeResponse.displayPermissions = displayPermissions.length > 0 ? displayPermissions.join(', ') : 'No Permissions';

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: employeeResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message
    });
  }
});

// Update employee
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, departments, permissions } = req.body;

    const employee = await Employee.findByIdAndUpdate(
      id,
      { 
        name, 
        email, 
        departments, 
        permissions: {
          studentManagement: permissions?.studentManagement || false,
          feeManagement: permissions?.feeManagement || false
        }
      },
      { new: true, runValidators: true }
    ).populate('departments', 'name').select('-password');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: employee
    });
  } catch (error) {
    // console.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message
    });
  }
});

// Delete employee (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    // console.error('Error deleting employee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee'
    });
  }
});

module.exports = router;