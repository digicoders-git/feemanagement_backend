const express = require('express');
const Student = require('../models/Student');
const Department = require('../models/Department');
const Speciality = require('../models/Speciality');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all active students (only admin added)
router.get('/show-students', auth, async (req, res) => {
  try {
    // Disable caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    let query = { isActive: true };

    // If user is employee, filter by their departments
    if (req.user.role === 'employee') {
      const employeeDepartmentIds = req.user.departments.map(dept => dept._id || dept);
      query.department = { $in: employeeDepartmentIds };
    }

    const students = await Student.find(query)
      .populate({
        path: 'addedBy',
        select: 'email'
      })
      .populate({
        path: 'department',
        select: 'name description',
        model: 'Department'
      })
      .populate({
        path: 'speciality',
        select: 'name totalSeats',
        model: 'Speciality'
      })
      .sort({ createdAt: -1 });

    // Transform data - only handle null references, no hardcoded values
    const transformedStudents = students.map(student => {
      const studentObj = student.toObject();

      // Only set fallback if department is null/undefined
      if (!studentObj.department) {
        studentObj.department = null;
      }

      // Only set fallback if speciality is null/undefined  
      if (!studentObj.speciality) {
        studentObj.speciality = null;
      }

      return studentObj;
    });

    res.json({
      message: `Found ${students.length} active students`,
      count: students.length,
      data: transformedStudents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch students',
      error: error.message
    });
  }
});

// Get single student by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate({
        path: 'addedBy',
        select: 'email'
      })
      .populate({
        path: 'department',
        select: 'name description',
        model: 'Department'
      })
      .populate({
        path: 'speciality',
        select: 'name totalSeats',
        model: 'Speciality'
      });

    if (!student) {
      return res.status(404).json({
        message: 'Student not found with the provided ID',
        studentId: req.params.id
      });
    }

    res.json({
      message: 'Student details retrieved successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch student details',
      error: error.message
    });
  }
});

// Add student (admin only)
router.post('/add-student', auth, async (req, res) => {
  try {
    const studentData = {
      ...req.body,
      addedBy: req.admin.id
    };
    const student = new Student(studentData);
    await student.save();
    await student.populate('addedBy', 'email');
    res.status(201).json({
      message: `Student '${student.name}' added successfully`,
      success: true,
      data: student
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      res.status(400).json({
        message: `Student with this ${field} already exists`,
        error: `Duplicate ${field}: ${error.keyValue[field]}`
      });
    } else {
      res.status(400).json({
        message: 'Failed to add student',
        error: error.message
      });
    }
  }
});

// Update student (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('addedBy', 'email');
    if (!student) {
      return res.status(404).json({
        message: 'Student not found for update',
        studentId: req.params.id
      });
    }
    res.json({
      message: `Student '${student.name}' updated successfully`,
      success: true,
      data: student
    });
  } catch (error) {
    res.status(400).json({
      message: 'Failed to update student',
      error: error.message
    });
  }
});

// Get student fee details
router.get('/:id/fees', auth, async (req, res) => {
  try {
    const Fee = require('../models/Fee');
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found',
        studentId: req.params.id
      });
    }

    const fees = await Fee.find({ studentId: req.params.id })
      .populate('addedBy', 'email')
      .sort({ createdAt: -1 });

    res.json({
      message: `Found ${fees.length} fee records for ${student.name}`,
      student: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        class: student.class
      },
      fees: fees
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch student fees',
      error: error.message
    });
  }
});

// Delete student (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({
        message: 'Student not found for deletion',
        studentId: req.params.id
      });
    }
    res.json({
      message: `Student '${student.name}' deleted successfully`,
      success: true,
      deletedStudent: {
        id: student._id,
        name: student.name,
        rollNumber: student.rollNumber
      }
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to delete student',
      error: error.message
    });
  }
});


