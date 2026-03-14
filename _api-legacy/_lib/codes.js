const { v4: uuidv4 } = require('uuid');

function generateBookingRef() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const code = uuidv4().slice(0, 4).toUpperCase();
  return `SA-${date}-${code}`;
}

function generateGiftCardCode() {
  const code = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `SA-GC-${code}`;
}

function generateVoucherCode() {
  const code = uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `SA-V-${code}`;
}

module.exports = { generateBookingRef, generateGiftCardCode, generateVoucherCode };
