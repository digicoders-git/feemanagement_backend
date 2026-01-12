require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.use(express.json());

// Mock data
const mockFees = [
  {
    _id: '507f1f77bcf86cd799439011',
    feeType: 'Tuition Fee',
    amount: 5000,
    status: 'paid',
    dueDate: '2024-01-15',
    paidDate: '2024-01-10',
    studentId: {
      _id: '507f1f77bcf86cd799439012',
      name: 'John Doe',
      rollNumber: 'STU001',
      class: '10th'
    },
    addedBy: { email: 'admin@school.com' },
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    _id: '507f1f77bcf86cd799439013',
    feeType: 'Library Fee',
    amount: 500,
    status: 'pending',
    dueDate: '2024-02-15',
    studentId: {
      _id: '507f1f77bcf86cd799439014',
      name: 'Jane Smith',
      rollNumber: 'STU002',
      class: '9th'
    },
    addedBy: { email: 'admin@school.com' },
    createdAt: '2024-01-05T00:00:00.000Z'
  }
];

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Mock server is working!' });
});

// Mock fees API
app.get('/api/fees', (req, res) => {
  res.json({
    message: `Found ${mockFees.length} fee records (MOCK DATA)`,
    count: mockFees.length,
    data: mockFees
  });
});

// Mock auth (always success)
app.post('/api/auth/login', (req, res) => {
  res.json({
    message: 'Login successful (MOCK)',
    token: 'mock-jwt-token-12345',
    admin: { id: '1', email: 'admin@test.com' }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  // console.error('Error:', error);
  res.status(500).json({ message: 'Internal server error', error: error.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // console.log(`🚀 Mock server running on port ${PORT}`);
  // console.log(`📝 This is a MOCK server - no database required`);
  // console.log(`🔗 Test at: http://localhost:${PORT}/test`);
});