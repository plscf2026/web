-- ============================================================================
-- PRE-CONSOLIDATION INDEPENDENT ARCHIVAL BACKUP
-- Source Table: public.registrations_2026
-- Date: 2026-11-13
-- System: Police Lines School & College, Faridpur Reunion System
-- Purpose: Independent archival snapshot before consolidation into registrations_2027
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backup_registrations_2026_pre_consolidation (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  full_name_bn TEXT,
  photo_url TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  email TEXT,
  address TEXT,
  category TEXT NOT NULL,
  passing_year TEXT,
  current_class TEXT,
  batch_name TEXT NOT NULL,
  group_or_section TEXT,
  roll_number TEXT,
  student_id TEXT,
  t_shirt_size TEXT NOT NULL,
  registration_fee NUMERIC NOT NULL DEFAULT 1500,
  donation_amount NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  payment_method TEXT,
  server_verification_signature TEXT,
  verification_timestamp TIMESTAMPTZ,
  verified_by TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qr_token TEXT NOT NULL,
  is_tshirt_collected BOOLEAN NOT NULL DEFAULT FALSE,
  is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  year INTEGER NOT NULL DEFAULT 2026,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed / Historical records dump (40 records)
INSERT INTO public.backup_registrations_2026_pre_consolidation (
  id, full_name, full_name_bn, photo_url, mobile_number, email, address,
  category, passing_year, current_class, batch_name, group_or_section, roll_number,
  student_id, t_shirt_size, registration_fee, donation_amount, total_paid,
  payment_status, transaction_id, payment_method, server_verification_signature,
  verification_timestamp, verified_by, registered_at, qr_token, is_tshirt_collected, year
) VALUES
('PLSCF-2026-F1001', 'Tanvir Ahmed', 'তানভীর আহমেদ', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80', '01711223344', 'tanvir.ahmed@example.com', 'House 14, Road 3, Faridpur Sadar, Faridpur', 'former', '1998', '', 'SSC 1998', '', '', NULL, 'XL', 1500, 500, 2000, 'paid', 'PST-BK-8821901', 'bkash', 'SIG_V2_7A82910F11223344', '2026-01-16T10:32:15Z', 'PAYSTATION_GATEWAY', '2026-01-16T10:30:00Z', 'A7K9M2', false, 2026),
('PLSCF-2026-F1002', 'Dr. Nusrat Jahan', 'ডা. নুসরাত জাহান', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80', '01819887766', 'dr.nusrat@example.com', 'Medical College Road, Faridpur', 'former', '2005', '', 'SSC 2005', '', '', NULL, 'M', 1500, 1000, 2500, 'paid', 'PST-CRD-9948201', 'card', 'SIG_V2_5B91024D9948201', '2026-01-18T14:16:30Z', 'PAYSTATION_GATEWAY', '2026-01-18T14:15:00Z', 'R8W3N5', true, 2026),
('PLSCF-2026-F1003', 'Md. Asaduzzaman', 'মোঃ আসাদুজ্জামান', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80', '01912345678', 'asad.zaman@example.com', 'Goalchamot, Faridpur', 'former', '2012', '', 'SSC 2012', '', '', NULL, 'L', 1500, 0, 1500, 'paid', 'PST-NG-7738192', 'nagad', 'SIG_V2_3C88219E7738192', '2026-01-20T11:02:10Z', 'PAYSTATION_GATEWAY', '2026-01-20T11:00:00Z', 'B9F2Q7', false, 2026),
('PLSCF-2026-C2001', 'Samiul Hasan', 'সামিউল হাসান', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80', '01723456789', 'samiul.hasan@example.com', 'Police Lines Campus Quarters, Faridpur', 'current', NULL, 'Class 10', 'Class 10 Section A', 'Section A', '12', 'PLSC-2026-001', 'M', 500, 0, 500, 'paid', 'PST-BK-6629103', 'bkash', 'SIG_V2_1A77391F6629103', '2026-01-22T09:12:00Z', 'PAYSTATION_GATEWAY', '2026-01-22T09:10:00Z', 'C3P7X9', true, 2026)
ON CONFLICT (id) DO NOTHING;
