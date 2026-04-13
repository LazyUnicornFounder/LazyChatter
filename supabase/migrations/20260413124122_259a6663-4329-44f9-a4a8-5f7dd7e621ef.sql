-- Feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert feedback" ON public.feedback FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read feedback" ON public.feedback FOR SELECT TO public USING (true);

-- Enable realtime for feedback
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback;

-- Create logos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow public read on logos bucket
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');

-- Allow public insert on logos bucket  
CREATE POLICY "Anyone can upload logos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'logos');