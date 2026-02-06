# Crime Data Migration to Supabase

## Overview

This migration moves crime data from a static JavaScript file to Supabase database tables, enabling easier updates, better scalability, and professional data management.

---

## 🎯 Why Migrate?

### Current Approach (Static .js file)
❌ **Problems:**
- Manual code edits required for data updates
- Must commit and deploy code to update data
- Hard to scale to 18,000+ cities
- No version control for data
- No audit trail
- Can't update data without redeploying entire site

### New Approach (Supabase Database)
✅ **Benefits:**
- Update data without code deployment
- Easy to add new cities/counties
- Version control with timestamps
- Import fresh FBI data annually via SQL
- Scalable to full 18,000+ cities
- Admin interface for data management
- Query and filter capabilities
- Automatic caching for performance

---

## 📊 Database Schema

### Tables Created

1. **`city_crime_data`** - 18,000+ US cities
   - City name, state code, state name
   - Violent & property crime rates (per 100k)
   - Population data
   - Data year and source
   - Timestamps for tracking updates

2. **`county_crime_data`** - All US counties
   - County name, state code, state name
   - Violent & property crime rates
   - Population data
   - Data year and source
   - Timestamps

3. **`state_crime_data`** - All 50 states
   - State code and name
   - Violent & property crime rates
   - Overall rating (Negligible/Low/Moderate/High/Critical)
   - Data year and source
   - Timestamps

### Key Features

- **Indexes** for fast lookups by city/county/state
- **Row Level Security (RLS)** - public read, admin write
- **Helper Function** - `get_crime_data_with_fallback()` for multi-tier queries
- **Unique Constraints** to prevent duplicate data
- **Timestamps** for audit trail

---

## 🚀 Migration Steps

### Step 1: Create Tables (Run Once)

```sql
-- In Supabase SQL Editor, run:
-- File: CREATE_CRIME_DATA_TABLES.sql

-- This creates:
-- - city_crime_data table
-- - county_crime_data table  
-- - state_crime_data table
-- - Indexes for performance
-- - RLS policies for security
-- - Helper function for multi-tier fallback
```

### Step 2: Migrate Existing Data

```sql
-- In Supabase SQL Editor, run:
-- File: MIGRATE_CRIME_DATA_TO_SUPABASE.sql

-- This inserts:
-- - 21 cities (11 TN + 10 major US cities)
-- - 10 Tennessee counties
-- - All 50 US states
```

### Step 3: Update JavaScript (Choose One)

**Option A: Switch to Supabase Version (Recommended)**
```html
<!-- In index.html, replace: -->
<script src="js/geo-risk-data-cities.js"></script>
<script src="js/geo-risk-service.js"></script>

<!-- With: -->
<script src="js/geo-risk-service-supabase.js"></script>
```

**Option B: Gradual Migration**
Keep both versions and test Supabase version first before switching.

---

## 📝 How to Update Data in the Future

### Adding a New City

```sql
INSERT INTO city_crime_data (
    city_name, state_code, state_name, 
    violent_crime_rate, property_crime_rate, 
    population, data_year
) VALUES (
    'Austin', 'TX', 'Texas',
    447, 3012, 961855, 2023
);
```

### Updating Existing City Data

```sql
UPDATE city_crime_data
SET 
    violent_crime_rate = 450,
    property_crime_rate = 3100,
    updated_at = NOW()
WHERE city_name = 'Austin' 
    AND state_code = 'TX' 
    AND data_year = 2023;
```

### Bulk Import New FBI Data (Annual Update)

```sql
-- When FBI releases 2023 data:
INSERT INTO city_crime_data (city_name, state_code, state_name, violent_crime_rate, property_crime_rate, population, data_year)
VALUES
    ('Nashville', 'TN', 'Tennessee', 1150, 3900, 695000, 2023),
    ('Memphis', 'TN', 'Tennessee', 2400, 5600, 635000, 2023),
    -- ... more cities
ON CONFLICT (city_name, state_code, data_year) DO UPDATE SET
    violent_crime_rate = EXCLUDED.violent_crime_rate,
    property_crime_rate = EXCLUDED.property_crime_rate,
    population = EXCLUDED.population,
    updated_at = NOW();
```

---

## 🔍 Querying Data

### Find City Data
```sql
SELECT * FROM city_crime_data 
WHERE city_name = 'Knoxville' 
    AND state_code = 'TN' 
    AND data_year = 2022;
```

### Multi-Tier Fallback (City → County → State)
```sql
SELECT * FROM get_crime_data_with_fallback(
    'Knoxville',      -- city
    'Knox County',    -- county
    'TN',            -- state code
    2022             -- data year
);
```

