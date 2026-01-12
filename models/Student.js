const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  rollNumber: { type: String, required: true, unique: true },
  section: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  parentName: { type: String, required: true },
  parentPhone: { type: String, required: true },
  admissionDate: { type: Date, required: true },
  dateOfBirth: { type: Date },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  speciality: { type: mongoose.Schema.Types.ObjectId, ref: 'Speciality', required: true },
  totalFee: { type: Number, required: true },
  feeType: { type: String, required: true, default: 'Annual' },
  // Individual fee components
  tuitionFee: { type: Number, default: 0 },
  hostelFee: { type: Number, default: 0 },
  securityFee: { type: Number, default: 0 },
  miscellaneousFee: { type: Number, default: 0 },
  acCharge: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', studentSchema);