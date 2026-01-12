require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// DB connect
connectDB();

app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:5173', 'http://localhost:5174'],
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
  // console.log('POST /api/employees called');
  // console.log('Body:', req.body);
  
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
      data: { name, email }
    });
  } catch (error) {
    // console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create employee',
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  // console.log(`404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
});