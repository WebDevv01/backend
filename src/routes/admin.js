const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const DeliveryPartner = require('../models/DeliveryPartner');
const User = require('../models/User');
const Parcel = require('../models/Parcel');

// Get all delivery partners
router.get('/delivery-partners', auth, authorize('admin'), async (req, res) => {
  try {
    const deliveryPartners = await DeliveryPartner.find()
      .populate('user', 'email isActive')
      .sort({ createdAt: -1 });

    res.json(deliveryPartners);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery partners', error: error.message });
  }
});

// Approve delivery partner
router.patch('/delivery-partners/:id/approve', auth, authorize('admin'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findById(req.params.id);
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    deliveryPartner.isApproved = true;
    deliveryPartner.rejectionReason = undefined;
    deliveryPartner.rejectionDate = undefined;
    await deliveryPartner.save();

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error approving delivery partner', error: error.message });
  }
});

// Reject delivery partner
router.patch('/delivery-partners/:id/reject', auth, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const deliveryPartner = await DeliveryPartner.findById(req.params.id);
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    deliveryPartner.isApproved = false;
    deliveryPartner.rejectionReason = reason;
    deliveryPartner.rejectionDate = new Date();
    await deliveryPartner.save();

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting delivery partner', error: error.message });
  }
});

// Allow reapplication
router.patch('/delivery-partners/:id/allow-reapply', auth, authorize('admin'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findById(req.params.id);
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    deliveryPartner.rejectionReason = undefined;
    deliveryPartner.rejectionDate = undefined;
    deliveryPartner.reapplicationDate = new Date();
    await deliveryPartner.save();

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error allowing reapplication', error: error.message });
  }
});

// Get delivery partner statistics
router.get('/statistics', auth, authorize('admin'), async (req, res) => {
  try {
    const [
      totalPartners,
      approvedPartners,
      pendingPartners,
      rejectedPartners
    ] = await Promise.all([
      DeliveryPartner.countDocuments(),
      DeliveryPartner.countDocuments({ isApproved: true }),
      DeliveryPartner.countDocuments({ isApproved: false, rejectionReason: { $exists: false } }),
      DeliveryPartner.countDocuments({ isApproved: false, rejectionReason: { $exists: true } })
    ]);

    res.json({
      totalPartners,
      approvedPartners,
      pendingPartners,
      rejectedPartners
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

// Get all parcels
router.get('/parcels', auth, authorize('admin'), async (req, res) => {
  try {
    const parcels = await Parcel.find()
      .populate('student', 'firstName lastName phoneNumber')
      .populate('deliveryPartner', 'firstName lastName phoneNumber')
      .sort({ createdAt: -1 });

    res.json(parcels);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching parcels', error: error.message });
  }
});

// Get delivery partner details
router.get('/delivery-partners/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findById(req.params.id)
      .populate('user', 'email isActive');
    
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    res.json(deliveryPartner);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery partner details', error: error.message });
  }
});

// Get delivery partner statistics
router.get('/delivery-partners/:id/statistics', auth, authorize('admin'), async (req, res) => {
  try {
    const deliveryPartner = await DeliveryPartner.findById(req.params.id);
    if (!deliveryPartner) {
      return res.status(404).json({ message: 'Delivery partner not found' });
    }

    const [
      totalDeliveries,
      pendingDeliveries,
      completedDeliveries,
      recentDeliveries
    ] = await Promise.all([
      Parcel.countDocuments({ deliveryPartner: deliveryPartner._id }),
      Parcel.countDocuments({
        deliveryPartner: deliveryPartner._id,
        status: { $in: ['accepted', 'picked_up', 'out_for_delivery'] }
      }),
      Parcel.countDocuments({
        deliveryPartner: deliveryPartner._id,
        status: 'delivered'
      }),
      Parcel.find({ deliveryPartner: deliveryPartner._id })
        .populate('student', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    // Calculate total earnings from completed deliveries
    const completedParcels = await Parcel.find({
      deliveryPartner: deliveryPartner._id,
      status: 'delivered',
      'payment.status': 'completed'
    });
    const totalEarnings = completedParcels.reduce((sum, parcel) => sum + (parcel.payment?.amount || 0), 0);

    res.json({
      statistics: {
        totalDeliveries,
        pendingDeliveries,
        completedDeliveries,
        totalEarnings
      },
      recentDeliveries
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching delivery partner statistics', error: error.message });
  }
});

module.exports = router; 