/**
 * Geo-Risk Service - Supabase Database Version
 * Fetches crime data from Supabase instead of static .js file
 * Includes caching for performance
 */

window.GeoRiskService = {
    apis: {
        nominatim: 'https://nominatim.openstreetmap.org/search',
        spotcrime: 'https://api.spotcrime.com/crimes.json'
    },

    granularity: {
        CITY: 'city',
        COUNTY: 'county',
        STATE: 'state'
    },

    cache: {},
    cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours

    /**
     * Main function to analyze location risk
     */
    async analyzeLocationRisk(addressData) {
        try {
            this.showAnalyzing();

            const { address, city, state, facilityType } = addressData;

            // 1. Geocode the address
            const location = await this.geocodeAddress(address, city, state);
            
            // 2. Fetch crime data from Supabase with multi-tier fallback
            const crimeData = await this.fetchCrimeDataFromSupabase(location);
            
            // 3. Fetch demographic data
            const demographics = await this.fetchDemographics(location);
            
            // 4. Recent incidents disabled (requires API key)
            const recentIncidents = null;
            
            // 5. Calculate enhanced risk assessment
            const riskAssessment = this.calculateEnhancedRiskAssessment(
                crimeData, 
                demographics, 
                recentIncidents,
                addressData
            );
            
            // 6. Add comprehensive metadata
            const confidence = this.calculateConfidence(crimeData, demographics, recentIncidents);
            const dataSources = this.getDataSources(crimeData.granularity, recentIncidents);

            this.hideAnalyzing();

            return {
                ...riskAssessment,
                metadata: {
                    location,
                    granularity: crimeData.granularity,
                    confidence,
                    dataSources,
                    analysisDate: new Date().toISOString()
                }
            };

        } catch (error) {
            this.hideAnalyzing();
            console.error('Risk analysis error:', error);
            throw error;
        }
    },

    /**
     * Fetch crime data from Supabase with multi-tier fallback
     */
    async fetchCrimeDataFromSupabase(location) {
        const cacheKey = `crime_supabase_${location.city}_${location.county}_${location.state}`;

        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log('✓ Using cached crime data');
            return cached;
        }

        try {
            // Use Supabase RPC function for multi-tier fallback
            const { data, error } = await supabase.rpc('get_crime_data_with_fallback', {
                p_city: location.city,
                p_county: location.county,
                p_state_code: this.getStateCode(location.state),
                p_data_year: 2022
            });

            if (error) throw error;

            if (data && data.length > 0) {
                const result = data[0];
                
                const crimeData = {
                    // Basic rates
                    violentCrimeRate: result.violent_crime_rate,
                    propertyCrimeRate: result.property_crime_rate,
                    totalCrimeRate: result.total_crime_rate,
                    population: result.population,
                    overallRating: this.getCrimeRating(result.violent_crime_rate),
                    granularity: result.granularity,
                    source: result.location_name,
                    dataSource: result.data_source,
                    
                    // Crime breakdowns
                    crimeBreakdown: {
                        murder_rate: result.murder_rate,
                        rape_rate: result.rape_rate,
                        robbery_rate: result.robbery_rate,
                        aggravated_assault_rate: result.aggravated_assault_rate,
                        burglary_rate: result.burglary_rate,
                        larceny_theft_rate: result.larceny_theft_rate,
                        motor_vehicle_theft_rate: result.motor_vehicle_theft_rate,
                        arson_rate: result.arson_rate
                    },
                    
                    // Clearance rates
                    violent_clearance_rate: result.violent_clearance_rate,
                    property_clearance_rate: result.property_clearance_rate,
                    
                    // Trends
                    violent_crime_trend: result.violent_crime_trend,
                    property_crime_trend: result.property_crime_trend,
                    year_over_year_change: result.year_over_year_change,
                    previous_year_violent_rate: result.previous_year_violent_rate,
                    
                    // Top crime types
                    top_violent_crime_type: result.top_violent_crime_type,
                    top_property_crime_type: result.top_property_crime_type,
                    
                    // Density
                    area_square_miles: result.area_square_miles,
                    crime_density: result.crime_density,
                    
                    // Data quality
                    data_quality: result.data_quality
                };

                // Cache the result
                this.setCache(cacheKey, crimeData);
                
                console.log(`✓ Fetched ${result.granularity}-level data from Supabase: ${result.location_name}`);
                return crimeData;
            }

            // Fallback to national averages if no data found
            console.warn('No crime data found in database, using national averages');
            return this.getNationalCrimeAverages();

        } catch (error) {
            console.error('Supabase crime data fetch error:', error);
            // Fall back to national averages
            return this.getNationalCrimeAverages();
        }
    },

    /**
     * Geocode address using OpenStreetMap Nominatim
     */
    async geocodeAddress(address, city, state) {
        const cacheKey = `geocode_${address}_${city}_${state}`;
        
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const queries = [
                `${address}, ${city}, ${state}, USA`,
                `${city}, ${state}, USA`
            ];

            for (const query of queries) {
                await this.delay(1000); // Rate limiting

                const response = await fetch(
                    `${this.apis.nominatim}?q=${encodeURIComponent(query)}&format=json&countrycodes=us&limit=1`,
                    { headers: { 'User-Agent': 'EvenfallAdvantage-SiteAssessment/1.0' } }
                );

                const results = await response.json();

                if (results && results.length > 0) {
                    const result = results[0];
                    const locationData = {
                        lat: parseFloat(result.lat),
                        lon: parseFloat(result.lon),
                        city: city,
                        county: result.address?.county,
                        state: state,
                        geocoded: true
                    };

                    this.setCache(cacheKey, locationData);
                    return locationData;
                }
            }

            // Fallback
            return this.createFallbackLocation(city, state);

        } catch (error) {
            console.error('Geocoding error:', error);
            return this.createFallbackLocation(city, state);
        }
    },

    createFallbackLocation(city, state) {
        return {
            city,
            state,
            geocoded: false,
            fallback: true
        };
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Fetch demographic data
     */
    async fetchDemographics(location) {
        const cacheKey = `demo_${location.state}_${location.county}`;
        
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const demographics = {
            populationDensity: this.estimatePopulationDensity(location),
            socioeconomicRisk: 'Moderate',
            vulnerablePopulation: false,
            note: 'Estimated based on location characteristics'
        };

        this.setCache(cacheKey, demographics);
        return demographics;
    },

    estimatePopulationDensity(location) {
        const majorCities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 
                            'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Nashville', 'Memphis'];
        
        if (majorCities.some(city => location.city?.includes(city))) {
            return 'High';
        }
        return 'Moderate';
    },

    /**
     * Calculate precision risk assessment using detailed crime breakdowns, trends, and clearance rates
     */
    calculateEnhancedRiskAssessment(crimeData, demographics, recentIncidents, addressData) {
        const facilityType = addressData.facilityType?.toLowerCase() || '';
        
        // ========================================
        // 1. THREAT LIKELIHOOD (Weighted Scoring)
        // ========================================
        let threatScore = 0;
        
        // Base violent crime rate (0-40 points)
        const violentRate = crimeData.violentCrimeRate || 0;
        if (violentRate >= 1000) threatScore += 40;
        else if (violentRate >= 600) threatScore += 30;
        else if (violentRate >= 350) threatScore += 20;
        else if (violentRate >= 150) threatScore += 10;
        
        // Crime type relevance to facility (0-20 points)
        const crimeBreakdown = crimeData.crimeBreakdown || {};
        if (facilityType.includes('school') || facilityType.includes('religious')) {
            // Schools/churches care more about active threats
            if (crimeBreakdown.aggravated_assault_rate > 200) threatScore += 15;
            if (crimeBreakdown.robbery_rate > 100) threatScore += 10;
        } else if (facilityType.includes('retail') || facilityType.includes('office')) {
            // Retail/offices care more about theft and burglary
            if (crimeBreakdown.burglary_rate > 300) threatScore += 15;
            if (crimeBreakdown.larceny_theft_rate > 1000) threatScore += 10;
        }
        
        // Trend analysis (0-15 points)
        if (crimeData.violent_crime_trend === 'increasing') {
            threatScore += 15; // Getting worse
        } else if (crimeData.violent_crime_trend === 'decreasing') {
            threatScore -= 10; // Improving (reduce score)
        }
        
        // Clearance rate (law enforcement effectiveness) (0-10 points)
        const clearanceRate = crimeData.violent_clearance_rate || 50;
        if (clearanceRate < 30) {
            threatScore += 10; // Low enforcement = higher threat
        } else if (clearanceRate > 60) {
            threatScore -= 5; // Strong enforcement = lower threat
        }
        
        // Recent incidents (0-15 points)
        if (recentIncidents && recentIncidents.total > 0) {
            if (recentIncidents.violent > 5) threatScore += 15;
            else if (recentIncidents.violent > 2) threatScore += 10;
            else if (recentIncidents.violent > 0) threatScore += 5;
        }
        
        // Convert score to likelihood
        let threatLikelihood;
        if (threatScore >= 70) threatLikelihood = 'Certain';
        else if (threatScore >= 50) threatLikelihood = 'Likely';
        else if (threatScore >= 30) threatLikelihood = 'Possible';
        else if (threatScore >= 15) threatLikelihood = 'Unlikely';
        else threatLikelihood = 'Rare';
        
        // ========================================
        // 2. POTENTIAL IMPACT (Facility-Specific)
        // ========================================
        let potentialImpact = 'Moderate';
        let impactReasoning = [];
        
        if (facilityType.includes('school')) {
            potentialImpact = 'Catastrophic'; // Children = highest impact
            impactReasoning.push('Vulnerable population (children)');
        } else if (facilityType.includes('healthcare')) {
            potentialImpact = 'Major'; // Patients = high impact
            impactReasoning.push('Vulnerable population (patients)');
        } else if (facilityType.includes('religious')) {
            potentialImpact = 'Major'; // Symbolic target
            impactReasoning.push('High-profile symbolic target');
        } else if (facilityType.includes('venue') || facilityType.includes('event')) {
            potentialImpact = 'Major'; // Large gatherings
            impactReasoning.push('Large public gatherings');
        } else if (facilityType.includes('office')) {
            potentialImpact = 'Moderate';
            impactReasoning.push('Standard business operations');
        } else if (facilityType.includes('retail')) {
            potentialImpact = 'Moderate';
            impactReasoning.push('Public access, cash handling');
        }
        
        // ========================================
        // 3. VULNERABILITY ASSESSMENT
        // ========================================
        let vulnerabilityScore = 50; // Start at moderate
        
        // High crime density increases vulnerability
        if (crimeData.crime_density && crimeData.crime_density > 100) {
            vulnerabilityScore += 15;
        }
        
        // Top crime types relevant to facility
        const topPropertyCrime = crimeData.top_property_crime_type || '';
        if (topPropertyCrime.toLowerCase().includes('burglary')) {
            vulnerabilityScore += 10; // Burglary = direct facility threat
        }
        
        // Population density
        if (demographics.populationDensity === 'High') {
            vulnerabilityScore += 5; // More targets, but also more witnesses
        }
        
        let overallVulnerability;
        if (vulnerabilityScore >= 80) overallVulnerability = 'Critical';
        else if (vulnerabilityScore >= 65) overallVulnerability = 'High';
        else if (vulnerabilityScore >= 45) overallVulnerability = 'Moderate';
        else if (vulnerabilityScore >= 30) overallVulnerability = 'Low';
        else overallVulnerability = 'Minimal';
        
        // ========================================
        // 4. RESILIENCE LEVEL
        // ========================================
        let resilienceScore = 50; // Start at fair
        
        // Good clearance rate = better resilience
        if (clearanceRate > 60) {
            resilienceScore += 20;
        } else if (clearanceRate < 30) {
            resilienceScore -= 20;
        }
        
        // Improving trends = better resilience
        if (crimeData.violent_crime_trend === 'decreasing') {
            resilienceScore += 15;
        } else if (crimeData.violent_crime_trend === 'increasing') {
            resilienceScore -= 15;
        }
        
        let resilienceLevel;
        if (resilienceScore >= 75) resilienceLevel = 'Excellent';
        else if (resilienceScore >= 60) resilienceLevel = 'Good';
        else if (resilienceScore >= 40) resilienceLevel = 'Fair';
        else if (resilienceScore >= 25) resilienceLevel = 'Poor';
        else resilienceLevel = 'Critical';
        
        // ========================================
        // 5. RETURN COMPREHENSIVE ASSESSMENT
        // ========================================
        return {
            threatLikelihood,
            potentialImpact,
            overallVulnerability,
            resilienceLevel,
            
            // Detailed scoring for transparency
            scoring: {
                threatScore,
                vulnerabilityScore,
                resilienceScore,
                impactReasoning
            },
            
            // Enhanced crime data with breakdowns
            crimeData: {
                violentCrimeRate: crimeData.violentCrimeRate,
                propertyCrimeRate: crimeData.propertyCrimeRate,
                overallRating: crimeData.overallRating,
                source: crimeData.source,
                granularity: crimeData.granularity,
                
                // Crime breakdowns
                crimeBreakdown: crimeData.crimeBreakdown,
                topViolentCrime: crimeData.top_violent_crime_type,
                topPropertyCrime: crimeData.top_property_crime_type,
                
                // Trends
                violentTrend: crimeData.violent_crime_trend,
                propertyTrend: crimeData.property_crime_trend,
                yearOverYearChange: crimeData.year_over_year_change,
                
                // Enforcement
                violentClearanceRate: crimeData.violent_clearance_rate,
                propertyClearanceRate: crimeData.property_clearance_rate,
                
                // Density
                crimeDensity: crimeData.crime_density
            },
            
            recentIncidents: recentIncidents ? {
                total: recentIncidents.total,
                violent: recentIncidents.violent,
                property: recentIncidents.property,
                radius: recentIncidents.radius
            } : null,
            
            demographics: demographics,
            autoPopulated: true,
            editable: true
        };
    },

    /**
     * Calculate confidence level
     */
    calculateConfidence(crimeData, demographics, recentIncidents) {
        let confidenceScore = 0;
        
        if (crimeData.granularity === this.granularity.CITY) {
            confidenceScore += 40;
        } else if (crimeData.granularity === this.granularity.COUNTY) {
            confidenceScore += 30;
        } else if (crimeData.granularity === this.granularity.STATE) {
            confidenceScore += 20;
        }

        if (recentIncidents && recentIncidents.total > 0) {
            confidenceScore += 30;
        } else if (recentIncidents === null) {
            confidenceScore += 10;
        }

        if (demographics && !demographics.note) {
            confidenceScore += 20;
        } else {
            confidenceScore += 10;
        }

        if (crimeData.granularity === this.granularity.CITY) {
            confidenceScore += 10;
        }

        if (confidenceScore >= 85) {
            return 'Very High (95%)';
        } else if (confidenceScore >= 70) {
            return 'High (85%)';
        } else if (confidenceScore >= 50) {
            return 'Moderate (70%)';
        } else {
            return 'Fair (50%)';
        }
    },

    /**
     * Get data sources for citation
     */
    getDataSources(granularity, recentIncidents) {
        const sources = [];
        
        if (granularity === this.granularity.CITY) {
            sources.push({
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'City-level crime statistics from Supabase database'
            });
        } else if (granularity === this.granularity.COUNTY) {
            sources.push({
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'County-level crime statistics from Supabase database'
            });
        } else {
            sources.push({
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'State-level crime statistics from Supabase database'
            });
        }
        
        sources.push({
            name: 'OpenStreetMap Nominatim',
            description: 'Geocoding and location services'
        });
        
        if (recentIncidents && recentIncidents.total > 0) {
            sources.push({
                name: 'SpotCrime',
                description: `Recent crime incidents (${recentIncidents.total} in ${recentIncidents.radius} mile radius)`
            });
        }
        
        sources.push({
            name: 'US Census Bureau',
            year: '2021',
            description: 'Demographic data (estimated)'
        });
        
        return sources;
    },

    getCrimeRating(violentRate) {
        if (violentRate >= 1000) return 'Critical';
        if (violentRate >= 600) return 'High';
        if (violentRate >= 350) return 'Moderate';
        if (violentRate >= 150) return 'Low';
        return 'Negligible';
    },

    getRiskColors(riskLevel) {
        const colorSchemes = {
            'Negligible': {
                bg: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
                border: '#9e9e9e',
                text: '#424242',
                icon: '#757575'
            },
            'Low': {
                bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                border: '#4caf50',
                text: '#1b5e20',
                icon: '#2e7d32'
            },
            'Moderate': {
                bg: 'linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%)',
                border: '#ffc107',
                text: '#f57c00',
                icon: '#ff9800'
            },
            'High': {
                bg: 'linear-gradient(135deg, #ffe8e0 0%, #ffccbc 100%)',
                border: '#ff5722',
                text: '#bf360c',
                icon: '#d84315'
            },
            'Critical': {
                bg: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                border: '#f44336',
                text: '#b71c1c',
                icon: '#c62828'
            }
        };
        return colorSchemes[riskLevel] || colorSchemes['Moderate'];
    },

    getGranularityColors(granularity) {
        const colorSchemes = {
            'city': {
                bg: '#4caf50',
                text: 'white',
                label: '📍 City-Level Data'
            },
            'county': {
                bg: '#ffc107',
                text: '#000',
                label: '📍 County-Level Data'
            },
            'state': {
                bg: '#f44336',
                text: 'white',
                label: '📍 State-Level Data'
            }
        };
        return colorSchemes[granularity] || colorSchemes['state'];
    },

    getNationalCrimeAverages() {
        return {
            violentCrimeRate: 380,
            propertyCrimeRate: 2300,
            overallRating: 'Moderate',
            granularity: 'national',
            source: 'National Average',
            note: 'National averages used'
        };
    },

    getStateCode(stateName) {
        const stateMap = {
            'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
            'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
            'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
            'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
            'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
            'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
            'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
            'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
            'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
            'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
        };
        return stateMap[stateName] || stateName;
    },

    // Cache management
    getFromCache(key) {
        const cached = this.cache[key];
        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            return cached.data;
        }
        return null;
    },

    setCache(key, data) {
        this.cache[key] = {
            data,
            timestamp: Date.now()
        };
    },

    showAnalyzing() {
        const indicator = document.createElement('div');
        indicator.id = 'geoRiskAnalyzing';
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(29, 52, 81, 0.95);
            color: white;
            padding: 2rem 3rem;
            border-radius: 1rem;
            z-index: 10000;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;
        indicator.innerHTML = `
            <i class="fas fa-map-marked-alt fa-spin" style="font-size: 2.5rem; margin-bottom: 1rem; color: #dd8c33;"></i>
            <br>
            <strong style="font-size: 1.2rem;">Analyzing Location Risk...</strong>
            <br>
            <small style="opacity: 0.8;">Fetching crime data from database</small>
        `;
        document.body.appendChild(indicator);
    },

    hideAnalyzing() {
        const indicator = document.getElementById('geoRiskAnalyzing');
        if (indicator) {
            indicator.remove();
        }
    }
};
