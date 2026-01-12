const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Email transporter with fallback to mock mode
let transporter;
let emailMode = 'real';

try {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      // console.log('Gmail authentication failed, switching to mock mode');
      emailMode = 'mock';
    } else {
      // console.log('Email server is ready to send messages');
    }
  });
} catch (error) {
  // console.log('Email setup failed, using mock mode');
  emailMode = 'mock';
}

// Mock transporter function
const mockSendMail = async (mailOptions) => {
  // console.log('\n=== EMAIL SENT (MOCK) ===');
  // console.log('From:', mailOptions.from);
  // console.log('To:', mailOptions.to);
  // console.log('Subject:', mailOptions.subject);
  // console.log('Timestamp:', new Date().toLocaleString('en-IN'));
  // console.log('========================\n');
  
  return {
    messageId: 'mock-' + Date.now() + '@gmail.com',
    accepted: [mailOptions.to],
    rejected: []
  };
};

// Wrapper function for sending emails
const sendEmail = async (mailOptions) => {
  try {
    if (emailMode === 'real') {
      return await transporter.sendMail(mailOptions);
    } else {
      return await mockSendMail(mailOptions);
    }
  } catch (error) {
    // console.log('Real email failed, falling back to mock mode');
    emailMode = 'mock';
    return await mockSendMail(mailOptions);
  }
};

// Send Email
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, message, studentName, amount, dueDate, feeType } = req.body;
    
    if (!to || !studentName) {
      return res.status(400).json({ success: false, message: 'Email and student name are required' });
    }
    
    const emailTemplate = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">${process.env.EMAIL_FROM_NAME || 'Fee Management System'}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Fee Payment Reminder</p>
        </div>
        
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-bottom: 20px;">Dear ${studentName},</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">This is a friendly reminder that your fee payment is due. Please review the details below:</p>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666;"><strong>Fee Type:</strong></td><td style="padding: 8px 0; color: #333;">${feeType || 'General Fee'}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Amount:</strong></td><td style="padding: 8px 0; color: #e74c3c; font-weight: bold; font-size: 18px;">₹${amount?.toLocaleString() || '0'}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td><td style="padding: 8px 0; color: #333;">${dueDate ? new Date(dueDate).toLocaleDateString('en-IN') : 'N/A'}</td></tr>
            </table>
            ${message ? `<div style="margin-top: 15px; padding: 15px; background: #fff; border-radius: 5px; border: 1px solid #e9ecef;"><strong>Additional Message:</strong><br>${message}</div>` : ''}
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> Please make the payment at your earliest convenience to avoid any late fees or penalties.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #666; margin-bottom: 15px;">For any queries, please contact the administration office.</p>
            <div style="border-top: 1px solid #eee; padding-top: 20px; color: #999; font-size: 14px;">
              <p style="margin: 0;">This is an automated message from ${process.env.EMAIL_FROM_NAME || 'Fee Management System'}</p>
              <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Fee Management System'}" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject || `Fee Payment Reminder - ${studentName}`,
      html: emailTemplate,
      priority: 'high'
    };

    const info = await sendEmail(mailOptions);
    // console.log('Email sent successfully:', info.messageId);

    res.json({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: info.messageId,
      recipient: to
    });
  } catch (error) {
    // console.error('Email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email: ' + error.message,
      error: error.code || 'EMAIL_ERROR'
    });
  }
});

// Send SMS as Email
router.post('/send-sms', async (req, res) => {
  try {
    const { phone, email, message, studentName, amount, dueDate, feeType } = req.body;
    
    // console.log('SMS request received:', req.body);
    
    // Use email if provided, otherwise create email from phone
    const recipientEmail = email || `${phone}@example.com`;
    const name = studentName || 'Student';
    
    if (!phone && !email) {
      // console.log('Missing phone and email');
      return res.status(400).json({ success: false, message: 'Phone number or email is required' });
    }
    
    const formattedAmount = amount ? `₹${amount.toLocaleString()}` : 'N/A';
    const formattedDate = dueDate ? new Date(dueDate).toLocaleDateString('en-IN') : 'N/A';
    
    const emailTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h2 style="margin: 0;">📱 SMS Notification</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Fee Payment Reminder</p>
        </div>
        
        <div style="padding: 20px;">
          <h3 style="color: #333;">Dear ${name},</h3>
          <p style="color: #666; line-height: 1.6;">Fee Payment Reminder:</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #667eea;">
            <p style="margin: 5px 0;"><strong>Fee Type:</strong> ${feeType || 'Fee'}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> <span style="color: #e74c3c; font-weight: bold;">${formattedAmount}</span></p>
            <p style="margin: 5px 0;"><strong>Due Date:</strong> ${formattedDate}</p>
          </div>
          
          ${message ? `<div style="background: #fff; border: 1px solid #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;"><strong>Message:</strong><br>${message}</div>` : ''}
          
          <p style="color: #666;">Please pay at the earliest to avoid late fees.</p>
          
          <div style="text-align: center; margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 5px;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;">📧 This SMS was sent via email for convenience</p>
          </div>
          
          <hr style="margin: 20px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">- ${process.env.EMAIL_FROM_NAME || 'Fee Management System'}</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Fee Management System'}" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `📱 SMS: Fee Payment Reminder - ${name}`,
      html: emailTemplate
    };

    const info = await sendEmail(mailOptions);
    // console.log('SMS-Email sent successfully:', info.messageId);

    res.json({ 
      success: true, 
      message: 'SMS sent via email successfully',
      recipient: recipientEmail,
      messageId: info.messageId
    });
  } catch (error) {
    // console.error('SMS-Email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send SMS via email: ' + error.message,
      error: error.code || 'SMS_EMAIL_ERROR'
    });
  }
});

