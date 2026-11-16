-- Migration: 20270125000000_tshirt_and_food_live_sync_and_toggle_rpcs.sql
-- Description: Real-time synchronization and admin toggle authority for T-Shirt and Food distributions

-- 1. AUTO-SYNCHRONIZATION TRIGGER: dress_distributions -> registrations_2027.is_tshirt_collected
CREATE OR REPLACE FUNCTION public.trg_sync_dress_distribution_to_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'RECEIVED' THEN
      UPDATE public.registrations_2027
      SET is_tshirt_collected = true
      WHERE id = NEW.registration_id;
    ELSIF NEW.status IN ('RETURNED', 'CANCELLED') THEN
      UPDATE public.registrations_2027
      SET is_tshirt_collected = false
      WHERE id = NEW.registration_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.registrations_2027
    SET is_tshirt_collected = false
    WHERE id = OLD.registration_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_dress_sync_registration ON public.dress_distributions;
CREATE TRIGGER trg_dress_sync_registration
  AFTER INSERT OR UPDATE OR DELETE ON public.dress_distributions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_dress_distribution_to_registration();

-- 2. IMMEDIATELY SYNC EXISTING DRESS DISTRIBUTIONS INTO REGISTRATIONS_2027
UPDATE public.registrations_2027 r
SET is_tshirt_collected = true
FROM public.dress_distributions d
WHERE r.id = d.registration_id AND d.status = 'RECEIVED';

-- 3. DEDICATED SECURITY DEFINER RPC: rpc_toggle_tshirt_distribution
CREATE OR REPLACE FUNCTION public.rpc_toggle_tshirt_distribution(
  p_reg_id TEXT,
  p_collected BOOLEAN,
  p_staff_id TEXT DEFAULT 'ADMIN',
  p_staff_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_res JSONB;
BEGIN
  SELECT id, full_name, t_shirt_size, batch_name INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_reg_id OR student_id = p_reg_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found in registrations_2027: ' || p_reg_id);
  END IF;

  -- Update registration column directly
  UPDATE public.registrations_2027
  SET is_tshirt_collected = p_collected
  WHERE id = v_reg.id;

  IF p_collected THEN
    INSERT INTO public.dress_distributions (
      id, registration_id, student_name, item_type, registered_size,
      status, received_at, staff_id, staff_name
    ) VALUES (
      'DRS-' || floor(extract(epoch from now()) * 1000)::text || '-' || floor(random() * 900 + 100)::text,
      v_reg.id,
      v_reg.full_name,
      'reunion_tshirt',
      COALESCE(v_reg.t_shirt_size, 'L'),
      'RECEIVED',
      now(),
      COALESCE(p_staff_id, 'ADMIN'),
      COALESCE(p_staff_name, 'Admin')
    )
    ON CONFLICT (registration_id, item_type)
    DO UPDATE SET
      status = 'RECEIVED',
      received_at = now(),
      staff_id = EXCLUDED.staff_id,
      staff_name = EXCLUDED.staff_name,
      registered_size = COALESCE(v_reg.t_shirt_size, dress_distributions.registered_size);
  ELSE
    -- Mark as RETURNED so it can be re-scanned, and update timestamp
    UPDATE public.dress_distributions
    SET status = 'RETURNED',
        corrected_by = COALESCE(p_staff_name, 'Admin'),
        correction_reason = 'Admin toggled to Pending',
        corrected_at = now()
    WHERE registration_id = v_reg.id AND item_type = 'reunion_tshirt';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg.id,
    'is_tshirt_collected', p_collected
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_toggle_tshirt_distribution(TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. DEDICATED SECURITY DEFINER RPC: rpc_toggle_food_distribution
CREATE OR REPLACE FUNCTION public.rpc_toggle_food_distribution(
  p_reg_id TEXT,
  p_meal_type TEXT,
  p_collected BOOLEAN,
  p_staff_id TEXT DEFAULT 'ADMIN',
  p_staff_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_meal TEXT := lower(trim(p_meal_type));
BEGIN
  IF v_meal NOT IN ('breakfast', 'lunch', 'dinner') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid meal type: must be breakfast, lunch, or dinner');
  END IF;

  SELECT id, full_name, batch_name INTO v_reg
  FROM public.registrations_2027
  WHERE id = p_reg_id OR student_id = p_reg_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found in registrations_2027: ' || p_reg_id);
  END IF;

  IF p_collected THEN
    INSERT INTO public.food_distributions (
      id, registration_id, student_name, batch_name, meal_type,
      status, collected_at, staff_id, staff_name
    ) VALUES (
      'FOOD-' || floor(extract(epoch from now()) * 1000)::text || '-' || floor(random() * 900 + 100)::text,
      v_reg.id,
      v_reg.full_name,
      COALESCE(v_reg.batch_name, 'General'),
      v_meal,
      'COLLECTED',
      now(),
      COALESCE(p_staff_id, 'ADMIN'),
      COALESCE(p_staff_name, 'Admin')
    )
    ON CONFLICT (registration_id, meal_type)
    DO UPDATE SET
      status = 'COLLECTED',
      collected_at = now(),
      staff_id = EXCLUDED.staff_id,
      staff_name = EXCLUDED.staff_name;
  ELSE
    -- Delete row or mark CANCELLED so student can receive again
    DELETE FROM public.food_distributions
    WHERE registration_id = v_reg.id AND meal_type = v_meal;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg.id,
    'meal_type', v_meal,
    'collected', p_collected
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_toggle_food_distribution(TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. PERMISSIVE RLS POLICY FOR STAFF UPDATE FLAGS
DROP POLICY IF EXISTS "registrations_2027_staff_update_flags" ON public.registrations_2027;
CREATE POLICY "registrations_2027_staff_update_flags" ON public.registrations_2027
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. ENABLE REALTIME PUBLICATION FOR DRESS, FOOD & REGISTRATIONS
ALTER TABLE public.dress_distributions REPLICA IDENTITY FULL;
ALTER TABLE public.food_distributions REPLICA IDENTITY FULL;
ALTER TABLE public.registrations_2027 REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.food_distributions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.dress_distributions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations_2027;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END;
$$;
