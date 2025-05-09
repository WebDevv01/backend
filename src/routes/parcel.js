const express = require("express");
const { generateOTP, sendDeliveryOTP } = require("../utils/email");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const { auth, authorize } = require("../middleware/auth");
const Parcel = require("../models/Parcel");
const Student = require("../models/Student");
const DeliveryPartner = require("../models/DeliveryPartner");

// Get all parcels for student
router.get("/student", auth, authorize("student"), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const parcels = await Parcel.find({ student: student._id })
      .populate("deliveryPartner", "firstName lastName phoneNumber")
      .sort({ createdAt: -1 });

    res.json(parcels);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching parcels", error: error.message });
  }
});

// Get available parcels for delivery partners
router.get(
  "/available",
  auth,
  authorize("deliveryPartner"),
  async (req, res) => {
    try {
      const deliveryPartner = await DeliveryPartner.findOne({
        user: req.user._id,
      });
      if (!deliveryPartner || !deliveryPartner.isApproved) {
        return res
          .status(403)
          .json({
            message:
              "Your account is not approved by admin yet! Please contact to admin",
          });
      }

      const parcels = await Parcel.find({
        status: "pending",
        deliveryPartner: { $exists: false },
      }).populate("student", "firstName lastName phoneNumber");

      res.json(parcels);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error fetching available parcels",
          error: error.message,
        });
    }
  }
);

// Create parcel request
router.post("/", auth, authorize("student"), async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const parcel = new Parcel({
      ...req.body,
      student: student._id,
      status: "pending",
    });

    await parcel.save();
    res.status(201).json(parcel);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating parcel request", error: error.message });
  }
});

// Accept parcel request
router.patch(
  "/:id/accept",
  auth,
  authorize("deliveryPartner"),
  async (req, res) => {
    try {
      const deliveryPartner = await DeliveryPartner.findOne({
        user: req.user._id,
      });
      if (!deliveryPartner || !deliveryPartner.isApproved) {
        return res
          .status(403)
          .json({
            message:
              "Your account is not approved by admin yet! Please contact to admin",
          });
      }

      const parcel = await Parcel.findById(req.params.id);
      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }

      if (parcel.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Parcel is not available for pickup" });
      }

      parcel.deliveryPartner = deliveryPartner._id;
      parcel.status = "accepted";
      await parcel.save();

      res.json(parcel);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error accepting parcel", error: error.message });
    }
  }
);

// Update parcel status
// Generate and send OTP for delivery verification
router.post(
  "/:id/delivery-otp",
  auth,
  authorize("deliveryPartner"),
  async (req, res) => {
    try {
      const parcel = await Parcel.findById(req.params.id).populate(
        "student",
        "user"
      );

      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }

      if (parcel.status !== "out_for_delivery") {
        return res
          .status(400)
          .json({ message: "Parcel must be out for delivery to generate OTP" });
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP valid for 10 minutes

      // Save OTP to parcel
      parcel.deliveryOtp = {
        code: otp,
        expiresAt: expiresAt,
        verified: false,
      };
      await parcel.save();

      // Get student email
      const student = await Student.findById(parcel.student).populate(
        "user",
        "email"
      );
      if (!student || !student.user.email) {
        return res.status(400).json({ message: "Student email not found" });
      }

      // Send OTP email
      const emailSent = await sendDeliveryOTP(student.user.email, otp);
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send OTP email" });
      }

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error generating OTP", error: error.message });
    }
  }
);

// Verify OTP and update parcel status
router.patch(
  "/:id/verify-otp",
  auth,
  authorize("deliveryPartner"),
  async (req, res) => {
    try {
      const { otp } = req.body;
      const parcel = await Parcel.findById(req.params.id);

      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }

      if (!parcel.deliveryOtp || !parcel.deliveryOtp.code) {
        return res
          .status(400)
          .json({ message: "No OTP generated for this parcel" });
      }

      if (parcel.deliveryOtp.verified) {
        return res.status(400).json({ message: "OTP already verified" });
      }

      if (new Date() > parcel.deliveryOtp.expiresAt) {
        return res.status(400).json({ message: "OTP has expired" });
      }

      if (parcel.deliveryOtp.code !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      parcel.deliveryOtp.verified = true;
      await parcel.save();

      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ message: "Error verifying OTP" });
    }
  }
);

