const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Student = require('../models/Student');

// Get student profile
router.get('/profile', auth, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student profile', error: error.message });
  }
});

// Update student profile
router.patch('/profile', auth, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const updates = Object.keys(req.body);
    updates.forEach(update => {
      student[update] = req.body[update];
    });

    await student.save();
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Error updating student profile', error: error.message });
  }
});

// Add address
router.post('/addresses', auth, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const newAddress = req.body;
    if (newAddress.isDefault) {
      // Reset all other addresses to non-default
      student.addresses.forEach(address => {
        address.isDefault = false;
      });
    }

    student.addresses.push(newAddress);
    await student.save();

    res.status(201).json(student.addresses[student.addresses.length - 1]);
  } catch (error) {
    res.status(500).json({ message: 'Error adding address', error: error.message });
  }
});

// Update address
router.patch('/addresses/:id', auth, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const address = student.addresses.id(req.params.id);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const updates = Object.keys(req.body);
    updates.forEach(update => {
      address[update] = req.body[update];
    });

    if (address.isDefault) {
      // Reset all other addresses to non-default
      student.addresses.forEach(addr => {
        if (addr._id.toString() !== address._id.toString()) {
          addr.isDefault = false;
        }
      });
    }

    await student.save();
    res.json(address);
  } catch (error) {
    res.status(500).json({ message: 'Error updating address', error: error.message });
  }
});

// Delete address
router.delete('/addresses/:id', auth, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const addressIndex = student.addresses.findIndex(addr => addr._id.toString() === req.params.id);
    if (addressIndex === -1) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Remove the address using splice
    student.addresses.splice(addressIndex, 1);
    await student.save();

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ message: 'Error deleting address', error: error.message });
  }
});

module.exports = router; 