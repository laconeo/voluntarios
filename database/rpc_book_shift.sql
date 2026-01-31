-- Function to book a shift atomically preventing overbooking
-- Updated to generate a custom ID for the booking within the PL/pgSQL block
CREATE OR REPLACE FUNCTION book_shift(
  p_user_id TEXT,
  p_shift_id TEXT,
  p_status TEXT DEFAULT 'confirmed'
) RETURNS JSONB AS $$
DECLARE
  v_shift_record RECORD;
  v_count INTEGER;
  v_booking_id TEXT;
  v_new_booking_id TEXT;
BEGIN
  -- Generate a custom ID similar to frontend logic (simple timestamp based)
  -- In production, a more robust UUID or sequence is preferred, but this matches current app pattern
  v_new_booking_id := 'booking_' || floor(extract(epoch from now()) * 1000)::text || '_' || substring(md5(random()::text) from 1 for 6);

  -- 1. Lock the shift row
  SELECT * INTO v_shift_record
  FROM shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Turno no encontrado');
  END IF;

  -- 2. Check if user already booked
  IF EXISTS (SELECT 1 FROM bookings WHERE user_id = p_user_id AND shift_id = p_shift_id AND status NOT IN ('cancelled', 'rejected')) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ya estás inscripto en este turno (o pendiente)');
  END IF;

  -- 3. Double Booking Check
  IF p_status IN ('confirmed', 'pending_approval') THEN
      IF EXISTS (
          SELECT 1 
          FROM bookings b
          JOIN shifts s ON b.shift_id = s.id
          WHERE b.user_id = p_user_id 
            AND b.status IN ('confirmed', 'pending_approval')
            AND s.date = v_shift_record.date 
            AND s.time_slot = v_shift_record.time_slot
      ) THEN
          RETURN jsonb_build_object('success', false, 'message', 'Ya tienes un turno activo en este horario');
      END IF;
  END IF;

  -- 4. Capacity Check
  IF p_status != 'waitlist' THEN
      SELECT count(*) INTO v_count
      FROM bookings
      WHERE shift_id = p_shift_id AND status IN ('confirmed', 'pending_approval');

      IF v_count >= v_shift_record.total_vacancies THEN
        RETURN jsonb_build_object('success', false, 'message', 'El turno está completo', 'code', 'FULL');
      END IF;
  END IF;

  -- 5. Insert with manually generated ID
  INSERT INTO bookings (id, user_id, shift_id, event_id, status, requested_at)
  VALUES (v_new_booking_id, p_user_id, p_shift_id, v_shift_record.event_id, p_status, now())
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql;