// Update parcel status
router.patch(
  "/:id/status",
  auth,
  authorize("deliveryPartner"),
  async (req, res) => {
    try {
      const { status } = req.body;
      const parcel = await Parcel.findById(req.params.id);

      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }

      // Check OTP verification for delivered status
      if (status === "delivered") {
        if (!parcel.deliveryOtp || !parcel.deliveryOtp.verified) {
          return res
            .status(400)
            .json({
              message: "OTP verification required before marking as delivered",
            });
        }

        if (parcel.payment.status !== "completed") {
          return res
            .status(400)
            .json({
              message: "Payment must be completed before marking as delivered",
            });
        }
      }

      const deliveryPartner = await DeliveryPartner.findOne({
        user: req.user._id,
      });
      if (!deliveryPartner) {
        return res
          .status(403)
          .json({ message: "Delivery partner profile not found" });
      }

      if (
        parcel.deliveryPartner.toString() !== deliveryPartner._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this parcel" });
      }

      // If marking as delivered, ensure payment is completed
      if (status === "delivered" && parcel.payment.status !== "completed") {
        return res
          .status(400)
          .json({
            message: "Payment must be completed before marking as delivered",
          });
      }

      parcel.status = status;
      if (status === "delivered") {
        parcel.deliveredAt = new Date();
      }

      await parcel.save();

      // Update delivery partner's total earnings if parcel is delivered
      if (status === "delivered") {
        deliveryPartner.totalEarnings += parcel.payment.amount;
        await deliveryPartner.save();
      }

      res.json(parcel);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error updating parcel status",
          error: error.message,
        });
    }
  }
);

// Update payment status
router.patch(
  "/:id/payment",
  auth,
  authorize("deliveryPartner"),
  async (req, res) => {
    try {
      const { method, upiId, status } = req.body;
      const parcel = await Parcel.findById(req.params.id);

      if (!parcel) {
        return res.status(404).json({ message: "Parcel not found" });
      }

      const deliveryPartner = await DeliveryPartner.findOne({
        user: req.user._id,
      });
      if (!deliveryPartner) {
        return res
          .status(403)
          .json({ message: "Delivery partner profile not found" });
      }

      if (
        parcel.deliveryPartner.toString() !== deliveryPartner._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this parcel" });
      }

      parcel.payment = {
        ...parcel.payment,
        method,
        upiId,
        status,
        completedAt: status === "completed" ? new Date() : undefined,
      };

      await parcel.save();
      res.json(parcel);
    } catch (error) {
      res
        .status(500)
        .json({
          message: "Error updating payment status",
          error: error.message,
        });
    }
  }
);

// Get single parcel by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const parcel = await Parcel.findById(req.params.id)
      .populate("student", "firstName lastName phoneNumber")
      .populate("deliveryPartner", "firstName lastName phoneNumber");

    if (!parcel) {
      return res.status(404).json({ message: "Parcel not found" });
    }

    // Check if user is authorized to view this parcel
    if (req.user.role === "student") {
      const student = await Student.findOne({ user: req.user._id });
      if (!student) {
        return res.status(403).json({ message: "Student profile not found" });
      }
      if (parcel.student._id.toString() !== student._id.toString()) {
        return res
          .status(403)
          .json({ message: "Not authorized to view this parcel" });
      }
    } else if (req.user.role === "deliveryPartner") {
      const deliveryPartner = await DeliveryPartner.findOne({
        user: req.user._id,
      });
      if (!deliveryPartner || !deliveryPartner.isApproved) {
        return res
          .status(403)
          .json({
            message:
              "Your account is not approved by admin yet! Please contact to admin",
          });
      }
      if (
        parcel.deliveryPartner &&
        parcel.deliveryPartner._id.toString() !== deliveryPartner._id.toString()
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to view this parcel" });
      }
    } else {
      return res
        .status(403)
        .json({ message: "Not authorized to view this parcel" });
    }

    res.json(parcel);
  } catch (error) {
    console.error("Error fetching parcel:", error);
    res.status(500).json({ message: "Error fetching parcel" });
  }
});

module.exports = router;
