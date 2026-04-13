-- Create rooms table
CREATE TABLE public.rooms (
  id TEXT PRIMARY KEY CHECK (char_length(id) = 6),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shipped BOOLEAN NOT NULL DEFAULT false,
  deployed_url TEXT
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rooms" ON public.rooms FOR UPDATE USING (true);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_emoji TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  type TEXT NOT NULL DEFAULT 'chat' CHECK (type IN ('chat', 'system', 'ship-success')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);

CREATE INDEX idx_messages_room_id ON public.messages(room_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;