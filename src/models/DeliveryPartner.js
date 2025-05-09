const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  vehicleType: {
    type: String,
    enum: ['bike', 'car', 'scooter']
  },
  vehicleNumber: {
    type: String
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  rejectionReason: {
    type: String
  },
  rejectionDate: {
    type: Date
  },
  reapplicationDate: {
    type: Date
  },
  profilePicture: {
    type: String
  },
  rating: {
    type: Number,
    default: 0
  },
  totalDeliveries: {
    type: Number,
    default: 0
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index for currentLocation
deliveryPartnerSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema); 