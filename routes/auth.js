const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

const router = express.Router();

/**
 * CREATE ADMIN
 */
router.post('/create', async (req, res) => {
  // console.log('POST /api/auth/create called');
  // console.log('Request body:', req.body);
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const admin = new Admin({ email, password });
    await admin.save();

    // console.log('Admin created successfully');
    res.status(201).json({
      success: true,
      message: 'Admin created successfully'
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * ADMIN LOGIN
 */
router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    // console.log('Login attempt:', { email, password: '***' });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email });
    // console.log('Admin found:', admin ? 'Yes' : 'No');
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    // console.log('Password match:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email
      }
    });

  } catch (error) {
    // console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * EMPLOYEE LOGIN
 */
router.post('/employee-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const employee = await Employee.findOne({ email: email.trim().toLowerCase() })
      .populate('departments', 'name');
    
    if (!employee) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await employee.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: employee._id, role: employee.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: employee._id,
        email: employee.email,
        name: employee.name,
        role: employee.role,
        departments: employee.departments,
        permissions: employee.permissions
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET CURRENT USER
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's admin or employee
    let user = await Admin.findById(decoded.id).select('-password');
    if (!user) {
      user = await Employee.findById(decoded.id).select('-password').populate('departments', 'name');
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        departments: user.departments,
        permissions: user.permissions
      }
    });

  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

/**
 * CHANGE PASSWORD
 */
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password cannot be same as current password' });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    // console.error('Change password error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
