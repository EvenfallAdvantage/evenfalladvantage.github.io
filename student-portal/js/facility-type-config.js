/**
 * Facility Type Configuration
 * Provides facility-specific terminology, questions, and recommendations
 */

const FacilityTypeConfig = {
    'School': {
        terminology: {
            spaces: 'classrooms',
            occupants: 'students and staff',
            primarySpace: 'classroom',
            commonAreas: 'hallways and cafeteria',
            entryArea: 'main office',
            secureArea: 'administrative offices',
            publicArea: 'front entrance and lobby',
            restrictedArea: 'staff areas'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'classroomLocks', label: 'Classroom Door Locks', type: 'select', options: ['All classrooms lockable from inside', 'Most classrooms lockable', 'Some classrooms lockable', 'No classroom locks'], tutorial: 'Classroom locks are critical for lockdown procedures.', riskFactor: true }
            ],
            accessControl: [
                { name: 'studentIDSystem', label: 'Student ID System', type: 'select', options: ['Electronic ID badges', 'Visual ID badges', 'No ID system'], tutorial: 'ID systems help identify unauthorized individuals.' }
            ]
        },
        recommendations: {
            high: [
                'Implement single point of entry with visitor screening',
                'Install classroom door locks operable from inside',
                'Conduct monthly lockdown drills with students',
                'Establish relationship with local law enforcement for school resource officer'
            ],
            moderate: [
                'Enhance perimeter fencing around playgrounds',
                'Install panic buttons in classrooms',
                'Implement visitor management system with ID verification'
            ]
        }
    },
    
    'Office Building': {
        terminology: {
            spaces: 'offices and conference rooms',
            occupants: 'employees and visitors',
            primarySpace: 'office',
            commonAreas: 'lobbies and break rooms',
            entryArea: 'reception desk',
            secureArea: 'executive offices',
            publicArea: 'lobby and reception',
            restrictedArea: 'server rooms and storage'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'serverRoomSecurity', label: 'Server/IT Room Security', type: 'select', options: ['Electronic access with logging', 'Key access only', 'Minimal security', 'No dedicated server room'], tutorial: 'Server rooms contain critical infrastructure.', riskFactor: true }
            ],
            accessControl: [
                { name: 'afterHoursCleaning', label: 'After-Hours Cleaning Security', type: 'select', options: ['Supervised cleaning crew', 'Vetted cleaning service', 'Unvetted cleaning service', 'Unknown'], tutorial: 'Cleaning crews have access to sensitive areas.', riskFactor: true }
            ]
        },
        recommendations: {
            high: [
                'Implement electronic access control for all entry points',
                'Install security desk with visitor management system',
                'Establish after-hours security patrol or monitoring',
                'Secure server rooms with biometric or card access'
            ],
            moderate: [
                'Install panic buttons at reception desk',
                'Implement badge-based elevator access',
                'Enhance parking lot lighting and surveillance'
            ]
        }
    },
    
    'Single-family Home': {
        terminology: {
            spaces: 'rooms',
            occupants: 'residents and family members',
            primarySpace: 'living area',
            commonAreas: 'living room and kitchen',
            entryArea: 'front door',
            secureArea: 'bedrooms',
            publicArea: 'front yard and porch',
            restrictedArea: 'private bedrooms'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'windowLocks', label: 'Window Security', type: 'select', options: ['All windows have secure locks', 'Most windows secured', 'Some windows unsecured', 'Poor window security'], tutorial: 'Windows are common entry points for burglars.', riskFactor: true },
                { name: 'garageSecurity', label: 'Garage Security', type: 'select', options: ['Secure with automatic opener', 'Manual lock', 'Minimal security', 'No garage'], tutorial: 'Attached garages provide direct access to home.' },
                { name: 'outdoorLighting', label: 'Outdoor Security Lighting', type: 'select', options: ['Motion-activated comprehensive coverage', 'Good coverage', 'Minimal lighting', 'Poor lighting'], tutorial: 'Lighting deters burglars and aids surveillance.', riskFactor: true }
            ],
            accessControl: [
                { name: 'smartLocks', label: 'Smart Lock System', type: 'select', options: ['Smart locks on all entry doors', 'Smart lock on main entry', 'Traditional deadbolts', 'Basic locks only'], tutorial: 'Smart locks provide remote monitoring and access logs.' },
                { name: 'gateAccess', label: 'Property Gate/Fence', type: 'select', options: ['Gated with secure access', 'Fenced perimeter', 'Partial fencing', 'No perimeter security'], tutorial: 'Perimeter barriers are first line of defense.' }
            ],
            surveillance: [
                { name: 'doorbellCamera', label: 'Video Doorbell', type: 'select', options: ['Video doorbell with recording', 'Basic doorbell camera', 'No doorbell camera'], tutorial: 'Video doorbells deter porch pirates and provide visitor identification.' }
            ]
        },
        recommendations: {
            high: [
                'Install monitored alarm system with door/window sensors',
                'Upgrade to solid-core doors with deadbolts on all entries',
                'Install motion-activated security lighting around perimeter',
                'Add video doorbell and exterior cameras with cloud recording',
                'Secure sliding doors with bar locks or security pins',
                'Consider smart home security system with mobile alerts'
            ],
            moderate: [
                'Install window locks and security film on ground-floor windows',
                'Add motion sensor lights to dark areas',
                'Trim shrubs near windows to eliminate hiding spots',
                'Install timer lights to simulate occupancy when away',
                'Secure garage door with additional lock or smart opener'
            ]
        }
    },
    
    'Multi-family Complex': {
        terminology: {
            spaces: 'units and common areas',
            occupants: 'residents and guests',
            primarySpace: 'residential unit',
            commonAreas: 'hallways, lobbies, and amenity areas',
            entryArea: 'main entrance and lobby',
            secureArea: 'individual units',
            publicArea: 'parking lot and exterior',
            restrictedArea: 'maintenance areas and rooftops'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'buildingAccess', label: 'Building Entry Security', type: 'select', options: ['Electronic access control', 'Key/fob access', 'Intercom system', 'Open access'], tutorial: 'Controlled building access protects all residents.', riskFactor: true },
                { name: 'mailroomSecurity', label: 'Mailroom/Package Security', type: 'select', options: ['Secure package lockers', 'Monitored mailroom', 'Basic mailboxes', 'Unsecured mail area'], tutorial: 'Package theft is common in multi-family properties.', riskFactor: true }
            ],
            accessControl: [
                { name: 'guestAccess', label: 'Guest Access Management', type: 'select', options: ['Digital guest registration', 'Intercom verification', 'Resident escort required', 'Open guest access'], tutorial: 'Guest management prevents unauthorized access.', riskFactor: true },
                { name: 'parkingAccess', label: 'Parking Lot Access Control', type: 'select', options: ['Gated with access control', 'Assigned parking with monitoring', 'Open parking lot'], tutorial: 'Parking lot security affects resident vehicle safety.', riskFactor: true }
            ],
            surveillance: [
                { name: 'commonAreaCoverage', label: 'Common Area Camera Coverage', type: 'select', options: ['All common areas covered', 'Most areas covered', 'Limited coverage', 'No coverage'], tutorial: 'Common areas require surveillance for resident safety.', riskFactor: true }
            ]
        },
        recommendations: {
            high: [
                'Install electronic access control on all building entries',
                'Implement comprehensive camera coverage of common areas',
                'Add secure package locker system',
                'Establish 24/7 security patrol or monitoring',
                'Install emergency call boxes in parking areas',
                'Implement guest registration system'
            ],
            moderate: [
                'Enhance lighting in parking lots and walkways',
                'Install cameras at all entry/exit points',
                'Implement resident ID badge system',
                'Add intercom system for guest verification',
                'Secure amenity areas with access control'
            ]
        }
    },
    
    'Religious Facility': {
        terminology: {
            spaces: 'worship areas and meeting rooms',
            occupants: 'congregation and visitors',
            primarySpace: 'sanctuary',
            commonAreas: 'fellowship halls and lobbies',
            entryArea: 'main entrance',
            secureArea: 'offices and storage',
            publicArea: 'sanctuary and parking lot',
            restrictedArea: 'administrative offices'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'sanctuaryLocks', label: 'Sanctuary Security', type: 'select', options: ['Lockable with emergency exits', 'Partially secured', 'Open access'], tutorial: 'Balance security with welcoming atmosphere.' }
            ],
            accessControl: [
                { name: 'eventSecurity', label: 'Large Event Security', type: 'select', options: ['Trained security team', 'Volunteer greeters', 'Minimal security', 'No security'], tutorial: 'Large gatherings require security presence.', riskFactor: true }
            ]
        },
        recommendations: {
            high: [
                'Establish security team with training for large services',
                'Install panic buttons in sanctuary and offices',
                'Implement visitor greeting and monitoring system',
                'Coordinate with local law enforcement for high-attendance events'
            ],
            moderate: [
                'Install cameras at entry points and parking lots',
                'Establish emergency evacuation procedures',
                'Secure administrative areas during services'
            ]
        }
    },
    
    'Healthcare': {
        terminology: {
            spaces: 'patient rooms and treatment areas',
            occupants: 'patients, staff, and visitors',
            primarySpace: 'patient care area',
            commonAreas: 'waiting rooms and hallways',
            entryArea: 'reception desk',
            secureArea: 'medication storage and records',
            publicArea: 'waiting room and lobby',
            restrictedArea: 'medication rooms and staff areas'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'medicationSecurity', label: 'Medication Storage Security', type: 'select', options: ['Secure locked storage with access control', 'Locked cabinets', 'Minimal security', 'Unknown'], tutorial: 'Medication security is critical and regulated.', riskFactor: true },
                { name: 'patientAreaSecurity', label: 'Patient Area Access Control', type: 'select', options: ['Electronic access control', 'Keypad entry', 'Staff monitoring', 'Open access'], tutorial: 'Patient areas require controlled access.', riskFactor: true }
            ]
        },
        recommendations: {
            high: [
                'Implement electronic access control for medication storage',
                'Install panic buttons in patient rooms and reception',
                'Establish de-escalation training for staff',
                'Secure patient records with access logging'
            ],
            moderate: [
                'Install cameras in public areas (not patient rooms)',
                'Implement visitor badge system',
                'Enhance lighting in parking areas'
            ]
        }
    },
    
    'Retail': {
        terminology: {
            spaces: 'sales floor and storage areas',
            occupants: 'customers and employees',
            primarySpace: 'sales floor',
            commonAreas: 'aisles and checkout area',
            entryArea: 'storefront entrance',
            secureArea: 'cash office and storage',
            publicArea: 'sales floor',
            restrictedArea: 'back office and storage'
        },
        specificFields: {
            physicalSecurity: [
                { name: 'cashHandling', label: 'Cash Handling Security', type: 'select', options: ['Drop safe with time delay', 'Locked safe', 'Cash register only', 'Minimal security'], tutorial: 'Cash handling procedures reduce robbery risk.', riskFactor: true }
            ],
            surveillance: [
                { name: 'posCoverage', label: 'Point-of-Sale Camera Coverage', type: 'select', options: ['All POS covered', 'Most POS covered', 'Limited coverage'], tutorial: 'POS cameras deter theft and fraud.', riskFactor: true }
            ]
        },
        recommendations: {
            high: [
                'Install comprehensive camera coverage including POS',
                'Implement drop safe procedures for cash management',
                'Install panic buttons at checkout and office',
                'Enhance exterior lighting and parking lot surveillance'
            ],
            moderate: [
                'Install anti-theft systems at exits',
                'Implement employee theft prevention training',
                'Secure high-value merchandise'
            ]
        }
    },
    
    'Venue/Event Space': {
        terminology: {
            spaces: 'event spaces and gathering areas',
            occupants: 'attendees and staff',
            primarySpace: 'main venue',
            commonAreas: 'lobbies and concourses',
            entryArea: 'ticket gates',
            secureArea: 'backstage and control rooms',
            publicArea: 'seating and concourse',
            restrictedArea: 'backstage and technical areas'
        },
        specificFields: {
            accessControl: [
                { name: 'crowdControl', label: 'Crowd Control Measures', type: 'select', options: ['Professional security team', 'Trained staff', 'Minimal measures', 'None'], tutorial: 'Crowd control prevents incidents at large events.', riskFactor: true },
                { name: 'ticketingSystem', label: 'Ticketing/Entry System', type: 'select', options: ['Electronic scanning', 'Manual verification', 'Honor system'], tutorial: 'Controlled entry manages capacity and security.' }
            ]
        },
        recommendations: {
            high: [
                'Hire professional security for events over 100 attendees',
                'Implement bag check procedures',
                'Establish emergency evacuation plan with marked exits',
                'Coordinate with local law enforcement for large events'
            ],
            moderate: [
                'Install cameras at entry/exit points',
                'Train staff in emergency procedures',
                'Establish clear signage for exits'
            ]
        }
    }
};

