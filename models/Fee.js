const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  feeType: { type: String, required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paidDate: { type: Date },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
  description: { type: String },
  paymentMethod: { type: String },
  transactionId: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Fee', feeSchema);