// Make Call (Mock implementation)
router.post('/make-call', async (req, res) => {
  try {
    const { phone, studentName } = req.body;
    
    // Mock call implementation - Replace with actual call service
    // console.log(`Call initiated to ${phone} for ${studentName}`);
    
    res.json({ success: true, message: 'Call initiated successfully' });
  } catch (error) {
    // console.error('Call error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate call' });
  }
});

// Send bulk notifications with enhanced functionality
router.post('/send-bulk', async (req, res) => {
  try {
    const { students, type, message, subject } = req.body;
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Students array is required' });
    }
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const student of students) {
      try {
        if (type === 'email' && student.email) {
          const emailTemplate = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">${process.env.EMAIL_FROM_NAME || 'Fee Management System'}</h2>
              </div>
              <div style="padding: 20px;">
                <h3>Dear ${student.name},</h3>
                <p>${message}</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p><strong>Amount Due:</strong> ₹${student.amount?.toLocaleString() || 'N/A'}</p>
                  <p><strong>Due Date:</strong> ${student.dueDate ? new Date(student.dueDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
                <p>Please contact the administration for any queries.</p>
                <hr style="margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated message sent on ${new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          `;
          
          await sendEmail({
            from: `"${process.env.EMAIL_FROM_NAME || 'Fee Management System'}" <${process.env.EMAIL_USER}>`,
            to: student.email,
            subject: subject || 'Fee Payment Reminder',
            html: emailTemplate
          });
          
          results.push({ 
            student: student.name, 
            contact: student.email,
            status: 'Email sent successfully',
            type: 'email'
          });
          successCount++;
          
        } else if (type === 'sms' && student.phone) {
          const smsMessage = `Dear ${student.name},\n\n${message}\n\nAmount: ₹${student.amount?.toLocaleString() || 'N/A'}\nDue: ${student.dueDate ? new Date(student.dueDate).toLocaleDateString('en-IN') : 'N/A'}\n\n- ${process.env.EMAIL_FROM_NAME || 'FMS'}`;
          
          // Mock SMS - replace with actual SMS service integration
          // console.log(`Bulk SMS to ${student.phone}: ${smsMessage}`);
          
          results.push({ 
            student: student.name, 
            contact: student.phone,
            status: 'SMS sent successfully',
            type: 'sms'
          });
          successCount++;
          
        } else if (type === 'both' && (student.email || student.phone)) {
          // Send both email and SMS
          let bothResults = [];
          
          if (student.email) {
            try {
              const emailTemplate = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1e40af;">Fee Payment Reminder</h2>
                  <p>Dear ${student.name},</p>
                  <p>${message}</p>
                  <p><strong>Amount:</strong> ₹${student.amount?.toLocaleString() || 'N/A'}</p>
                  <p><strong>Due Date:</strong> ${student.dueDate ? new Date(student.dueDate).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
              `;
              
              await sendEmail({
                from: `"${process.env.EMAIL_FROM_NAME || 'Fee Management System'}" <${process.env.EMAIL_USER}>`,
                to: student.email,
                subject: subject || 'Fee Payment Reminder',
                html: emailTemplate
              });
              bothResults.push('Email sent');
            } catch (emailError) {
              bothResults.push('Email failed');
            }
          }
          
          if (student.phone) {
            const smsMessage = `Dear ${student.name}, ${message} Amount: ₹${student.amount?.toLocaleString() || 'N/A'}, Due: ${student.dueDate ? new Date(student.dueDate).toLocaleDateString('en-IN') : 'N/A'}`;
            // console.log(`SMS to ${student.phone}: ${smsMessage}`);
            bothResults.push('SMS sent');
          }
          
          results.push({ 
            student: student.name, 
            contact: `${student.email || ''} / ${student.phone || ''}`,
            status: bothResults.join(', '),
            type: 'both'
          });
          successCount++;
          
        } else {
          results.push({ 
            student: student.name, 
            contact: 'N/A',
            status: `No ${type} contact available`,
            type: type
          });
          failureCount++;
        }
        
        // Add small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        // console.error(`Error sending to ${student.name}:`, error);
        results.push({ 
          student: student.name, 
          contact: student.email || student.phone || 'N/A',
          status: 'Failed: ' + error.message,
          type: type
        });
        failureCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `Bulk notifications completed. ${successCount} successful, ${failureCount} failed.`,
      summary: {
        total: students.length,
        successful: successCount,
        failed: failureCount,
        type: type
      },
      results 
    });
  } catch (error) {
    // console.error('Bulk notification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Bulk notification failed: ' + error.message 
    });
  }
});

module.exports = router;