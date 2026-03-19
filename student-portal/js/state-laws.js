// State-Specific Security Guard Laws and Requirements

const stateLaws = {
    'AL': {
        name: 'Alabama',
        licensing: 'Registration required with the Alabama Security Regulatory Board (ASRB). All security officers must obtain an ASRB registration card. Companies must hold a Contract Security Company License.',
        trainingHours: '8 hours minimum pre-assignment training. ASRB mandates training in legal authority, emergency procedures, and report writing.',
        minAge: '19 years old (unique to Alabama; 21 for armed)',
        useOfForce: 'Stand Your Ground state (Code of Ala. § 13A-3-23). No duty to retreat in any place where the person has a lawful right to be. Force permitted when reasonably necessary to prevent imminent harm. Deadly force only to prevent imminent death or serious bodily harm.',
        citizensArrest: 'Permitted under Code of Ala. § 15-10-7. May arrest for public offenses or breach of peace in presence, or felonies with reasonable cause. Must deliver to law enforcement without unnecessary delay.',
        weapons: 'Armed Guard Permit from ASRB required plus firearms qualification course. Annual requalification mandatory. Concealed carry permit may also be required depending on assignment.',
        agency: 'Alabama Security Regulatory Board (ASRB)',
        notes: 'Background check and fingerprinting required. Registration renewed every 2 years. One of few states with minimum age of 19. Companies must maintain liability insurance.'
    },
    'AK': {
        name: 'Alaska',
        licensing: 'No state license required for unarmed guards. Security companies must register as a business with the Alaska Division of Corporations.',
        trainingHours: 'No mandatory state training hours. Employers expected to provide adequate on-the-job training.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (AS § 11.81.335). No duty to retreat from any place the person has a right to be. Deadly force permitted when reasonably necessary to prevent death or serious physical injury. Defense of property allows reasonable nondeadly force (AS § 11.81.350).',
        citizensArrest: 'Permitted under AS § 12.25.030. May arrest for crimes committed or attempted in presence, or when arrested person has committed a felony. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Constitutional carry state — no permit required for open or concealed carry for those 21+. Armed guards must comply with employer policies and carry appropriate insurance.',
        agency: 'Alaska Department of Commerce, Community, and Economic Development (DCCED)',
        notes: 'Largely unregulated at state level for unarmed guards. Employers set training standards. Remote locations create unique operational considerations.'
    },
    'AZ': {
        name: 'Arizona',
        licensing: 'Registration required through Arizona DPS. All guards must obtain a Security Guard Registration Certificate. Background check and fingerprinting through approved vendor required.',
        trainingHours: '8 hours pre-assignment training plus 8 additional hours within 90 days. Covers legal authority, emergency response, observation/reporting, and ethics.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (ARS § 13-404 through 13-411). Force justified when a reasonable person would believe it immediately necessary to protect against unlawful physical force. Deadly force when reasonably necessary to protect against death or serious physical injury. No duty to retreat.',
        citizensArrest: 'Permitted under ARS § 13-3884. May arrest when a felony has been committed with reasonable grounds, or a misdemeanor breach of peace in presence. Must deliver to magistrate or peace officer without unnecessary delay.',
        weapons: 'Armed Security Guard Certification from DPS required. Minimum 16-hour firearms program, written exam, and range qualification. Annual requalification. Valid Fingerprint Clearance Card required.',
        agency: 'Arizona Department of Public Safety (DPS) — Security Guard Program',
        notes: 'Fingerprint Clearance Card required. Registration valid 2 years. Extreme heat creates unique duty-of-care obligations for outdoor security. DPS maintains active database of registered guards.'
    },
    'CA': {
        name: 'California',
        licensing: 'Guard Card (Guard Registration) required from BSIS. Must complete training, pass background check with Live Scan fingerprinting. Guard Card valid for 2 years.',
        trainingHours: '40 hours total: 8 hours Powers to Arrest (pre-assignment), 16 hours within 30 days (including WMD/Terrorism Awareness), 16 hours within 6 months. 8-hour annual refresher for renewal.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state in public. Self-defense justified when person reasonably believes they are in imminent danger (Penal Code § 198.5, CALCRIM 505/506). Castle Doctrine in home only. Guards have no more authority than private citizens. Powers to Arrest training covers force limitations. Excessive force = criminal charges + civil liability.',
        citizensArrest: 'Governed by Penal Code § 837. May arrest for public offense in presence, when arrested person committed felony (even if not in presence), or with reasonable cause for felony. Core topic in mandatory Powers to Arrest training.',
        weapons: 'Exposed Firearms Permit from BSIS required. 16-hour firearms course, written exam, range qualification with each specific firearm. Annual requalification. Baton Permit requires separate 8-hour course. OC spray with employer authorization. Strict ammo restrictions in some jurisdictions.',
        agency: 'Bureau of Security and Investigative Services (BSIS), California Department of Consumer Affairs',
        notes: 'One of the most heavily regulated states. Live Scan fingerprinting required. 2-year renewal with continuing education. Public license verification database. Strict penalties for working without valid Guard Card. AB 229 expanded BSIS oversight.'
    },
    'FL': {
        name: 'Florida',
        licensing: 'Class D Security Officer License required from FDACS Division of Licensing. Must complete training, pass background check with fingerprinting. License valid 2 years.',
        trainingHours: '40 hours Class D training: legal authority, ethics, emergency procedures, access control, patrol techniques, first aid/AED, report writing. Armed guards need additional 28-hour Class G training.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (FL Stat. § 776.012-776.013). No duty to retreat anywhere person has right to be. Force including deadly force justified when reasonably necessary to prevent imminent death, great bodily harm, or imminent forcible felony. Castle Doctrine (§ 776.013) adds protections in dwellings, residences, and occupied vehicles.',
        citizensArrest: 'Permitted under FL Stat. § 901.16. May arrest for felonies with reasonable ground, or breach of peace in presence. Merchant\'s Protection statute (§ 812.015) provides specific retail theft detention authority. Must deliver to law enforcement without unreasonable delay.',
        weapons: 'Class G Statewide Firearm License required. 28 hours firearms training from licensed instructor including classroom and range qualification. Annual requalification with each firearm. Must carry both Class D and G licenses while armed on duty.',
        agency: 'Florida Department of Agriculture and Consumer Services (FDACS) — Division of Licensing',
        notes: 'One of most popular states for security employment. Both licenses valid 2 years. Online verification system. Some state reciprocity for armed licenses. Continuing education for renewal.'
    },
    'GA': {
        name: 'Georgia',
        licensing: 'Registration with Georgia Board of Private Detective and Security Agencies. Companies must be licensed, guards registered through employer. Background check with fingerprinting through GCIC.',
        trainingHours: 'No specific minimum hours mandated. Board requires employers ensure proper training before assignment. Most employers provide 8-24 hours covering state law, use of force, emergency response, and reporting.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (O.C.G.A. § 16-3-21 through 24.2). No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary to prevent death, great bodily injury, or forcible felony. Deadly force only for death, great bodily injury, or forcible felony prevention.',
        citizensArrest: 'SIGNIFICANTLY REFORMED in 2021 after Ahmaud Arbery case. Under O.C.G.A. § 17-4-60, citizen\'s arrest is now extremely limited: may only detain if witnessing a felony AND person is escaping, solely to contact law enforcement. Previous broad authority eliminated. Shopkeeper\'s privilege (§ 51-7-60) still applies for merchants.',
        weapons: 'Constitutional carry state as of April 2022 (SB 319) — no license required for those 21+. Armed companies typically still require firearms training and qualification for liability purposes. Georgia Firearms License available through local probate court.',
        agency: 'Georgia Board of Private Detective and Security Agencies (under Secretary of State)',
        notes: 'Background check and fingerprinting mandatory. Company license renewed annually. 2021 citizen\'s arrest reform is one of the most significant changes nationally — guards must understand the restricted standards. Constitutional carry (2022) does not eliminate employer training requirements.'
    },
    'IL': {
        name: 'Illinois',
        licensing: 'Permanent Employee Registration Card (PERC) required from IDFPR. Background check with fingerprinting, training completion, and application fee required. PERC valid 3 years.',
        trainingHours: '20 hours pre-assignment covering legal authority, emergency response, observation/reporting, safety, access control, and ethics. 8 hours annual refresher required. Armed guards need additional 20-hour firearms program.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state in public (720 ILCS 5/7-1). Force justified when reasonably necessary to prevent imminent unlawful force. Deadly force only to prevent imminent death, great bodily harm, or forcible felony. Castle Doctrine (720 ILCS 5/7-2) eliminates duty to retreat in dwelling or place of business.',
        citizensArrest: 'Permitted under 725 ILCS 5/107-3. May arrest when reasonable grounds to believe person is committing or has committed offense. May use reasonable force. Must deliver to peace officer without unreasonable delay. Requires "reasonable grounds" — higher than mere suspicion.',
        weapons: 'Firearm Control Card (FCC) from IDFPR plus valid FOID Card from IL State Police required. 20-hour approved firearms program, written and practical exams. Annual requalification. Strict assault weapons regulations and magazine capacity limits in Cook County/Chicago.',
        agency: 'Illinois Department of Financial and Professional Regulation (IDFPR)',
        notes: 'Strong regulations and active enforcement. PERC renewed every 3 years with continuing education. Governed by Private Detective, Private Alarm, Private Security, Fingerprint Vendor, and Locksmith Act of 2004 (225 ILCS 447). Chicago has additional local requirements.'
    },
    'MI': {
        name: 'Michigan',
        licensing: 'No state license for individual unarmed guards. Private security companies must be licensed by Michigan State Police under Private Security Business and Security Alarm Act (MCL 338.1051-1092). Guards registered through employing company.',
        trainingHours: 'No mandatory state hours for unarmed guards. Act requires employers ensure competency but no minimum hours specified. Most employers provide 8-16 hours pre-assignment. Armed guards must meet MSP firearms qualification.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state as of October 2024 (MCL § 780.972 expanded). Person who has not engaged in unlawful activity may use deadly force anywhere with legal right to be if honestly and reasonably believing it necessary to prevent imminent death, great bodily harm, or sexual assault. No duty to retreat. Previously only Castle Doctrine in dwellings — 2024 expansion is a major change.',
        citizensArrest: 'Permitted under MCL § 764.16. May arrest for felonies in presence. Misdemeanors only for breach of peace in presence — more restrictive than some states. Must deliver to peace officer without unnecessary delay. Only reasonable force permitted.',
        weapons: 'Concealed Pistol License (CPL) from county clerk required. Michigan requires pistol registration. Open carry of registered pistols legal without permit. Armed companies must comply with MSP licensing. Employers require range qualification and annual requalification.',
        agency: 'Michigan State Police (MSP) — Licensing and Regulatory Affairs',
        notes: 'Company licensing through MSP required. Michigan expanded Stand Your Ground significantly in October 2024 — major legal change guards must understand. Detroit and urban areas may have additional local requirements.'
    },
    'NY': {
        name: 'New York',
        licensing: 'Security Guard Registration required from NY Department of State, Division of Licensing Services. Must complete training, pass background check with fingerprinting. Registration valid 2 years.',
        trainingHours: '24 hours total: 8 hours pre-assignment (NYS-approved course), plus 16 hours on-the-job training within 90 days. Annual 8-hour refresher required. Training must be NYS-approved. Armed guards require additional 47-hour firearms course.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state (NY Penal Law § 35.15). Force justified when reasonably necessary against imminent unlawful physical force. Deadly force only when facing imminent death or serious physical injury AND cannot retreat safely. Castle Doctrine (§ 35.15(2)(a)(i)) — no duty to retreat at home. NYC has additional restrictions on security guard use of force.',
        citizensArrest: 'Permitted under NY CPL § 140.30. May arrest for offenses in presence. For felonies, may arrest when person has in fact committed felony. Deadly force may not be used to prevent escape. Must deliver to law enforcement without unnecessary delay. NY courts strictly interpret authority.',
        weapons: 'Special Armed Guard Registration from NY DOS required. NYS-approved 47-hour firearms training, written and practical exams. NY SAFE Act: assault weapons restrictions, 10-round magazine limit, universal background checks. NYC armed guards need separate NYPD permit. Very heavily regulated.',
        agency: 'New York Department of State (DOS) — Division of Licensing Services',
        notes: 'One of most heavily regulated states. 2-year renewal with continuing education. NYS-approved training only. NYC has additional requirements beyond state (NYPD oversight for armed). SAFE Act compliance mandatory. DOS maintains online verification database.'
    },
    'NC': {
        name: 'North Carolina',
        licensing: 'Registration required with NC Private Protective Services Board (PPSB). Companies must be licensed. Guards registered through employer. Background check with fingerprinting required.',
        trainingHours: 'PPSB requires employer-provided training before assignment. Training must cover statutory authority, use of force, emergency procedures, and report writing. Armed guards require firearms qualification through PPSB-approved program.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (NCGS § 14-51.3). No duty to retreat in any place with lawful right to be. Force justified when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony. Castle Doctrine (§ 14-51.2) provides presumption of reasonable fear against intruders in home, vehicle, or workplace.',
        citizensArrest: 'Permitted under NCGS § 15A-404. May detain when probable cause to believe person committed felony, misdemeanor breach of peace, theft, or property destruction. Reasonable force permitted. Must notify law enforcement immediately.',
        weapons: 'Armed guard certification through PPSB-approved program required. Handgun purchase permit from sheriff or CHP required. CHP for concealed carry. Open carry legal without permit.',
        agency: 'North Carolina Private Protective Services Board (PPSB)',
        notes: 'Background check and fingerprinting required. PPSB actively regulates the industry. Military installations create additional security employment.'
    },
    'OH': {
        name: 'Ohio',
        licensing: 'No state license required for unarmed guards. Security companies must register with Ohio Department of Public Safety.',
        trainingHours: 'No mandatory state training hours for unarmed guards. Employers set own standards. Ohio Peace Officer Training Commission (OPOTC) provides optional resources.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state as of April 2021 (SB 175). Previously duty-to-retreat. No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary to prevent imminent death or great bodily harm. Deadly force only for death, great bodily harm, or forcible felony. Castle Doctrine (ORC § 2901.09) in residence or vehicle.',
        citizensArrest: 'Permitted under ORC § 2935.04. May arrest for felonies in presence. Must deliver to peace officer or magistrate without unnecessary delay. More limited than many states — primarily felonies.',
        weapons: 'Constitutional carry state since June 2022 (SB 215) — no permit for concealed carry for those 21+. CHLs still issued for reciprocity. Armed guards comply with employer requirements.',
        agency: 'Ohio Department of Public Safety (limited oversight)',
        notes: 'Minimal state regulation for individual guards. Shifted to Stand Your Ground in 2021. Constitutional carry since 2022. Cleveland, Columbus, and Cincinnati have significant security markets.'
    },
    'PA': {
        name: 'Pennsylvania',
        licensing: 'No state license for unarmed guards. Act 235 certification NOT required for unarmed — only for carrying weapons on duty. Companies register as businesses.',
        trainingHours: 'No state requirement for unarmed guards. Act 235 for armed guards: 40 hours classroom and range from PA State Police-approved school. Biennial requalification.',
        minAge: '18 years old (21 for Act 235)',
        useOfForce: 'Duty to Retreat in public (18 Pa.C.S. § 505). Force justified when immediately necessary against unlawful force. Must retreat before deadly force if safely possible. Castle Doctrine (§ 505(b)(2.3)) — no duty to retreat in dwelling, residence, or occupied vehicle. Deadly force to prevent death, serious bodily injury, kidnapping, or forcible sexual intercourse. 2011 Castle Doctrine expansion strengthened protections.',
        citizensArrest: 'Permitted under common law. May arrest for felonies in presence or with probable cause. Breach of peace in presence also justifies. PA courts moderate in interpretation. Must deliver to law enforcement promptly.',
        weapons: 'Act 235 certification from PA State Police required for lethal weapons on duty. 40-hour course, written exam, range qualification. LTCF from county sheriff for concealed carry. Open carry legal without permit except Philadelphia (LTCF required). Act 235 valid 5 years with biennial requalification.',
        agency: 'Pennsylvania State Police (Act 235 Program)',
        notes: 'Act 235 only for armed guards. Unarmed guards have no state requirements. Philadelphia has additional local requirements. Major security market with healthcare and industrial sectors.'
    },
    'TX': {
        name: 'Texas',
        licensing: 'Level II (Noncommissioned Security Officer) registration or higher required from Texas DPS Private Security Bureau. Must pass background check with fingerprinting and complete required training. Companies must hold Private Security Company License.',
        trainingHours: '6 hours pre-assignment classroom training (Level II) covering legal authority, emergency procedures, patrol techniques, and report writing. Plus employer-provided on-the-job training. Level III (Commissioned/Armed) requires additional 30-hour firearms course. Continuing education for renewal.',
        minAge: '18 years old (21 for Level III armed)',
        useOfForce: 'Stand Your Ground state (TX Penal Code § 9.31-9.44). No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary to protect against unlawful force. Deadly force to prevent imminent death, serious bodily injury, aggravated kidnapping, murder, sexual assault, or robbery. Castle Doctrine (§ 9.32) provides strong protections in habitation, vehicle, or place of business.',
        citizensArrest: 'Permitted under TX Code of Criminal Procedure Art. 14.01. May arrest for felonies or offenses against the public peace committed in view. Must deliver to peace officer without unnecessary delay. Shopkeeper\'s privilege (TX Civil Practice & Remedies Code § 124.001) for reasonable detention.',
        weapons: 'Level III (Commissioned Security Officer) license required for armed guards. 30-hour firearms training from DPS-approved school, written exam, and range qualification. Must qualify with each firearm. Constitutional carry since September 2021 (HB 1927) for those 21+. LTC still available for reciprocity.',
        agency: 'Texas Department of Public Safety (DPS) — Private Security Bureau',
        notes: 'One of the most structured licensing systems (Level II through IV). Background check required. Licenses renewed every 2 years. DPS actively enforces. One of largest security markets nationally. Constitutional carry since 2021 but Level III still required for armed work.'
    },
    'VA': {
        name: 'Virginia',
        licensing: 'Registration required with Virginia DCJS. All security officers must be registered. Companies must hold a Private Security Services Business License. Background check with fingerprinting required.',
        trainingHours: '18 hours minimum entry-level training (compulsory minimum training standards set by DCJS). Covers legal authority, emergency procedures, use of force, report writing, and ethics. In-service training required for renewal. Armed guards require additional DCJS-approved firearms training (minimum 24 hours) plus range qualification.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (VA Code § 18.2-31, case law). No duty to retreat in public places. Force justified when reasonably necessary to prevent imminent bodily harm. Deadly force when reasonably necessary to prevent imminent death, serious bodily harm, or forcible felony. Castle Doctrine applies in home.',
        citizensArrest: 'Permitted under VA Code § 19.2-81. May arrest for felonies in presence, or when person has committed a felony. Misdemeanors only for breach of peace in presence. Must deliver to law enforcement without unnecessary delay. Virginia courts interpret strictly.',
        weapons: 'Armed security requires DCJS-approved firearms training (minimum 24 hours), written exam, and range qualification. Must qualify with each firearm. Annual requalification. Virginia CHP from circuit court for concealed carry. Open carry legal without permit.',
        agency: 'Virginia Department of Criminal Justice Services (DCJS)',
        notes: 'DCJS is one of the most active state regulatory bodies for private security. Compulsory minimum training enforced. Registration renewed every 2 years. Northern Virginia proximity to D.C. creates high demand for cleared security personnel.'
    },
    'WA': {
        name: 'Washington',
        licensing: 'Security Guard License required from Washington DOL. Must complete training, pass background check with fingerprinting. License valid 2 years. Companies must also be licensed.',
        trainingHours: '8 hours pre-assignment training plus additional training within first 14 days. Covers legal authority, emergency response, observation/reporting, safety, and ethics. Armed guards require additional DOL-approved firearms training.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state (RCW § 9A.16.020, 9A.16.050). Force justified when reasonably necessary to prevent imminent harm. Must retreat before deadly force if safely possible. Castle Doctrine in dwelling (RCW § 9A.16.110) — no duty to retreat from home. Washington courts apply strict "reasonable person" standard.',
        citizensArrest: 'Permitted under RCW § 10.31.100. May arrest for felonies in presence, with probable cause for felony, or gross misdemeanors/misdemeanors in presence. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Armed guard license from DOL requires additional firearms training, written exam, and range qualification. Washington CPL required for concealed carry. Open carry legal without permit. Initiative 1639 (2018) enhanced semi-auto rifle requirements.',
        agency: 'Washington Department of Licensing (DOL) — Security Guard Program',
        notes: 'Well-regulated state. Background check and fingerprinting required. License renewed every 2 years. Governed by RCW 18.170. DOL maintains online verification. Seattle and tech corridor create significant employment.',
        statutes: 'RCW 18.170 - Private Security Guards',
        links: [
            { text: 'WA Dept of Licensing - Security Guards', url: 'https://dol.wa.gov/business-and-organization-licenses/professional-licenses/security-guard-license' },
            { text: 'RCW 18.170', url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=18.170' }
        ]
    },
    'AR': {
        name: 'Arkansas',
        licensing: 'License required through Arkansas State Police (ASP). Companies must obtain Private Security Agency License. Individual guards registered through employing agency. Background check required.',
        trainingHours: 'No specific minimum hours at state level. ASP requires employers provide adequate training before assignment. Armed guards must complete firearms qualification.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (Ark. Code § 5-2-607). No duty to retreat from any place with lawful right to be. Deadly force justified when reasonably necessary to prevent imminent death or serious physical injury. Castle Doctrine applies to dwellings, vehicles, and occupied structures.',
        citizensArrest: 'Permitted under Ark. Code § 16-81-106. May arrest for felonies in presence or with reasonable grounds. Misdemeanors only if breach of peace in presence. Must deliver to law enforcement promptly.',
        weapons: 'Certification through ASP required for armed guards. Approved firearms course with written exam and range qualification. Concealed Handgun Carry License (CHCL) may be needed. Open carry legal without permit.',
        agency: 'Arkansas State Police — Regulatory Services Division',
        notes: 'Background check required. Agency license renewed annually. Individual registration maintained by employer.',
        statutes: 'Arkansas Code § 17-40-101 et seq.',
        links: [
            { text: 'AR State Police Licensing', url: 'https://www.dps.arkansas.gov/law-enforcement/arkansas-state-police/regulatory-services/' },
            { text: 'AR Code Title 17 Chapter 40', url: 'https://advance.lexis.com/container?config=00JAA1ZDgzNzU2ZC02MmMzLTRlZWQtOGJjNC00YzQ1MmZlNzc2YWYKAFBvZENhdGFsb2e9zYpNUjTRaIWVfyrur9ud&crid=c0f8e6e5-3f2e-4e5f-9e5e-5e5e5e5e5e5e' }
        ]
    },
    'CO': {
        name: 'Colorado',
        licensing: 'No state-level license required. No statewide security guard regulatory framework. Some municipalities (Denver, Aurora, Colorado Springs) may have local registration or permitting requirements.',
        trainingHours: 'No mandatory state training hours. Employers responsible for training. Many companies voluntarily follow ASIS International standards.',
        minAge: '18 years old',
        useOfForce: 'Modified Stand Your Ground with strong Castle Doctrine (CRS § 18-1-704 through 710). Reasonable force when reasonably necessary. Deadly force only when lesser force is inadequate and facing imminent death or serious bodily injury. "Make My Day" law (CRS § 18-1-704.5) provides strong protections against intruders in occupied dwellings.',
        citizensArrest: 'Permitted under CRS § 16-3-201. May arrest when any crime is being committed in presence. Must use only reasonable force. Must deliver to peace officer or judge without unnecessary delay.',
        weapons: 'No state-level armed guard license. Concealed carry requires Colorado CHP from county sheriff. Denver has historically had stricter regulations. Employers set armed guard requirements.',
        agency: 'No state-level regulatory agency. Locally regulated by municipal licensing offices.',
        notes: 'Least regulated at state level. Denver, Aurora, and Colorado Springs have own licensing — check local ordinances.',
        statutes: 'No state statute - locally regulated',
        links: [
            { text: 'Colorado Revised Statutes', url: 'https://leg.colorado.gov/colorado-revised-statutes' }
        ]
    },
    'CT': {
        name: 'Connecticut',
        licensing: 'Security Officer License required from DESPP, Division of State Police — Special Licensing and Firearms Unit. Background check, fingerprints, and training required.',
        trainingHours: '8 hours pre-assignment covering legal powers, emergency procedures, general duties, report writing, and ethics. Armed guards require additional firearms training hours.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state (CGS § 53a-19). Force justified when reasonably necessary to prevent imminent physical harm. Deadly force only when reasonably necessary to prevent imminent death or serious bodily harm AND no reasonable opportunity to retreat safely. Castle Doctrine (CGS § 53a-20) — no duty to retreat at home.',
        citizensArrest: 'Permitted under CGS § 53a-22. May use reasonable force to arrest when reasonably believing person committed an offense. Deadly force only if necessary to defend against imminent deadly force during arrest attempt.',
        weapons: 'Separate Armed Security Guard Permit from DESPP required. Approved firearms course, written and practical exams, range qualification. Firearms must be registered in CT. Assault weapons and large-capacity magazines prohibited.',
        agency: 'Connecticut DESPP — Special Licensing and Firearms Unit',
        notes: 'Background check and fingerprinting required. License renewed every 5 years. Strict firearms laws. Companies must be licensed separately.',
        statutes: 'Connecticut General Statutes § 29-161a et seq.',
        links: [
            { text: 'CT DESPP Licensing', url: 'https://portal.ct.gov/DESPP/Division-of-State-Police/Special-Licensing-and-Firearms/Security-Services' },
            { text: 'CT Gen. Stat. § 29-161a', url: 'https://www.cga.ct.gov/current/pub/chap_534.htm' }
        ]
    },
    'DE': {
        name: 'Delaware',
        licensing: 'Registration required with Delaware Board of Examiners of Private Investigators and Private Security Agencies (Title 24, Chapter 13). Guards registered through employing agency. Background check required.',
        trainingHours: 'Employers must provide adequate training before assignment. No specific minimum hours mandated. Many employers provide 8-16 hours pre-assignment. Armed guards must complete firearms qualification.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state with Castle Doctrine (11 Del. C. § 464-465). Force justified when reasonably necessary against unlawful force. Deadly force only to prevent imminent death, serious physical injury, kidnapping, or compelled sexual intercourse. No duty to retreat in dwelling.',
        citizensArrest: 'Permitted under 11 Del. C. § 1935. May arrest for felonies in presence or with reasonable ground. Misdemeanors only for breaches of peace in presence. Must deliver to law enforcement promptly.',
        weapons: 'Armed guards must meet firearms qualification standards. Concealed Deadly Weapons License (CDWL) from Court of Common Pleas for concealed carry. Open carry legal without permit.',
        agency: 'Delaware Board of Examiners of Private Investigators and Private Security Agencies (Division of Professional Regulation)',
        notes: 'Background check required. Agency license renewed every 2 years. Proximity to Philadelphia, Baltimore, and D.C. means many guards work across state lines.',
        statutes: 'No specific state statute for unarmed guards',
        links: [
            { text: 'Delaware State Police', url: 'https://dsp.delaware.gov/' }
        ]
    },
    'HI': {
        name: 'Hawaii',
        licensing: 'Guard registration required with Hawaii Board of Private Detectives and Guards (under DCCA). Agencies must hold valid license. Guards registered through employer. Background check required.',
        trainingHours: 'No specific minimum hours mandated. Board requires employing agencies ensure adequate training. Many employers provide 8-16 hours covering state laws, emergency procedures, and site-specific protocols.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state (HRS § 703-304). Force for self-defense only when reasonably necessary AND cannot retreat safely. Deadly force only to prevent death or serious bodily injury when retreat is not safely possible. Limited Castle Doctrine in dwelling (HRS § 703-304(5)).',
        citizensArrest: 'Permitted under HRS § 803-3. May arrest for felonies in presence or with reasonable ground. Misdemeanors only for breach of peace in presence. Must deliver to peace officer immediately.',
        weapons: 'Strictest firearms regulations in the nation. All firearms must be registered. Concealed carry permits extremely difficult to obtain. Armed security heavily restricted. Guards carrying weapons must have specific employer authorization.',
        agency: 'Hawaii Board of Private Detectives and Guards (under DCCA)',
        notes: 'Background check required. Registration must be renewed. Strict firearms laws make armed security significantly more regulated than most states.',
        statutes: 'Hawaii Revised Statutes Chapter 463',
        links: [
            { text: 'HI DCCA - Private Detectives', url: 'https://cca.hawaii.gov/pvl/boards/private-detectives/' },
            { text: 'HRS Chapter 463', url: 'https://www.capitol.hawaii.gov/hrscurrent/Vol10_Ch0436-0474/HRS0463/' }
        ]
    },
    'ID': {
        name: 'Idaho',
        licensing: 'No state license or registration required for unarmed guards. No statewide regulatory framework. Some municipalities may have local business licensing.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible for training. Industry best practices suggest 8-16 hours pre-assignment.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (Idaho Code § 18-4009, § 19-202). Force justified when reasonably necessary to prevent imminent harm. Deadly force to prevent death, great bodily injury, or forcible felony. No duty to retreat. Strong Castle Doctrine (§ 18-4009(3)) in habitation.',
        citizensArrest: 'Permitted under Idaho Code § 19-604. May arrest for public offense in presence, when person has committed felony, or with reasonable cause for felony. Must deliver to magistrate or peace officer.',
        weapons: 'Constitutional carry state — no permit required for concealed or open carry for residents 18+. No state-level armed guard certification. Employers set own armed guard standards.',
        agency: 'No state-level regulatory agency.',
        notes: 'One of the least regulated states. No licensing, training, or oversight for unarmed guards. Employers bear full responsibility.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Idaho State Legislature', url: 'https://legislature.idaho.gov/statutesrules/' }
        ]
    },
    'IN': {
        name: 'Indiana',
        licensing: 'No state license required for unarmed guards. No statewide individual guard licensing program. Some municipalities may have local permitting.',
        trainingHours: 'No mandatory state training hours. Employers responsible for training. Many companies provide 8-16 hours pre-assignment.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (IC § 35-41-3-2). No duty to retreat from any place with right to be. Reasonable force to protect self or others. Deadly force when reasonably necessary to prevent serious bodily injury, death, or forcible felony. Indiana uniquely allows force against unlawful law enforcement entry (IC § 35-41-3-2(i)).',
        citizensArrest: 'Permitted under IC § 35-33-1-4. May arrest for felonies with reasonable grounds, or misdemeanor breach of peace in presence. Must deliver to law enforcement without unnecessary delay.',
        weapons: 'Constitutional carry state since July 2022 (HEA 1296) — no permit required for handguns for those 18+. Armed guards must comply with employer policies and federal law.',
        agency: 'No state-level regulatory agency for security guards.',
        notes: 'Minimal state regulation. Constitutional carry since 2022. Proximity to Chicago means cross-state workers must understand Illinois\' stricter regulations.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Indiana General Assembly', url: 'http://iga.in.gov/legislative/laws/2023/ic/titles/025' }
        ]
    },
    'IA': {
        name: 'Iowa',
        licensing: 'No state license required for unarmed guards. Private security companies may need local business licenses.',
        trainingHours: 'No mandatory state training hours. Employers set own standards. Iowa Law Enforcement Academy offers voluntary resources.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state since July 2017 (Iowa Code § 704.1-704.13). No duty to retreat from any place with lawful right to be when not the initial aggressor. Force justified when reasonably necessary. Deadly force when reasonably necessary to prevent imminent death or serious injury.',
        citizensArrest: 'Permitted under Iowa Code § 804.9. May arrest for public offense in presence, or felony with reasonable ground. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Constitutional carry state since July 2021 (HF 756) — no permit for those 21+. Optional Permits to Carry Weapons still issued for reciprocity. Employers typically require armed guard firearms training.',
        agency: 'Iowa Department of Public Safety (limited oversight). No dedicated security guard body.',
        notes: 'Minimal state regulation. Constitutional carry since 2021. Employers bear primary responsibility for training.',
        statutes: 'Iowa Code Chapter 80A (armed guards only)',
        links: [
            { text: 'Iowa DPS', url: 'https://dps.iowa.gov/' },
            { text: 'Iowa Code Chapter 80A', url: 'https://www.legis.iowa.gov/docs/code/80A.pdf' }
        ]
    },
    'KS': {
        name: 'Kansas',
        licensing: 'No state license required. Kansas does not regulate private security at state level. Local jurisdictions may have business licensing.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (KSA § 21-5222 through 21-5231). Force justified when and to the extent it appears necessary to defend self or others. No duty to retreat. Deadly force when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony.',
        citizensArrest: 'Permitted under KSA § 22-2403. May arrest for felonies with reasonable grounds, or any misdemeanor in view. Must deliver to law enforcement without unnecessary delay.',
        weapons: 'Constitutional carry state since 2015 — no permit for concealed or open carry for those 21+ (18+ military). Employers set armed guard standards.',
        agency: 'No state-level regulatory agency.',
        notes: 'One of least regulated states. One of first to adopt constitutional carry (2015). Employers and insurers drive training standards.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Kansas Legislature', url: 'http://www.kslegislature.org/li/b2023_24/statute/' }
        ]
    },
    'KY': {
        name: 'Kentucky',
        licensing: 'No state license required for unarmed guards. No statewide licensing program. Security companies may need local business licenses.',
        trainingHours: 'No mandatory state training hours. Employers set standards.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground and Castle Doctrine state (KRS § 503.050-503.080). No duty to retreat from any place with lawful right to be. Deadly force to prevent death, serious physical injury, kidnapping, or sexual assault. Presumption of reasonable fear against unlawful forcible entry into dwelling, vehicle, or place of business (KRS § 503.055).',
        citizensArrest: 'Permitted under KRS § 431.005. May arrest for felonies committed in fact with reasonable grounds, or misdemeanors in presence. Must deliver to law enforcement without unnecessary delay.',
        weapons: 'Constitutional carry state since June 2019 (SB 150) — no permit for concealed carry for those 21+. CCDWL still issued for reciprocity. Employers typically mandate firearms training for armed guards.',
        agency: 'No state-level regulatory agency for security guards.',
        notes: 'Minimal state regulation. Constitutional carry since 2019. Employers and insurance carriers drive training standards.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Kentucky Legislature', url: 'https://legislature.ky.gov/Law/statutes/Pages/default.aspx' }
        ]
    },
    'LA': {
        name: 'Louisiana',
        licensing: 'Security Officer Commission required from LSBPSE. All officers must be commissioned. Companies must hold Private Security Company License. Background check with fingerprinting required.',
        trainingHours: '8 hours minimum pre-assignment covering legal authority, emergency procedures, observation/reporting, general duties, and use of force. Armed guards require additional firearms classroom and range qualification.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (LA R.S. 14:19-14:22). No duty to retreat in any place with right to be. Force including deadly force justified when reasonably necessary to prevent death, great bodily harm, or imminent forcible felony. Castle Doctrine (R.S. 14:20) adds protections in dwelling, place of business, and occupied vehicle.',
        citizensArrest: 'Permitted under LA Code of Criminal Procedure Art. 214. May arrest for felonies whether or not in presence. Misdemeanors only for breach of peace in presence. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Firearms Endorsement on Security Officer Commission required. LSBPSE-approved firearms training (minimum 8 hours classroom + range). Must qualify with each specific firearm. Annual requalification. Constitutional carry state as of July 2024 (SB 1) for those 18+.',
        agency: 'Louisiana State Board of Private Security Examiners (LSBPSE)',
        notes: 'Background check and fingerprinting required. Commission renewed annually. LSBPSE actively enforces requirements. One of more regulated states in Southeast.',
        statutes: 'Louisiana Revised Statutes Title 37, Chapter 25',
        links: [
            { text: 'LA Board of Private Security', url: 'https://www.lsbpse.com/' },
            { text: 'LA RS 37:3050 et seq.', url: 'https://legis.la.gov/Legis/Law.aspx?d=98716' }
        ]
    },
    'ME': {
        name: 'Maine',
        licensing: 'No state license required for unarmed guards. No statewide regulatory program.',
        trainingHours: 'No mandatory state training hours. Employers responsible for training. Many provide 8-16 hours voluntarily.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state with Castle Doctrine (17-A M.R.S. § 108). Nondeadly force when reasonably necessary. Deadly force only to prevent imminent death or serious bodily harm after exhausting reasonable means of retreat. No duty to retreat in dwelling (Castle Doctrine expanded in 2007).',
        citizensArrest: 'Permitted under 17-A M.R.S. § 16. May use nondeadly force to arrest when reasonably believing person committed crime. Deadly force only if necessary to defend during arrest.',
        weapons: 'Constitutional carry state since October 2015 (LD 652). No permit for concealed carry for those 21+ (18+ military). Employers set armed guard standards.',
        agency: 'No state-level regulatory agency.',
        notes: 'Minimal state regulation. Constitutional carry since 2015. Rural character and seasonal tourism create unique needs.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Maine Legislature', url: 'https://legislature.maine.gov/statutes/' }
        ]
    },
    'MD': {
        name: 'Maryland',
        licensing: 'Security Guard Registration required with Maryland State Police (MSP) Licensing Division. Background check with fingerprinting, training, and fee required. Agencies separately licensed.',
        trainingHours: '16 hours minimum for unarmed guards plus 8-hour annual refresher. Covers legal authority, emergency procedures, patrol, report writing, first aid, use of force. Armed guards require additional 22 hours (38 total). MSP-approved instructors only.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state (MD Criminal Law § 4-101, case law). Must retreat if safely possible before deadly force (except in home — Castle Doctrine). Deadly force only to prevent imminent death or serious bodily harm. Courts apply strict "reasonable person" standard.',
        citizensArrest: 'Permitted under Maryland common law. May arrest for felonies in presence or with probable cause. Misdemeanors only for breaches of peace in presence. Courts strict — wrongful arrest leads to civil and criminal liability.',
        weapons: 'MSP-approved 22-hour firearms course, written and practical exams, range qualification. Assault weapons ban and 10-round magazine limit. Wear-and-carry permits shall-issue since 2022 Bruen decision.',
        agency: 'Maryland State Police (MSP) — Licensing Division',
        notes: 'Registration valid 2 years. One of more regulated states. 2022 Bruen decision changed concealed carry from may-issue to shall-issue. Proximity to D.C. means many guards need federal clearances.',
        statutes: 'Maryland Business Occupations and Professions Code § 19-101 et seq.',
        links: [
            { text: 'MD State Police Licensing', url: 'https://mdsp.maryland.gov/Organization/Pages/CriminalInvestigationBureau/LicensingDivision.aspx' },
            { text: 'MD Code § 19-101', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gbo&section=19-101' }
        ]
    },
    'MA': {
        name: 'Massachusetts',
        licensing: 'No state license specifically for unarmed guards. Regulated at local level — some municipalities require Watchman/Guard license from local police. Companies must register as businesses.',
        trainingHours: 'No mandatory state training hours. Local jurisdictions may impose requirements. Many employers provide 8-24 hours.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state (Commonwealth v. Shaffer). Reasonable force only when reasonably necessary and proportionate. Strict duty to retreat before deadly force if safe. Castle Doctrine in dwelling — no duty to retreat from home (Commonwealth v. Catalina).',
        citizensArrest: 'Permitted under M.G.L. c. 276, § 28. May arrest for felonies in presence or with reasonable cause. Courts strict about "in presence" requirement.',
        weapons: 'Among strictest firearms laws nationally. License to Carry (LTC) from local Police Chief for handguns. Armed guards need valid LTC and employer certification. Assault weapons ban. 2024 gun reform law (HD 4420) added restrictions.',
        agency: 'Local police departments. Massachusetts Division of Professional Licensure has limited oversight.',
        notes: 'Primarily locally regulated. Boston and other cities have own requirements. "May-issue" firearms licenses. Strong labor laws and union presence affect industry.',
        statutes: 'No state statute - locally regulated',
        links: [
            { text: 'MA General Laws', url: 'https://malegislature.gov/Laws/GeneralLaws' }
        ]
    },
    'MN': {
        name: 'Minnesota',
        licensing: 'Individual guards not licensed by state. Employing companies must be licensed by Minnesota Board of Private Detective and Protective Agent Services. Guards registered through employer.',
        trainingHours: 'No mandatory state hours for individual guards. Board requires employers ensure proper training. Most companies provide 8-24 hours pre-assignment.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state (Minn. Stat. § 609.06-609.065). Reasonable force when reasonably necessary. Duty to retreat before deadly force if safely possible. Castle Doctrine (§ 609.065) — no duty to retreat in dwelling; force including deadly force against intruder if reasonably necessary.',
        citizensArrest: 'Permitted under Minn. Stat. § 629.37. May arrest for public offense in presence, felony even if not in presence, or with reasonable cause. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Minnesota Permit to Carry from county sheriff required. Live firearms training and background check. Permits valid 5 years. Employers require additional qualification.',
        agency: 'Minnesota Board of Private Detective and Protective Agent Services',
        notes: 'Company licensing through Board required. Mall of America and major venues drive significant security employment.',
        statutes: 'Minnesota Statutes Chapter 326',
        links: [
            { text: 'MN Board of Private Detective', url: 'https://mn.gov/boards/private-detective/' },
            { text: 'MN Stat. Chapter 326', url: 'https://www.revisor.mn.gov/statutes/cite/326' }
        ]
    },
    'MS': {
        name: 'Mississippi',
        licensing: 'No state license required for unarmed guards. No comprehensive statewide framework.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground with strong Castle Doctrine (Miss. Code § 97-3-15). No duty to retreat anywhere with right to be. Presumption of reasonable fear against unlawful forcible entry into dwelling, occupied vehicle, or place of business.',
        citizensArrest: 'Permitted under Miss. Code § 99-3-7. May arrest for felonies in presence or with reasonable grounds. Misdemeanors only for breach of peace in presence.',
        weapons: 'Constitutional carry state since April 2016 (HB 786) — no permit for open or concealed carry for those 18+. Enhanced Carry Permits for additional reciprocity.',
        agency: 'No state-level regulatory agency.',
        notes: 'Least regulated states for security. Constitutional carry since 2016. Gulf Coast casinos employ significant security under Gaming Commission.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Mississippi Legislature', url: 'https://law.justia.com/codes/mississippi/' }
        ]
    },
    'MO': {
        name: 'Missouri',
        licensing: 'No state license for unarmed guards. Some municipalities (St. Louis, Kansas City) have their own guard licensing requirements.',
        trainingHours: 'No mandatory state training hours. Employers set standards. St. Louis and Kansas City may require specific training.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (RSMo § 563.031). No duty to retreat. Force justified when reasonably necessary. Deadly force to protect against death, serious physical injury, or forcible felony. Castle Doctrine (§ 563.031.2) provides presumption of reasonableness against intruders.',
        citizensArrest: 'Permitted under RSMo § 544.180. May arrest for any criminal offense in presence, or felony with reasonable cause. Must deliver to law enforcement without unnecessary delay.',
        weapons: 'Constitutional carry state since January 2017 (SB 656) — no permit for concealed carry for those 19+ (18+ military). St. Louis and Kansas City have historically had stricter local ordinances.',
        agency: 'No state-level regulatory agency. Local regulation in some cities.',
        notes: 'Minimal state regulation. Some local regulation in major cities. Constitutional carry since 2017.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Missouri Revised Statutes', url: 'https://revisor.mo.gov/main/Home.aspx' }
        ]
    },
    'MT': {
        name: 'Montana',
        licensing: 'Companies must be licensed by Montana Board of Private Security Patrol Officers and Investigators. Individual guards registered through employing company. Background check required.',
        trainingHours: 'No specific minimum hours for unarmed guards. Board requires employers ensure competency. Many employers provide 8-16 hours.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (MCA § 45-3-102 through 115). No duty to retreat. Deadly force when reasonably necessary to prevent death, serious bodily injury, kidnapping, or sexual assault. Castle Doctrine (MCA § 45-3-103) in occupied structures.',
        citizensArrest: 'Permitted under MCA § 46-6-502. May arrest for felonies or misdemeanors in presence, or felonies with probable cause. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Constitutional carry state since February 2021 (HB 102). No permit for concealed carry for those 18+. Employers set armed guard standards.',
        agency: 'Montana Board of Private Security Patrol Officers and Investigators (under Department of Labor and Industry)',
        notes: 'Company licensing required. Constitutional carry since 2021. Mining, oil, and ranching drive private security employment.',
        statutes: 'Montana Code Annotated Title 37, Chapter 60',
        links: [
            { text: 'MT Board of Private Security', url: 'https://boards.bsd.dli.mt.gov/pri' },
            { text: 'MCA 37-60', url: 'https://leg.mt.gov/bills/mca/title_0370/chapter_0600/parts_index.html' }
        ]
    },
    'NE': {
        name: 'Nebraska',
        licensing: 'No state license required for unarmed guards. No comprehensive statewide regulatory framework.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state as of April 2024 (LB 77). Previously duty-to-retreat. Now no duty to retreat from any place with lawful right to be. Deadly force to prevent death, serious bodily harm, kidnapping, or sexual assault. Castle Doctrine in dwellings.',
        citizensArrest: 'Permitted under Neb. Rev. Stat. § 29-402. May arrest for criminal offense in presence, or felony with reasonable cause. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Constitutional carry state as of April 2024 (LB 77) — no permit for concealed carry for those 21+. Concealed Handgun Permits still issued for reciprocity.',
        agency: 'No state-level regulatory agency.',
        notes: 'Major 2024 change: shifted from duty-to-retreat to stand-your-ground AND adopted constitutional carry. Guards must understand this significant legal shift.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'Nebraska Legislature', url: 'https://nebraskalegislature.gov/laws/browse-statutes.php' }
        ]
    },
    'NV': {
        name: 'Nevada',
        licensing: 'Work Card required from Nevada PILB. Background check with fingerprinting and pre-assignment training required. Companies must hold Private Patrol License.',
        trainingHours: '8 hours pre-assignment required by PILB covering legal authority, emergency procedures, report writing, observation, and ethics. Armed guards require additional 16 hours minimum. Gaming/hospitality employers often exceed minimums.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (NRS § 200.120, 200.275). Right to stand ground and defend with reasonable force when not original aggressor. Deadly force to prevent death or substantial bodily harm. Castle Doctrine (NRS § 200.120(2)) in occupied habitations.',
        citizensArrest: 'Permitted under NRS § 171.126. May arrest for public offense in presence, felony even if not in presence, or felony with reasonable cause.',
        weapons: 'Firearms Endorsement on PILB Work Card required. 16-hour course, written and practical exams, range qualification. Requalify every 6 months. Each firearm registered and qualified separately.',
        agency: 'Nevada Private Investigators Licensing Board (PILB)',
        notes: 'One of most active security markets due to gaming/hospitality. Las Vegas Strip exceeds PILB minimums. Work Card renewed every 5 years. Gaming establishments may need Gaming Control Board clearance.',
        statutes: 'Nevada Revised Statutes Chapter 648',
        links: [
            { text: 'NV PILB', url: 'http://www.pilb.nv.gov/' },
            { text: 'NRS Chapter 648', url: 'https://www.leg.state.nv.us/nrs/NRS-648.html' }
        ]
    },
    'NH': {
        name: 'New Hampshire',
        licensing: 'No state license required. New Hampshire does not regulate private security at state level.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (RSA § 627:4). No duty to retreat from any place with lawful right to be. Deadly force when reasonably necessary to prevent death or serious bodily harm. Stand Your Ground expansion enacted in 2011 (SB 88). Castle Doctrine in dwellings.',
        citizensArrest: 'Permitted under RSA § 627:5. May use nondeadly force when reasonably believing person committed felony or misdemeanor. Deadly force only to defend during arrest.',
        weapons: 'Constitutional carry state since February 2017 (SB 12). No permit for concealed carry for those 18+.',
        agency: 'No state-level regulatory agency.',
        notes: 'Minimal regulation — "Live Free or Die" philosophy. Constitutional carry since 2017. Proximity to Boston means cross-state workers must understand Massachusetts\' stricter laws.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'NH General Court', url: 'http://www.gencourt.state.nh.us/rsa/html/indexes/default.html' }
        ]
    },
    'NJ': {
        name: 'New Jersey',
        licensing: 'SORA Card required from NJ State Police Firearms Investigation Unit. Background check with fingerprinting, training, and fee required. Registration valid 2 years.',
        trainingHours: 'No specific minimum hours mandated by SORA, but employers required to provide adequate training. Most provide 8-16 hours. Armed guards must complete extensive firearms training.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Duty to Retreat state (N.J.S.A. 2C:3-4). Must retreat before deadly force if safely possible. Deadly force only to protect against death or serious bodily harm. Castle Doctrine in dwelling (N.J.S.A. 2C:3-4(b)(2)).',
        citizensArrest: 'Permitted under N.J.S.A. 2A:169-3. May arrest for indictable offenses (felonies) in presence, or disorderly persons offenses for breach of peace. NJ courts strictly scrutinize.',
        weapons: 'Among strictest firearms laws nationally. Carry permits now shall-issue post-Bruen 2022 but stringent. Assault weapons ban. 10-round magazine limit. Hollow-point restrictions. Armed security heavily regulated.',
        agency: 'New Jersey State Police — Firearms Investigation Unit (SORA)',
        notes: 'SORA Card renewed every 2 years. Very strict firearms laws even post-Bruen. Proximity to NYC and Philadelphia creates cross-state compliance issues.',
        statutes: 'N.J.S.A. 45:19A-1 et seq.',
        links: [
            { text: 'NJ State Police SORA', url: 'https://www.njsp.org/private-detective/sora.shtml' },
            { text: 'NJSA 45:19A-1', url: 'https://lis.njleg.state.nj.us/nxt/gateway.dll?f=templates&fn=default.htm&vid=Publish:10.1048/Enu' }
        ]
    },
    'NM': {
        name: 'New Mexico',
        licensing: 'No state license required for unarmed guards. Companies may need business registration through NM RLD.',
        trainingHours: 'No mandatory state training hours. Employers set own standards.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (NMSA § 30-2-7). No duty to retreat in any place with lawful right to be. Deadly force when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony.',
        citizensArrest: 'Permitted under NMSA § 31-4-14. May arrest for felonies in presence or with reasonable belief. Must deliver to peace officer without unnecessary delay.',
        weapons: 'No permit for open carry. Concealed Handgun License from DPS for concealed carry. Armed guards comply with employer requirements.',
        agency: 'New Mexico Regulation and Licensing Department (limited oversight)',
        notes: 'Minimal state regulation. Proximity to Mexican border creates unique security considerations for transportation and logistics.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'NM RLD', url: 'https://www.rld.nm.gov/' }
        ]
    },
    'ND': {
        name: 'North Dakota',
        licensing: 'Employers must be licensed by ND Private Investigation and Security Board. Guards registered through employer. Background check required.',
        trainingHours: 'No specific minimum hours for individual guards. Board requires employers ensure competency. Many provide 8-16 hours.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (NDCC § 12.1-05-03 through 07). No duty to retreat. Deadly force to prevent death, serious bodily injury, or forcible felony. Castle Doctrine in dwelling and place of work.',
        citizensArrest: 'Permitted under NDCC § 29-06-20. May arrest for public offense in presence, or felony not in presence. Must deliver to peace officer without unnecessary delay.',
        weapons: 'Constitutional carry state since August 2017 (HB 1169) for residents with valid ID. Concealed Weapons License still issued for reciprocity.',
        agency: 'North Dakota Private Investigation and Security Board',
        notes: 'Company licensing through Board required. Constitutional carry since 2017. Oil industry (Bakken formation) drives significant security employment.',
        statutes: 'North Dakota Century Code Chapter 43-30',
        links: [
            { text: 'ND PISB', url: 'https://www.piscboard.nd.gov/' },
            { text: 'NDCC 43-30', url: 'https://www.legis.nd.gov/cencode/t43c30.pdf' }
        ]
    },
    'OK': {
        name: 'Oklahoma',
        licensing: 'Security Guard License required from CLEET. Background check with fingerprinting and CLEET training required. Companies must be licensed.',
        trainingHours: 'CLEET-mandated phase training: Phase I (pre-assignment) covers legal authority, ethics, observation/reporting, and emergency response. Armed guards require additional CLEET firearms training.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (21 OK Stat. § 1289.25). No duty to retreat. Castle Doctrine provides presumption of reasonable fear against intruders in dwellings, vehicles, and places of business.',
        citizensArrest: 'Permitted under 22 OK Stat. § 202. May arrest for public offense in presence, or when person has committed felony.',
        weapons: 'Constitutional carry since November 2019 (SB 12) — no permit for those 21+ (18+ military). Armed guards must still have CLEET firearms certification: approved training, written exam, range qualification, annual requalification.',
        agency: 'Oklahoma Council on Law Enforcement Education and Training (CLEET)',
        notes: 'CLEET actively regulates security industry. Constitutional carry since 2019 but CLEET still requires armed guard certification. Oil and gas drives significant employment.',
        statutes: 'Oklahoma Statutes Title 59, Section 1750.1 et seq.',
        links: [
            { text: 'OK CLEET', url: 'https://www.ok.gov/cleet/' },
            { text: 'OK Stat. Title 59 § 1750.1', url: 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=69655' }
        ]
    },
    'OR': {
        name: 'Oregon',
        licensing: 'No state license for unarmed guards as individuals. Companies must be certified by DPSST. Executive security officers require DPSST certification.',
        trainingHours: 'No mandatory state hours for unarmed guards. DPSST requires companies to train adequately. Executive security officers must complete DPSST-approved program.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state (ORS § 161.209-219). Deadly force only to prevent imminent death, serious physical injury, or forcible felony AND person cannot safely retreat. Castle Doctrine (ORS § 161.219) — no duty to retreat from home.',
        citizensArrest: 'Permitted under ORS § 133.225. May arrest for any crime in presence, or felony. Merchant detention authority (ORS § 131.655) for shoplifting.',
        weapons: 'No permit for open carry. CHL from county sheriff for concealed carry. Measure 114 (2022) permit-to-purchase enjoined by courts. Armed guards comply with DPSST requirements.',
        agency: 'Oregon Department of Public Safety Standards and Training (DPSST)',
        notes: 'Company certification through DPSST required. Portland has significant security market.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'OR DPSST', url: 'https://www.oregon.gov/dpsst/' }
        ]
    },
    'RI': {
        name: 'Rhode Island',
        licensing: 'No state license required for unarmed guards. No comprehensive statewide regulation.',
        trainingHours: 'No mandatory state training hours. Employers set own standards.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state (case law — State v. Quarles). Must retreat before deadly force if safely possible. Castle Doctrine in dwelling — no duty to retreat from home.',
        citizensArrest: 'Permitted under RI common law. May arrest for felonies in presence or with reasonable belief. Breach of peace in presence.',
        weapons: 'Concealed carry permit required from local police chief or Attorney General. Relatively strict firearms regulations.',
        agency: 'No state-level regulatory agency.',
        notes: 'Minimal state regulation. Small state with security needs around Providence. Cross-state work with MA and CT common.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'RI General Laws', url: 'http://webserver.rilegislature.gov/Statutes/' }
        ]
    },
    'SC': {
        name: 'South Carolina',
        licensing: 'Registration required with SLED. Companies must hold Security Company License. Guards registered through employer. Background check required.',
        trainingHours: '4 hours minimum pre-assignment covering legal authority, emergency procedures, and general duties. Armed guards require additional firearms training through SLED-approved program.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (SC Code § 16-11-440). No duty to retreat anywhere with right to be. Castle Doctrine (§ 16-11-440(C)) presumption of reasonable fear against intruders in dwellings, residences, and occupied vehicles.',
        citizensArrest: 'Permitted under SC Code § 17-13-10 and § 17-13-20. May arrest for felonies or larceny in view or on immediate knowledge. Merchant detention (§ 16-13-140) for shoplifting.',
        weapons: 'Armed guard certification through SLED-approved program required. SC adopted partial permitless carry in 2024 (open carry without permit for 18+). Armed guards must still meet SLED requirements.',
        agency: 'South Carolina Law Enforcement Division (SLED) — Regulatory Services',
        notes: 'Background check required. Renewed every 2 years. SLED actively regulates. Military installations create additional security employment.',
        statutes: 'South Carolina Code § 40-18-10 et seq.',
        links: [
            { text: 'SC SLED Licensing', url: 'https://www.sled.sc.gov/regulatory/' },
            { text: 'SC Code § 40-18', url: 'https://www.scstatehouse.gov/code/t40c018.php' }
        ]
    },
    'SD': {
        name: 'South Dakota',
        licensing: 'No state license required. No statewide regulatory framework.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (SDCL § 22-18-4). No duty to retreat. Castle Doctrine in occupied structures and vehicles.',
        citizensArrest: 'Permitted under SDCL § 22-18A-26 and common law. May arrest for felonies in presence or with reasonable cause.',
        weapons: 'Constitutional carry state since July 2019 (SB 47) — no permit for those 18+. Enhanced Permit for reciprocity.',
        agency: 'No state-level regulatory agency.',
        notes: 'Minimal regulation. Constitutional carry since 2019. Tourism (Mount Rushmore, Sturgis Rally) creates seasonal demand.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'SD Legislature', url: 'https://sdlegislature.gov/Statutes/Codified_Laws' }
        ]
    },
    'TN': {
        name: 'Tennessee',
        licensing: 'Security Guard/Officer License required from Tennessee Department of Commerce and Insurance. Companies must be licensed. Individual guards registered. Background check required.',
        trainingHours: '8 hours minimum pre-assignment covering legal authority, emergency procedures, general duties, and report writing. Armed guards require additional firearms training. Continuing education for renewal.',
        minAge: '18 years old (21 for armed)',
        useOfForce: 'Stand Your Ground state (TCA § 39-11-611). No duty to retreat from any place with lawful right to be. Deadly force presumed reasonable against intruders making unlawful and forcible entry into dwelling, residence, business, or occupied vehicle.',
        citizensArrest: 'Permitted under TCA § 40-7-109. May arrest for public offense in presence, or when person has committed felony. Shopkeeper\'s privilege for retail theft.',
        weapons: 'Constitutional carry since July 2021 (HB 786) for those 21+ (18+ military). Enhanced Handgun Carry Permit still available. Armed guards must have employer-required certification and meet Department of Commerce standards.',
        agency: 'Tennessee Department of Commerce and Insurance — Private Protective Services',
        notes: 'Background check required. License renewed annually. Tennessee actively regulates private security. Constitutional carry since 2021 but armed guard certification still required. Nashville and Memphis are major markets.',
        statutes: 'Tennessee Code Annotated § 62-35-101 et seq.',
        links: [
            { text: 'TN Dept of Commerce - Security', url: 'https://www.tn.gov/commerce/regboards/private-protective-services.html' },
            { text: 'TCA § 62-35-101', url: 'https://advance.lexis.com/documentpage/?pdmfid=1000516&crid=8e8e8e8e-8e8e-8e8e-8e8e-8e8e8e8e8e8e' }
        ]
    },
    'UT': {
        name: 'Utah',
        licensing: 'No state license required for unarmed guards. Utah BCI oversees some armed security matters.',
        trainingHours: 'No mandatory state training hours for unarmed guards. Employers set own standards.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (Utah Code § 76-2-402). No duty to retreat. Deadly force when reasonably necessary to prevent death, serious bodily injury, or forcible felony. Castle Doctrine (§ 76-2-405) in habitation — deadly force presumed reasonable against unlawful and forcible entry.',
        citizensArrest: 'Permitted under Utah Code § 77-7-3. May arrest for public offense in presence, or felony not in presence.',
        weapons: 'Constitutional carry state since May 2021 (HB 60) — no permit for those 21+. CFP still issued for reciprocity. Armed guards comply with employer and BCI standards.',
        agency: 'Utah Bureau of Criminal Identification (BCI) — limited oversight',
        notes: 'Minimal regulation. Constitutional carry since 2021. Growing tech sector (Silicon Slopes) creates diverse security needs.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'Utah BCI', url: 'https://bci.utah.gov/' }
        ]
    },
    'VT': {
        name: 'Vermont',
        licensing: 'No state license required. Vermont does not regulate private security at state level.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Duty to Retreat state (case law — State v. Hatcher). Must retreat before deadly force if safely possible. Castle Doctrine in dwelling. Vermont courts apply traditional common-law standards.',
        citizensArrest: 'Permitted under Vermont common law and 13 V.S.A. § 7559. May arrest for felonies in presence or with reasonable belief.',
        weapons: 'The original constitutional carry state — never required a permit for concealed carry ("Vermont carry"). No permit needed for those legally allowed to possess firearms.',
        agency: 'No state-level regulatory agency.',
        notes: 'The original constitutional carry state. No guard licensing, registration, or mandated training. Small rural state.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'VT Legislature', url: 'https://legislature.vermont.gov/statutes/' }
        ]
    },
    'WV': {
        name: 'West Virginia',
        licensing: 'No state license required. No comprehensive statewide regulatory framework.',
        trainingHours: 'No mandatory state training hours. Employers set own standards.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (WV Code § 55-7-22). No duty to retreat. Castle Doctrine (§ 55-7-22(b)) in home or vehicle — presumption of reasonable fear against intruders.',
        citizensArrest: 'Permitted under WV common law. May arrest for felonies in presence or with reasonable grounds. Breach of peace in presence.',
        weapons: 'Constitutional carry state since May 2016 (SB 347) — no permit for those 21+ (18+ military). CHL still issued for reciprocity.',
        agency: 'No state-level regulatory agency.',
        notes: 'Minimal regulation. Constitutional carry since 2016. Coal, natural gas, and chemical industries drive some security employment.',
        statutes: 'No state statute - unregulated',
        links: [
            { text: 'WV Legislature', url: 'http://www.wvlegislature.gov/wvcode/code.cfm' }
        ]
    },
    'WI': {
        name: 'Wisconsin',
        licensing: 'No state license for unarmed guards. Private detective agencies must be licensed (Wis. Stat. § 440.26) but does not cover all security companies.',
        trainingHours: 'No mandatory state training hours for unarmed guards. Employers set own standards.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground in practice (Wis. Stat. § 939.48). No statutory duty to retreat, though courts may consider failure to retreat. Castle Doctrine (§ 939.48(1m)) provides presumption of reasonable force against intruders in dwelling, vehicle, or place of business.',
        citizensArrest: 'Permitted under Wis. Stat. § 968.07. May arrest for felonies in presence. Misdemeanors only for breach of peace in presence.',
        weapons: 'Wisconsin requires CCW license from DOJ for concealed carry. Open carry legal without permit. Wisconsin does NOT have constitutional carry — one of few states still requiring permit. CCW requires firearms training.',
        agency: 'No state-level regulatory agency specifically for security guards.',
        notes: 'Minimal regulation. No constitutional carry. Milwaukee and other urban areas have significant security markets. Strong union presence.',
        statutes: 'No state statute for unarmed guards',
        links: [
            { text: 'WI Legislature', url: 'https://docs.legis.wisconsin.gov/statutes/statutes' }
        ]
    },
    'WY': {
        name: 'Wyoming',
        licensing: 'No state license required. Wyoming does not regulate private security at state level.',
        trainingHours: 'No mandatory state training hours. Employers solely responsible.',
        minAge: '18 years old',
        useOfForce: 'Stand Your Ground state (WS § 6-2-602). No duty to retreat. Castle Doctrine (§ 6-2-602(b)) in habitation, occupied vehicle, or place of business — presumption of reasonable fear against unlawful intruders.',
        citizensArrest: 'Permitted under WS § 7-2-102. May arrest for felonies or misdemeanors in presence, or felony with reasonable cause.',
        weapons: 'Constitutional carry state since July 2011 — one of earliest. No permit for residents 21+. CFP still issued for reciprocity.',
        agency: 'No state-level regulatory agency.',
        notes: 'Minimal regulation. One of earliest constitutional carry states (2011). Lowest population density in continental US. Energy industry drives security employment.',
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
