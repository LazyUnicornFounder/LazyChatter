
-- Page views tracking
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  referrer TEXT,
  country TEXT
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read page views"
ON public.page_views FOR SELECT USING (true);

CREATE POLICY "Anyone can insert page views"
ON public.page_views FOR INSERT WITH CHECK (true);

-- Add remix count to rooms
ALTER TABLE public.rooms ADD COLUMN remix_count INTEGER NOT NULL DEFAULT 0;
