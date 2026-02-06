/**
 * Geo-Based Risk Assessment Service
 * Free tier implementation using Nominatim, FBI Crime Data, and US Census API
 * Evenfall Advantage LLC
 */

const GeoRiskService = {
    // API endpoints
    apis: {
        nominatim: 'https://nominatim.openstreetmap.org/search',
        fbiCrimeData: 'https://api.usa.gov/crime/fbi/cde',
        census: 'https://api.census.gov/data/2021/acs/acs5'
    },

    // Cache for API responses
    cache: {},

    /**
     * Main function to analyze location risk
     * @param {Object} addressData - Address components
     * @returns {Promise<Object>} Risk assessment data
     */
    async analyzeLocationRisk(addressData) {
        const { address, city, state } = addressData;
        
        if (!city || !state) {
            throw new Error('City and State are required for risk analysis');
        }

        try {
            // Show loading
            this.showAnalyzing();

            // 1. Geocode the address
            const location = await this.geocodeAddress(address, city, state);
            
            // 2. Fetch crime data
            const crimeData = await this.fetchCrimeData(location);
            
            // 3. Fetch demographic data
            const demographics = await this.fetchDemographics(location);
            
            // 4. Calculate risk assessment
            const riskAssessment = this.calculateRiskAssessment(crimeData, demographics, addressData);
            
            // 5. Add metadata
            riskAssessment.metadata = {
                location: location,
                dataSources: this.getDataSources(),
                analysisDate: new Date().toISOString(),
                confidence: this.calculateConfidence(crimeData, demographics)
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
        const query = address ? `${address}, ${city}, ${state}, USA` : `${city}, ${state}, USA`;
        const cacheKey = `geocode_${query}`;

        // Check cache
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        try {
            const response = await fetch(
                `${this.apis.nominatim}?` + new URLSearchParams({
                    q: query,
                    format: 'json',
                    addressdetails: 1,
                    limit: 1,
                    countrycodes: 'us'
                }),
                {
                    headers: {
                        'User-Agent': 'EvenfallAdvantage-SecurityAssessment/1.0'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Geocoding failed');
            }

            const data = await response.json();
            
            if (!data || data.length === 0) {
                throw new Error('Location not found');
            }

            const result = {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                county: data[0].address.county || '',
                state: data[0].address.state || state,
                city: data[0].address.city || data[0].address.town || city,
                displayName: data[0].display_name
            };

            // Cache result
            this.cache[cacheKey] = result;
            return result;

        } catch (error) {
            console.error('Geocoding error:', error);
            // Return approximate data based on city/state
            return {
                lat: null,
                lon: null,
                county: '',
                state: state,
                city: city,
                displayName: `${city}, ${state}`,
                error: 'Geocoding unavailable'
            };
        }
    },

    /**
     * Fetch crime data from FBI Crime Data Explorer
     * Note: FBI API requires registration, using fallback crime statistics
     * @param {Object} location - Location data
     * @returns {Promise<Object>} Crime statistics
     */
    async fetchCrimeData(location) {
        const cacheKey = `crime_${location.state}_${location.county}`;

        // Check cache
        if (this.cache[cacheKey]) {
            return this.cache[cacheKey];
        }

        try {
            // FBI Crime Data Explorer API (requires API key)
            // For now, using state-level averages and known statistics
            const crimeStats = await this.getStateCrimeAverages(location.state);
            
            // Cache result
            this.cache[cacheKey] = crimeStats;
            return crimeStats;

        } catch (error) {
            console.error('Crime data fetch error:', error);
            // Return national averages as fallback
            return this.getNationalCrimeAverages();
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
     * Fetch demographic data from US Census API
     * @param {Object} location - Location data
     * @returns {Promise<Object>} Demographic data
     */
    async fetchDemographics(location) {
        // For now, return estimated demographics
        // Full Census API integration would require state/county FIPS codes
        return {
            populationDensity: 'Moderate',
            medianIncome: 'Moderate',
            educationLevel: 'Moderate',
            note: 'Estimated demographics'
        };
    },

    /**
     * Calculate risk assessment based on collected data
     * @param {Object} crimeData - Crime statistics
     * @param {Object} demographics - Demographic data
     * @param {Object} addressData - Original address data
     * @returns {Object} Risk assessment
     */
    calculateRiskAssessment(crimeData, demographics, addressData) {
        // Calculate threat likelihood based on crime rates
        let threatLikelihood = 'Possible';
        if (crimeData.violent > 500 || crimeData.overall === 'High') {
            threatLikelihood = 'Likely';
        } else if (crimeData.violent > 350) {
            threatLikelihood = 'Possible';
        } else if (crimeData.violent < 250) {
            threatLikelihood = 'Unlikely';
        }

        // Calculate potential impact based on facility type
        let potentialImpact = 'Moderate';
        const facilityType = addressData.facilityType?.toLowerCase() || '';
        
        if (facilityType.includes('school') || facilityType.includes('healthcare')) {
            potentialImpact = 'Major'; // Higher impact for vulnerable populations
        } else if (facilityType.includes('office') || facilityType.includes('retail')) {
            potentialImpact = 'Moderate';
        }

        // Default vulnerability and resilience (assessor will refine)
        const overallVulnerability = 'Moderate';
        const resilienceLevel = 'Fair';

        return {
            threatLikelihood,
            potentialImpact,
            overallVulnerability,
            resilienceLevel,
            crimeData: {
                violentCrimeRate: crimeData.violent,
                propertyCrimeRate: crimeData.property,
                overallRating: crimeData.overall
            },
            autoPopulated: true,
            editable: true
        };
    },

    /**
     * Calculate confidence level of the analysis
     * @param {Object} crimeData - Crime data
     * @param {Object} demographics - Demographics
     * @returns {string} Confidence level
     */
    calculateConfidence(crimeData, demographics) {
        if (crimeData.note || demographics.note) {
            return 'Medium'; // Using estimates
        }
        return 'High'; // Using actual data
    },

    /**
     * Get data sources for citation
     * @returns {Array} Data sources
     */
    getDataSources() {
        return [
            {
                name: 'FBI Uniform Crime Reporting (UCR)',
                year: '2022',
                description: 'State-level crime statistics'
            },
            {
                name: 'OpenStreetMap Nominatim',
                description: 'Geocoding and location services'
            },
            {
                name: 'US Census Bureau',
                year: '2021',
                description: 'Demographic data (estimated)'
            }
        ];
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