// Default configuration for 'Other' or unspecified facility types
FacilityTypeConfig['Other'] = {
    terminology: {
        spaces: 'areas',
        occupants: 'occupants',
        primarySpace: 'main area',
        commonAreas: 'common areas',
        entryArea: 'entrance',
        secureArea: 'restricted areas',
        publicArea: 'public areas',
        restrictedArea: 'private areas'
    },
    specificFields: {},
    recommendations: {
        high: [
            'Implement access control at entry points',
            'Install surveillance cameras at critical areas',
            'Establish emergency procedures',
            'Conduct regular security assessments'
        ],
        moderate: [
            'Enhance perimeter security',
            'Improve lighting in vulnerable areas',
            'Train staff in security awareness'
        ]
    }
};

// Helper function to get facility configuration
FacilityTypeConfig.getConfig = function(facilityType) {
    return this[facilityType] || this['Other'];
};

// Helper function to get terminology
FacilityTypeConfig.getTerm = function(facilityType, termKey) {
    const config = this.getConfig(facilityType);
    return config.terminology[termKey] || termKey;
};

// Helper function to get specific fields for a section
FacilityTypeConfig.getSpecificFields = function(facilityType, sectionId) {
    const config = this.getConfig(facilityType);
    return config.specificFields[sectionId] || [];
};

// Helper function to get recommendations
FacilityTypeConfig.getRecommendations = function(facilityType, riskLevel) {
    const config = this.getConfig(facilityType);
    const level = riskLevel.toLowerCase();
    return config.recommendations[level] || config.recommendations['moderate'] || [];
};
