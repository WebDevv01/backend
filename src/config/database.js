const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Set JWT secret
process.env.JWT_SECRET = 'gaterunner-secret-key-2024';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb+srv://Raghu:root@cluster0.dfz4z.mongodb.net/gaterunner", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 