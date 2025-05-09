const otpGenerator = require("otp-generator");
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Generate OTP
const generateOTP = () => {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
};

// Send OTP email
const sendDeliveryOTP = async (email, otp) => {
  try {
    const msg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: 'Your Delivery OTP',
      text: `Your OTP for parcel delivery is: ${otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request this OTP, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2196F3;">Delivery OTP Verification</h2>
          <p>Your OTP for parcel delivery is:</p>
          <h1 style="color: #1976D2; font-size: 32px; letter-spacing: 5px; margin: 20px 0;">${otp}</h1>
          <p>This OTP will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you did not request this OTP, please ignore this email.</p>
        </div>
      `
    };

    const [response] = await sgMail.send(msg); // <-- Destructure the array
    console.log('SendGrid Response Status Code:', response.statusCode);
    console.log('SendGrid Response Headers:', response.headers);
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
};

module.exports = {
  generateOTP,
  sendDeliveryOTP,
};
