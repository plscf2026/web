-- Seed standard expense categories and harmonize rpc_get_financial_transparency_summary with staff expenses
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

CREATE OR REPLACE FUNCTION public.rpc_get_financial_transparency_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_total_reg_fee numeric := 0;
    v_total_reg_donations numeric := 0;
    v_total_standalone_donations numeric := 0;
    v_total_donations numeric := 0;
    v_total_collected numeric := 0;
    v_total_direct_expenses numeric := 0;
    v_total_staff_approved_expenses numeric := 0;
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

    -- 2. Money from standalone donations
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_standalone_donations, v_donor_count
    FROM public.donations
    WHERE payment_status = 'paid' AND (registration_id IS NULL OR registration_id = '');

    v_total_donations := v_total_reg_donations + v_total_standalone_donations;
    v_total_collected := v_total_reg_fee + v_total_donations;

    -- 3. Direct approved expense vouchers
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_direct_expenses
    FROM public.expenses
    WHERE status = 'approved';

    -- 4. Approved staff expenses ONLY (excludes SUBMITTED, REJECTED, VOIDED, and deduplicates against expenses)
    SELECT COALESCE(SUM(se.amount), 0)
    INTO v_total_staff_approved_expenses
    FROM public.staff_expenses se
    WHERE se.status = 'APPROVED'
      AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = se.id);

    v_total_expenses := v_total_direct_expenses + v_total_staff_approved_expenses;
    v_remaining_balance := v_total_collected - v_total_expenses;

    -- Category breakdown with live approved spend
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
            COALESCE(
                (
                    SELECT SUM(amount)
                    FROM (
                        SELECT e.amount
                        FROM public.expenses e
                        WHERE e.status = 'approved' AND (e.category_id = c.id OR e.category = c.name_en)
                        UNION ALL
                        SELECT se.amount
                        FROM public.staff_expenses se
                        WHERE se.status = 'APPROVED'
                          AND (
                            se.category ILIKE '%' || c.name_en || '%'
                            OR (c.id = 'cat-food' AND se.category ILIKE '%Food%')
                            OR (c.id = 'cat-stage' AND (se.category ILIKE '%Stage%' OR se.category ILIKE '%Logistics%'))
                            OR (c.id = 'cat-souvenir' AND (se.category ILIKE '%Printing%' OR se.category ILIKE '%Souvenir%'))
                            OR (c.id = 'cat-security' AND (se.category ILIKE '%Sanitation%' OR se.category ILIKE '%Medical%'))
                            OR (c.id = 'cat-tshirt' AND se.category ILIKE '%Uniform%')
                            OR (c.id = 'cat-other' AND se.category ILIKE '%Supplies%')
                          )
                          AND NOT EXISTS (SELECT 1 FROM public.expenses ex WHERE ex.id = se.id)
                    ) combined_exp
                ),
                0
            ) AS total_spent,
            COALESCE(
                (
                    SELECT COUNT(*)
                    FROM (
                        SELECT e.id
                        FROM public.expenses e
                        WHERE e.status = 'approved' AND (e.category_id = c.id OR e.category = c.name_en)
                        UNION ALL
                        SELECT se.id
                        FROM public.staff_expenses se
                        WHERE se.status = 'APPROVED'
                          AND (
                            se.category ILIKE '%' || c.name_en || '%'
                            OR (c.id = 'cat-food' AND se.category ILIKE '%Food%')
                            OR (c.id = 'cat-stage' AND (se.category ILIKE '%Stage%' OR se.category ILIKE '%Logistics%'))
                            OR (c.id = 'cat-souvenir' AND (se.category ILIKE '%Printing%' OR se.category ILIKE '%Souvenir%'))
                            OR (c.id = 'cat-security' AND (se.category ILIKE '%Sanitation%' OR se.category ILIKE '%Medical%'))
                            OR (c.id = 'cat-tshirt' AND se.category ILIKE '%Uniform%')
                            OR (c.id = 'cat-other' AND se.category ILIKE '%Supplies%')
                          )
                          AND NOT EXISTS (SELECT 1 FROM public.expenses ex WHERE ex.id = se.id)
                    ) combined_cnt
                ),
                0
            ) AS expense_count
        FROM public.expense_categories c
        ORDER BY c.display_order ASC
    ) cat_row;

    -- Recent verified expenses
    SELECT COALESCE(jsonb_agg(exp_row), '[]'::jsonb)
    INTO v_recent_expenses
    FROM (
        SELECT * FROM (
            SELECT
                e.id,
                e.category_id,
                e.category,
                e.amount,
                e.expense_date::text AS expense_date,
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
            UNION ALL
            SELECT
                se.id,
                CASE
                    WHEN se.category ILIKE '%Food%' THEN 'cat-food'
                    WHEN se.category ILIKE '%Stage%' OR se.category ILIKE '%Logistics%' THEN 'cat-stage'
                    WHEN se.category ILIKE '%Sound%' THEN 'cat-sound'
                    WHEN se.category ILIKE '%Photo%' THEN 'cat-photo'
                    WHEN se.category ILIKE '%Marketing%' THEN 'cat-marketing'
                    WHEN se.category ILIKE '%Sanitation%' OR se.category ILIKE '%Medical%' THEN 'cat-security'
                    WHEN se.category ILIKE '%Printing%' OR se.category ILIKE '%Souvenir%' THEN 'cat-souvenir'
                    WHEN se.category ILIKE '%Uniform%' THEN 'cat-tshirt'
                    ELSE 'cat-other'
                END AS category_id,
                se.category,
                se.amount,
                se.expense_date::text AS expense_date,
                se.description,
                NULL::text AS description_bn,
                se.vendor_name,
                se.staff_name AS responsible_person,
                se.id AS voucher_number,
                se.receipt_url,
                NULL::text AS receipt_filename,
                'approved'::text AS status,
                se.created_at
            FROM public.staff_expenses se
            WHERE se.status = 'APPROVED'
              AND NOT EXISTS (SELECT 1 FROM public.expenses ex WHERE ex.id = se.id)
        ) all_exp
        ORDER BY created_at DESC
        LIMIT 15
    ) exp_row;

    -- Recent confirmed donations (exclude failed and anonymous/masked appropriately)
    SELECT COALESCE(jsonb_agg(don_row), '[]'::jsonb)
    INTO v_recent_donations
    FROM (
        SELECT
            d.id,
            d.donor_name,
            CASE
                WHEN d.registration_id IS NOT NULL AND length(d.registration_id) > 6
                THEN substr(d.registration_id, 1, length(d.registration_id) - 4) || '****'
                ELSE d.registration_id
            END AS masked_registration_id,
            d.batch_name,
            d.passing_year,
            d.amount,
            d.purpose,
            d.payment_method,
            d.donation_date::text AS donation_date,
            d.is_anonymous,
            d.created_at
        FROM public.donations d
        WHERE d.payment_status = 'paid'
        ORDER BY d.amount DESC
        LIMIT 20
    ) don_row;

    RETURN jsonb_build_object(
        'total_collected', v_total_collected,
        'total_registration_fees', v_total_reg_fee,
        'total_donations', v_total_donations,
        'total_expenses', v_total_expenses,
        'remaining_balance', v_remaining_balance,
        'paid_student_count', v_paid_student_count,
        'donor_count', v_donor_count,
        'categories', v_categories,
        'recent_expenses', v_recent_expenses,
        'recent_donations', v_recent_donations,
        'updated_at', now()
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_get_financial_transparency_summary() TO anon, authenticated, service_role;
