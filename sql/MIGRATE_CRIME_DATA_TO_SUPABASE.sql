-- Migrate existing crime data from .js file to Supabase tables
-- Run this after creating the crime data tables

-- ============================================
-- INSERT CITY-LEVEL CRIME DATA
-- ============================================

INSERT INTO city_crime_data (city_name, state_code, state_name, violent_crime_rate, property_crime_rate, population, data_year) VALUES
-- Tennessee Cities
('Nashville', 'TN', 'Tennessee', 1138, 3842, 689447, 2022),
('Memphis', 'TN', 'Tennessee', 2352, 5560, 633104, 2022),
('Knoxville', 'TN', 'Tennessee', 687, 3234, 190740, 2022),
('Chattanooga', 'TN', 'Tennessee', 1158, 4521, 181099, 2022),
('Clarksville', 'TN', 'Tennessee', 582, 2845, 166722, 2022),
('Murfreesboro', 'TN', 'Tennessee', 445, 2567, 152769, 2022),
('Franklin', 'TN', 'Tennessee', 89, 1234, 83454, 2022),
('Jackson', 'TN', 'Tennessee', 892, 3678, 68205, 2022),
('Johnson City', 'TN', 'Tennessee', 456, 2345, 71046, 2022),
('Sevierville', 'TN', 'Tennessee', 234, 1876, 17185, 2022),
('Seymour', 'TN', 'Tennessee', 312, 2145, 12500, 2022),

-- Major US Cities
('New York', 'NY', 'New York', 539, 1432, 8336817, 2022),
('Los Angeles', 'CA', 'California', 734, 2331, 3898747, 2022),
('Chicago', 'IL', 'Illinois', 943, 2301, 2746388, 2022),
('Houston', 'TX', 'Texas', 1110, 4532, 2304580, 2022),
('Phoenix', 'AZ', 'Arizona', 645, 3012, 1608139, 2022),
('Philadelphia', 'PA', 'Pennsylvania', 1009, 2145, 1603797, 2022),
('San Antonio', 'TX', 'Texas', 678, 3456, 1434625, 2022),
('San Diego', 'CA', 'California', 389, 1876, 1386932, 2022),
('Dallas', 'TX', 'Texas', 892, 3234, 1304379, 2022),
('San Jose', 'CA', 'California', 345, 2012, 1013240, 2022)

ON CONFLICT (city_name, state_code, data_year) DO UPDATE SET
    violent_crime_rate = EXCLUDED.violent_crime_rate,
    property_crime_rate = EXCLUDED.property_crime_rate,
    population = EXCLUDED.population,
    updated_at = NOW();

-- ============================================
-- INSERT COUNTY-LEVEL CRIME DATA
-- ============================================

INSERT INTO county_crime_data (county_name, state_code, state_name, violent_crime_rate, property_crime_rate, population, data_year) VALUES
-- Tennessee Counties
('Knox County', 'TN', 'Tennessee', 645, 3123, 478971, 2022),
('Shelby County', 'TN', 'Tennessee', 1876, 4987, 929744, 2022),
('Davidson County', 'TN', 'Tennessee', 1089, 3756, 715884, 2022),
('Hamilton County', 'TN', 'Tennessee', 987, 4234, 366207, 2022),
('Rutherford County', 'TN', 'Tennessee', 423, 2456, 341486, 2022),
('Williamson County', 'TN', 'Tennessee', 112, 1345, 247726, 2022),
('Montgomery County', 'TN', 'Tennessee', 534, 2789, 220069, 2022),
('Sumner County', 'TN', 'Tennessee', 345, 2123, 196281, 2022),
('Sevier County', 'TN', 'Tennessee', 287, 1987, 98380, 2022),
('Blount County', 'TN', 'Tennessee', 234, 1765, 135280, 2022)

ON CONFLICT (county_name, state_code, data_year) DO UPDATE SET
    violent_crime_rate = EXCLUDED.violent_crime_rate,
    property_crime_rate = EXCLUDED.property_crime_rate,
    population = EXCLUDED.population,
    updated_at = NOW();

-- ============================================
-- INSERT STATE-LEVEL CRIME DATA
-- ============================================

