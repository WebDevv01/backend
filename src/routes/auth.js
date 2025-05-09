const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const DeliveryPartner = require('../models/DeliveryPartner');
const { auth } = require('../middleware/auth');

// Register validation middleware
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['student', 'deliveryPartner'])
];

// Login validation middleware
const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
];

// Register route
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, role, ...userData } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Create user
    const user = new User({ email, password, role });
    await user.save();

    // Create role-specific profile
    if (role === 'student') {
      // Check for duplicate universityId
      const existingStudent = await Student.findOne({ universityId: userData.universityId });
      if (existingStudent) {
        await User.findByIdAndDelete(user._id); // Clean up the created user
        return res.status(400).json({ message: 'University ID is already registered' });
      }

      // Check for duplicate phoneNumber
      const existingPhone = await Student.findOne({ phoneNumber: userData.phoneNumber });
      if (existingPhone) {
        await User.findByIdAndDelete(user._id); // Clean up the created user
        return res.status(400).json({ message: 'Phone number is already registered' });
      }

      const student = new Student({ ...userData, user: user._id });
      await student.save();
    } else if (role === 'deliveryPartner') {
      // Check for duplicate phoneNumber
      const existingPhone = await DeliveryPartner.findOne({ phoneNumber: userData.phoneNumber });
      if (existingPhone) {
        await User.findByIdAndDelete(user._id); // Clean up the created user
        return res.status(400).json({ message: 'Phone number is already registered' });
      }

      const deliveryPartner = new DeliveryPartner({ ...userData, user: user._id });
      await deliveryPartner.save();
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.status(201).json({ token, user: { id: user._id, role: user.role } });
  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      
      let message = 'Duplicate field error';
      if (field === 'email') {
        message = `Email '${value}' is already registered`;
      } else if (field === 'universityId') {
        message = `University ID '${value}' is already registered`;
      } else if (field === 'phoneNumber') {
        message = `Phone number '${value}' is already registered`;
      }
      
      // If user was created but profile creation failed, clean up the user
      if (error.message.includes('User')) {
        await User.findByIdAndDelete(error.keyValue._id);
      }
      
      return res.status(400).json({ 
        message,
        field,
        value
      });
    }
    
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login route
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Find user
    const user = await User.findOne({ email });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.json({ token, user: { id: user._id, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let profile;
    if (user.role === 'student') {
      profile = await Student.findOne({ user: user._id });
    } else if (user.role === 'deliveryPartner') {
      profile = await DeliveryPartner.findOne({ user: user._id });
    }

    res.json({ user, profile });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
});

module.exports = router; 