-- ============================================================
-- Migración: Corrección de Permisos RLS para Stand PC
-- Ejecutar en el SQL Editor de Supabase para permitir que la 
-- extensión registre y actualice el estado de las PCs.
-- ============================================================

-- 1. Asegurar que las tablas tengan RLS habilitado
ALTER TABLE pcs_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora_uso ENABLE ROW LEVEL SECURITY;

-- 2. Política para pcs_status: permitir TODO a la anon key
--    Esto permite que la extensión inserte nuevas PCs y actualice su estado.
DROP POLICY IF EXISTS "pcs_status_public_all" ON pcs_status;
CREATE POLICY "pcs_status_public_all" ON pcs_status 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 3. Política para bitacora_uso: permitir insertar reportes y leerlos
DROP POLICY IF EXISTS "bitacora_uso_public_insert" ON bitacora_uso;
CREATE POLICY "bitacora_uso_public_insert" ON bitacora_uso 
FOR INSERT 
TO anon 
WITH CHECK (true);

DROP POLICY IF EXISTS "bitacora_uso_public_read" ON bitacora_uso;
CREATE POLICY "bitacora_uso_public_read" ON bitacora_uso 
FOR SELECT 
TO anon 
USING (true);

-- 4. Verificación de permisos
SELECT 
    schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('pcs_status', 'bitacora_uso');
