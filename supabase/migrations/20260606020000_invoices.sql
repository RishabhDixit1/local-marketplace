-- Invoice / GST billing for completed orders
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subtotal_paise bigint NOT NULL,
  commission_paise bigint NOT NULL DEFAULT 0,
  tax_paise bigint NOT NULL DEFAULT 0,
  total_paise bigint NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','cancelled','refunded')),
  gst_provider_gstin text,
  gst_consumer_gstin text,
  gst_rate numeric(5,2) DEFAULT 18.00,
  gst_cgst_paise bigint DEFAULT 0,
  gst_sgst_paise bigint DEFAULT 0,
  gst_igst_paise bigint DEFAULT 0,
  invoice_date timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_id ON public.invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_consumer_id ON public.invoices(consumer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = provider_id OR auth.uid() = consumer_id);

CREATE POLICY "Admins can manage invoices" ON public.invoices
  FOR ALL USING (true);

CREATE POLICY "System can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (true);
