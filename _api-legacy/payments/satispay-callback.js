const { supabase } = require('../_lib/supabase');
const { sendBookingConfirmation } = require('../_lib/email');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ref } = req.query;
  const { status, id } = req.body;

  if (status === 'ACCEPTED' && ref) {
    await supabase.from('bookings').update({ status: 'confirmed', payment_id: id }).eq('booking_ref', ref);

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, calendar_slots(date, time, experiences(name))')
      .eq('booking_ref', ref)
      .single();

    if (booking) {
      await sendBookingConfirmation({
        ...booking,
        date: booking.calendar_slots.date,
        time: booking.calendar_slots.time,
        experience_name: booking.calendar_slots.experiences.name,
      });
    }
  }

  res.json({ received: true });
};
