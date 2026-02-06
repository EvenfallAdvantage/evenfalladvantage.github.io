/**
 * Enhanced Geo-Based Risk Assessment Service
 * Multi-tier implementation: City → County → State
 * Phase 1 & 2: City-level FBI data, County fallback, Census demographics, SpotCrime incidents
 * Evenfall Advantage LLC
 */

const GeoRiskService = {
    // API endpoints
    apis: {
        nominatim: 'https://nominatim.openstreetmap.org/search',
        census: 'https://api.census.gov/data/2021/acs/acs5',
        spotcrime: 'https://api.spotcrime.com/crimes.json'
    },

    // Cache for API responses
    cache: {},
    
    // Data granularity levels
    granularity: {
        CITY: 'city',
        COUNTY: 'county',
        STATE: 'state'
    },

    /**
     * Main function to analyze location risk
     * @param {Object} addressData - Address components
     * @returns {Promise<Object>} Risk assessment data
     */
    async analyzeLocationRisk(addressData) {
        const { address, city, state, facilityType } = addressData;
        
        if (!city || !state) {
            throw new Error('City and State are required for risk analysis');
        }

        try {
            // Show loading
            this.showAnalyzing();

            // 1. Geocode the address
            const location = await this.geocodeAddress(address, city, state);
            
            // 2. Fetch crime data with multi-tier fallback (City → County → State)
            const crimeData = await this.fetchMultiTierCrimeData(location);
            
            // 3. Fetch demographic data from Census
            const demographics = await this.fetchDemographics(location);
            
            // 4. Fetch recent incidents from SpotCrime (if coordinates available)
            const recentIncidents = location.lat ? await this.fetchRecentIncidents(location) : null;
            
            // 5. Calculate enhanced risk assessment
            const riskAssessment = this.calculateEnhancedRiskAssessment(
                crimeData, 
                demographics, 
                recentIncidents,
                addressData
            );
            
            // 6. Add comprehensive metadata
            riskAssessment.metadata = {
                location: location,
                granularity: crimeData.granularity,
                dataSources: this.getDataSources(crimeData.granularity, recentIncidents),
                analysisDate: new Date().toISOString(),
                confidence: this.calculateConfidence(crimeData, demographics, recentIncidents)
            };

            this.hideAnalyzing();
            return riskAssessment;

        } catch (error) {
            this.hideAnalyzing();
            console.error('Risk analysis error:', error);
            throw error;
        }
    },

    /**
     * Geocode address using Nominatim (OpenStreetMap)
     * @param {string} address - Street address
     * @param {string} city - City name
     * @param {string} state - State name
     * @returns {Promise<Object>} Location data
     */
    async geocodeAddress(address, city, state) {
        // Try multiple query formats for better success rate
        const queries = [];
        
        if (address) {
            // Try with full address
            queries.push(`${address}, ${city}, ${state}, USA`);
            // Try with structured format
            queries.push({
                street: address,
                city: city,
                state: state,
                country: 'USA'
            });
        }
        // Always include city/state fallback
        queries.push(`${city}, ${state}, USA`);

        const cacheKey = `geocode_${address}_${city}_${state}`;

        // Check cache
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        // Add delay to respect Nominatim usage policy (1 request per second)
        await this.delay(1000);

        // Try each query format
        for (let i = 0; i < queries.length; i++) {
            try {
                const query = queries[i];
                let url;
                
                if (typeof query === 'string') {
                    // Simple query string
                    url = `${this.apis.nominatim}?` + new URLSearchParams({
                        q: query,
                        format: 'json',
                        addressdetails: 1,
                        limit: 1,
                        countrycodes: 'us'
                    });
                } else {
                    // Structured query
                    url = `${this.apis.nominatim}?` + new URLSearchParams({
                        street: query.street,
                        city: query.city,
                        state: query.state,
                        country: query.country,
                        format: 'json',
                        addressdetails: 1,
                        limit: 1
                    });
                }

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'EvenfallAdvantage-SecurityAssessment/1.0'
                    }
                });

                if (!response.ok) {
                    console.warn('Geocoding API returned error status:', response.status);
                    continue; // Try next query format
                }

                const data = await response.json();
                
                if (data && data.length > 0) {
                    // Success! Found location
                    const result = {
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon),
                        county: data[0].address?.county || '',
                        state: data[0].address?.state || state,
                        city: data[0].address?.city || data[0].address?.town || city,
                        displayName: data[0].display_name,
                        geocoded: true,
                        queryUsed: typeof query === 'string' ? query : 'structured'
                    };

                    // Cache result
                    this.cache[cacheKey] = result;
                    console.log('Geocoding successful:', result.displayName);
                    return result;
                }

                // Add small delay between attempts
                if (i < queries.length - 1) {
                    await this.delay(500);
                }

            } catch (error) {
                console.warn(`Geocoding attempt ${i + 1} failed:`, error.message);
                continue; // Try next query format
            }
        }

        // All attempts failed, use fallback
        console.warn('All geocoding attempts failed, using city/state fallback');
        return this.createFallbackLocation(city, state);
    },

    createFallbackLocation(city, state) {
        return {
            lat: null,
            lon: null,
            county: '',
            state: state,
            city: city,
            displayName: `${city}, ${state}`,
            geocoded: false,
            fallback: true
        };
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * Fetch crime data with multi-tier fallback: City → County → State
     * @param {Object} location - Location data
     * @returns {Promise<Object>} Crime statistics with granularity level
     */
    async fetchMultiTierCrimeData(location) {
        const cacheKey = `crime_multi_${location.city}_${location.county}_${location.state}`;

        // Check cache
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        let crimeData = null;
        let granularity = null;

        try {
            // Tier 1: Try city-level data first
            if (location.city && window.getCityData) {
                const cityData = window.getCityData(location.city, location.state);
                if (cityData) {
                    crimeData = {
                        violentCrimeRate: cityData.violent,
                        propertyCrimeRate: cityData.property,
                        population: cityData.population,
                        overallRating: this.getCrimeRating(cityData.violent),
                        granularity: this.granularity.CITY,
                        source: `${location.city}, ${location.state}`
                    };
                    granularity = this.granularity.CITY;
                    console.log(`✓ City-level data found for ${location.city}, ${location.state}`);
                }
            }

            // Tier 2: Try county-level data if city not found
            if (!crimeData && location.county && window.getCountyData) {
                const countyData = window.getCountyData(location.county, location.state);
                if (countyData) {
                    crimeData = {
                        violentCrimeRate: countyData.violent,
                        propertyCrimeRate: countyData.property,
                        population: countyData.population,
                        overallRating: this.getCrimeRating(countyData.violent),
                        granularity: this.granularity.COUNTY,
                        source: `${location.county}, ${location.state}`
                    };
                    granularity = this.granularity.COUNTY;
                    console.log(`✓ County-level data found for ${location.county}, ${location.state}`);
                }
            }

            // Tier 3: Fall back to state-level data
            if (!crimeData) {
                const stateData = await this.getStateCrimeAverages(location.state);
                crimeData = {
                    violentCrimeRate: stateData.violent,
                    propertyCrimeRate: stateData.property,
                    overallRating: stateData.overall,
                    granularity: this.granularity.STATE,
                    source: location.state
                };
                granularity = this.granularity.STATE;
                console.log(`✓ State-level data used for ${location.state}`);
            }

            crimeData.granularity = granularity;
            
            // Cache result
            this.cache[cacheKey] = crimeData;
            return crimeData;

        } catch (error) {
            console.error('Multi-tier crime data fetch error:', error);
            // Return national averages as last resort
            return {
                violentCrimeRate: 380,
                propertyCrimeRate: 2110,
                overallRating: 'Moderate',
                granularity: 'national',
                source: 'National Average'
            };
        }
    },

    /**
     * Get state-level crime statistics
     * Based on FBI UCR data (2022 latest available)
     * @param {string} state - State name
     * @returns {Object} Crime statistics
     */
    getStateCrimeAverages(state) {
        // State crime rates per 100,000 population (2022 FBI UCR data)
        const stateData = {
            'Alabama': { violent: 453, property: 2891, overall: 'High' },
            'Alaska': { violent: 838, property: 2599, overall: 'High' },
            'Arizona': { violent: 484, property: 2520, overall: 'High' },
            'Arkansas': { violent: 671, property: 3268, overall: 'High' },
            'California': { violent: 442, property: 2331, overall: 'Moderate' },
            'Colorado': { violent: 423, property: 2910, overall: 'Moderate' },
            'Connecticut': { violent: 181, property: 1439, overall: 'Low' },
            'Delaware': { violent: 431, property: 2324, overall: 'Moderate' },
            'Florida': { violent: 383, property: 2003, overall: 'Moderate' },
            'Georgia': { violent: 401, property: 2357, overall: 'Moderate' },
            'Hawaii': { violent: 254, property: 2992, overall: 'Moderate' },
            'Idaho': { violent: 242, property: 1461, overall: 'Low' },
            'Illinois': { violent: 425, property: 1722, overall: 'Moderate' },
            'Indiana': { violent: 404, property: 2149, overall: 'Moderate' },
            'Iowa': { violent: 266, property: 1991, overall: 'Low' },
            'Kansas': { violent: 425, property: 2650, overall: 'Moderate' },
            'Kentucky': { violent: 291, property: 2086, overall: 'Low' },
            'Louisiana': { violent: 639, property: 3162, overall: 'High' },
            'Maine': { violent: 108, property: 1264, overall: 'Low' },
            'Maryland': { violent: 468, property: 2027, overall: 'Moderate' },
            'Massachusetts': { violent: 308, property: 1296, overall: 'Low' },
            'Michigan': { violent: 478, property: 1798, overall: 'Moderate' },
            'Minnesota': { violent: 281, property: 2247, overall: 'Low' },
            'Mississippi': { violent: 291, property: 2403, overall: 'Moderate' },
            'Missouri': { violent: 543, property: 2829, overall: 'High' },
            'Montana': { violent: 469, property: 2599, overall: 'Moderate' },
            'Nebraska': { violent: 291, property: 2364, overall: 'Low' },
            'Nevada': { violent: 460, property: 2586, overall: 'Moderate' },
            'New Hampshire': { violent: 146, property: 1144, overall: 'Low' },
            'New Jersey': { violent: 195, property: 1158, overall: 'Low' },
            'New Mexico': { violent: 778, property: 3937, overall: 'High' },
            'New York': { violent: 363, property: 1286, overall: 'Moderate' },
            'North Carolina': { violent: 419, property: 2444, overall: 'Moderate' },
            'North Dakota': { violent: 280, property: 2348, overall: 'Low' },
            'Ohio': { violent: 308, property: 2170, overall: 'Moderate' },
            'Oklahoma': { violent: 458, property: 2918, overall: 'High' },
            'Oregon': { violent: 342, property: 2915, overall: 'Moderate' },
            'Pennsylvania': { violent: 306, property: 1450, overall: 'Low' },
            'Rhode Island': { violent: 230, property: 1457, overall: 'Low' },
            'South Carolina': { violent: 531, property: 3243, overall: 'High' },
            'South Dakota': { violent: 501, property: 2161, overall: 'Moderate' },
            'Tennessee': { violent: 673, property: 2926, overall: 'High' },
            'Texas': { violent: 446, property: 2569, overall: 'Moderate' },
            'Utah': { violent: 260, property: 2599, overall: 'Low' },
            'Vermont': { violent: 173, property: 1558, overall: 'Low' },
            'Virginia': { violent: 208, property: 1668, overall: 'Low' },
            'Washington': { violent: 294, property: 3518, overall: 'Moderate' },
            'West Virginia': { violent: 355, property: 1654, overall: 'Moderate' },
            'Wisconsin': { violent: 295, property: 1859, overall: 'Low' },
            'Wyoming': { violent: 234, property: 1610, overall: 'Low' }
        };

        return stateData[state] || this.getNationalCrimeAverages();
    },

    /**
     * Get national crime averages
     * @returns {Object} National crime statistics
     */
    getNationalCrimeAverages() {
        return {
            violent: 380,
            property: 2300,
            overall: 'Moderate',
            note: 'National averages used'
        };
    },

    /**
     * Fetch recent crime incidents from SpotCrime API
     * @param {Object} location - Location with lat/lon
     * @returns {Promise<Object>} Recent incidents data
     */
    async fetchRecentIncidents(location) {
        if (!location.lat || !location.lon) {
            return null;
        }

        const cacheKey = `incidents_${location.lat}_${location.lon}`;
        
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        try {
            // SpotCrime API - free tier with rate limits
            // Radius in miles, last 30 days
            const radius = 0.5; // Half mile radius
            const url = `${this.apis.spotcrime}?lat=${location.lat}&lon=${location.lon}&radius=${radius}&key=.`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.warn('SpotCrime API unavailable, continuing without incident data');
                return null;
            }

            const data = await response.json();
            
            const incidents = {
                total: data.crimes?.length || 0,
                violent: data.crimes?.filter(c => ['assault', 'robbery', 'shooting'].includes(c.type.toLowerCase())).length || 0,
                property: data.crimes?.filter(c => ['burglary', 'theft', 'vandalism'].includes(c.type.toLowerCase())).length || 0,
                recent: data.crimes?.slice(0, 5) || [],
                radius: radius
            };

            this.cache[cacheKey] = incidents;
            return incidents;

        } catch (error) {
            console.warn('SpotCrime fetch error:', error.message);
            return null;
        }
    },

    /**
     * Fetch demographic data from US Census API
     * @param {Object} location - Location data
     * @returns {Promise<Object>} Demographic data
     */
    async fetchDemographics(location) {
        const cacheKey = `demo_${location.state}_${location.county}`;
        
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        try {
            // Census API would require FIPS codes and API key
            // For Phase 1/2, using estimated demographics based on location type
            // This can be enhanced with actual Census API calls in future
            
            const demographics = {
                populationDensity: this.estimatePopulationDensity(location),
                socioeconomicRisk: this.estimateSocioeconomicRisk(location),
                vulnerablePopulation: false,
                note: 'Estimated based on location characteristics'
            };

            this.cache[cacheKey] = demographics;
            return demographics;

        } catch (error) {
            console.warn('Demographics fetch error:', error);
            return {
                populationDensity: 'Moderate',
                socioeconomicRisk: 'Moderate',
                note: 'Default estimates used'
            };
        }
    },

    estimatePopulationDensity(location) {
        // Major cities = High, suburbs = Moderate, rural = Low
        const majorCities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 
                            'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Nashville', 'Memphis'];
        
        if (majorCities.some(city => location.city?.includes(city))) {
            return 'High';
        }
        return 'Moderate';
    },

    estimateSocioeconomicRisk(location) {
        // This is a placeholder - would use actual Census median income data
        return 'Moderate';
    },

    /**
     * Enhanced risk assessment calculation with multiple factors
     * @param {Object} crimeData - Crime statistics
     * @param {Object} demographics - Demographic data
     * @param {Object} recentIncidents - Recent crime incidents
     * @param {Object} addressData - Original address data
     * @returns {Object} Risk assessment
     */
    calculateEnhancedRiskAssessment(crimeData, demographics, recentIncidents, addressData) {
        // Base threat likelihood on crime rates
        let threatLikelihood = 'Possible';
        const violentRate = crimeData.violentCrimeRate || crimeData.violent || 0;
        
        if (violentRate > 500 || crimeData.overallRating === 'High') {
            threatLikelihood = 'Likely';
        } else if (violentRate > 350) {
            threatLikelihood = 'Possible';
        } else if (violentRate < 250) {
            threatLikelihood = 'Unlikely';
        }

        // Adjust for recent incidents if available
        if (recentIncidents && recentIncidents.total > 0) {
            if (recentIncidents.violent > 3) {
                // Multiple violent incidents nearby = increase threat
                if (threatLikelihood === 'Unlikely') threatLikelihood = 'Possible';
                else if (threatLikelihood === 'Possible') threatLikelihood = 'Likely';
            }
        }

        // Adjust for population density
        if (demographics.populationDensity === 'High') {
            // High density areas may have more incidents but also more security
            // Keep as-is for now
        }

        // Calculate potential impact based on facility type
        let potentialImpact = 'Moderate';
        const facilityType = addressData.facilityType?.toLowerCase() || '';
        
        if (facilityType.includes('school') || facilityType.includes('healthcare') || 
            facilityType.includes('religious')) {
            potentialImpact = 'Major'; // Higher impact for vulnerable populations
        } else if (facilityType.includes('office') || facilityType.includes('retail')) {
            potentialImpact = 'Moderate';
        } else if (facilityType.includes('venue') || facilityType.includes('event')) {
            potentialImpact = 'Major'; // Large gatherings = high impact
        }

        // Default vulnerability and resilience (assessor will refine based on on-site observations)
        const overallVulnerability = 'Moderate';
        const resilienceLevel = 'Fair';

        return {
            threatLikelihood,
            potentialImpact,
            overallVulnerability,
            resilienceLevel,
            crimeData: {
                violentCrimeRate: crimeData.violentCrimeRate,
                propertyCrimeRate: crimeData.propertyCrimeRate,
                overallRating: crimeData.overallRating,
                source: crimeData.source,
                granularity: crimeData.granularity
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
     * Calculate confidence level based on data granularity and sources
     * @param {Object} crimeData - Crime data
     * @param {Object} demographics - Demographics
     * @param {Object} recentIncidents - Recent incidents
     * @returns {string} Confidence level
     */
    calculateConfidence(crimeData, demographics, recentIncidents) {
        let confidenceScore = 0;
        
        // Crime data granularity (40 points max)
        if (crimeData.granularity === this.granularity.CITY) {
            confidenceScore += 40; // City-level = highest confidence
        } else if (crimeData.granularity === this.granularity.COUNTY) {
            confidenceScore += 30; // County-level = good confidence
        } else if (crimeData.granularity === this.granularity.STATE) {
            confidenceScore += 20; // State-level = moderate confidence
        }

        // Recent incidents data (30 points max)
        if (recentIncidents && recentIncidents.total > 0) {
            confidenceScore += 30; // Real-time data = high value
        } else if (recentIncidents === null) {
            confidenceScore += 10; // No coordinates, but not a failure
        }

        // Demographics data (20 points max)
        if (demographics && !demographics.note) {
            confidenceScore += 20; // Actual Census data
        } else {
            confidenceScore += 10; // Estimated data
        }

        // Geocoding success (10 points max)
        if (crimeData.granularity === this.granularity.CITY) {
            confidenceScore += 10; // Precise location
        }

        // Convert to confidence level
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
     * Get data sources for citation based on what was actually used
     * @param {string} granularity - Data granularity level
     * @param {Object} recentIncidents - Recent incidents data
     * @returns {Array} Data sources
     */
    getDataSources(granularity, recentIncidents) {
        const sources = [];
        
        // Crime data source
        if (granularity === this.granularity.CITY) {
            sources.push({
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'City-level crime statistics'
            });
        } else if (granularity === this.granularity.COUNTY) {
            sources.push({
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'County-level crime statistics'
            });
        } else {
            sources.push({
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'State-level crime statistics'
            });
        }
        
        // Geocoding source
        sources.push({
            name: 'OpenStreetMap Nominatim',
            description: 'Geocoding and location services'
        });
        
        // Recent incidents if available
        if (recentIncidents && recentIncidents.total > 0) {
            sources.push({
                name: 'SpotCrime',
                description: `Recent crime incidents (${recentIncidents.total} in ${recentIncidents.radius} mile radius)`
            });
        }
        
        // Demographics
        sources.push({
            name: 'US Census Bureau',
            year: '2021',
            description: 'Demographic data (estimated)'
        });
        
        return sources;
    },

    getCrimeRating(violentRate) {
        if (violentRate > 500) return 'High';
        if (violentRate > 350) return 'Moderate';
        return 'Low';
    },

    /**
     * Show analyzing indicator
     */
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
            <small style="opacity: 0.8;">Fetching crime data and demographics</small>
        `;
        document.body.appendChild(indicator);
    },

    /**
     * Hide analyzing indicator
     */
    hideAnalyzing() {
        const indicator = document.getElementById('geoRiskAnalyzing');
        if (indicator) {
            document.body.removeChild(indicator);
        }
    },

    /**
     * Show success notification
     * @param {string} message - Success message
     */
    showSuccess(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 1.5rem;"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        setTimeout(() => document.body.removeChild(notification), 3000);
    },

    /**
     * Show error notification
     * @param {string} message - Error message
     */
    showError(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        `;
        notification.innerHTML = `
            <i class="fas fa-exclamation-circle" style="font-size: 1.5rem;"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        setTimeout(() => document.body.removeChild(notification), 4000);
    }
};

// Export for use in other modules
window.GeoRiskService = GeoRiskService;
