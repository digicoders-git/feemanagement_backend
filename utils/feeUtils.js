const Fee = require('../models/Fee');

// Update overdue fees automatically
const updateOverdueFees = async () => {
  try {
    const currentDate = new Date();
    
    // Find all pending fees that are past due date
    const overdueFees = await Fee.updateMany(
      {
        status: 'pending',
        dueDate: { $lt: currentDate },
        paidAmount: { $lt: '$amount' }
      },
      {
        status: 'overdue',
        updatedAt: currentDate
      }
    );
    
    // console.log(`Updated ${overdueFees.modifiedCount} fees to overdue status`);
    return overdueFees;
  } catch (error) {
    // console.error('Error updating overdue fees:', error);
    throw error;
  }
};

// Check if fee is fully paid
const isFeeFullyPaid = (fee) => {
  return fee.paidAmount >= fee.amount;
};

// Calculate remaining amount
const getRemainingAmount = (fee) => {
  return Math.max(0, fee.amount - (fee.paidAmount || 0));
};

// Get fee status with proper logic
const getFeeStatus = (fee) => {
  if (isFeeFullyPaid(fee)) {
    return 'paid';
  }
  
  const currentDate = new Date();
  if (fee.dueDate < currentDate) {
    return 'overdue';
  }
  
  return 'pending';
};

module.exports = {
  updateOverdueFees,
  isFeeFullyPaid,
  getRemainingAmount,
  getFeeStatus
};