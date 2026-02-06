-- Crime Data Tables for Geo-Risk Assessment
-- Stores city, county, and state-level crime statistics
-- Data source: FBI Uniform Crime Reporting (UCR)

-- ============================================
-- CITY-LEVEL CRIME DATA
-- ============================================
CREATE TABLE IF NOT EXISTS city_crime_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_name VARCHAR(255) NOT NULL,
    state_code VARCHAR(2) NOT NULL, -- Two-letter state code (e.g., 'TN', 'CA')
    state_name VARCHAR(100) NOT NULL, -- Full state name (e.g., 'Tennessee')
    
    -- Crime statistics (per 100,000 population)
    violent_crime_rate INTEGER NOT NULL,
    property_crime_rate INTEGER NOT NULL,
    
    -- Population data
    population INTEGER,
    
    -- Data source and versioning
    data_year INTEGER NOT NULL DEFAULT 2022,
    data_source VARCHAR(255) DEFAULT 'FBI UCR',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for fast lookups
    CONSTRAINT unique_city_state UNIQUE (city_name, state_code, data_year)
);

-- Index for fast city lookups
CREATE INDEX idx_city_crime_lookup ON city_crime_data(city_name, state_code);
CREATE INDEX idx_city_crime_state ON city_crime_data(state_code);

-- ============================================
-- COUNTY-LEVEL CRIME DATA
-- ============================================
CREATE TABLE IF NOT EXISTS county_crime_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    county_name VARCHAR(255) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    
    -- Crime statistics (per 100,000 population)
    violent_crime_rate INTEGER NOT NULL,
    property_crime_rate INTEGER NOT NULL,
    
    -- Population data
    population INTEGER,
    
    -- Data source and versioning
    data_year INTEGER NOT NULL DEFAULT 2022,
    data_source VARCHAR(255) DEFAULT 'FBI UCR',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for fast lookups
    CONSTRAINT unique_county_state UNIQUE (county_name, state_code, data_year)
);

-- Index for fast county lookups
CREATE INDEX idx_county_crime_lookup ON county_crime_data(county_name, state_code);
CREATE INDEX idx_county_crime_state ON county_crime_data(state_code);

-- ============================================
-- STATE-LEVEL CRIME DATA
-- ============================================
CREATE TABLE IF NOT EXISTS state_crime_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code VARCHAR(2) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    
    -- Crime statistics (per 100,000 population)
    violent_crime_rate INTEGER NOT NULL,
    property_crime_rate INTEGER NOT NULL,
    
    -- Overall rating
    overall_rating VARCHAR(50), -- 'Negligible', 'Low', 'Moderate', 'High', 'Critical'
    
    -- Data source and versioning
    data_year INTEGER NOT NULL DEFAULT 2022,
    data_source VARCHAR(255) DEFAULT 'FBI UCR',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for fast lookups
    CONSTRAINT unique_state_year UNIQUE (state_code, data_year)
);

-- Index for fast state lookups
CREATE INDEX idx_state_crime_lookup ON state_crime_data(state_code);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE city_crime_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE county_crime_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_crime_data ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view crime data)
CREATE POLICY "Public read access for city crime data"
    ON city_crime_data FOR SELECT
    USING (true);

CREATE POLICY "Public read access for county crime data"
    ON county_crime_data FOR SELECT
    USING (true);

CREATE POLICY "Public read access for state crime data"
    ON state_crime_data FOR SELECT
    USING (true);

-- Only authenticated admins can insert/update/delete
-- (You can adjust this based on your admin role setup)
CREATE POLICY "Admin write access for city crime data"
    ON city_crime_data FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin write access for county crime data"
    ON county_crime_data FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin write access for state crime data"
    ON state_crime_data FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get crime data with multi-tier fallback
CREATE OR REPLACE FUNCTION get_crime_data_with_fallback(
    p_city VARCHAR,
    p_county VARCHAR,
    p_state_code VARCHAR,
    p_data_year INTEGER DEFAULT 2022
)
RETURNS TABLE (
    granularity VARCHAR,
    location_name VARCHAR,
    violent_crime_rate INTEGER,
    property_crime_rate INTEGER,
    population INTEGER,
    data_source VARCHAR
) AS $$
BEGIN
    -- Try city-level first
    RETURN QUERY
    SELECT 
        'city'::VARCHAR as granularity,
        city_name || ', ' || state_code as location_name,
        violent_crime_rate,
        property_crime_rate,
        population,
        data_source
    FROM city_crime_data
    WHERE city_name ILIKE p_city
        AND state_code = p_state_code
        AND data_year = p_data_year
    LIMIT 1;
    
    -- If found, return
    IF FOUND THEN
        RETURN;
    END IF;
    
    -- Try county-level
    RETURN QUERY
    SELECT 
        'county'::VARCHAR as granularity,
        county_name || ', ' || state_code as location_name,
        violent_crime_rate,
        property_crime_rate,
        population,
        data_source
    FROM county_crime_data
    WHERE county_name ILIKE p_county
        AND state_code = p_state_code
        AND data_year = p_data_year
    LIMIT 1;
    
    -- If found, return
    IF FOUND THEN
        RETURN;
    END IF;
    
    -- Fall back to state-level
    RETURN QUERY
    SELECT 
        'state'::VARCHAR as granularity,
        state_name as location_name,
        violent_crime_rate,
        property_crime_rate,
        NULL::INTEGER as population,
        data_source
    FROM state_crime_data
    WHERE state_code = p_state_code
        AND data_year = p_data_year
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE city_crime_data IS 'FBI UCR city-level crime statistics - supports 18,000+ US cities';
COMMENT ON TABLE county_crime_data IS 'FBI UCR county-level crime statistics - covers all US counties';
COMMENT ON TABLE state_crime_data IS 'FBI UCR state-level crime statistics - covers all 50 states';

COMMENT ON FUNCTION get_crime_data_with_fallback IS 'Multi-tier fallback function: tries city → county → state';
