const config = require('config');

module.exports = function() {
  if (!config.get('jwtSecret')) {
    throw new Error('FATAL ERROR: jwtToken is not defined.');
  }
}