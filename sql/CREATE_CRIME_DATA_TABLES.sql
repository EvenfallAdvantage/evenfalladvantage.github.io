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
    
    -- Overall crime statistics (per 100,000 population)
    violent_crime_rate INTEGER NOT NULL,
    property_crime_rate INTEGER NOT NULL,
    total_crime_rate INTEGER, -- Sum of violent + property
    
    -- Violent crime breakdown (per 100,000 population)
    murder_rate DECIMAL(10,2),
    rape_rate DECIMAL(10,2),
    robbery_rate DECIMAL(10,2),
    aggravated_assault_rate DECIMAL(10,2),
    
    -- Property crime breakdown (per 100,000 population)
    burglary_rate DECIMAL(10,2),
    larceny_theft_rate DECIMAL(10,2),
    motor_vehicle_theft_rate DECIMAL(10,2),
    arson_rate DECIMAL(10,2),
    
    -- Clearance rates (percentage of crimes solved)
    violent_clearance_rate DECIMAL(5,2), -- e.g., 45.5 = 45.5%
    property_clearance_rate DECIMAL(5,2),
    
    -- Trend analysis
    violent_crime_trend VARCHAR(20), -- 'increasing', 'stable', 'decreasing'
    property_crime_trend VARCHAR(20),
    year_over_year_change DECIMAL(5,2), -- Percentage change from previous year
    previous_year_violent_rate INTEGER, -- For comparison
    
    -- Population and density
    population INTEGER,
    area_square_miles DECIMAL(10,2),
    crime_density DECIMAL(10,2), -- Crimes per square mile
    
    -- Risk indicators
    top_violent_crime_type VARCHAR(50), -- e.g., 'Aggravated Assault'
    top_property_crime_type VARCHAR(50), -- e.g., 'Larceny-Theft'
    
    -- Data source and versioning
    data_year INTEGER NOT NULL DEFAULT 2022,
    data_source VARCHAR(255) DEFAULT 'FBI UCR',
    data_quality VARCHAR(20) DEFAULT 'verified', -- 'verified', 'estimated', 'partial'
    
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
    
    -- Overall crime statistics (per 100,000 population)
    violent_crime_rate INTEGER NOT NULL,
    property_crime_rate INTEGER NOT NULL,
    total_crime_rate INTEGER,
    
    -- Violent crime breakdown (per 100,000 population)
    murder_rate DECIMAL(10,2),
    rape_rate DECIMAL(10,2),
    robbery_rate DECIMAL(10,2),
    aggravated_assault_rate DECIMAL(10,2),
    
    -- Property crime breakdown (per 100,000 population)
    burglary_rate DECIMAL(10,2),
    larceny_theft_rate DECIMAL(10,2),
    motor_vehicle_theft_rate DECIMAL(10,2),
    arson_rate DECIMAL(10,2),
    
    -- Clearance rates (percentage of crimes solved)
    violent_clearance_rate DECIMAL(5,2),
    property_clearance_rate DECIMAL(5,2),
    
    -- Trend analysis
    violent_crime_trend VARCHAR(20),
    property_crime_trend VARCHAR(20),
    year_over_year_change DECIMAL(5,2),
    previous_year_violent_rate INTEGER,
    
    -- Population and density
    population INTEGER,
    area_square_miles DECIMAL(10,2),
    crime_density DECIMAL(10,2),
    
    -- Risk indicators
    top_violent_crime_type VARCHAR(50),
    top_property_crime_type VARCHAR(50),
    
    -- Data source and versioning
    data_year INTEGER NOT NULL DEFAULT 2022,
    data_source VARCHAR(255) DEFAULT 'FBI UCR',
    data_quality VARCHAR(20) DEFAULT 'verified',
    
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
    
    -- Overall crime statistics (per 100,000 population)
    violent_crime_rate INTEGER NOT NULL,
    property_crime_rate INTEGER NOT NULL,
    total_crime_rate INTEGER,
    
    -- Violent crime breakdown (per 100,000 population)
    murder_rate DECIMAL(10,2),
    rape_rate DECIMAL(10,2),
    robbery_rate DECIMAL(10,2),
    aggravated_assault_rate DECIMAL(10,2),
    
    -- Property crime breakdown (per 100,000 population)
    burglary_rate DECIMAL(10,2),
    larceny_theft_rate DECIMAL(10,2),
    motor_vehicle_theft_rate DECIMAL(10,2),
    arson_rate DECIMAL(10,2),
    
    -- Clearance rates (percentage of crimes solved)
    violent_clearance_rate DECIMAL(5,2),
    property_clearance_rate DECIMAL(5,2),
    
    -- Trend analysis
    violent_crime_trend VARCHAR(20),
    property_crime_trend VARCHAR(20),
    year_over_year_change DECIMAL(5,2),
    previous_year_violent_rate INTEGER,
    
    -- Risk indicators
    top_violent_crime_type VARCHAR(50),
    top_property_crime_type VARCHAR(50),
    overall_rating VARCHAR(50), -- 'Negligible', 'Low', 'Moderate', 'High', 'Critical'
    
    -- Data source and versioning
    data_year INTEGER NOT NULL DEFAULT 2022,
    data_source VARCHAR(255) DEFAULT 'FBI UCR',
    data_quality VARCHAR(20) DEFAULT 'verified',
    
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

