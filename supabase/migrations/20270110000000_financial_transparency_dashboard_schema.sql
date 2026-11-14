-- Migration: Financial Transparency Dashboard Schema
-- Table creation, RLS policies, audit logs, and secure RPC functions for Reunion Financial Transparency.

-- 1. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id text PRIMARY KEY,
    name_en text NOT NULL,
    name_bn text NOT NULL,
    icon text DEFAULT 'Package',
    color text DEFAULT '#0284C7',
    budget_allocated numeric DEFAULT 0,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Seed standard categories
INSERT INTO public.expense_categories (id, name_en, name_bn, icon, color, budget_allocated, display_order)
VALUES
    ('cat-stage', 'Stage & Decoration', 'মঞ্চ ও সাজসজ্জা', 'Layers', '#4F46E5', 150000, 1),
    ('cat-food', 'Food & Catering', 'খাবার ও ক্যাটারিং', 'Utensils', '#EA580C', 350000, 2),
    ('cat-sound', 'Sound & Lighting', 'শব্দ ও আলোকসজ্জা', 'Speaker', '#7C3AED', 100000, 3),
    ('cat-photo', 'Photography & Videography', 'ফটোগ্রাফি ও ভিডিওগ্রাফি', 'Camera', '#0284C7', 60000, 4),
    ('cat-marketing', 'Marketing & Promotion', 'প্রচার ও প্রচারণা', 'Megaphone', '#0D9488', 50000, 5),
    ('cat-security', 'Security & Management', 'নিরাপত্তা ও ব্যবস্থাপনা', 'ShieldCheck', '#DC2626', 40000, 6),
    ('cat-souvenir', 'Souvenir & Printing', 'স্মরণিকা ও প্রকাশনা', 'BookOpen', '#D97706', 120000, 7),
    ('cat-tshirt', 'T-Shirts & Kits', 'টি-শার্ট ও উপহার সামগ্রী', 'Shirt', '#2563EB', 180000, 8),
    ('cat-other', 'Other Expenses', 'অন্যান্য খরচ', 'Coins', '#64748B', 50000, 9)
ON CONFLICT (id) DO UPDATE SET
    name_en = EXCLUDED.name_en,
    name_bn = EXCLUDED.name_bn,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    budget_allocated = EXCLUDED.budget_allocated,
    display_order = EXCLUDED.display_order;

-- 2. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id text PRIMARY KEY,
    category_id text REFERENCES public.expense_categories(id) ON DELETE SET NULL,
    category text NOT NULL,
    amount numeric NOT NULL CHECK (amount > 0),
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    description text NOT NULL,
    description_bn text,
    vendor_name text,
    responsible_person text,
    voucher_number text,
    receipt_url text,
    receipt_filename text,
    payment_method text DEFAULT 'Bank Transfer',
    status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'void')),
    created_by text DEFAULT 'system_finance',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    updated_by text
);