INSERT INTO state_crime_data (state_code, state_name, violent_crime_rate, property_crime_rate, overall_rating, data_year) VALUES
('AL', 'Alabama', 453, 2650, 'Moderate', 2022),
('AK', 'Alaska', 885, 2599, 'High', 2022),
('AZ', 'Arizona', 484, 2520, 'Moderate', 2022),
('AR', 'Arkansas', 671, 3268, 'High', 2022),
('CA', 'California', 442, 2331, 'Moderate', 2022),
('CO', 'Colorado', 423, 2910, 'Moderate', 2022),
('CT', 'Connecticut', 181, 1395, 'Low', 2022),
('DE', 'Delaware', 431, 2348, 'Moderate', 2022),
('FL', 'Florida', 383, 1801, 'Moderate', 2022),
('GA', 'Georgia', 401, 2357, 'Moderate', 2022),
('HI', 'Hawaii', 254, 2992, 'Low', 2022),
('ID', 'Idaho', 242, 1461, 'Low', 2022),
('IL', 'Illinois', 425, 1722, 'Moderate', 2022),
('IN', 'Indiana', 404, 2210, 'Moderate', 2022),
('IA', 'Iowa', 287, 1991, 'Low', 2022),
('KS', 'Kansas', 425, 2590, 'Moderate', 2022),
('KY', 'Kentucky', 291, 2086, 'Low', 2022),
('LA', 'Louisiana', 639, 3162, 'High', 2022),
('ME', 'Maine', 108, 1264, 'Low', 2022),
('MD', 'Maryland', 468, 2027, 'Moderate', 2022),
('MA', 'Massachusetts', 308, 1296, 'Low', 2022),
('MI', 'Michigan', 478, 1798, 'Moderate', 2022),
('MN', 'Minnesota', 281, 2247, 'Low', 2022),
('MS', 'Mississippi', 291, 2403, 'Moderate', 2022),
('MO', 'Missouri', 543, 2829, 'Moderate', 2022),
('MT', 'Montana', 469, 2599, 'Moderate', 2022),
('NE', 'Nebraska', 291, 2364, 'Low', 2022),
('NV', 'Nevada', 460, 2586, 'Moderate', 2022),
('NH', 'New Hampshire', 146, 1144, 'Low', 2022),
('NJ', 'New Jersey', 195, 1158, 'Low', 2022),
('NM', 'New Mexico', 778, 3937, 'High', 2022),
('NY', 'New York', 363, 1286, 'Moderate', 2022),
('NC', 'North Carolina', 419, 2444, 'Moderate', 2022),
('ND', 'North Dakota', 280, 2348, 'Low', 2022),
('OH', 'Ohio', 308, 2170, 'Moderate', 2022),
('OK', 'Oklahoma', 458, 2918, 'Moderate', 2022),
('OR', 'Oregon', 342, 2915, 'Moderate', 2022),
('PA', 'Pennsylvania', 306, 1450, 'Low', 2022),
('RI', 'Rhode Island', 230, 1457, 'Low', 2022),
('SC', 'South Carolina', 531, 3243, 'Moderate', 2022),
('SD', 'South Dakota', 501, 2161, 'Moderate', 2022),
('TN', 'Tennessee', 673, 2926, 'High', 2022),
('TX', 'Texas', 446, 2569, 'Moderate', 2022),
('UT', 'Utah', 260, 2599, 'Low', 2022),
('VT', 'Vermont', 173, 1558, 'Low', 2022),
('VA', 'Virginia', 208, 1668, 'Low', 2022),
('WA', 'Washington', 294, 3518, 'Moderate', 2022),
('WV', 'West Virginia', 355, 1654, 'Moderate', 2022),
('WI', 'Wisconsin', 295, 1859, 'Low', 2022),
('WY', 'Wyoming', 234, 1610, 'Low', 2022)

ON CONFLICT (state_code, data_year) DO UPDATE SET
    violent_crime_rate = EXCLUDED.violent_crime_rate,
    property_crime_rate = EXCLUDED.property_crime_rate,
    overall_rating = EXCLUDED.overall_rating,
    updated_at = NOW();

-- ============================================
-- VERIFY DATA MIGRATION
-- ============================================

-- Check counts
SELECT 
    'Cities' as data_type,
    COUNT(*) as record_count,
    MIN(data_year) as earliest_year,
    MAX(data_year) as latest_year
FROM city_crime_data

UNION ALL

SELECT 
    'Counties' as data_type,
    COUNT(*) as record_count,
    MIN(data_year) as earliest_year,
    MAX(data_year) as latest_year
FROM county_crime_data

UNION ALL

SELECT 
    'States' as data_type,
    COUNT(*) as record_count,
    MIN(data_year) as earliest_year,
    MAX(data_year) as latest_year
FROM state_crime_data;

-- Test the fallback function
SELECT * FROM get_crime_data_with_fallback('Knoxville', 'Knox County', 'TN', 2022);
SELECT * FROM get_crime_data_with_fallback('Unknown City', 'Knox County', 'TN', 2022);
SELECT * FROM get_crime_data_with_fallback('Unknown City', 'Unknown County', 'TN', 2022);
