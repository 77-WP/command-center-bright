
-- Allow authenticated users to insert new option groups
CREATE POLICY "Allow authenticated users to insert option_groups"
ON public.option_groups
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update option groups
CREATE POLICY "Allow authenticated users to update option_groups"
ON public.option_groups
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
