const express = require('express');
const config = require('config');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(morgan('combined', { stream: logger.stream }));
app.use(requestLogger);

require('./startUp/routes')(app);
require('./startUp/config')();

const port = config.get('port');
const dbUri = config.get('db.url');

// Unhandled rejection handler
process.on('unhandledRejection', (ex) => {
  logger.error('Unhandled Promise Rejection:', ex);
  // Optional: process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (ex) => {
  logger.error('Uncaught Exception:', ex);
  // Optional: process.exit(1);
});

mongoose.connect(dbUri)
  .then(() => {
    logger.info('✅ Database connected successfully');
    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    logger.error('❌ Database connection error:', err);
    process.exit(1);
  });