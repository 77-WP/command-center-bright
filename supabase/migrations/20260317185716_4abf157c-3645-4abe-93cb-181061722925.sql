-- Allow admin/staff to insert categories
CREATE POLICY "Admin Insert Categories"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
);

-- Allow admin/staff to update categories
CREATE POLICY "Admin Update Categories"
ON public.categories
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
)
WITH CHECK (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
);