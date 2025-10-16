-- Messaging System Database Setup

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create message_threads table (for grouping conversations)
CREATE TABLE IF NOT EXISTS message_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    participant_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(participant_1, participant_2)
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messages
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT 
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send messages" ON messages
    FOR INSERT 
    WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their received messages" ON messages
    FOR UPDATE 
    USING (auth.uid() = to_user_id);

-- RLS Policies for message_threads
CREATE POLICY "Users can view their threads" ON message_threads
    FOR SELECT 
    USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create threads" ON message_threads
    FOR INSERT 
    WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_participant1 ON message_threads(participant_1);
CREATE INDEX IF NOT EXISTS idx_threads_participant2 ON message_threads(participant_2);

-- Function to update thread timestamp
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE message_threads
    SET last_message_at = NEW.created_at
    WHERE (participant_1 = NEW.from_user_id AND participant_2 = NEW.to_user_id)
       OR (participant_1 = NEW.to_user_id AND participant_2 = NEW.from_user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update thread timestamp when new message is sent
CREATE TRIGGER update_thread_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_timestamp();
