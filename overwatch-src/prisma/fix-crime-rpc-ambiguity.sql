-- Fix: get_crime_data_with_fallback — "violent_crime_rate" ambiguous column reference
-- Run on LEGACY Supabase (vaagvairvwmgyzsmymhs)
-- Root cause: RETURNS TABLE column names clash with PL/pgSQL variables
-- Fix: add #variable_conflict use_column + prefix all column references

DROP FUNCTION IF EXISTS get_crime_data_with_fallback(VARCHAR, VARCHAR, VARCHAR, INTEGER);

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
    murder_rate DECIMAL,
    rape_rate DECIMAL,
    robbery_rate DECIMAL,
    aggravated_assault_rate DECIMAL,
    burglary_rate DECIMAL,
    larceny_theft_rate DECIMAL,
    motor_vehicle_theft_rate DECIMAL,
    arson_rate DECIMAL,
    violent_clearance_rate DECIMAL,
    property_clearance_rate DECIMAL,
    violent_crime_trend VARCHAR,
    property_crime_trend VARCHAR,
    year_over_year_change DECIMAL,
    previous_year_violent_rate INTEGER,
    top_violent_crime_type VARCHAR,
    top_property_crime_type VARCHAR,
    area_square_miles DECIMAL,
    crime_density DECIMAL,
    data_quality VARCHAR
)
LANGUAGE plpgsql
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
    -- Try city-level first
    RETURN QUERY
    SELECT 
        'city'::VARCHAR as granularity,
        (c.city_name || ', ' || c.state_code)::VARCHAR as location_name,
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
        (co.county_name || ', ' || co.state_code)::VARCHAR as location_name,
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
        s.state_name::VARCHAR as location_name,
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
$$;

-- Verify
SELECT * FROM get_crime_data_with_fallback('Knoxville', 'Knox County', 'TN', 2022);
