require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

async function createDefaultAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // console.log('Connected to MongoDB');
    
    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email: 'admin@gmail.com' });
    
    if (existingAdmin) {
      // console.log('Admin already exists!');
    } else {
      // Create new admin
      const admin = new Admin({
        email: 'admin@gmail.com',
        password: 'admin123',
        role: 'super_admin'
      });
      
      await admin.save();
      // console.log('Admin created successfully!');
    }
    
    // console.log('\n=== LOGIN CREDENTIALS ===');
    // console.log('Email: admin@gmail.com');
    // console.log('Password: admin123');
    // console.log('Login URL: http://localhost:5000/api/auth/login');
    
    process.exit(0);
  } catch (error) {
    // console.error('Error:', error.message);
    process.exit(1);
  }
}

createDefaultAdmin();