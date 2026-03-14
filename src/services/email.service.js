const nodemailer = require('nodemailer');
const config = require('../config');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

async function sendBookingConfirmation(booking) {
  try {
    const t = getTransporter();
    await t.sendMail({
      from: config.smtp.from,
      to: booking.email,
      subject: `Conferma Prenotazione ${booking.booking_ref} - ${config.businessName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#ddd;padding:32px;border-radius:8px;">
          <h1 style="color:#c8e635;font-size:24px;">Prenotazione Confermata!</h1>
          <p>Ciao <strong>${booking.nome}</strong>,</p>
          <p>La tua prenotazione è stata confermata con successo.</p>
          <table style="width:100%;margin:24px 0;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#999;">Riferimento</td><td style="padding:8px 0;font-weight:bold;color:#c8e635;">${booking.booking_ref}</td></tr>
            <tr><td style="padding:8px 0;color:#999;">Esperienza</td><td style="padding:8px 0;">${booking.experience_name}</td></tr>
            <tr><td style="padding:8px 0;color:#999;">Data</td><td style="padding:8px 0;">${booking.date}</td></tr>
            <tr><td style="padding:8px 0;color:#999;">Orario</td><td style="padding:8px 0;">${booking.time}</td></tr>
            <tr><td style="padding:8px 0;color:#999;">Motoslitte</td><td style="padding:8px 0;">${booking.num_sleds}</td></tr>
            <tr><td style="padding:8px 0;color:#999;">Persone</td><td style="padding:8px 0;">${booking.num_people}</td></tr>
          </table>
          <p style="font-size:14px;color:#999;">Punto di ritrovo: Baita Belfud, SP2, 24010 Foppolo BG</p>
          <p style="font-size:14px;color:#999;">Si prega di arrivare 30 minuti prima dell'orario di partenza.</p>
          <p style="font-size:14px;color:#999;">Per domande: <a href="mailto:info@snowadventure.it" style="color:#c8e635;">info@snowadventure.it</a> | <a href="tel:+393397133695" style="color:#c8e635;">+39 339 7133695</a></p>
          <hr style="border:none;border-top:1px solid #333;margin:24px 0;">
          <p style="font-size:11px;color:#666;">Snow Adventure Foppolo &copy; ${new Date().getFullYear()}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

async function sendGiftCardEmail(giftCard) {
  try {
    const t = getTransporter();
    const to = giftCard.recipient_email || giftCard.purchaser_email;
    await t.sendMail({
      from: config.smtp.from,
      to,
      subject: `La tua Gift Card ${config.businessName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#ddd;padding:32px;border-radius:8px;">
          <h1 style="color:#c8e635;font-size:24px;">Gift Card Snow Adventure</h1>
          ${giftCard.personal_message ? `<p style="font-style:italic;color:#bbb;">"${giftCard.personal_message}"</p>` : ''}
          <div style="text-align:center;margin:32px 0;padding:24px;background:#1a1a1a;border:2px dashed #c8e635;border-radius:8px;">
            <p style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:2px;">Codice Gift Card</p>
            <p style="font-size:28px;font-weight:bold;color:#c8e635;letter-spacing:4px;">${giftCard.code}</p>
            <p style="font-size:24px;margin-top:12px;">${(giftCard.amount_cents / 100).toFixed(0)}€</p>
          </div>
          <p style="font-size:14px;color:#999;">Valida fino al: ${new Date(giftCard.expires_at).toLocaleDateString('it-IT')}</p>
          <p style="font-size:14px;color:#999;">Presenta questo codice al momento della prenotazione su snowadventure.it</p>
          <hr style="border:none;border-top:1px solid #333;margin:24px 0;">
          <p style="font-size:11px;color:#666;">Snow Adventure Foppolo &copy; ${new Date().getFullYear()}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Gift card email error:', err.message);
  }
}

async function sendContactNotification(contact) {
  try {
    const t = getTransporter();
    await t.sendMail({
      from: config.smtp.from,
      to: config.smtp.user,
      subject: `Nuovo messaggio da ${contact.nome} ${contact.cognome}`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Nuovo messaggio dal sito</h2>
          <p><strong>Nome:</strong> ${contact.nome} ${contact.cognome}</p>
          <p><strong>Email:</strong> ${contact.email}</p>
          ${contact.phone ? `<p><strong>Telefono:</strong> ${contact.phone}</p>` : ''}
          <p><strong>Messaggio:</strong></p>
          <p style="background:#f5f5f5;padding:16px;border-radius:4px;">${contact.message}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Contact email error:', err.message);
  }
}

module.exports = { sendBookingConfirmation, sendGiftCardEmail, sendContactNotification };