-- Function to get crime data with multi-tier fallback (returns all detailed fields)
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
    total_crime_rate INTEGER,
    population INTEGER,
    data_source VARCHAR,
    -- Crime breakdowns
    murder_rate DECIMAL,
    rape_rate DECIMAL,
    robbery_rate DECIMAL,
    aggravated_assault_rate DECIMAL,
    burglary_rate DECIMAL,
    larceny_theft_rate DECIMAL,
    motor_vehicle_theft_rate DECIMAL,
    arson_rate DECIMAL,
    -- Clearance rates
    violent_clearance_rate DECIMAL,
    property_clearance_rate DECIMAL,
    -- Trends
    violent_crime_trend VARCHAR,
    property_crime_trend VARCHAR,
    year_over_year_change DECIMAL,
    previous_year_violent_rate INTEGER,
    -- Top crime types
    top_violent_crime_type VARCHAR,
    top_property_crime_type VARCHAR,
    -- Density
    area_square_miles DECIMAL,
    crime_density DECIMAL,
    -- Data quality
    data_quality VARCHAR
) AS $$
BEGIN
    -- Try city-level first
    RETURN QUERY
    SELECT 
        'city'::VARCHAR as granularity,
        city_name || ', ' || state_code as location_name,
        c.violent_crime_rate,
        c.property_crime_rate,
        c.total_crime_rate,
        c.population,
        c.data_source,
        c.murder_rate,
        c.rape_rate,
        c.robbery_rate,
        c.aggravated_assault_rate,
        c.burglary_rate,
        c.larceny_theft_rate,
        c.motor_vehicle_theft_rate,
        c.arson_rate,
        c.violent_clearance_rate,
        c.property_clearance_rate,
        c.violent_crime_trend,
        c.property_crime_trend,
        c.year_over_year_change,
        c.previous_year_violent_rate,
        c.top_violent_crime_type,
        c.top_property_crime_type,
        c.area_square_miles,
        c.crime_density,
        c.data_quality
    FROM city_crime_data c
    WHERE c.city_name ILIKE p_city
        AND c.state_code = p_state_code
        AND c.data_year = p_data_year
    LIMIT 1;
    
    IF FOUND THEN
        RETURN;
    END IF;
    
    -- Try county-level
    RETURN QUERY
    SELECT 
        'county'::VARCHAR as granularity,
        county_name || ', ' || state_code as location_name,
        co.violent_crime_rate,
        co.property_crime_rate,
        co.total_crime_rate,
        co.population,
        co.data_source,
        co.murder_rate,
        co.rape_rate,
        co.robbery_rate,
        co.aggravated_assault_rate,
        co.burglary_rate,
        co.larceny_theft_rate,
        co.motor_vehicle_theft_rate,
        co.arson_rate,
        co.violent_clearance_rate,
        co.property_clearance_rate,
        co.violent_crime_trend,
        co.property_crime_trend,
        co.year_over_year_change,
        co.previous_year_violent_rate,
        co.top_violent_crime_type,
        co.top_property_crime_type,
        co.area_square_miles,
        co.crime_density,
        co.data_quality
    FROM county_crime_data co
    WHERE co.county_name ILIKE p_county
        AND co.state_code = p_state_code
        AND co.data_year = p_data_year
    LIMIT 1;
    
    IF FOUND THEN
        RETURN;
    END IF;
    
    -- Fall back to state-level
    RETURN QUERY
    SELECT 
        'state'::VARCHAR as granularity,
        s.state_name as location_name,
        s.violent_crime_rate,
        s.property_crime_rate,
        s.total_crime_rate,
        NULL::INTEGER as population,
        s.data_source,
        s.murder_rate,
        s.rape_rate,
        s.robbery_rate,
        s.aggravated_assault_rate,
        s.burglary_rate,
        s.larceny_theft_rate,
        s.motor_vehicle_theft_rate,
        s.arson_rate,
        s.violent_clearance_rate,
        s.property_clearance_rate,
        s.violent_crime_trend,
        s.property_crime_trend,
        s.year_over_year_change,
        s.previous_year_violent_rate,
        s.top_violent_crime_type,
        s.top_property_crime_type,
        NULL::DECIMAL as area_square_miles,
        NULL::DECIMAL as crime_density,
        s.data_quality
    FROM state_crime_data s
    WHERE s.state_code = p_state_code
        AND s.data_year = p_data_year
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
