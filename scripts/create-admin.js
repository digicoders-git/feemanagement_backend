require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // console.log('✅ Connected to MongoDB');
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@gmail.com' });
    
    if (existingAdmin) {
      // console.log('⚠️  Admin already exists!');
      // console.log('Email:', existingAdmin.email);
      // console.log('Role:', existingAdmin.role);
    } else {
      // Create new admin
      const admin = new Admin({
        email: 'admin@gmail.com',
        password: 'admin123',
        role: 'super_admin',
        permissions: {
          studentManagement: true,
          feeManagement: true
        }
      });
      
      await admin.save();
      // console.log('✅ Super Admin created successfully!');
    }
    
    // console.log('\n=== LOGIN CREDENTIALS ===');
    // console.log('Email: admin@gmail.com');
    // console.log('Password: admin123');
    // console.log('Role: super_admin');
    
    process.exit(0);
  } catch (error) {
    // console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdmin();