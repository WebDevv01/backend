const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const logger = require('./middleware/logger');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Connect to MongoDB
connectDB().then(async () => {
  // Seed admin user if not exists
  try {
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' });
    if (!existingAdmin) {
      const admin = new User({
        email: 'admin@gmail.com',
        password: 'Admin@123', // This will be hashed by the pre-save middleware
        role: 'admin',
        isActive: true
      });
      await admin.save();
      console.log('Admin account created successfully');
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(logger);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/student'));
app.use('/api/delivery-partners', require('./routes/deliveryPartner'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/parcels', require('./routes/parcel'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.url}`, {
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 9876;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 