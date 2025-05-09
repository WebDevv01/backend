const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const DeliveryPartner = require('../models/DeliveryPartner');
const Parcel = require('../models/Parcel');

// Get delivery partner profile
router.get('/profile', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({ user: req.user._id });
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery partner profile', error: error.message });
  }
});

// Update delivery partner profile
router.patch('/profile', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({ user: req.user._id });
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    const updates = Object.keys(req.body);
    updates.forEach(update => {
      deliveryPartner[update] = req.body[update];
    });

    await deliveryPartner.save();
    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error updating delivery partner profile', error: error.message });
  }
});

// Update availability status
router.patch('/availability', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const deliveryPartner = await DeliveryPartner.findOne({ user: req.user._id });
    
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    if (!deliveryPartner.isApproved) {
      return res.status(403).json({ message: 'Your account is not approved by admin yet! Please contact to admin' });
    }

    deliveryPartner.isAvailable = isAvailable;
    await deliveryPartner.save();

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error updating availability', error: error.message });
  }
});

// Update current location
router.patch('/location', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    const { coordinates } = req.body;
    const deliveryPartner = await DeliveryPartner.findOne({ user: req.user._id });
    
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner profile not found' });
    }

    if (!deliveryPartner.isApproved) {
      return res.status(403).json({ message: 'Your account is not approved by admin yet! Please contact to admin' });
    }

    deliveryPartner.currentLocation.coordinates = coordinates;
    await deliveryPartner.save();

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error updating location', error: error.message });
  }
});

// Get assigned parcels
router.get('/parcels', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({ user: req.user._id });
    if (!deliveryPartner || !deliveryPartner.isApproved) {
      return res.status(403).json({ message: 'Your account is not approved by admin yet! Please contact to admin' });
    }

    const parcels = await Parcel.find({
      deliveryPartner: deliveryPartner._id
    })
      .populate('student', 'firstName lastName phoneNumber')
      .sort({ 
        status: 1, // Sort by status (pending first)
        createdAt: -1 // Then by date (newest first)
      });

    res.json(parcels);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parcels', error: error.message });
  }
});

// Get delivery statistics
router.get('/statistics', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findOne({ user: req.user._id });
    if (!deliveryPartner || !deliveryPartner.isApproved) {
      return res.status(403).json({ message: 'Your account is not approved by admin yet! Please contact to admin' });
    }

    // Set up date ranges
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    // Get all delivered parcels for the delivery partner
    const deliveredParcels = await Parcel.find({
      deliveryPartner: deliveryPartner._id,
      status: 'delivered'
    }).select('deliveryFee payment.amount deliveredAt');

    // Calculate earnings (including both deliveryFee and payment.amount)
    const todayEarnings = deliveredParcels
      .filter(parcel => parcel.deliveredAt >= today)
      .reduce((sum, parcel) => sum + (parcel.deliveryFee || 0) + (parcel.payment?.amount || 0), 0);

    const monthlyEarnings = deliveredParcels
      .filter(parcel => parcel.deliveredAt >= firstDayOfMonth)
      .reduce((sum, parcel) => sum + (parcel.deliveryFee || 0) + (parcel.payment?.amount || 0), 0);

    const yearlyEarnings = deliveredParcels
      .filter(parcel => parcel.deliveredAt >= firstDayOfYear)
      .reduce((sum, parcel) => sum + (parcel.deliveryFee || 0) + (parcel.payment?.amount || 0), 0);

    // Get delivery counts
    const [
      totalDeliveries,
      pendingDeliveries,
      completedDeliveries
    ] = await Promise.all([
      Parcel.countDocuments({ deliveryPartner: deliveryPartner._id }),
      Parcel.countDocuments({
        deliveryPartner: deliveryPartner._id,
        status: { $in: ['accepted', 'picked_up', 'out_for_delivery'] }
      }),
      Parcel.countDocuments({
        deliveryPartner: deliveryPartner._id,
        status: 'delivered'
      })
    ]);

    res.json({
      totalDeliveries,
      pendingDeliveries,
      completedDeliveries,
      rating: deliveryPartner.rating,
      earnings: {
        today: todayEarnings,
        monthly: monthlyEarnings,
        yearly: yearlyEarnings
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

// Create delivery partner profile
router.post('/profile', auth, authorize('deliveryPartner'), async (req, res) => {
  try {
    // Check if profile already exists
    const existingProfile = await DeliveryPartner.findOne({ user: req.user._id });
    if (existingProfile) {
      return res.status(400).json({ message: 'Profile already exists' });
    }

    // Create new profile
    const deliveryPartner = new DeliveryPartner({
      ...req.body,
      user: req.user._id
    });
    await deliveryPartner.save();

    res.status(201).json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error creating delivery partner profile', error: error.message });
  }
});

module.exports = router; 