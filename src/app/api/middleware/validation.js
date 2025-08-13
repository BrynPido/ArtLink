const { body, validationResult } = require('express-validator');

// Validation rules
const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validatePost = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be less than 255 characters'),
  
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Content must be less than 5000 characters')
];

const validateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment content is required and must be less than 1000 characters'),
  
  body('postId')
    .isInt({ min: 1 })
    .withMessage('Valid post ID is required')
];

const validateListing = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be less than 255 characters'),
  
  // Custom validation for listingDetails - parse if it's a string
  body('listingDetails')
    .custom((value, { req }) => {
      // If listingDetails is a string, parse it
      if (typeof value === 'string') {
        try {
          req.body.listingDetails = JSON.parse(value);
        } catch (error) {
          throw new Error('Invalid listing details format');
        }
      }
      
      const details = req.body.listingDetails;
      
      // Validate price
      if (!details.price || isNaN(parseFloat(details.price)) || parseFloat(details.price) < 0) {
        throw new Error('Price must be a positive number');
      }
      
      // Validate category
      if (!details.category || details.category.trim().length === 0) {
        throw new Error('Category is required');
      }
      
      // Validate condition
      if (!details.condition || details.condition.trim().length === 0) {
        throw new Error('Condition is required');
      }
      
      // Validate location
      if (!details.location || details.location.trim().length === 0) {
        throw new Error('Location is required');
      }
      
      return true;
    })
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validatePost,
  validateComment,
  validateListing,
  handleValidationErrors
};
