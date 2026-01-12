// middleware/role.js

// ✅ Super Admin only
const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access only' });
  }
  next();
};

// ✅ Employee permission check
const checkEmployeePermission = (permission) => {
  return (req, res, next) => {
    const user = req.admin || req.user;
    
    if (user.role === 'super_admin') {
      return next();
    }
    
    if (user.role === 'employee') {
      if (!user.permissions || !user.permissions[permission]) {
        return res.status(403).json({
          message: `Access denied: ${permission} permission required`
        });
      }
    }
    
    next();
  };
};

// ✅ Check permission (backward compatibility)
const checkPermission = (permission) => {
  return (req, res, next) => {
    const user = req.admin || req.user;

    if (user.role === 'super_admin') {
      return next();
    }

    if (user.role === 'employee') {
      const permissionMap = {
        'student': 'studentManagement',
        'fee': 'feeManagement'
      };
      
      const actualPermission = permissionMap[permission] || permission;
      
      if (!user.permissions || !user.permissions[actualPermission]) {
        return res.status(403).json({
          message: `Access denied: ${permission} permission required`
        });
      }
    }

    next();
  };
};

// ✅ Department access check
const checkDepartmentAccess = (departmentField = 'department') => {
  return (req, res, next) => {
    const user = req.admin || req.user;

    if (user.role === 'super_admin') {
      return next();
    }

    if (user.role === 'employee') {
      const departmentId = req.body[departmentField] || 
                          req.params[departmentField] || 
                          req.query[departmentField];

      if (!departmentId) {
        return res.status(400).json({ message: 'Department is required' });
      }

      const hasAccess = user.departments.some(
        dep => dep._id ? dep._id.toString() === departmentId.toString() : 
               dep.toString() === departmentId.toString()
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Access denied for this department'
        });
      }
    }

    next();
  };
};

// ✅ Filter data by department access
const filterByDepartmentAccess = (user, query = {}) => {
  if (user.role === 'super_admin') {
    return query;
  }
  
  if (user.role === 'employee' && user.departments && user.departments.length > 0) {
    const departmentIds = user.departments.map(dep => 
      dep._id ? dep._id : dep
    );
    query.department = { $in: departmentIds };
  }
  
  return query;
};

module.exports = {
  superAdminOnly,
  checkEmployeePermission,
  checkPermission,
  checkDepartmentAccess,
  filterByDepartmentAccess
};