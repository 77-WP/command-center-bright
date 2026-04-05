-- =============================================================================
-- SECURITY HARDENING: Comprehensive RLS policies for all tables
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times — all statements use IF NOT EXISTS or DROP IF EXISTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY on every table that needs it
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_banners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keep_alive              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.options                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_groups           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. HELPER: reusable inline role-check expression (used inside policies)
--    Resolves current user's role from user_roles table.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. orders — authenticated users have full access (internal admin tool only)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Authenticated can select orders') THEN
    CREATE POLICY "Authenticated can select orders"
      ON public.orders FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Authenticated can insert orders') THEN
    CREATE POLICY "Authenticated can insert orders"
      ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='orders' AND policyname='Authenticated can update orders') THEN
    CREATE POLICY "Authenticated can update orders"
      ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. menu_items — public read (active items only), admin/staff write
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_items' AND policyname='Anon can select active menu items') THEN
    CREATE POLICY "Anon can select active menu items"
      ON public.menu_items FOR SELECT TO anon USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_items' AND policyname='Authenticated can select all menu items') THEN
    CREATE POLICY "Authenticated can select all menu items"
      ON public.menu_items FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_items' AND policyname='Admin/staff can insert menu items') THEN
    CREATE POLICY "Admin/staff can insert menu items"
      ON public.menu_items FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_items' AND policyname='Admin/staff can update menu items') THEN
    CREATE POLICY "Admin/staff can update menu items"
      ON public.menu_items FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_items' AND policyname='Admin/staff can delete menu items') THEN
    CREATE POLICY "Admin/staff can delete menu items"
      ON public.menu_items FOR DELETE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. hero_banners — public read (active only), admin/staff write
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hero_banners' AND policyname='Anon can select active banners') THEN
    CREATE POLICY "Anon can select active banners"
      ON public.hero_banners FOR SELECT TO anon USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hero_banners' AND policyname='Authenticated can select all banners') THEN
    CREATE POLICY "Authenticated can select all banners"
      ON public.hero_banners FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hero_banners' AND policyname='Admin/staff can insert banners') THEN
    CREATE POLICY "Admin/staff can insert banners"
      ON public.hero_banners FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hero_banners' AND policyname='Admin/staff can update banners') THEN
    CREATE POLICY "Admin/staff can update banners"
      ON public.hero_banners FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='hero_banners' AND policyname='Admin/staff can delete banners') THEN
    CREATE POLICY "Admin/staff can delete banners"
      ON public.hero_banners FOR DELETE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. app_settings — public read, admin-only write (security-sensitive settings)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Anyone can select app settings') THEN
    CREATE POLICY "Anyone can select app settings"
      ON public.app_settings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_settings' AND policyname='Admin only can update app settings') THEN
    CREATE POLICY "Admin only can update app settings"
      ON public.app_settings FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. site_content — public read, admin/staff write
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_content' AND policyname='Anyone can select site content') THEN
    CREATE POLICY "Anyone can select site content"
      ON public.site_content FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_content' AND policyname='Admin/staff can insert site content') THEN
    CREATE POLICY "Admin/staff can insert site content"
      ON public.site_content FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='site_content' AND policyname='Admin/staff can update site content') THEN
    CREATE POLICY "Admin/staff can update site content"
      ON public.site_content FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. marketing_links — authenticated only (internal analytics tool)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_links' AND policyname='Authenticated can select marketing links') THEN
    CREATE POLICY "Authenticated can select marketing links"
      ON public.marketing_links FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_links' AND policyname='Authenticated can insert marketing links') THEN
    CREATE POLICY "Authenticated can insert marketing links"
      ON public.marketing_links FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_links' AND policyname='Authenticated can update marketing links') THEN
    CREATE POLICY "Authenticated can update marketing links"
      ON public.marketing_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='marketing_links' AND policyname='Authenticated can delete marketing links') THEN
    CREATE POLICY "Authenticated can delete marketing links"
      ON public.marketing_links FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. events — public insert (storefront tracking), authenticated read
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='Anyone can insert events') THEN
    CREATE POLICY "Anyone can insert events"
      ON public.events FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='Authenticated can select events') THEN
    CREATE POLICY "Authenticated can select events"
      ON public.events FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. keep_alive — authenticated only
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='keep_alive' AND policyname='Authenticated can manage keep_alive') THEN
    CREATE POLICY "Authenticated can manage keep_alive"
      ON public.keep_alive FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11. user_roles — CRITICAL: prevents privilege escalation