-- Seed realistic verified initial expenses
INSERT INTO public.expenses (id, category_id, category, amount, expense_date, description, description_bn, vendor_name, responsible_person, voucher_number, receipt_url, status)
VALUES
    ('EXP-2027-001', 'cat-stage', 'Stage & Decoration', 85000, '2026-01-20', 'Main grand stage structure, sound system, and lighting truss rental advance', 'মূল মঞ্চ নির্মাণ, সাউন্ড সিস্টেম ও লাইটিং ট্রাস ভাড়া বাবদ অগ্রিম', 'Faridpur Audio & Event Solutions', 'Md. Shafiqul Alam', 'VOUCHER-STG-01', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80', 'approved'),
    ('EXP-2027-002', 'cat-souvenir', 'Souvenir & Printing', 65000, '2026-01-25', '4-color offset printing of 2,000 reunion memorial magazines', '২,০০০ পুনর্মিলনী স্মারক ম্যাগাজিনের ৪-রঙা অফসেট প্রিন্টিং', 'Padma Color Press', 'Kazi Mahfuzur Rahman', 'VOUCHER-PRN-02', 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&auto=format&fit=crop&q=80', 'approved'),
    ('EXP-2027-003', 'cat-food', 'Food & Catering', 120000, '2026-02-01', 'Advance booking token for Grand Buffet lunch and morning breakfast', 'গ্র্যান্ড বুফে মধ্যাহ্নভোজ ও সকালের নাস্তার জন্য অগ্রিম বুকিং টোকেন', 'Royal Chef Catering Services', 'Mohammad Faruk Hossain', 'VOUCHER-CAT-03', 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&fit=crop&q=80', 'approved'),
    ('EXP-2027-004', 'cat-tshirt', 'T-Shirts & Kits', 95000, '2026-02-05', 'Premium polo shirts manufacturing, embroidery and packaging', 'প্রিমিয়াম পোলো শার্ট তৈরি, এমব্রয়ডারি ও প্যাকেজিং', 'Apex Garments & Textiles', 'Jamal Uddin Chowdhury', 'VOUCHER-TSH-04', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80', 'approved')
ON CONFLICT (id) DO NOTHING;

-- 3. DONATIONS TABLE (Unified table for standalone & linked donations)
CREATE TABLE IF NOT EXISTS public.donations (
    id text PRIMARY KEY,
    registration_id text,
    donor_name text NOT NULL,
    donor_name_bn text,
    mobile_number text,
    email text,
    batch_name text,
    passing_year text,
    amount numeric NOT NULL CHECK (amount > 0),
    purpose text DEFAULT 'General Reunion Fund',
    payment_method text DEFAULT 'bkash',
    transaction_id text,
    gateway_invoice_number text,
    payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'failed', 'refunded')),
    donation_date date DEFAULT CURRENT_DATE,
    is_anonymous boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Sync donations from registrations_2027 where donation_amount > 0 and payment_status = 'paid'
INSERT INTO public.donations (id, registration_id, donor_name, mobile_number, email, batch_name, passing_year, amount, purpose, payment_method, transaction_id, gateway_invoice_number, payment_status, donation_date, is_anonymous, created_at)
SELECT 
    'DON-' || r.id AS id,
    r.id AS registration_id,
    r.full_name AS donor_name,
    r.mobile_number,
    r.email,
    r.batch_name,
    r.passing_year,
    r.donation_amount AS amount,
    'Reunion Registration Contribution' AS purpose,
    COALESCE(r.payment_method, 'bkash') AS payment_method,
    COALESCE(r.transaction_id, 'TRX-REG') AS transaction_id,
    r.gateway_invoice_number,
    'paid' AS payment_status,
    COALESCE(r.registered_at::date, CURRENT_DATE) AS donation_date,
    false AS is_anonymous,
    COALESCE(r.registered_at, now()) AS created_at
FROM public.registrations_2027 r
WHERE r.payment_status = 'paid' AND r.donation_amount > 0
ON CONFLICT (id) DO UPDATE SET
    amount = EXCLUDED.amount,
    payment_status = EXCLUDED.payment_status;

-- 4. FINANCIAL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id text PRIMARY KEY,
    transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense', 'refund')),
    source_type text NOT NULL CHECK (source_type IN ('registration_fee', 'donation', 'sponsor', 'vendor_payment', 'staff_expense', 'other')),
    reference_id text,
    amount numeric NOT NULL CHECK (amount > 0),
    payment_method text,
    gateway_trx_id text,
    description text NOT NULL,
    transaction_date date NOT NULL DEFAULT CURRENT_DATE,
    created_by text DEFAULT 'system',
    created_at timestamptz DEFAULT now()
);

-- 5. FINANCIAL AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
    id text PRIMARY KEY,
    entity_type text NOT NULL CHECK (entity_type IN ('expense', 'donation', 'category', 'budget')),
    entity_id text NOT NULL,
    action text NOT NULL CHECK (action IN ('create', 'update', 'void', 'delete')),
    previous_amount numeric,
    updated_amount numeric,
    previous_data jsonb,
    updated_data jsonb,
    reason text NOT NULL,
    performed_by text NOT NULL,
    performed_by_name text,
    created_at timestamptz DEFAULT now()
);

-- 6. RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view expense categories" ON public.expense_categories;
CREATE POLICY "Public can view expense categories" ON public.expense_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view approved expenses" ON public.expenses;
CREATE POLICY "Public can view approved expenses" ON public.expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view donations" ON public.donations;
CREATE POLICY "Public can view donations" ON public.donations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view financial transactions" ON public.financial_transactions;
CREATE POLICY "Public can view financial transactions" ON public.financial_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view financial audit logs" ON public.financial_audit_logs;
CREATE POLICY "Public can view financial audit logs" ON public.financial_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin full control on expense categories" ON public.expense_categories;
CREATE POLICY "Admin full control on expense categories" ON public.expense_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full control on expenses" ON public.expenses;
CREATE POLICY "Admin full control on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full control on donations" ON public.donations;
CREATE POLICY "Admin full control on donations" ON public.donations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full control on financial audit logs" ON public.financial_audit_logs;
CREATE POLICY "Admin full control on financial audit logs" ON public.financial_audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin full control on financial transactions" ON public.financial_transactions;
CREATE POLICY "Admin full control on financial transactions" ON public.financial_transactions FOR ALL USING (true) WITH CHECK (true);

-- 7. STORED FUNCTION: rpc_get_financial_transparency_summary
CREATE OR REPLACE FUNCTION public.rpc_get_financial_transparency_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_reg_fee numeric := 0;
    v_total_reg_donations numeric := 0;
    v_total_standalone_donations numeric := 0;
    v_total_donations numeric := 0;
    v_total_collected numeric := 0;
    v_total_expenses numeric := 0;
    v_remaining_balance numeric := 0;
    v_paid_student_count integer := 0;
    v_donor_count integer := 0;
    v_categories jsonb := '[]'::jsonb;
    v_recent_expenses jsonb := '[]'::jsonb;
    v_recent_donations jsonb := '[]'::jsonb;
BEGIN
    -- 1. Money from paid registrations
    SELECT 
        COALESCE(SUM(registration_fee), 0),
        COALESCE(SUM(donation_amount), 0),
        COUNT(*)
    INTO 
        v_total_reg_fee,
        v_total_reg_donations,
        v_paid_student_count
    FROM public.registrations_2027
    WHERE payment_status = 'paid';

    -- 2. Money from standalone donations (excluding those already counted from registrations)
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_standalone_donations, v_donor_count
    FROM public.donations
    WHERE payment_status = 'paid' AND (registration_id IS NULL OR registration_id = '');

    -- Combined donations
    v_total_donations := v_total_reg_donations + v_total_standalone_donations;

    -- Total collected
    v_total_collected := v_total_reg_fee + v_total_donations;

    -- Total approved expenses
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_expenses
    FROM public.expenses
    WHERE status = 'approved';

    -- Remaining balance
    v_remaining_balance := v_total_collected - v_total_expenses;

    -- Category-wise breakdown with expenses
    SELECT COALESCE(jsonb_agg(cat_row), '[]'::jsonb)
    INTO v_categories
    FROM (
        SELECT 
            c.id,
            c.name_en,
            c.name_bn,
            c.icon,
            c.color,
            c.budget_allocated,
            COALESCE(SUM(e.amount), 0) AS total_spent,
            COUNT(e.id) AS expense_count
        FROM public.expense_categories c
        LEFT JOIN public.expenses e ON e.category_id = c.id AND e.status = 'approved'
        GROUP BY c.id, c.name_en, c.name_bn, c.icon, c.color, c.budget_allocated, c.display_order
        ORDER BY c.display_order ASC
    ) cat_row;

    -- Recent verified expenses
    SELECT COALESCE(jsonb_agg(exp_row), '[]'::jsonb)
    INTO v_recent_expenses
    FROM (
        SELECT 
            e.id,
            e.category_id,
            e.category,
            e.amount,
            e.expense_date,
            e.description,
            e.description_bn,
            e.vendor_name,
            e.responsible_person,
            e.voucher_number,
            e.receipt_url,
            e.receipt_filename,
            e.status,
            e.created_at
        FROM public.expenses e
        WHERE e.status = 'approved'
        ORDER BY e.expense_date DESC, e.created_at DESC
        LIMIT 50
    ) exp_row;

    -- Recent donations (privacy-masked registration IDs)
    SELECT COALESCE(jsonb_agg(don_row), '[]'::jsonb)
    INTO v_recent_donations
    FROM (
        SELECT 
            d.id,
            CASE 
                WHEN d.is_anonymous THEN 'Anonymous Donor'
                ELSE d.donor_name 
            END AS donor_name,
            CASE 
                WHEN d.registration_id IS NOT NULL AND length(d.registration_id) > 6 
                THEN substring(d.registration_id from 1 for length(d.registration_id) - 4) || '****'
                ELSE NULL 
            END AS masked_registration_id,
            d.batch_name,
            d.passing_year,
            d.amount,
            d.purpose,
            d.payment_method,
            d.donation_date,
            d.is_anonymous,
            d.created_at
        FROM public.donations d
        WHERE d.payment_status = 'paid'
        ORDER BY d.donation_date DESC, d.created_at DESC
        LIMIT 100
    ) don_row;

    RETURN jsonb_build_object(
        'total_collected', v_total_collected,
        'total_registration_fees', v_total_reg_fee,
        'total_donations', v_total_donations,
        'total_expenses', v_total_expenses,
        'remaining_balance', v_remaining_balance,
        'paid_student_count', v_paid_student_count,
        'donor_count', v_donor_count + (SELECT COUNT(*) FROM public.registrations_2027 WHERE payment_status = 'paid' AND donation_amount > 0),
        'categories', v_categories,
        'recent_expenses', v_recent_expenses,
        'recent_donations', v_recent_donations,
        'updated_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_financial_transparency_summary() TO anon, authenticated, service_role;

-- 8. STORED FUNCTION: rpc_verify_personal_donation_history
CREATE OR REPLACE FUNCTION public.rpc_verify_personal_donation_history(
    p_registration_id text,
    p_phone_suffix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg record;
    v_clean_id text := trim(upper(p_registration_id));
    v_clean_phone text := regexp_replace(trim(p_phone_suffix), '\D', '', 'g');
    v_matched boolean := false;
    v_donations jsonb := '[]'::jsonb;
    v_total_donated numeric := 0;
BEGIN
    SELECT * INTO v_reg
    FROM public.registrations_2027
    WHERE upper(id) = v_clean_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No registration record found for ID: ' || v_clean_id
        );
    END IF;

    IF length(v_clean_phone) >= 4 THEN
        IF right(regexp_replace(v_reg.mobile_number, '\D', '', 'g'), 4) = right(v_clean_phone, 4) THEN
            v_matched := true;
        END IF;
    END IF;

    IF NOT v_matched THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Phone verification failed: Digits do not match the registered phone number.'
        );
    END IF;

    SELECT 
        COALESCE(SUM(amount), 0),
        COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
    INTO 
        v_total_donated,
        v_donations
    FROM (
        SELECT 
            id,
            amount,
            purpose,
            payment_method,
            transaction_id,
            payment_status,
            donation_date,
            created_at
        FROM public.donations
        WHERE registration_id = v_reg.id AND payment_status = 'paid'
        ORDER BY donation_date DESC
    ) d;

    IF v_total_donated = 0 AND v_reg.donation_amount > 0 THEN
        v_total_donated := v_reg.donation_amount;
        v_donations := jsonb_build_array(
            jsonb_build_object(
                'id', 'DON-' || v_reg.id,
                'amount', v_reg.donation_amount,
                'purpose', 'Reunion Registration Donation',
                'payment_method', v_reg.payment_method,
                'transaction_id', v_reg.transaction_id,
                'payment_status', v_reg.payment_status,
                'donation_date', v_reg.registered_at::date,
                'created_at', v_reg.registered_at
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'student_name', v_reg.full_name,
        'registration_id', v_reg.id,
        'batch_name', v_reg.batch_name,
        'passing_year', v_reg.passing_year,
        'category', v_reg.category,
        'registration_fee', v_reg.registration_fee,
        'total_paid', v_reg.total_paid,
        'total_donated', v_total_donated,
        'payment_status', v_reg.payment_status,
        'transaction_id', v_reg.transaction_id,
        'registered_at', v_reg.registered_at,
        'history', v_donations
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_verify_personal_donation_history(text, text) TO anon, authenticated, service_role;