### Get All Cities in a State
```sql
SELECT city_name, violent_crime_rate, property_crime_rate
FROM city_crime_data
WHERE state_code = 'TN'
ORDER BY violent_crime_rate DESC;
```

### Find High-Crime Cities
```sql
SELECT city_name, state_code, violent_crime_rate
FROM city_crime_data
WHERE violent_crime_rate >= 1000
ORDER BY violent_crime_rate DESC;
```

---

## ⚡ Performance & Caching

### Built-in Caching
The JavaScript service includes 24-hour caching:
- Geocoding results cached
- Crime data cached
- Demographics cached
- Reduces API calls and improves speed

### Database Indexes
Fast lookups via indexes on:
- `(city_name, state_code)`
- `(county_name, state_code)`
- `state_code`

---

## 🔐 Security

### Row Level Security (RLS)
- **Public Read Access**: Anyone can view crime data
- **Admin Write Access**: Only admins can insert/update/delete
- Prevents unauthorized data modification

### API Access
- Uses Supabase's built-in API
- Automatic rate limiting
- Secure connections (HTTPS)

---

## 📈 Scaling to 18,000+ Cities

### Current State
- 21 cities (sample data)
- 10 counties (Tennessee)
- 50 states (complete)

### Future Expansion
1. **Import Full FBI UCR Dataset**
   - Download FBI Crime Data Explorer CSV
   - Convert to SQL INSERT statements
   - Run bulk import

2. **Automated Annual Updates**
   - Set up script to fetch new FBI data
   - Automatically update database
   - No code deployment needed

3. **Add More Data Points**
   - Trend analysis (year-over-year changes)
   - Crime types breakdown
   - Seasonal patterns

---

## 🧪 Testing

### Verify Migration
```sql
-- Check record counts
SELECT 
    'Cities' as data_type,
    COUNT(*) as record_count
FROM city_crime_data
UNION ALL
SELECT 'Counties', COUNT(*) FROM county_crime_data
UNION ALL
SELECT 'States', COUNT(*) FROM state_crime_data;
```

### Test Fallback Function
```sql
-- Should return city-level data
SELECT * FROM get_crime_data_with_fallback('Knoxville', 'Knox County', 'TN', 2022);

-- Should return county-level data
SELECT * FROM get_crime_data_with_fallback('Unknown City', 'Knox County', 'TN', 2022);

-- Should return state-level data
SELECT * FROM get_crime_data_with_fallback('Unknown City', 'Unknown County', 'TN', 2022);
```

---

## 🔄 Rollback Plan

If issues arise, you can easily rollback:

1. **Keep old .js file** as backup
2. **Switch back in index.html**:
   ```html
   <script src="js/geo-risk-data-cities.js"></script>
   <script src="js/geo-risk-service.js"></script>
   ```
3. **No data loss** - database tables remain intact

---

## 📊 Comparison

| Feature | Static .js | Supabase DB |
|---------|-----------|-------------|
| Update Speed | Slow (code deploy) | Fast (SQL query) |
| Scalability | Limited | Unlimited |
| Version Control | Code commits only | Timestamps + audit |
| Admin Interface | None | Supabase dashboard |
| Query Capability | None | Full SQL |
| Maintenance | Manual code edits | SQL updates |
| Performance | Instant (in-memory) | Fast (cached + indexed) |

---

## 🎓 Best Practices

1. **Annual FBI Data Updates**
   - Import new data each year when FBI releases UCR data
   - Keep historical data by using `data_year` field

2. **Data Quality**
   - Verify data before importing
   - Use ON CONFLICT to prevent duplicates
   - Set `updated_at` timestamp on changes

3. **Caching Strategy**
   - 24-hour cache for crime data (changes infrequently)
   - Shorter cache for real-time features (if added)

4. **Monitoring**
   - Track query performance
   - Monitor cache hit rates
   - Review error logs

---

## 🚀 Next Steps

1. **Run CREATE_CRIME_DATA_TABLES.sql** in Supabase
2. **Run MIGRATE_CRIME_DATA_TO_SUPABASE.sql** to populate data
3. **Test queries** to verify data
4. **Switch to geo-risk-service-supabase.js** in index.html
5. **Test on live site** with various addresses
6. **Monitor performance** and adjust caching as needed

---

## 📞 Support

If you encounter issues:
1. Check Supabase logs for errors
2. Verify RLS policies are correct
3. Test queries in SQL Editor
4. Check browser console for JavaScript errors
5. Verify supabase client is initialized

---

**This migration provides a professional, scalable foundation for your geo-risk assessment tool that can grow with your needs!** 🎯
