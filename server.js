require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// DB connect
connectDB();

app.use(cors({
  origin: ['http://localhost:5000','https://feemanagement-frontend.vercel.app', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'https://feemanagment-full-frontend-backup.onrender.com'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server working!' });
});

// Employees POST route
app.post('/api/employees', async (req, res) => {
  try {
    const Employee = require('./models/Employee');
    const { name, email, password, departments, accessPermissions } = req.body;
    
    const permissions = {
      studentManagement: accessPermissions?.includes('students') || false,
      feeManagement: accessPermissions?.includes('fees') || false
    };

    const employee = new Employee({
      name,
      email,
      password,
      departments: departments || [],
      permissions
    });

    await employee.save();
    
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { name, email, permissions }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message
    });
  }
});

// Employees GET route
app.get('/api/employees', async (req, res) => {
  try {
    const Employee = require('./models/Employee');
    const employees = await Employee.find({ isActive: true })
      .populate('departments', 'name')
      .select('-password');
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// Employees PUT route
app.put('/api/employees/:id', async (req, res) => {
  try {
    const Employee = require('./models/Employee');
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

// All other routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/students');
const feeRoutes = require('./routes/fees');
const notificationRoutes = require('./routes/notifications');
const departmentRoutes = require('./routes/departments');
const specialityRoutes = require('./routes/specialities');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/specialities', specialityRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
