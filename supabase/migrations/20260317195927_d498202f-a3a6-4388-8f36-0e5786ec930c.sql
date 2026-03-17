-- Allow admin/staff to delete categories
CREATE POLICY "Admin Delete Categories"
ON public.categories
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = ANY (ARRAY['admin'::app_role, 'staff'::app_role])
);
