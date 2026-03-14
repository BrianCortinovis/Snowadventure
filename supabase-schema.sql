-- Snow Adventure - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor

-- Experiences
CREATE TABLE experiences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  duration TEXT,
  price_cents INTEGER,
  max_sleds INTEGER DEFAULT 6,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar slots
CREATE TABLE calendar_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  max_sleds INTEGER NOT NULL DEFAULT 6,
  notes TEXT,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(experience_id, date, time)
);

-- Bookings
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_ref TEXT UNIQUE NOT NULL,
  slot_id UUID NOT NULL REFERENCES calendar_slots(id),
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  num_sleds INTEGER NOT NULL DEFAULT 1,
  num_people INTEGER NOT NULL,
  gift_card_code TEXT,
  voucher_code TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed','expired')),
  payment_method TEXT CHECK(payment_method IN ('stripe','paypal','satispay')),
  payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  discount_cents INTEGER DEFAULT 0,
  privacy_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Cards
CREATE TABLE gift_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  experience_slug TEXT,
  amount_cents INTEGER NOT NULL,
  purchaser_nome TEXT NOT NULL,
  purchaser_cognome TEXT NOT NULL,
  purchaser_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_email TEXT,
  personal_message TEXT,
  payment_id TEXT,
  payment_method TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','used','expired','cancelled')),
  used_booking_id UUID REFERENCES bookings(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vouchers
CREATE TABLE vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage','fixed')),
  discount_value INTEGER NOT NULL,
  description TEXT,
  max_uses INTEGER DEFAULT 1,
  times_used INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery Images
CREATE TABLE gallery_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Messages
CREATE TABLE contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  privacy_consent BOOLEAN NOT NULL DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_slots_date ON calendar_slots(date);
CREATE INDEX idx_slots_experience ON calendar_slots(experience_id, date);
CREATE INDEX idx_bookings_slot ON bookings(slot_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_ref ON bookings(booking_ref);
CREATE INDEX idx_giftcards_code ON gift_cards(code);
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_gallery_sort ON gallery_images(sort_order);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed experiences
INSERT INTO experiences (slug, name, duration, price_cents, max_sleds, description) VALUES
  ('sunset', 'Orobic Sunset Tour', '1.5 ore', 15000, 6, 'Escursione al tramonto in motoslitta fino a 2.200m con aperitivo in quota.'),
  ('night', 'Night Tour Adventure', '3 ore', 17000, 6, 'Escursione notturna in motoslitta con cena in rifugio nelle Alpi Orobie.'),
  ('freeride', 'Private Freeride Ski Shuttle', NULL, 0, 4, 'Servizio motoslitta privato per raggiungere le piste fuoripista.');

-- Enable RLS on all tables
ALTER TABLE experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read experiences" ON experiences FOR SELECT USING (true);
CREATE POLICY "Public read visible gallery" ON gallery_images FOR SELECT USING (is_visible = true);
CREATE POLICY "Public read calendar slots" ON calendar_slots FOR SELECT USING (is_blocked = false);

-- Service role (used by API functions) bypasses RLS, so no admin policies needed

-- Storage bucket (run separately or via dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true);
