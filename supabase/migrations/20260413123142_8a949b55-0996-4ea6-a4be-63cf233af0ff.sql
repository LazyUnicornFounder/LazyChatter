
-- Room progress checklist state
CREATE TABLE public.room_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  logo_done BOOLEAN NOT NULL DEFAULT false,
  waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
  shared BOOLEAN NOT NULL DEFAULT false,
  first_signup BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.room_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read room progress"
ON public.room_progress FOR SELECT USING (true);

CREATE POLICY "Anyone can insert room progress"
ON public.room_progress FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update room progress"
ON public.room_progress FOR UPDATE USING (true);

-- Waitlist emails collected from shipped sites
CREATE TABLE public.waitlist_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read waitlist emails"
ON public.waitlist_emails FOR SELECT USING (true);

CREATE POLICY "Anyone can add waitlist emails"
ON public.waitlist_emails FOR INSERT WITH CHECK (true);

-- Enable realtime for waitlist to detect first signup
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist_emails;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_progress;
