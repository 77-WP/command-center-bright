
ALTER TABLE public.app_settings
ADD COLUMN is_upsell_active boolean DEFAULT false,
ADD COLUMN upsell_title text DEFAULT 'เพิ่มเติมไหมคะ?';
