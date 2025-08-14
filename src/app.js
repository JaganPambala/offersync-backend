const express = require('express');
const config = require('config');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

require('./startUp/routes')(app);
require('./startUp/config')();

const port = config.get('port');
const dbUri = config.get('db.url');

mongoose.connect(dbUri)
  .then(() => {
    console.log('✅ Database connected successfully');
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });