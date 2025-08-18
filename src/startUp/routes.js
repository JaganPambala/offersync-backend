const express = require("express");
const authRoutes = require("../controllers/auth.controller");
const candidateRoutes = require("../controllers/candidate.controller");
const companyRoutes = require("../controllers/company");
const offerRoutes = require("../controllers/offers.controller");
const communicationRoutes = require("../controllers/communication.controller");

module.exports = function (app) {
  console.log("Routes loaded");
  if (authRoutes) app.use("/api/auth", authRoutes);
  if (companyRoutes) app.use("/api/company", companyRoutes);
  if (candidateRoutes) app.use("/api/candidate", candidateRoutes);
  if (offerRoutes) app.use("/api/offers", offerRoutes);
  if (communicationRoutes) app.use("/api/communication", communicationRoutes);
};
