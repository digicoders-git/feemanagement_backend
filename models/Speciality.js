const mongoose = require('mongoose');

const specialitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  totalSeats: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure unique speciality per department
specialitySchema.index({ name: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Speciality', specialitySchema);