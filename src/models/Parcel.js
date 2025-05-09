const mongoose = require('mongoose');

const parcelSchema = new mongoose.Schema({
  deliveryOtp: {
    code: String,
    expiresAt: Date,
    verified: {
      type: Boolean,
      default: false
    }
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  deliveryPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner'
  },
  trackingNumber: {
    type: String,
    required: true,
    unique: true
  },
  courierPartner: {
    type: String,
    required: true,
    enum: ['amazon', 'flipkart', 'other']
  },
  orderDetails: {
    orderId: String,
    orderDate: Date,
    estimatedDeliveryDate: Date
  },
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  deliveryAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student.addresses',
    required: true
  },
  status: {
    type: String,
    enum: [
      'pending',
      'accepted',
      'picked_up',
      'out_for_delivery',
      'delivered',
      'cancelled'
    ],
    default: 'pending'
  },
  payment: {
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['cash', 'online', 'upi'],
      required: true
    }
  },
  notes: String,
  deliveryOtp: {
    code: String,
    expiresAt: Date,
    verified: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create geospatial index for pickupLocation
parcelSchema.index({ pickupLocation: '2dsphere' });

// Update the updatedAt field before saving
parcelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Parcel', parcelSchema); 