// Import students from Excel
router.post('/import-excel', auth, async (req, res) => {
  try {
    const { students } = req.body;
    const results = {
      failed: 0,
      errors: [],
      updated: 0,
      created: 0,
      skipped: 0,
      firstSkippedRowKeys: null
    };

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'No student data provided' });
    }

    // Pre-fetch all departments and specialities
    const departments = await Department.find({});
    const specialities = await Speciality.find({});

    const departmentMap = {}; // Name -> ID
    departments.forEach(d => {
      departmentMap[d.name?.toLowerCase().trim()] = d._id;
    });

    const specialityMap = {}; // Name -> ID
    specialities.forEach(s => {
      specialityMap[s.name?.toLowerCase().trim()] = s._id;
    });

    // --- GLOBAL CONTEXT SCAN ---
    // Scan all cells in the first 50 rows to find ANY mention of a department or speciality
    // This handles cases where the Dept name is in a title like "B.SC NURSING BATCH..."
    let globalDeptId = null;
    let globalSpecId = null;

    for (const row of students.slice(0, 50)) {
      for (const val of Object.values(row)) {
        if (!val) continue;
        const str = val.toString().toLowerCase();

        // Look for dept match in this string
        for (const [name, id] of Object.entries(departmentMap)) {
          if (str.includes(name) && name.length > 3) {
            globalDeptId = id;
          }
        }
        // Look for speciality match
        for (const [name, id] of Object.entries(specialityMap)) {
          if (str.includes(name) && name.length > 3) {
            globalSpecId = id;
          }
        }
      }
    }
    console.log(`Global Detection - Dept: ${globalDeptId}, Spec: ${globalSpecId}`);
    // ---------------------------

    // Get Admin ID from req.user/req.admin (auth middleware sets req.user or req.admin)
    // Based on 'add-student' route using req.admin.id, try that or req.user.id
    // middleware/auth.js usually sets req.user. Checking other routes... 
    // router.get('/show-students') uses req.user.role. 
    // router.post('/add-student') uses req.admin.id. 
    // I'll check what `auth` middleware does, but safely fallback.
    const addedBy = req.admin?.id || req.user?.id || req.user?._id;

    // Helper to find value by fuzzy key match (Aggressive & Prioritized)
    const getValue = (row, key) => {
      const target = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const keys = Object.keys(row);

      // 1. Exact Match (normalized)
      let foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === target);
      if (foundKey) {
        console.log(`Found exact match for '${key}': '${foundKey}'`);
        return row[foundKey];
      }

      // 2. Starts With (e.g. "Department Name" starts with "department")
      foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(target));
      if (foundKey) {
        console.log(`Found startsWith match for '${key}': '${foundKey}'`);
        return row[foundKey];
      }

      // 3. Contains (e.g. "Student Name" contains "name")
      foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(target));
      if (foundKey) {
        console.log(`Found contains match for '${key}': '${foundKey}'`);
        return row[foundKey];
      }

      console.log(`No match found for '${key}' among keys: ${keys.join(', ')}`);
      return undefined;
    };

    const parseDate = (dateVal) => {
      if (!dateVal) return undefined;
      // If it's already a Date object
      if (dateVal instanceof Date) return dateVal;
      // If it's a string
      if (typeof dateVal === 'string') {
        // Try standard ISO
        let d = new Date(dateVal);
        if (!isNaN(d.getTime())) return d;

        // Try DD/MM/YYYY
        const parts = dateVal.split(/[-/]/);
        if (parts.length === 3) {
          // Assume DD/MM/YYYY if first part > 12 or based on locale? 
          // Safest is to stick to ISO, but let's try to be helpful.
          // If input is "15/01/2023", Date("15/01/2023") is invalid or US-centric.
          // Let's manually parse DD/MM/YYYY
          return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
      return new Date(dateVal); // Number case (though cellDates:true handles this) or other
    };

    console.log(`Starting bulk import for ${students.length} students.`);
    if (students.length > 0) {
      console.log('Sample row:', JSON.stringify(students[0], null, 2));
    }

    for (const row of students) {
      // Fuzzy get Roll Number
      let rollNumberVal = getValue(row, 'Roll Number') ||
        getValue(row, 'Roll No') ||
        getValue(row, 'RollNumber') ||
        getValue(row, 'Roll') ||
        getValue(row, 'Id') ||
        getValue(row, 'Enrollment') ||
        getValue(row, 'Enrolment') ||
        getValue(row, 'Reg No') ||
        getValue(row, 'Registration') ||
        getValue(row, 'Admission No') ||
        getValue(row, 'Scholar No') ||
        getValue(row, 'SNo') ||
        getValue(row, 'S.No.') ||
        getValue(row, 'S.No');

      // FINAL FALLBACK: If no identified roll column, take the first column that has a value
      if (!rollNumberVal) {
        const firstKey = Object.keys(row)[0];
        if (firstKey && row[firstKey]) {
          rollNumberVal = row[firstKey];
        }
      }

      // Skip empty rows or rows that look like totals
      if (!rollNumberVal || rollNumberVal.toString().toLowerCase().includes('total')) {
        if (results.skipped === 0) {
          results.firstSkippedRowKeys = Object.keys(row);
        }
        results.skipped++;
        continue;
      }

      try {
        // Validate & Resolve Department (be very flexible with column names)
        let deptId = null;
        let deptVal = getValue(row, 'Department') || getValue(row, 'Course') || getValue(row, 'Branch') || getValue(row, 'Class') || getValue(row, 'Stream') || getValue(row, 'Batch');

        if (deptVal) {
          const deptName = deptVal.toString().trim().toLowerCase();
          deptId = departmentMap[deptName];
          // If not found by exact name, try partial match
          if (!deptId) {
            const partialMatch = Object.keys(departmentMap).find(k => deptName.includes(k) || k.includes(deptName));
            if (partialMatch) deptId = departmentMap[partialMatch];
          }
        }

        // Validate & Resolve Speciality
        let specId = null;
        let specVal = getValue(row, 'Speciality') || getValue(row, 'Subject') || getValue(row, 'Specialization') || deptVal; // Fallback to deptVal

        if (specVal) {
          const specName = specVal.toString().trim().toLowerCase();
          specId = specialityMap[specName];
          if (!specId) {
            const partialMatch = Object.keys(specialityMap).find(k => specName.includes(k) || k.includes(specName));
            if (partialMatch) specId = specialityMap[partialMatch];
          }
        }

        // Find existing student
        const rollNum = rollNumberVal.toString();
        let student = await Student.findOne({ rollNumber: rollNum });

        const nameVal = getValue(row, 'Name');
        const phoneVal = getValue(row, 'Phone');
        const emailVal = getValue(row, 'Email');
        const addressVal = getValue(row, 'Address');
        const totalFeeVal = getValue(row, 'Total Fee') || getValue(row, 'Fee Due') || getValue(row, 'TotalDue') || getValue(row, 'Fixed Fee');

        const parentNameVal = getValue(row, 'Parent Name') || getValue(row, 'Father Name') || getValue(row, 'Guardian');
        const parentPhoneVal = getValue(row, 'Parent Phone');
        const admissionDateVal = getValue(row, 'Admission Date');
        const dobVal = getValue(row, 'Date of Birth');
        const sectionVal = getValue(row, 'Section');
        const feeTypeVal = getValue(row, 'Fee Type');

        const tuitionFeeVal = getValue(row, 'Tuition Fee');
        const hostelFeeVal = getValue(row, 'Hostel Fee');
        const securityFeeVal = getValue(row, 'Security Fee');
        const miscFeeVal = getValue(row, 'Miscellaneous Fee');
        const acChargeVal = getValue(row, 'AC Charge');


        if (student) {
          // UPDATE
          if (nameVal) student.name = nameVal;
          if (phoneVal) student.phone = phoneVal.toString();
          if (emailVal) student.email = emailVal;
          if (addressVal) student.address = addressVal;
          if (totalFeeVal !== undefined && totalFeeVal !== '') student.totalFee = Number(totalFeeVal);

          if (deptId) student.department = deptId;
          if (specId) student.speciality = specId;

          // Update extra fields
          if (parentNameVal) student.parentName = parentNameVal;
          if (parentPhoneVal) student.parentPhone = parentPhoneVal.toString();
          if (admissionDateVal) student.admissionDate = parseDate(admissionDateVal);
          if (dobVal) student.dateOfBirth = parseDate(dobVal);
          if (sectionVal) student.section = sectionVal;
          if (feeTypeVal) student.feeType = feeTypeVal;

          // Fee Breakdowns
          if (tuitionFeeVal !== undefined) student.tuitionFee = Number(tuitionFeeVal);
          if (hostelFeeVal !== undefined) student.hostelFee = Number(hostelFeeVal);
          if (securityFeeVal !== undefined) student.securityFee = Number(securityFeeVal);
          if (miscFeeVal !== undefined) student.miscellaneousFee = Number(miscFeeVal);
          if (acChargeVal !== undefined) student.acCharge = Number(acChargeVal);

          await student.save();
          results.updated++;
        } else {
          // INSERT
          // 1. Row-level Dept -> 2. Global Context Dept -> 3. Database Fallback
          if (!deptId) deptId = globalDeptId;
          if (!deptId && departments.length > 0) {
            deptId = departments[0]._id;
          }

          if (!specId) specId = globalSpecId;
          if (!specId && specialities.length > 0) {
            specId = specialities[0]._id;
          }

          if (!deptId) throw new Error('Department not found. Please ensure at least one department exists in the system or is named in the Excel.');

          const newStudent = new Student({
            name: nameVal || `Student ${rollNum}`,
            rollNumber: rollNum,
            phone: (phoneVal || parentPhoneVal || '0000000000').toString(),
            email: emailVal || '',
            address: addressVal || '',
            totalFee: Number(totalFeeVal) || 0,
            department: deptId,
            speciality: specId,
            parentName: parentNameVal || 'Not Provided',
            parentPhone: (parentPhoneVal || '0000000000').toString(),
            admissionDate: parseDate(admissionDateVal) || new Date(),
            feeType: feeTypeVal || 'Annual',
            addedBy: addedBy,
            isActive: true,

            // Optional
            dateOfBirth: dobVal ? parseDate(dobVal) : undefined,
            section: sectionVal || '',
            tuitionFee: Number(tuitionFeeVal) || 0,
            hostelFee: Number(hostelFeeVal) || 0,
            securityFee: Number(securityFeeVal) || 0,
            miscellaneousFee: Number(miscFeeVal) || 0,
            acCharge: Number(acChargeVal) || 0,
          });

          await newStudent.save();
          results.created++;
        }

      } catch (err) {
        results.failed++;
        results.errors.push({
          rollNumber: rollNumberVal || 'Unknown',
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Import complete. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}, Skipped: ${results.skipped}`,
      results
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: 'Import failed', error: error.message });
  }
});

module.exports = router;