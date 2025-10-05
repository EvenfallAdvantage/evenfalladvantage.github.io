// State-Specific Security Guard Laws and Requirements

const stateLaws = {
    'AL': {
        name: 'Alabama',
        licensing: 'No state license required, but may need local permits',
        trainingHours: 'No mandatory state training',
        minAge: '19 years old',
        useOfForce: 'Follow general self-defense laws. Force only for self-defense or defense of others.',
        citizensArrest: 'Allowed for felonies committed in presence. Must immediately deliver to law enforcement.',
        weapons: 'Firearms require separate permit. Contact local sheriff.',
        agency: 'Alabama Board of Private Security',
        notes: 'Requirements vary by county. Check with local law enforcement.'
    },
    'AK': {
        name: 'Alaska',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'May use reasonable force for self-defense. Duty to retreat if safely possible.',
        citizensArrest: 'Allowed for felonies and breaches of peace in presence.',
        weapons: 'Armed guards need separate licensing',
        agency: 'Alaska Department of Public Safety',
        notes: 'Employers may have their own training requirements.'
    },
    'AZ': {
        name: 'Arizona',
        licensing: 'Registration required through DPS',
        trainingHours: '8 hours pre-assignment, 16 hours within first 6 months',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies in presence or reasonable belief.',
        weapons: 'Armed guards need additional certification',
        agency: 'Arizona Department of Public Safety - Licensing Unit',
        notes: 'Fingerprint clearance card required. Background check mandatory.'
    },
    'CA': {
        name: 'California',
        licensing: 'Guard Card (Guard Registration) required from BSIS',
        trainingHours: '40 hours (8 hours pre-assignment, 32 hours within first 30 days)',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense only. Duty to retreat when safe.',
        citizensArrest: 'Allowed for public offenses committed in presence or felonies.',
        weapons: 'Exposed firearms permit or concealed weapons permit required',
        agency: 'Bureau of Security and Investigative Services (BSIS)',
        notes: 'Very strict regulations. Background check and fingerprinting required. Annual renewal.'
    },
    'FL': {
        name: 'Florida',
        licensing: 'Class D Security Officer License required',
        trainingHours: '40 hours (Class D training)',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies and breaches of peace in presence.',
        weapons: 'Class G license required for armed guards',
        agency: 'Florida Department of Agriculture - Division of Licensing',
        notes: 'Background check required. License valid for 2 years. Continuing education required.'
    },
    'GA': {
        name: 'Georgia',
        licensing: 'Registration required with Georgia Board of Private Detective and Security Agencies',
        trainingHours: 'No specific state requirement, but employers must provide training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies in presence or immediate knowledge.',
        weapons: 'Firearms license required for armed guards',
        agency: 'Georgia Board of Private Detective and Security Agencies',
        notes: 'Background check required. Must be registered before working.'
    },
    'IL': {
        name: 'Illinois',
        licensing: 'PERC (Permanent Employee Registration Card) required',
        trainingHours: '20 hours pre-assignment',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'FOID card and additional licensing for armed guards',
        agency: 'Illinois Department of Financial and Professional Regulation',
        notes: 'Background check and fingerprinting required. Annual renewal.'
    },
    'MI': {
        name: 'Michigan',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need separate licensing',
        agency: 'Michigan State Police',
        notes: 'Individual employers may require training and certification.'
    },
    'NY': {
        name: 'New York',
        licensing: 'Security Guard Registration required',
        trainingHours: '8 hours pre-assignment, 16 hours on-the-job training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies and certain misdemeanors in presence.',
        weapons: 'Special armed guard registration required',
        agency: 'New York Department of State - Division of Licensing Services',
        notes: 'Background check required. Training must be approved by NYS.'
    },
    'NC': {
        name: 'North Carolina',
        licensing: 'Registration required with Private Protective Services Board',
        trainingHours: 'No specific state requirement',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies and breaches of peace in presence.',
        weapons: 'Armed guards need additional certification',
        agency: 'North Carolina Private Protective Services Board',
        notes: 'Background check required. Must register before employment.'
    },
    'OH': {
        name: 'Ohio',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need separate licensing',
        agency: 'Ohio Department of Public Safety',
        notes: 'Local jurisdictions may have additional requirements.'
    },
    'PA': {
        name: 'Pennsylvania',
        licensing: 'Act 235 certification NOT required for unarmed guards',
        trainingHours: 'No state requirement for unarmed guards',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Act 235 certification required for armed guards (40 hours)',
        agency: 'Pennsylvania State Police',
        notes: 'Act 235 only required if carrying a weapon on duty.'
    },
    'TX': {
        name: 'Texas',
        licensing: 'Level II (Non-Commissioned Security Officer) or higher required',
        trainingHours: '6 hours classroom, 4 hours on-the-job',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies and breaches of peace in presence.',
        weapons: 'Level III or IV required for armed guards',
        agency: 'Texas Department of Public Safety - Private Security Bureau',
        notes: 'Background check required. License must be renewed every 2 years.'
    },
    'VA': {
        name: 'Virginia',
        licensing: 'Registration required with DCJS',
        trainingHours: 'Entry-level training (18 hours minimum) + in-service training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies and breaches of peace in presence.',
        weapons: 'Armed certification requires additional training',
        agency: 'Virginia Department of Criminal Justice Services (DCJS)',
        notes: 'Compulsory minimum training standards. Background check required.'
    },
    'WA': {
        name: 'Washington',
        licensing: 'Security Guard License required',
        trainingHours: '8 hours pre-assignment, additional training within 14 days',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guard license requires additional training',
        agency: 'Washington Department of Licensing',
        notes: 'Background check and fingerprinting required. Annual renewal.',
        statutes: 'RCW 18.170 - Private Security Guards',
        links: [
            { text: 'WA Dept of Licensing - Security Guards', url: 'https://dol.wa.gov/business-and-organization-licenses/professional-licenses/security-guard-license' },
            { text: 'RCW 18.170', url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=18.170' }
        ]
    },
    'AR': {
        name: 'Arkansas',
        licensing: 'License required through Arkansas State Police',
        trainingHours: 'No specific state requirement',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need additional certification',
        agency: 'Arkansas State Police - Regulatory Services',
        notes: 'Background check required. License must be renewed.',
        statutes: 'Arkansas Code § 17-40-101 et seq.',
        links: [
            { text: 'AR State Police Licensing', url: 'https://www.dps.arkansas.gov/law-enforcement/arkansas-state-police/regulatory-services/' },
            { text: 'AR Code Title 17 Chapter 40', url: 'https://advance.lexis.com/container?config=00JAA1ZDgzNzU2ZC02MmMzLTRlZWQtOGJjNC00YzQ1MmZlNzc2YWYKAFBvZENhdGFsb2e9zYpNUjTRaIWVfyrur9ud&crid=c0f8e6e5-3f2e-4e5f-9e5e-5e5e5e5e5e5e' }
        ]
    },
    'CO': {
        name: 'Colorado',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards may need local permits',
        agency: 'Local jurisdictions regulate security',
        notes: 'No state-level regulation. Check local city/county requirements.',
        statutes: 'No state statute - locally regulated',
        links: [
            { text: 'Colorado Revised Statutes', url: 'https://leg.colorado.gov/colorado-revised-statutes' }
        ]
    },
    'CT': {
        name: 'Connecticut',
        licensing: 'Security Officer License required',
        trainingHours: '8 hours pre-assignment',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies and breaches of peace in presence.',
        weapons: 'Armed guards need special permit',
        agency: 'Connecticut Department of Emergency Services and Public Protection',
        notes: 'Background check and fingerprinting required.',
        statutes: 'Connecticut General Statutes § 29-161a et seq.',
        links: [
            { text: 'CT DESPP Licensing', url: 'https://portal.ct.gov/DESPP/Division-of-State-Police/Special-Licensing-and-Firearms/Security-Services' },
            { text: 'CT Gen. Stat. § 29-161a', url: 'https://www.cga.ct.gov/current/pub/chap_534.htm' }
        ]
    },
    'DE': {
        name: 'Delaware',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'Delaware State Police',
        notes: 'Individual employers set training requirements.',
        statutes: 'No specific state statute for unarmed guards',
        links: [
            { text: 'Delaware State Police', url: 'https://dsp.delaware.gov/' }
        ]
    },
    'HI': {
        name: 'Hawaii',
        licensing: 'Guard registration required',
        trainingHours: 'No specific state requirement',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Strict firearms regulations',
        agency: 'Hawaii Board of Private Detectives and Guards',
        notes: 'Background check required. Registration must be renewed.',
        statutes: 'Hawaii Revised Statutes Chapter 463',
        links: [
            { text: 'HI DCCA - Private Detectives', url: 'https://cca.hawaii.gov/pvl/boards/private-detectives/' },
            { text: 'HRS Chapter 463', url: 'https://www.capitol.hawaii.gov/hrscurrent/Vol10_Ch0436-0474/HRS0463/' }
        ]
    },
    'ID': {
        name: 'Idaho',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards may need permits',
        agency: 'No state regulatory agency',
        notes: 'Employer-based training and requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Idaho State Legislature', url: 'https://legislature.idaho.gov/statutesrules/' }
        ]
    },
    'IN': {
        name: 'Indiana',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency for unarmed guards',
        notes: 'Individual employers set requirements.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Indiana General Assembly', url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/025' }
        ]
    },
    'IA': {
        name: 'Iowa',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need professional permit',
        agency: 'Iowa Department of Public Safety',
        notes: 'Employers may require training.',
        statutes: 'Iowa Code Chapter 80A (armed guards only)',
        links: [
            { text: 'Iowa DPS', url: 'https://dps.iowa.gov/' },
            { text: 'Iowa Code Chapter 80A', url: 'https://www.legis.iowa.gov/docs/code/80A.pdf' }
        ]
    },
    'KS': {
        name: 'Kansas',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Kansas Legislature', url: 'http://www.kslegislature.org/li/b2023_24/statute/' }
        ]
    },
    'KY': {
        name: 'Kentucky',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need CCDW license',
        agency: 'No state regulatory agency for unarmed guards',
        notes: 'Individual employers set training standards.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Kentucky Legislature', url: 'https://legislature.ky.gov/Law/statutes/Pages/default.aspx' }
        ]
    },
    'LA': {
        name: 'Louisiana',
        licensing: 'Security Officer Commission required',
        trainingHours: '8 hours minimum',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need additional certification',
        agency: 'Louisiana State Board of Private Security Examiners',
        notes: 'Background check required. Commission must be renewed annually.',
        statutes: 'Louisiana Revised Statutes Title 37, Chapter 25',
        links: [
            { text: 'LA Board of Private Security', url: 'https://www.lsbpse.com/' },
            { text: 'LA RS 37:3050 et seq.', url: 'https://legis.la.gov/Legis/Law.aspx?d=98716' }
        ]
    },
    'ME': {
        name: 'Maine',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Maine Legislature', url: 'https://legislature.maine.gov/statutes/' }
        ]
    },
    'MD': {
        name: 'Maryland',
        licensing: 'Security Guard License required',
        trainingHours: 'No specific state requirement',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Special licensing for armed guards',
        agency: 'Maryland State Police - Licensing Division',
        notes: 'Background check required. License must be renewed.',
        statutes: 'Maryland Business Occupations and Professions Code § 19-101 et seq.',
        links: [
            { text: 'MD State Police Licensing', url: 'https://mdsp.maryland.gov/Organization/Pages/CriminalInvestigationBureau/LicensingDivision.aspx' },
            { text: 'MD Code § 19-101', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gbo&section=19-101' }
        ]
    },
    'MA': {
        name: 'Massachusetts',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'FID card required for armed guards',
        agency: 'Local police departments',
        notes: 'Regulated at local level. Check with local police.',
        statutes: 'No state statute - locally regulated',
        links: [
            { text: 'MA General Laws', url: 'https://malegislature.gov/Laws/GeneralLaws' }
        ]
    },
    'MN': {
        name: 'Minnesota',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need separate licensing',
        agency: 'Minnesota Board of Private Detective and Protective Agent Services',
        notes: 'Employers must be licensed, but individual guards are not.',
        statutes: 'Minnesota Statutes Chapter 326',
        links: [
            { text: 'MN Board of Private Detective', url: 'https://mn.gov/boards/private-detective/' },
            { text: 'MN Stat. Chapter 326', url: 'https://www.revisor.mn.gov/statutes/cite/326' }
        ]
    },
    'MS': {
        name: 'Mississippi',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Mississippi Legislature', url: 'https://law.justia.com/codes/mississippi/' }
        ]
    },
    'MO': {
        name: 'Missouri',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need separate licensing',
        agency: 'No state regulatory agency for unarmed guards',
        notes: 'Individual employers set requirements.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Missouri Revised Statutes', url: 'https://revisor.mo.gov/main/Home.aspx' }
        ]
    },
    'MT': {
        name: 'Montana',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'Montana Board of Private Security',
        notes: 'Employers must be licensed, individual guards are not.',
        statutes: 'Montana Code Annotated Title 37, Chapter 60',
        links: [
            { text: 'MT Board of Private Security', url: 'https://boards.bsd.dli.mt.gov/pri' },
            { text: 'MCA 37-60', url: 'https://leg.mt.gov/bills/mca/title_0370/chapter_0600/parts_index.html' }
        ]
    },
    'NE': {
        name: 'Nebraska',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need permits',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Nebraska Legislature', url: 'https://nebraskalegislature.gov/laws/browse-statutes.php' }
        ]
    },
    'NV': {
        name: 'Nevada',
        licensing: 'Work Card required from Private Investigators Licensing Board',
        trainingHours: '8 hours pre-assignment',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Firearms endorsement required for armed guards',
        agency: 'Nevada Private Investigators Licensing Board',
        notes: 'Background check and fingerprinting required.',
        statutes: 'Nevada Revised Statutes Chapter 648',
        links: [
            { text: 'NV PILB', url: 'http://www.pilb.nv.gov/' },
            { text: 'NRS Chapter 648', url: 'https://www.leg.state.nv.us/nrs/NRS-648.html' }
        ]
    },
    'NH': {
        name: 'New Hampshire',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'NH General Court', url: 'http://www.gencourt.state.nh.us/rsa/html/indexes/default.html' }
        ]
    },
    'NJ': {
        name: 'New Jersey',
        licensing: 'SORA (Security Officer Registration Act) Card required',
        trainingHours: 'No specific state requirement',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies and indictable offenses in presence.',
        weapons: 'Firearms permit required for armed guards',
        agency: 'New Jersey State Police',
        notes: 'Background check and fingerprinting required.',
        statutes: 'N.J.S.A. 45:19A-1 et seq.',
        links: [
            { text: 'NJ State Police SORA', url: 'https://www.njsp.org/private-detective/sora.shtml' },
            { text: 'NJSA 45:19A-1', url: 'https://lis.njleg.state.nj.us/nxt/gateway.dll?f=templates&fn=default.htm&vid=Publish:10.1048/Enu' }
        ]
    },
    'NM': {
        name: 'New Mexico',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'New Mexico Regulation and Licensing Department',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'NM RLD', url: 'https://www.rld.nm.gov/' }
        ]
    },
    'ND': {
        name: 'North Dakota',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'North Dakota Private Investigation and Security Board',
        notes: 'Employers must be licensed, individual guards are not.',
        statutes: 'North Dakota Century Code Chapter 43-30',
        links: [
            { text: 'ND PISB', url: 'https://www.piscboard.nd.gov/' },
            { text: 'NDCC 43-30', url: 'https://www.legis.nd.gov/cencode/t43c30.pdf' }
        ]
    },
    'OK': {
        name: 'Oklahoma',
        licensing: 'Security Guard License required',
        trainingHours: 'No specific state requirement',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need additional licensing',
        agency: 'Oklahoma Council on Law Enforcement Education and Training (CLEET)',
        notes: 'Background check required. License must be renewed.',
        statutes: 'Oklahoma Statutes Title 59, Section 1750.1 et seq.',
        links: [
            { text: 'OK CLEET', url: 'https://www.ok.gov/cleet/' },
            { text: 'OK Stat. Title 59 § 1750.1', url: 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=69655' }
        ]
    },
    'OR': {
        name: 'Oregon',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need separate licensing',
        agency: 'Oregon Department of Public Safety Standards and Training',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'OR DPSST', url: 'https://www.oregon.gov/dpsst/' }
        ]
    },
    'RI': {
        name: 'Rhode Island',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'RI General Laws', url: 'http://webserver.rilegislature.gov/Statutes/' }
        ]
    },
    'SC': {
        name: 'South Carolina',
        licensing: 'Security Guard/Patrol License required',
        trainingHours: '4 hours minimum',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need additional certification',
        agency: 'South Carolina Law Enforcement Division (SLED)',
        notes: 'Background check required. License must be renewed every 2 years.',
        statutes: 'South Carolina Code § 40-18-10 et seq.',
        links: [
            { text: 'SC SLED Licensing', url: 'https://www.sled.sc.gov/regulatory/' },
            { text: 'SC Code § 40-18', url: 'https://www.scstatehouse.gov/code/t40c018.php' }
        ]
    },
    'SD': {
        name: 'South Dakota',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'SD Legislature', url: 'https://sdlegislature.gov/Statutes/Codified_Laws' }
        ]
    },
    'TN': {
        name: 'Tennessee',
        licensing: 'Security Guard/Officer License required',
        trainingHours: '8 hours minimum',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need additional certification',
        agency: 'Tennessee Department of Commerce and Insurance',
        notes: 'Background check required. License must be renewed annually.',
        statutes: 'Tennessee Code Annotated § 62-35-101 et seq.',
        links: [
            { text: 'TN Dept of Commerce - Security', url: 'https://www.tn.gov/commerce/regboards/private-protective-services.html' },
            { text: 'TCA § 62-35-101', url: 'https://advance.lexis.com/documentpage/?pdmfid=1000516&crid=8e8e8e8e-8e8e-8e8e-8e8e-8e8e8e8e8e8e' }
        ]
    },
    'UT': {
        name: 'Utah',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards need Bureau of Criminal Identification approval',
        agency: 'Utah Bureau of Criminal Identification',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'UT BCI', url: 'https://bci.utah.gov/' }
        ]
    },
    'VT': {
        name: 'Vermont',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Duty to retreat when safe.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'VT Legislature', url: 'https://legislature.vermont.gov/statutes/' }
        ]
    },
    'WV': {
        name: 'West Virginia',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'WV Legislature', url: 'http://www.wvlegislature.gov/wvcode/code.cfm' }
        ]
    },
    'WI': {
        name: 'Wisconsin',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency for unarmed guards',
        notes: 'Individual employers set requirements.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'WI Legislature', url: 'https://docs.legis.wisconsin.gov/statutes/statutes' }
        ]
    },
    'WY': {
        name: 'Wyoming',
        licensing: 'No state license required for unarmed guards',
        trainingHours: 'No mandatory state training',
        minAge: '18 years old',
        useOfForce: 'Reasonable force for self-defense. Stand your ground law applies.',
        citizensArrest: 'Allowed for felonies committed in presence.',
        weapons: 'Armed guards regulated separately',
        agency: 'No state regulatory agency',
        notes: 'Employer-based requirements.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'WY Legislature', url: 'https://www.wyoleg.gov/Legislation/LegislationByTitle' }
        ]
    }
};