--     Only admins can manage roles; all authenticated users can read their own role
--     (needed for the inline sub-select role checks in other policies)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Authenticated can select user_roles') THEN
    CREATE POLICY "Authenticated can select user_roles"
      ON public.user_roles FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Admin only can insert user_roles') THEN
    CREATE POLICY "Admin only can insert user_roles"
      ON public.user_roles FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Admin only can update user_roles') THEN
    CREATE POLICY "Admin only can update user_roles"
      ON public.user_roles FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='Admin only can delete user_roles') THEN
    CREATE POLICY "Admin only can delete user_roles"
      ON public.user_roles FOR DELETE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 12. customers — authenticated only (contains PII: phone numbers)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Authenticated can select customers') THEN
    CREATE POLICY "Authenticated can select customers"
      ON public.customers FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Authenticated can insert customers') THEN
    CREATE POLICY "Authenticated can insert customers"
      ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='Authenticated can update customers') THEN
    CREATE POLICY "Authenticated can update customers"
      ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 13. options — public read (storefront needs prices/names), admin/staff write
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='options' AND policyname='Anyone can select options') THEN
    CREATE POLICY "Anyone can select options"
      ON public.options FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='options' AND policyname='Admin/staff can insert options') THEN
    CREATE POLICY "Admin/staff can insert options"
      ON public.options FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='options' AND policyname='Admin/staff can update options') THEN
    CREATE POLICY "Admin/staff can update options"
      ON public.options FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='options' AND policyname='Admin/staff can delete options') THEN
    CREATE POLICY "Admin/staff can delete options"
      ON public.options FOR DELETE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 14. menu_item_option_groups — public read, admin/staff write
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_item_option_groups' AND policyname='Anyone can select menu_item_option_groups') THEN
    CREATE POLICY "Anyone can select menu_item_option_groups"
      ON public.menu_item_option_groups FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_item_option_groups' AND policyname='Admin/staff can insert menu_item_option_groups') THEN
    CREATE POLICY "Admin/staff can insert menu_item_option_groups"
      ON public.menu_item_option_groups FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_item_option_groups' AND policyname='Admin/staff can update menu_item_option_groups') THEN
    CREATE POLICY "Admin/staff can update menu_item_option_groups"
      ON public.menu_item_option_groups FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='menu_item_option_groups' AND policyname='Admin/staff can delete menu_item_option_groups') THEN
    CREATE POLICY "Admin/staff can delete menu_item_option_groups"
      ON public.menu_item_option_groups FOR DELETE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 15. option_groups — FIX: drop overly-permissive policies (any authenticated),
--     replace with admin/staff only, add public read
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to insert option_groups" ON public.option_groups;
DROP POLICY IF EXISTS "Allow authenticated users to update option_groups" ON public.option_groups;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='option_groups' AND policyname='Anyone can select option_groups') THEN
    CREATE POLICY "Anyone can select option_groups"
      ON public.option_groups FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='option_groups' AND policyname='Admin/staff can insert option_groups') THEN
    CREATE POLICY "Admin/staff can insert option_groups"
      ON public.option_groups FOR INSERT TO authenticated
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='option_groups' AND policyname='Admin/staff can update option_groups') THEN
    CREATE POLICY "Admin/staff can update option_groups"
      ON public.option_groups FOR UPDATE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      )
      WITH CHECK (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='option_groups' AND policyname='Admin/staff can delete option_groups') THEN
    CREATE POLICY "Admin/staff can delete option_groups"
      ON public.option_groups FOR DELETE TO authenticated
      USING (
        (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) IN ('admin', 'staff')
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 16. orders — add non-negative grand_total constraint (data integrity)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_grand_total_non_negative' AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_grand_total_non_negative CHECK (grand_total >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 17. categories — enable RLS (was missing) + public read, admin/staff write
--     Previous migrations created INSERT/UPDATE/DELETE policies but never
--     enabled RLS or added a SELECT policy, which blocked all reads.
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='Anyone can select categories') THEN
    CREATE POLICY "Anyone can select categories"
      ON public.categories FOR SELECT USING (true);
  END IF;
END $$;
