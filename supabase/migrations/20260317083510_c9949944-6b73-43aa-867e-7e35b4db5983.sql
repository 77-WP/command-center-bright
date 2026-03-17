-- Add sequential order number for display
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number SERIAL;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
