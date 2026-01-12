require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

async function resetPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // console.log('Connected to MongoDB');
    
    const email = 'admin@gmail.com';
    const newPassword = 'admin123'; // Simple password for testing
    
    // console.log('Resetting password for:', email);
    // console.log('New password will be:', newPassword);
    
    // Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      // console.log('❌ Admin not found');
      return;
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password directly in database
    await Admin.updateOne(
      { email },
      { password: hashedPassword }
    );
    
    // console.log('✅ Password reset successfully!');
    // console.log('');
    // console.log('=== Login Credentials ===');
    // console.log('Email:', email);
    // console.log('Password:', newPassword);
    // console.log('');
    // console.log('Now try logging in with these credentials.');
    
    process.exit(0);
  } catch (error) {
    // console.error('Error:', error);
    process.exit(1);
  }
}

resetPassword();