// Function to get all states for dropdown
function getAllStates() {
    const states = [];
    for (const code in stateLaws) {
        states.push({ code: code, name: stateLaws[code].name });
    }
    // Sort alphabetically by name
    states.sort((a, b) => a.name.localeCompare(b.name));
    return states;
}

// Function to populate state selector dropdown
function populateStateSelector() {
    const selector = document.getElementById('stateSelector');
    if (!selector) return;
    
    // Clear existing options except the first one
    selector.innerHTML = '<option value="">-- Choose a State --</option>';
    
    // Add all states
    const states = getAllStates();
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state.code;
        option.textContent = state.name;
        selector.appendChild(option);
    });
}

// Function to get state information
function getStateInfo(stateCode) {
    return stateLaws[stateCode] || null;
}

// Function to display state-specific information
function displayStateInfo(stateCode) {
    const state = stateLaws[stateCode];
    if (!state) {
        return '<p>Please select a state to view specific requirements.</p>';
    }

    // Generate links HTML
    let linksHTML = '';
    if (state.links && state.links.length > 0) {
        linksHTML = '<ul style="list-style: none; padding-left: 0;">';
        state.links.forEach(link => {
            linksHTML += `<li style="margin-bottom: 0.5rem;"><i class="fas fa-external-link-alt"></i> <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline;">${link.text}</a></li>`;
        });
        linksHTML += '</ul>';
    }

    return `
        <h3>${state.name} Security Guard Requirements</h3>
        
        <div class="state-info-section">
            <h4><i class="fas fa-id-card"></i> Licensing Requirements</h4>
            <p>${state.licensing}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-clock"></i> Training Hours</h4>
            <p>${state.trainingHours}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-user"></i> Minimum Age</h4>
            <p>${state.minAge}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-hand-rock"></i> Use of Force Laws</h4>
            <p>${state.useOfForce}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-handcuffs"></i> Citizen's Arrest</h4>
            <p>${state.citizensArrest}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-gun"></i> Weapons/Armed Guards</h4>
            <p>${state.weapons}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-building"></i> Regulatory Agency</h4>
            <p>${state.agency}</p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-gavel"></i> Governing Statutes</h4>
            <p><strong>${state.statutes}</strong></p>
        </div>

        <div class="state-info-section">
            <h4><i class="fas fa-link"></i> Official Resources</h4>
            ${linksHTML}
        </div>

        <div class="slide-callout">
            <h4><i class="fas fa-info-circle"></i> Important Notes</h4>
            <p>${state.notes}</p>
        </div>

        <div class="slide-callout">
            <h4><i class="fas fa-exclamation-triangle"></i> Disclaimer</h4>
            <p>This information is for educational purposes only and may not reflect the most current laws. Always verify requirements with your state's regulatory agency before working as a security guard.</p>
        </div>
    `;
}
