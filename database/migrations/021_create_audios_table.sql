-- Migration: Create audios_pabx table
-- Description: Table for storing audio files uploaded by agents
-- Date: 2025-01-25

CREATE TABLE IF NOT EXISTS audios_pabx (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    agent_id UUID,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Foreign key constraints
    CONSTRAINT fk_audios_user FOREIGN KEY (user_id) REFERENCES users_pabx(id) ON DELETE CASCADE,
    CONSTRAINT fk_audios_agent FOREIGN KEY (agent_id) REFERENCES agentes_pabx(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audios_user_id ON audios_pabx(user_id);
CREATE INDEX IF NOT EXISTS idx_audios_agent_id ON audios_pabx(agent_id);
CREATE INDEX IF NOT EXISTS idx_audios_created_at ON audios_pabx(created_at DESC);

-- Add comments
COMMENT ON TABLE audios_pabx IS 'Table for storing audio files uploaded by agents';
COMMENT ON COLUMN audios_pabx.id IS 'Unique identifier for the audio file';
COMMENT ON COLUMN audios_pabx.user_id IS 'ID of the user who owns the audio';
COMMENT ON COLUMN audios_pabx.agent_id IS 'ID of the agent (if exclusive to agent, NULL if shared)';
COMMENT ON COLUMN audios_pabx.name IS 'Display name of the audio file';
COMMENT ON COLUMN audios_pabx.file_path IS 'Path to the physical audio file';
COMMENT ON COLUMN audios_pabx.created_at IS 'Timestamp when the audio was uploaded';
