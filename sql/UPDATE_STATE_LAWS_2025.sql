-- =====================================================
-- UPDATE STATE LAWS — COMPREHENSIVE 2025 REFRESH
-- =====================================================
-- Run on the LEGACY Supabase SQL Editor.
-- =====================================================

-- ─── ALABAMA ───
UPDATE state_laws SET
  licensing = 'Registration required with the Alabama Security Regulatory Board (ASRB). All security officers must obtain an ASRB registration card. Companies must hold a Contract Security Company License.',
  training_hours = '8 hours minimum pre-assignment training. ASRB mandates training in legal authority, emergency procedures, and report writing.',
  min_age = '19 years old (unique to Alabama; 21 for armed)',
  use_of_force = 'Stand Your Ground state (Code of Ala. § 13A-3-23). No duty to retreat in any place where the person has a lawful right to be. Force permitted when reasonably necessary to prevent imminent harm. Deadly force only to prevent imminent death or serious bodily harm.',
  citizens_arrest = 'Permitted under Code of Ala. § 15-10-7. May arrest for public offenses or breach of peace in presence, or felonies with reasonable cause. Must deliver to law enforcement without unnecessary delay.',
  weapons = 'Armed Guard Permit from ASRB required plus firearms qualification course. Annual requalification mandatory. Concealed carry permit may also be required depending on assignment.',
  regulatory_agency = 'Alabama Security Regulatory Board (ASRB)',
  notes = 'Background check and fingerprinting required. Registration renewed every 2 years. One of few states with minimum age of 19. Companies must maintain liability insurance.',
  updated_at = NOW()
WHERE state_code = 'AL';

-- ─── ALASKA ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. Security companies must register as a business with the Alaska Division of Corporations.',
  training_hours = 'No mandatory state training hours. Employers expected to provide adequate on-the-job training.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (AS § 11.81.335). No duty to retreat from any place the person has a right to be. Deadly force permitted when reasonably necessary to prevent death or serious physical injury. Defense of property allows reasonable nondeadly force (AS § 11.81.350).',
  citizens_arrest = 'Permitted under AS § 12.25.030. May arrest for crimes committed or attempted in presence, or when arrested person has committed a felony. Must deliver to peace officer without unnecessary delay.',
  weapons = 'Constitutional carry state — no permit required for open or concealed carry for those 21+. Armed guards must comply with employer policies and carry appropriate insurance.',
  regulatory_agency = 'Alaska Department of Commerce, Community, and Economic Development (DCCED)',
  notes = 'Largely unregulated at state level for unarmed guards. Employers set training standards. Remote locations create unique operational considerations.',
  updated_at = NOW()
WHERE state_code = 'AK';

-- ─── ARIZONA ───
UPDATE state_laws SET
  licensing = 'Registration required through Arizona DPS. All guards must obtain a Security Guard Registration Certificate. Background check and fingerprinting through approved vendor required.',
  training_hours = '8 hours pre-assignment training plus 8 additional hours within 90 days. Covers legal authority, emergency response, observation/reporting, and ethics.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (ARS § 13-404 through 13-411). Force justified when a reasonable person would believe it immediately necessary to protect against unlawful physical force. Deadly force when reasonably necessary to protect against death or serious physical injury. No duty to retreat.',
  citizens_arrest = 'Permitted under ARS § 13-3884. May arrest when a felony has been committed with reasonable grounds, or a misdemeanor breach of peace in presence. Must deliver to magistrate or peace officer without unnecessary delay.',
  weapons = 'Armed Security Guard Certification from DPS required. Minimum 16-hour firearms program, written exam, and range qualification. Annual requalification. Valid Fingerprint Clearance Card required.',
  regulatory_agency = 'Arizona Department of Public Safety (DPS) — Security Guard Program',
  notes = 'Fingerprint Clearance Card required. Registration valid 2 years. Extreme heat creates unique duty-of-care obligations for outdoor security. DPS maintains active database of registered guards.',
  updated_at = NOW()
WHERE state_code = 'AZ';

-- ─── ARKANSAS ───
UPDATE state_laws SET
  licensing = 'License required through Arkansas State Police (ASP). Companies must obtain Private Security Agency License. Individual guards registered through employing agency. Background check required.',
  training_hours = 'No specific minimum hours at state level. ASP requires employers provide adequate training before assignment. Armed guards must complete firearms qualification.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (Ark. Code § 5-2-607). No duty to retreat from any place the person has a lawful right to be. Deadly force justified when reasonably necessary to prevent imminent death or serious physical injury. Castle Doctrine applies to dwellings, vehicles, and occupied structures.',
  citizens_arrest = 'Permitted under Ark. Code § 16-81-106. May arrest for felonies in presence or with reasonable grounds. Misdemeanors only if breach of peace in presence. Must deliver to law enforcement promptly.',
  weapons = 'Certification through ASP required for armed guards. Approved firearms course with written exam and range qualification. Concealed Handgun Carry License (CHCL) may be needed. Open carry legal without permit.',
  regulatory_agency = 'Arkansas State Police — Regulatory Services Division',
  notes = 'Background check required. Agency license renewed annually. Individual registration maintained by employer. No separate individual guard card.',
  updated_at = NOW()
WHERE state_code = 'AR';

-- ─── CALIFORNIA ───
UPDATE state_laws SET
  licensing = 'Guard Card (Guard Registration) required from BSIS. Must complete training, pass background check with Live Scan fingerprinting. Guard Card valid for 2 years.',
  training_hours = '40 hours total: 8 hours Powers to Arrest (pre-assignment), 16 hours within 30 days (including WMD/Terrorism Awareness), 16 hours within 6 months. 8-hour annual refresher for renewal.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state in public. Self-defense justified when person reasonably believes they are in imminent danger (Penal Code § 198.5, CALCRIM 505/506). Castle Doctrine in home only. Guards have no more authority than private citizens. Powers to Arrest training covers force limitations. Excessive force = criminal charges + civil liability.',
  citizens_arrest = 'Governed by Penal Code § 837. May arrest for public offense in presence, when arrested person committed felony (even if not in presence), or with reasonable cause for felony. Core topic in mandatory Powers to Arrest training.',
  weapons = 'Exposed Firearms Permit from BSIS required. 16-hour firearms course, written exam, range qualification with each specific firearm. Annual requalification. Baton Permit requires separate 8-hour course. OC spray with employer authorization. Strict ammo restrictions in some jurisdictions.',
  regulatory_agency = 'Bureau of Security and Investigative Services (BSIS), California Department of Consumer Affairs',
  notes = 'One of the most heavily regulated states. Live Scan fingerprinting required. 2-year renewal with continuing education. Public license verification database. Strict penalties for working without valid Guard Card. AB 229 expanded BSIS oversight.',
  updated_at = NOW()
WHERE state_code = 'CA';

-- ─── COLORADO ───
UPDATE state_laws SET
  licensing = 'No state-level license required. Colorado has no statewide security guard regulatory framework. Some municipalities (Denver, Aurora, Colorado Springs) may have local registration or permitting requirements.',
  training_hours = 'No mandatory state training hours. Employers responsible for training. Many companies voluntarily follow ASIS International standards.',
  min_age = '18 years old',
  use_of_force = 'Modified Stand Your Ground with strong Castle Doctrine (CRS § 18-1-704 through 710). Reasonable force to defend self or others when reasonably necessary. Deadly force only when lesser force is inadequate and facing imminent death or serious bodily injury. "Make My Day" law (CRS § 18-1-704.5) provides strong protections against intruders in occupied dwellings.',
  citizens_arrest = 'Permitted under CRS § 16-3-201. May arrest when any crime is being committed in presence. Must use only reasonable force. Must deliver to peace officer or judge without unnecessary delay. Liability for wrongful arrest falls on the individual.',
  weapons = 'No state-level armed guard license. Concealed carry requires Colorado CHP from county sheriff. Denver has historically had stricter regulations. Employers set armed guard requirements.',
  regulatory_agency = 'No state-level regulatory agency. Locally regulated by municipal licensing offices.',
  notes = 'Least regulated at state level. Denver, Aurora, and Colorado Springs have own licensing requirements — check local ordinances. Employers often require first aid/CPR certification.',
  updated_at = NOW()
WHERE state_code = 'CO';

-- ─── CONNECTICUT ───
UPDATE state_laws SET
  licensing = 'Security Officer License required from DESPP, Division of State Police — Special Licensing and Firearms Unit. Background check, fingerprints, and training required.',
  training_hours = '8 hours pre-assignment covering legal powers, emergency procedures, general duties, report writing, and ethics. Armed guards require additional firearms training hours.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state (CGS § 53a-19). Force justified when reasonably necessary to prevent imminent physical harm. Deadly force only when reasonably necessary to prevent imminent death or serious bodily harm AND no reasonable opportunity to retreat safely. Castle Doctrine applies in dwelling (CGS § 53a-20) — no duty to retreat at home.',
  citizens_arrest = 'Permitted under CGS § 53a-22. May use reasonable force to arrest when reasonably believing person committed an offense. Deadly force only if necessary to defend against imminent deadly force during arrest attempt.',
  weapons = 'Separate Armed Security Guard Permit from DESPP required. Approved firearms course, written and practical exams, range qualification. Firearms must be registered in CT. Assault weapons and large-capacity magazines prohibited.',
  regulatory_agency = 'Connecticut DESPP — Special Licensing and Firearms Unit',
  notes = 'Background check and fingerprinting required. License renewed every 5 years. Strict firearms laws. Companies must be licensed separately.',
  updated_at = NOW()
WHERE state_code = 'CT';

-- ─── DELAWARE ───
UPDATE state_laws SET
  licensing = 'Registration required with Delaware Board of Examiners of Private Investigators and Private Security Agencies (Title 24, Chapter 13). Guards registered through employing agency. Background check required.',
  training_hours = 'Employers must provide adequate training before assignment. No specific minimum hours mandated. Many employers provide 8-16 hours pre-assignment. Armed guards must complete firearms qualification.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state with Castle Doctrine (11 Del. C. § 464-465). Force justified when reasonably necessary against unlawful force. Deadly force only to prevent imminent death, serious physical injury, kidnapping, or compelled sexual intercourse. No duty to retreat in dwelling.',
  citizens_arrest = 'Permitted under 11 Del. C. § 1935. May arrest for felonies in presence or with reasonable ground. Misdemeanors only for breaches of peace in presence. Must deliver to law enforcement promptly.',
  weapons = 'Armed guards must meet firearms qualification standards. Concealed Deadly Weapons License (CDWL) from Court of Common Pleas for concealed carry. Open carry legal without permit.',
  regulatory_agency = 'Delaware Board of Examiners of Private Investigators and Private Security Agencies (Division of Professional Regulation)',
  notes = 'Background check required. Agency license renewed every 2 years. Proximity to Philadelphia, Baltimore, and D.C. means many guards work across state lines.',
  updated_at = NOW()
WHERE state_code = 'DE';

-- ─── FLORIDA ───
UPDATE state_laws SET
  licensing = 'Class D Security Officer License required from FDACS Division of Licensing. Must complete training, pass background check with fingerprinting. License valid 2 years.',
  training_hours = '40 hours Class D training: legal authority, ethics, emergency procedures, access control, patrol techniques, first aid/AED, report writing. Armed guards need additional 28-hour Class G training.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (FL Stat. § 776.012-776.013). No duty to retreat anywhere person has right to be. Force including deadly force justified when reasonably necessary to prevent imminent death, great bodily harm, or imminent forcible felony. Castle Doctrine (§ 776.013) adds protections in dwellings, residences, and occupied vehicles.',
  citizens_arrest = 'Permitted under FL Stat. § 901.16. May arrest for felonies with reasonable ground, or breach of peace in presence. Merchant''s Protection statute (§ 812.015) provides specific retail theft detention authority. Must deliver to law enforcement without unreasonable delay.',
  weapons = 'Class G Statewide Firearm License required. 28 hours firearms training from licensed instructor including classroom and range qualification. Annual requalification with each firearm. Must carry both Class D and G licenses while armed on duty.',
  regulatory_agency = 'Florida Department of Agriculture and Consumer Services (FDACS) — Division of Licensing',
  notes = 'One of most popular states for security employment. Both licenses valid 2 years. Online verification system. Some state reciprocity for armed licenses. Continuing education for renewal.',
  updated_at = NOW()
WHERE state_code = 'FL';

-- ─── GEORGIA ───
UPDATE state_laws SET
  licensing = 'Registration with Georgia Board of Private Detective and Security Agencies. Companies must be licensed, guards registered through employer. Background check with fingerprinting through GCIC.',
  training_hours = 'No specific minimum hours mandated. Board requires employers ensure proper training before assignment. Most employers provide 8-24 hours covering state law, use of force, emergency response, and reporting.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (O.C.G.A. § 16-3-21 through 24.2). No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary to prevent death, great bodily injury, or forcible felony. Deadly force only for death, great bodily injury, or forcible felony prevention.',
  citizens_arrest = 'SIGNIFICANTLY REFORMED in 2021 after Ahmaud Arbery case. Under O.C.G.A. § 17-4-60, citizen''s arrest is now extremely limited: may only detain if witnessing a felony AND person is escaping, solely to contact law enforcement. Previous broad authority eliminated. Shopkeeper''s privilege (§ 51-7-60) still applies for merchants.',
  weapons = 'Constitutional carry state as of April 2022 (SB 319) — no license required for those 21+. Armed companies typically still require firearms training and qualification for liability purposes. Georgia Firearms License available through local probate court.',
  regulatory_agency = 'Georgia Board of Private Detective and Security Agencies (under Secretary of State)',
  notes = 'Background check and fingerprinting mandatory. Company license renewed annually. 2021 citizen''s arrest reform is one of the most significant changes nationally — guards must understand the restricted standards. Constitutional carry (2022) does not eliminate employer training requirements.',
  updated_at = NOW()
WHERE state_code = 'GA';

-- ─── HAWAII ───
UPDATE state_laws SET
  licensing = 'Guard registration required with Hawaii Board of Private Detectives and Guards (under DCCA). Agencies must hold valid license. Guards registered through employer. Background check required.',
  training_hours = 'No specific minimum hours mandated. Board requires employing agencies ensure adequate training. Many employers provide 8-16 hours covering state laws, emergency procedures, and site-specific protocols.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state (HRS § 703-304). Force for self-defense only when reasonably necessary AND cannot retreat safely. Deadly force only to prevent death or serious bodily injury when retreat is not safely possible. Limited Castle Doctrine in dwelling (HRS § 703-304(5)).',
  citizens_arrest = 'Permitted under HRS § 803-3. May arrest for felonies in presence or with reasonable ground. Misdemeanors only for breach of peace in presence. Must deliver to peace officer immediately.',
  weapons = 'Strictest firearms regulations in the nation. All firearms must be registered. Concealed carry permits extremely difficult to obtain (County Police Chief issues). Armed security heavily restricted. Guards carrying weapons must have specific employer authorization and comply with all state and county registration requirements.',
  regulatory_agency = 'Hawaii Board of Private Detectives and Guards (under DCCA)',
  notes = 'Background check required. Registration must be renewed. Strict firearms laws make armed security significantly more regulated than most states. Guard agencies must maintain liability insurance.',
  updated_at = NOW()
WHERE state_code = 'HI';

-- ─── IDAHO ───
UPDATE state_laws SET
  licensing = 'No state license or registration required for unarmed guards. No statewide regulatory framework. Some municipalities may have local business licensing requirements.',
  training_hours = 'No mandatory state training hours. Employers solely responsible for training. Industry best practices suggest 8-16 hours pre-assignment.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (Idaho Code § 18-4009, § 19-202). Force justified when reasonably necessary to prevent imminent harm. Deadly force to prevent death, great bodily injury, or forcible felony. No duty to retreat. Strong Castle Doctrine (§ 18-4009(3)) in habitation.',
  citizens_arrest = 'Permitted under Idaho Code § 19-604. May arrest for public offense in presence, when person has committed felony, or with reasonable cause for felony. Must deliver to magistrate or peace officer.',
  weapons = 'Constitutional carry state — no permit required for concealed or open carry for residents 18+. No state-level armed guard certification. Employers set own armed guard standards.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'One of the least regulated states. No licensing, training, or oversight requirements for unarmed guards. Employers bear full responsibility for competency.',
  updated_at = NOW()
WHERE state_code = 'ID';

-- ─── ILLINOIS ───
UPDATE state_laws SET
  licensing = 'Permanent Employee Registration Card (PERC) required from IDFPR. Background check with fingerprinting, training completion, and application fee required. PERC valid 3 years.',
  training_hours = '20 hours pre-assignment covering legal authority, emergency response, observation/reporting, safety, access control, and ethics. 8 hours annual refresher required. Armed guards need additional 20-hour firearms program.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state in public (720 ILCS 5/7-1). Force justified when reasonably necessary to prevent imminent unlawful force. Deadly force only to prevent imminent death, great bodily harm, or forcible felony. Castle Doctrine (720 ILCS 5/7-2) eliminates duty to retreat in dwelling or place of business.',
  citizens_arrest = 'Permitted under 725 ILCS 5/107-3. May arrest when reasonable grounds to believe person is committing or has committed offense. May use reasonable force. Must deliver to peace officer without unreasonable delay. Requires "reasonable grounds" — higher than mere suspicion.',
  weapons = 'Firearm Control Card (FCC) from IDFPR plus valid FOID Card from IL State Police required. 20-hour approved firearms program, written and practical exams. Annual requalification. Strict assault weapons regulations and magazine capacity limits in Cook County/Chicago.',
  regulatory_agency = 'Illinois Department of Financial and Professional Regulation (IDFPR)',
  notes = 'Strong regulations and active enforcement. PERC renewed every 3 years with continuing education. Governed by Private Detective, Private Alarm, Private Security, Fingerprint Vendor, and Locksmith Act of 2004 (225 ILCS 447). Chicago has additional local requirements.',
  updated_at = NOW()
WHERE state_code = 'IL';

-- ─── INDIANA ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. No statewide individual guard licensing program. Some municipalities may have local permitting.',
  training_hours = 'No mandatory state training hours. Employers responsible for training. Many companies provide 8-16 hours pre-assignment to meet client contracts and reduce liability.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (IC § 35-41-3-2). No duty to retreat from any place with right to be. Reasonable force to protect self or others from unlawful force. Deadly force when reasonably necessary to prevent serious bodily injury, death, or forcible felony. Indiana uniquely allows force against unlawful law enforcement entry (IC § 35-41-3-2(i)).',
  citizens_arrest = 'Permitted under IC § 35-33-1-4. May arrest for felonies with reasonable grounds, or misdemeanor breach of peace in presence. Must deliver to law enforcement without unnecessary delay.',
  weapons = 'Constitutional carry state since July 2022 (HEA 1296) — no permit required for handguns for those 18+. Armed guards must comply with employer policies and federal law. Employers typically require firearms qualification.',
  regulatory_agency = 'No state-level regulatory agency for security guards.',
  notes = 'Minimal state regulation. Constitutional carry since 2022. Proximity to Chicago means many guards work across state lines — must understand Illinois'' stricter regulations.',
  updated_at = NOW()
WHERE state_code = 'IN';

-- ─── IOWA ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. Private security companies may need local business licenses.',
  training_hours = 'No mandatory state training hours. Employers set own standards. Iowa Law Enforcement Academy offers voluntary resources.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state since July 2017 (Iowa Code § 704.1-704.13). No duty to retreat from any place with lawful right to be when not the initial aggressor. Force justified when reasonably necessary to protect against unlawful force. Deadly force when reasonably necessary to prevent imminent death or serious injury.',
  citizens_arrest = 'Permitted under Iowa Code § 804.9. May arrest for public offense in presence, or felony with reasonable ground. Must deliver to peace officer without unnecessary delay. Force must be reasonable.',
  weapons = 'Constitutional carry state since July 2021 (HF 756) — no permit for those 21+. Optional Permits to Carry Weapons still issued for reciprocity. Employers typically require armed guard firearms training and requalification.',
  regulatory_agency = 'Iowa Department of Public Safety (limited oversight). No dedicated security guard body.',
  notes = 'Minimal state regulation. Iowa Code Chapter 80A governs only agencies at company level. Constitutional carry since 2021. Employers bear primary responsibility for training.',
  updated_at = NOW()
WHERE state_code = 'IA';

-- ─── KANSAS ───
UPDATE state_laws SET
  licensing = 'No state license required. Kansas does not regulate private security at state level. Local jurisdictions may have business licensing.',
  training_hours = 'No mandatory state training hours. Employers solely responsible. Some clients and insurers require certifications.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (KSA § 21-5222 through 21-5231). Force justified when and to the extent it appears necessary to defend self or others. No duty to retreat. Deadly force when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony.',
  citizens_arrest = 'Permitted under KSA § 22-2403. May arrest for felonies with reasonable grounds, or any misdemeanor in view. Must deliver to law enforcement without unnecessary delay.',
  weapons = 'Constitutional carry state since 2015 — no permit for concealed or open carry for those 21+ (18+ military). Employers set armed guard standards.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'One of the least regulated states. No licensing, registration, or training requirements. One of first states to adopt constitutional carry (2015). Employers and insurers drive training standards.',
  updated_at = NOW()
WHERE state_code = 'KS';

-- ─── KENTUCKY ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. No statewide licensing program. Security companies may need local business licenses.',
  training_hours = 'No mandatory state training hours. Employers set standards. Department of Criminal Justice Training offers relevant but non-mandatory courses.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground and Castle Doctrine state (KRS § 503.050-503.080). No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary. Deadly force to prevent death, serious physical injury, kidnapping, or sexual assault. Presumption of reasonable fear against unlawful forcible entry into dwelling, vehicle, or place of business (KRS § 503.055).',
  citizens_arrest = 'Permitted under KRS § 431.005. May arrest for felonies committed in fact with reasonable grounds, or misdemeanors in presence. Must deliver to law enforcement without unnecessary delay. Reasonable force permitted.',
  weapons = 'Constitutional carry state since June 2019 (SB 150) — no permit for concealed carry for those 21+. CCDWL still issued for reciprocity. Employers typically mandate firearms training for armed guards.',
  regulatory_agency = 'No state-level regulatory agency for security guards.',
  notes = 'Minimal state regulation. Constitutional carry since 2019. Employers and insurance carriers drive training standards.',
  updated_at = NOW()
WHERE state_code = 'KY';

-- ─── LOUISIANA ───
UPDATE state_laws SET
  licensing = 'Security Officer Commission required from LSBPSE. All officers must be commissioned. Companies must hold Private Security Company License. Background check with fingerprinting required.',
  training_hours = '8 hours minimum pre-assignment covering legal authority, emergency procedures, observation/reporting, general duties, and use of force. Armed guards require additional firearms classroom and range qualification.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (LA R.S. 14:19-14:22). No duty to retreat in any place with right to be. Force including deadly force justified when reasonably necessary to prevent death, great bodily harm, or imminent forcible felony. Castle Doctrine (R.S. 14:20) adds protections in dwelling, place of business, and occupied vehicle. Justifiable homicide in self-defense when reasonably in imminent danger.',
  citizens_arrest = 'Permitted under LA Code of Criminal Procedure Art. 214. May arrest for felonies whether or not in presence. Misdemeanors only for breach of peace in presence. Must deliver to peace officer without unnecessary delay. Reasonable force permitted.',
  weapons = 'Firearms Endorsement on Security Officer Commission required. LSBPSE-approved firearms training (minimum 8 hours classroom + range). Must qualify with each specific firearm. Annual requalification. Constitutional carry state as of July 2024 (SB 1) for those 18+.',
  regulatory_agency = 'Louisiana State Board of Private Security Examiners (LSBPSE)',
  notes = 'Background check and fingerprinting required. Commission renewed annually. LSBPSE actively enforces requirements. One of more regulated states in Southeast.',
  updated_at = NOW()
WHERE state_code = 'LA';

-- ─── MAINE ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. No statewide regulatory program. Companies may need local business registrations.',
  training_hours = 'No mandatory state training hours. Employers responsible for training. Many provide 8-16 hours voluntarily.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state with Castle Doctrine (17-A M.R.S. § 108). Nondeadly force when reasonably necessary against imminent unlawful force. Deadly force only to prevent imminent death or serious bodily harm after exhausting reasonable means of retreat. No duty to retreat in dwelling (Castle Doctrine expanded in 2007 amendments).',
  citizens_arrest = 'Permitted under 17-A M.R.S. § 16. May use nondeadly force to arrest when reasonably believing person committed crime. Deadly force only if necessary to defend against imminent deadly force during arrest. Must deliver to law enforcement promptly.',
  weapons = 'Constitutional carry state since October 2015 (LD 652). No permit for concealed carry for those 21+ (18+ military). Employers set armed guard standards. Concealed Handgun Permits still issued for reciprocity.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal state regulation. Constitutional carry since 2015. Rural character and seasonal tourism create unique needs. Employers enforce training standards.',
  updated_at = NOW()
WHERE state_code = 'ME';

-- ─── MARYLAND ───
UPDATE state_laws SET
  licensing = 'Security Guard Registration required with Maryland State Police (MSP) Licensing Division. Background check with fingerprinting, training completion, and application fee required. Agencies must be separately licensed.',
  training_hours = '16 hours minimum for unarmed guards plus 8-hour annual refresher. Covers legal authority, emergency procedures, patrol techniques, report writing, first aid, and use of force. Armed guards require additional 22 hours firearms training (38 total). MSP-approved instructors only.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state (MD Criminal Law § 4-101, case law). Reasonable force when reasonably in imminent danger. Must retreat if safely possible before deadly force (except in home — Castle Doctrine). Deadly force only to prevent imminent death or serious bodily harm. Maryland courts apply strict "reasonable person" standard.',
  citizens_arrest = 'Permitted under Maryland common law. May arrest for felonies in presence or with probable cause. Misdemeanors only for breaches of peace in presence. Courts are strict — wrongful arrest leads to civil and criminal liability. Must deliver to law enforcement promptly.',
  weapons = 'MSP-approved 22-hour firearms course, written and practical exams, range qualification required. Must carry Armed Guard Permit and Registration while on duty. Assault weapons ban and 10-round magazine limit. Handgun Qualification License for purchases. Wear-and-carry permits are shall-issue since 2022 Bruen decision.',
  regulatory_agency = 'Maryland State Police (MSP) — Licensing Division',
  notes = 'Registration valid 2 years. One of more regulated states. MSP maintains verification database. 2022 Bruen decision changed concealed carry from may-issue to shall-issue. Proximity to D.C. means many guards need federal clearances.',
  updated_at = NOW()
WHERE state_code = 'MD';

-- ─── MASSACHUSETTS ───
UPDATE state_laws SET
  licensing = 'No state license specifically for unarmed guards. Regulated primarily at local level — some municipalities require Watchman/Guard license from local police. Security companies must register as businesses.',
  training_hours = 'No mandatory state training hours. Local jurisdictions may impose requirements. Many employers provide 8-24 hours. Some clients (healthcare, education) require specific certifications.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state (Commonwealth v. Shaffer). Reasonable force only when reasonably necessary and force is proportionate. Strict duty to retreat before deadly force if retreat is safe. Castle Doctrine in dwelling — no duty to retreat from home (Commonwealth v. Catalina).',
  citizens_arrest = 'Permitted under M.G.L. c. 276, § 28. May arrest for felonies in presence or with reasonable cause. Breach of peace in presence also justifies. Courts strict about "in presence" requirement. Must deliver to law enforcement without unreasonable delay.',
  weapons = 'Among strictest firearms laws nationally. License to Carry (LTC) from local Police Chief for handguns. FID for rifles/shotguns. Armed guards need valid LTC and employer certification. Assault weapons ban. Strict magazine limits. 2024 gun reform law (HD 4420) added restrictions.',
  regulatory_agency = 'Local police departments. Massachusetts Division of Professional Licensure has limited oversight.',
  notes = 'Primarily locally regulated. Boston and other cities have their own requirements. "May-issue" firearms licenses — local chief has discretion. Thorough background checks. Strong labor laws and union presence affect industry.',
  updated_at = NOW()
WHERE state_code = 'MA';

-- ─── MICHIGAN ───
UPDATE state_laws SET
  licensing = 'No state license for individual unarmed guards. Private security companies must be licensed by Michigan State Police under Private Security Business and Security Alarm Act (MCL 338.1051-1092). Guards registered through employing company.',
  training_hours = 'No mandatory state hours for unarmed guards. Act requires employers ensure competency but no minimum hours specified. Most employers provide 8-16 hours pre-assignment. Armed guards must meet MSP firearms qualification.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state as of October 2024 (MCL § 780.972 expanded). Person who has not engaged in unlawful activity may use deadly force anywhere with legal right to be if honestly and reasonably believing it necessary to prevent imminent death, great bodily harm, or sexual assault. No duty to retreat. Previously only Castle Doctrine in dwellings — 2024 expansion is a major change.',
  citizens_arrest = 'Permitted under MCL § 764.16. May arrest for felonies in presence. Misdemeanors only for breach of peace in presence — more restrictive than some states. Must deliver to peace officer without unnecessary delay. Only reasonable force permitted.',
  weapons = 'Concealed Pistol License (CPL) from county clerk required. Michigan requires pistol registration. Open carry of registered pistols legal without permit. Armed companies must comply with MSP licensing. Employers require range qualification and annual requalification.',
  regulatory_agency = 'Michigan State Police (MSP) — Licensing and Regulatory Affairs',
  notes = 'Company licensing through MSP required. Michigan expanded Stand Your Ground significantly in October 2024 — major legal change guards must understand. Detroit and urban areas may have additional local requirements.',
  updated_at = NOW()
WHERE state_code = 'MI';

-- ─── MINNESOTA ───
UPDATE state_laws SET
  licensing = 'Individual guards not licensed by state. Employing companies must be licensed by Minnesota Board of Private Detective and Protective Agent Services. Guards registered through employer. Background check required.',
  training_hours = 'No mandatory state hours for individual guards. Board requires employers ensure proper training. Most companies provide 8-24 hours pre-assignment.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state (Minn. Stat. § 609.06-609.065). Reasonable force when reasonably necessary to prevent imminent bodily harm. Duty to retreat before deadly force if safely possible. Deadly force only to prevent great bodily harm or death. Castle Doctrine (§ 609.065) — no duty to retreat in dwelling; force including deadly force against intruder if reasonably necessary.',
  citizens_arrest = 'Permitted under Minn. Stat. § 629.37. May arrest for public offense in presence, felony even if not in presence, or with reasonable cause for felony. Must deliver to peace officer without unnecessary delay. Reasonable force permitted.',
  weapons = 'Minnesota Permit to Carry from county sheriff required. Live firearms training and background check. Permits valid 5 years. Employers require additional qualification and annual requalification. Some assault-style weapon restrictions in Minneapolis/St. Paul.',
  regulatory_agency = 'Minnesota Board of Private Detective and Protective Agent Services',
  notes = 'Company licensing through Board required. Mall of America and major venues drive significant security employment. Twin Cities event culture requires crowd management training.',
  updated_at = NOW()
WHERE state_code = 'MN';

-- ─── MISSISSIPPI ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. No comprehensive statewide framework. Companies may need local business licenses.',
  training_hours = 'No mandatory state training hours. Employers solely responsible. Larger employers follow industry standards of 8-16 hours pre-assignment.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground with strong Castle Doctrine (Miss. Code § 97-3-15). No duty to retreat anywhere with right to be. Force including deadly force justified when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony. Presumption of reasonable fear against unlawful forcible entry into dwelling, occupied vehicle, or place of business.',
  citizens_arrest = 'Permitted under Miss. Code § 99-3-7. May arrest for felonies in presence or with reasonable grounds. Misdemeanors only for breach of peace in presence. Must deliver to law enforcement without unnecessary delay.',
  weapons = 'Constitutional carry state since April 2016 (HB 786) — no permit for open or concealed carry for those 18+. Enhanced Carry Permits issued for additional reciprocity. Armed guards comply with employer policies.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Least regulated states for security. Constitutional carry since 2016. Gaming industry (Gulf Coast casinos) employs significant security — casino security falls under Mississippi Gaming Commission separately.',
  updated_at = NOW()
WHERE state_code = 'MS';

-- ─── MISSOURI ───
UPDATE state_laws SET
  licensing = 'No state license for unarmed guards. No state-level mandate. Some municipalities (St. Louis, Kansas City) have their own guard licensing requirements.',
  training_hours = 'No mandatory state training hours. Employers set standards. St. Louis and Kansas City may require specific training for guards within city limits.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (RSMo § 563.031). No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary against imminent unlawful force. Deadly force to protect against death, serious physical injury, or forcible felony. Castle Doctrine (§ 563.031.2) provides presumption of reasonableness against intruders in dwellings, residences, and vehicles.',
  citizens_arrest = 'Permitted under RSMo § 544.180. May arrest for any criminal offense in presence, or felony with reasonable cause. Must deliver to law enforcement without unnecessary delay. Reasonable force permitted.',
  weapons = 'Constitutional carry state since January 2017 (SB 656) — no permit for concealed carry for those 19+ (18+ military). Optional CCPs for reciprocity. St. Louis and Kansas City have historically had stricter local ordinances.',
  regulatory_agency = 'No state-level regulatory agency. Local regulation in some cities.',
  notes = 'Minimal state regulation. Some local regulation in major cities. Constitutional carry since 2017. Diverse geography creates varying security needs.',
  updated_at = NOW()
WHERE state_code = 'MO';

-- ─── MONTANA ───
UPDATE state_laws SET
  licensing = 'Companies must be licensed by Montana Board of Private Security Patrol Officers and Investigators. Individual guards registered through employing company. Background check required.',
  training_hours = 'No specific minimum hours for unarmed guards. Board requires employers ensure competency. Many employers provide 8-16 hours pre-assignment.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (MCA § 45-3-102 through 115). Force justified against imminent bodily injury. No duty to retreat. Deadly force when reasonably necessary to prevent death, serious bodily injury, kidnapping, or sexual assault. Castle Doctrine (MCA § 45-3-103) in occupied structures — force including deadly force against intruders.',
  citizens_arrest = 'Permitted under MCA § 46-6-502. May arrest for felonies or misdemeanors in presence, or felonies with probable cause. Must deliver to peace officer without unnecessary delay. Only reasonable force permitted.',
  weapons = 'Constitutional carry state since February 2021 (HB 102). No permit for concealed carry for those 18+. Historically permissive firearms laws. Employers set armed guard standards and typically require qualification.',
  regulatory_agency = 'Montana Board of Private Security Patrol Officers and Investigators (under Department of Labor and Industry)',
  notes = 'Company licensing required. Individual guards registered through employers. Vast rural landscape creates unique challenges. Mining, oil, and ranching drive private security employment. Constitutional carry since 2021.',
  updated_at = NOW()
WHERE state_code = 'MT';

-- ─── NEBRASKA ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. No comprehensive statewide regulatory framework. Local business registration may be required.',
  training_hours = 'No mandatory state training hours. Employers solely responsible for training.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state as of April 2024 (LB 77). Previously a duty-to-retreat state. Now no duty to retreat from any place with lawful right to be when not the initial aggressor. Force justified when reasonably necessary against unlawful force. Deadly force to prevent death, serious bodily harm, kidnapping, or sexual assault. Castle Doctrine applies in dwellings.',
  citizens_arrest = 'Permitted under Neb. Rev. Stat. § 29-402. May arrest for criminal offense in presence, or felony with reasonable cause. Must deliver to peace officer without unnecessary delay.',
  weapons = 'Constitutional carry state as of April 2024 (LB 77) — no permit for concealed carry for those 21+. Concealed Handgun Permits still issued for reciprocity. Armed guards comply with employer requirements.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Major change in 2024: shifted from duty-to-retreat to stand-your-ground AND adopted constitutional carry. Guards must understand this significant legal shift. Omaha and Lincoln may have additional local requirements.',
  updated_at = NOW()
WHERE state_code = 'NE';

-- ─── NEVADA ───
UPDATE state_laws SET
  licensing = 'Work Card required from Nevada PILB. All guards must obtain Work Card before employment. Background check with fingerprinting and pre-assignment training required. Companies must hold Private Patrol License.',
  training_hours = '8 hours pre-assignment required by PILB covering legal authority, emergency procedures, report writing, observation, and ethics. Armed guards require additional 16 hours minimum. Gaming/hospitality employers often exceed minimums.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (NRS § 200.120, 200.275). Person who is not the original aggressor has right to stand ground and defend with reasonable force. Deadly force when reasonably necessary to prevent death or substantial bodily harm. Castle Doctrine (NRS § 200.120(2)) in occupied habitations — no duty to retreat.',
  citizens_arrest = 'Permitted under NRS § 171.126. May arrest for public offense in presence, felony even if not in presence, or felony with reasonable cause. Must deliver to peace officer without unnecessary delay.',
  weapons = 'Firearms Endorsement on PILB Work Card required. 16-hour PILB-approved course, written and practical exams, range qualification. Must requalify every 6 months. Each specific firearm must be registered and qualified separately. PILB has strict armed guard requirements despite permissive general firearms laws.',
  regulatory_agency = 'Nevada Private Investigators Licensing Board (PILB)',
  notes = 'One of most active security markets due to gaming/hospitality. Las Vegas Strip properties have requirements exceeding PILB minimums. PILB actively enforces and maintains online verification. Work Card renewed every 5 years. Gaming establishments may need Gaming Control Board clearance.',
  updated_at = NOW()
WHERE state_code = 'NV';

-- ─── NEW HAMPSHIRE ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. New Hampshire does not regulate private security at state level.',
  training_hours = 'No mandatory state training hours. Employers solely responsible. Government contracts may require specific certifications.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (RSA § 627:4). Nondeadly force when reasonably necessary against unlawful force. Deadly force when reasonably necessary to prevent death or serious bodily harm. No duty to retreat from any place with lawful right to be. Stand Your Ground expansion enacted in 2011 (SB 88). Castle Doctrine applies in dwellings.',
  citizens_arrest = 'Permitted under RSA § 627:5. May use nondeadly force when reasonably believing person committed felony or misdemeanor. Deadly force only to defend against imminent deadly force during arrest. Must deliver to law enforcement without unnecessary delay.',
  weapons = 'Constitutional carry state since February 2017 (SB 12). No permit for concealed carry for those 18+. No permit for open carry. Armed guards comply with employer requirements.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal regulation — "Live Free or Die" philosophy. No guard licensing, registration, or mandated training. Constitutional carry since 2017. Proximity to Boston means cross-state workers must understand Massachusetts'' stricter laws.',
  updated_at = NOW()
WHERE state_code = 'NH';

-- ─── NEW JERSEY ───
UPDATE state_laws SET
  licensing = 'SORA (Security Officer Registration Act) Card required from NJ State Police Firearms Investigation Unit. Background check with fingerprinting, training completion, and fee required. Registration valid 2 years.',
  training_hours = 'No specific minimum hours mandated by SORA, but employers required to provide adequate training. Most employers provide 8-16 hours pre-assignment. Armed guards must complete extensive firearms training meeting NJ State Police standards.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state (N.J.S.A. 2C:3-4). Force justified when reasonably necessary against imminent unlawful force. Duty to retreat before deadly force if safely possible. Deadly force only to protect against death or serious bodily harm. Castle Doctrine in dwelling — no duty to retreat at home (N.J.S.A. 2C:3-4(b)(2)).',
  citizens_arrest = 'Permitted under N.J.S.A. 2A:169-3. May arrest for indictable offenses (felonies) in presence, or disorderly persons offenses (misdemeanors) involving breach of peace in presence. Must deliver to law enforcement promptly. NJ courts strictly scrutinize citizen''s arrests.',
  weapons = 'Among the strictest firearms laws nationally. Firearms purchaser ID card required. Carry permits now shall-issue post-Bruen 2022 but still stringent. Armed guards need employer-sponsored permit process. Assault weapons ban. 10-round magazine limit. Hollow-point restrictions. Armed security heavily regulated.',
  regulatory_agency = 'New Jersey State Police — Firearms Investigation Unit (SORA)',
  notes = 'Background check and fingerprinting required. SORA Card renewed every 2 years. Very strict firearms laws even post-Bruen. Proximity to NYC and Philadelphia creates cross-state compliance issues.',
  updated_at = NOW()
WHERE state_code = 'NJ';

-- ─── NEW MEXICO ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. Security companies may need business registration through NM Regulation and Licensing Department.',
  training_hours = 'No mandatory state training hours. Employers set own standards.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (NMSA § 30-2-7). Force justified when reasonably necessary to prevent death or great bodily harm. No duty to retreat in any place with lawful right to be. Deadly force when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony.',
  citizens_arrest = 'Permitted under NMSA § 31-4-14. May arrest for felonies in presence or with reasonable belief. Must deliver to peace officer without unnecessary delay. Only reasonable force permitted.',
  weapons = 'No permit required for open carry. Concealed Handgun License from DPS required for concealed carry. Armed guards must comply with employer requirements and state firearms laws.',
  regulatory_agency = 'New Mexico Regulation and Licensing Department (limited oversight)',
  notes = 'Minimal state regulation for unarmed guards. Proximity to Mexican border creates unique security considerations for transportation and logistics.',
  updated_at = NOW()
WHERE state_code = 'NM';

-- ─── NEW YORK ───
UPDATE state_laws SET
  licensing = 'Security Guard Registration required from NY Department of State, Division of Licensing Services. Must complete training, pass background check with fingerprinting. Registration valid 2 years.',
  training_hours = '24 hours total: 8 hours pre-assignment (NYS-approved course), plus 16 hours on-the-job training within 90 days. Annual 8-hour refresher required. Training must be NYS-approved. Armed guards require additional 47-hour firearms course.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state (NY Penal Law § 35.15). Force justified when reasonably necessary against imminent unlawful physical force. Deadly force only when facing imminent death or serious physical injury AND cannot retreat safely. Castle Doctrine (§ 35.15(2)(a)(i)) — no duty to retreat at home. NYC has additional restrictions on security guard use of force.',
  citizens_arrest = 'Permitted under NY CPL § 140.30. May arrest for offenses in presence. For felonies, may arrest when person has in fact committed felony. Deadly force may not be used to prevent escape. Must deliver to law enforcement without unnecessary delay. NY courts strictly interpret authority.',
  weapons = 'Special Armed Guard Registration from NY DOS required. NYS-approved 47-hour firearms training, written and practical exams. NY SAFE Act: assault weapons restrictions, 10-round magazine limit, universal background checks. NYC armed guards need separate NYPD permit. Very heavily regulated.',
  regulatory_agency = 'New York Department of State (DOS) — Division of Licensing Services',
  notes = 'One of most heavily regulated states. 2-year renewal with continuing education. NYS-approved training only. NYC has additional requirements beyond state (NYPD oversight for armed). SAFE Act compliance mandatory. DOS maintains online verification database.',
  updated_at = NOW()
WHERE state_code = 'NY';

-- ─── NORTH CAROLINA ───
UPDATE state_laws SET
  licensing = 'Registration required with NC Private Protective Services Board (PPSB). Companies must be licensed. Guards registered through employer. Background check with fingerprinting required.',
  training_hours = 'PPSB requires employer-provided training before assignment. Training must cover statutory authority, use of force, emergency procedures, and report writing. Armed guards require firearms qualification through PPSB-approved program.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (NCGS § 14-51.3). No duty to retreat in any place with lawful right to be. Force justified when reasonably necessary to prevent imminent death, great bodily harm, or forcible felony. Castle Doctrine (§ 14-51.2) provides presumption of reasonable fear against intruders in home, vehicle, or workplace.',
  citizens_arrest = 'Permitted under NCGS § 15A-404. May detain when probable cause to believe person committed felony, misdemeanor breach of peace, theft, or property destruction. Reasonable force permitted. Must notify law enforcement immediately.',
  weapons = 'Armed guard certification through PPSB-approved program required. Handgun purchase permit from sheriff or CHP required. CHP for concealed carry. Open carry legal without permit.',
  regulatory_agency = 'North Carolina Private Protective Services Board (PPSB)',
  notes = 'Background check and fingerprinting required. PPSB actively regulates the industry. Military installations create additional security employment.',
  updated_at = NOW()
WHERE state_code = 'NC';

-- ─── NORTH DAKOTA ───
UPDATE state_laws SET
  licensing = 'Employers must be licensed by ND Private Investigation and Security Board. Guards registered through employer. Background check required.',
  training_hours = 'No specific minimum hours for individual guards. Board requires employers ensure competency. Many employers provide 8-16 hours.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (NDCC § 12.1-05-03 through 07). Force justified when reasonably necessary to prevent imminent unlawful bodily injury. No duty to retreat. Deadly force to prevent death, serious bodily injury, or forcible felony. Castle Doctrine in dwelling and place of work.',
  citizens_arrest = 'Permitted under NDCC § 29-06-20. May arrest for public offense in presence, or felony not in presence. Must deliver to peace officer without unnecessary delay. Reasonable force only.',
  weapons = 'Constitutional carry state since August 2017 (HB 1169) for residents with valid ID. Concealed Weapons License still issued for reciprocity. Armed guards comply with employer standards.',
  regulatory_agency = 'North Dakota Private Investigation and Security Board',
  notes = 'Company licensing through Board required. Constitutional carry since 2017. Oil industry (Bakken formation) drives significant security employment in western ND.',
  updated_at = NOW()
WHERE state_code = 'ND';

-- ─── OHIO ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. Security companies must register with Ohio Department of Public Safety.',
  training_hours = 'No mandatory state training hours for unarmed guards. Employers set own standards. Ohio Peace Officer Training Commission (OPOTC) provides optional resources.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state as of April 2021 (SB 175). Previously duty-to-retreat. No duty to retreat from any place with lawful right to be. Force justified when reasonably necessary to prevent imminent death or great bodily harm. Deadly force only for death, great bodily harm, or forcible felony. Castle Doctrine (ORC § 2901.09) in residence or vehicle.',
  citizens_arrest = 'Permitted under ORC § 2935.04. May arrest for felonies in presence. Must deliver to peace officer or magistrate without unnecessary delay. More limited than many states — primarily felonies.',
  weapons = 'Constitutional carry state since June 2022 (SB 215) — no permit for concealed carry for those 21+. CHLs still issued for reciprocity. Armed guards comply with employer requirements.',
  regulatory_agency = 'Ohio Department of Public Safety (limited oversight)',
  notes = 'Minimal state regulation for individual guards. Shifted to Stand Your Ground in 2021. Constitutional carry since 2022. Cleveland, Columbus, and Cincinnati have significant security markets.',
  updated_at = NOW()
WHERE state_code = 'OH';

-- ─── OKLAHOMA ───
UPDATE state_laws SET
  licensing = 'Security Guard License required from CLEET. Background check with fingerprinting and CLEET training required. Companies must be licensed.',
  training_hours = 'CLEET-mandated phase training: Phase I (pre-assignment) covers legal authority, ethics, observation/reporting, and emergency response. Phase II within specified period. Armed guards require additional CLEET firearms training.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (21 OK Stat. § 1289.25). No duty to retreat from any place with right to be. Force justified to prevent death, great bodily harm, or forcible felony. Castle Doctrine provides presumption of reasonable fear against intruders in dwellings, vehicles, and places of business.',
  citizens_arrest = 'Permitted under 22 OK Stat. § 202. May arrest for public offense in presence, or when person has committed felony. Must deliver to peace officer without unnecessary delay.',
  weapons = 'Constitutional carry since November 2019 (SB 12) — no permit for those 21+ (18+ military). Armed guards must still have CLEET firearms certification: approved training, written exam, range qualification, annual requalification.',
  regulatory_agency = 'Oklahoma Council on Law Enforcement Education and Training (CLEET)',
  notes = 'CLEET actively regulates security industry. Constitutional carry since 2019 but CLEET still requires armed guard certification. Oil and gas industry drives significant security employment.',
  updated_at = NOW()
WHERE state_code = 'OK';

-- ─── OREGON ───
UPDATE state_laws SET
  licensing = 'No state license for unarmed guards as individuals. Companies must be certified by DPSST. Executive security officers require DPSST certification.',
  training_hours = 'No mandatory state hours for unarmed guards. DPSST requires companies to train adequately. Many employers provide 8-16 hours. Executive security officers must complete DPSST-approved program.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state (ORS § 161.209-219). Force justified when reasonably necessary against imminent physical force. Deadly force only to prevent imminent death, serious physical injury, or forcible felony AND person cannot safely retreat. Castle Doctrine (ORS § 161.219) — no duty to retreat from home.',
  citizens_arrest = 'Permitted under ORS § 133.225. May arrest for any crime in presence, or felony. Must deliver to peace officer without unnecessary delay. Reasonable force only. Specific merchant detention authority (ORS § 131.655) for shoplifting.',
  weapons = 'No permit for open carry. CHL required for concealed carry, issued by county sheriff. Measure 114 (2022) permit-to-purchase requirements enjoined by courts. Armed guards comply with employer and DPSST requirements.',
  regulatory_agency = 'Oregon Department of Public Safety Standards and Training (DPSST)',
  notes = 'Company certification through DPSST required. Individual unarmed guards not separately licensed. Portland has significant security market.',
  updated_at = NOW()
WHERE state_code = 'OR';

-- ─── PENNSYLVANIA ───
UPDATE state_laws SET
  licensing = 'No state license for unarmed guards. Act 235 certification NOT required for unarmed — only for carrying weapons on duty. Companies register as businesses.',
  training_hours = 'No state requirement for unarmed guards. Act 235 for armed guards: 40 hours classroom and range from PA State Police-approved school. Biennial requalification.',
  min_age = '18 years old (21 for Act 235)',
  use_of_force = 'Duty to Retreat in public (18 Pa.C.S. § 505). Force justified when immediately necessary against unlawful force. Must retreat before deadly force if safely possible. Castle Doctrine (§ 505(b)(2.3)) — no duty to retreat in dwelling, residence, or occupied vehicle. Deadly force to prevent death, serious bodily injury, kidnapping, or forcible sexual intercourse. 2011 Castle Doctrine expansion strengthened protections.',
  citizens_arrest = 'Permitted under common law. May arrest for felonies in presence or with probable cause. Breach of peace in presence also justifies. PA courts moderate in interpretation. Must deliver to law enforcement promptly.',
  weapons = 'Act 235 certification from PA State Police required for lethal weapons on duty. 40-hour course, written exam, range qualification. LTCF from county sheriff for concealed carry. Open carry legal without permit except Philadelphia (LTCF required). Act 235 valid 5 years with biennial requalification.',
  regulatory_agency = 'Pennsylvania State Police (Act 235 Program)',
  notes = 'Act 235 only for armed guards. Unarmed guards have no state requirements. Philadelphia has additional local requirements. Major security market with healthcare and industrial sectors.',
  updated_at = NOW()
WHERE state_code = 'PA';

-- ─── RHODE ISLAND ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed guards. No comprehensive statewide regulation. Local jurisdictions may have licensing.',
  training_hours = 'No mandatory state training hours. Employers set own standards.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state (case law — State v. Quarles). Force justified when reasonably necessary against imminent unlawful force. Must retreat before deadly force if safely possible. Castle Doctrine in dwelling — no duty to retreat from home.',
  citizens_arrest = 'Permitted under RI common law. May arrest for felonies in presence or with reasonable belief. Breach of peace in presence. Must deliver to law enforcement promptly.',
  weapons = 'Concealed carry permit required from local police chief or Attorney General. Armed guards comply with employer requirements. Relatively strict firearms regulations.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal state regulation. Small state with security needs concentrated around Providence. Cross-state work with MA and CT common.',
  updated_at = NOW()
WHERE state_code = 'RI';

-- ─── SOUTH CAROLINA ───
UPDATE state_laws SET
  licensing = 'Registration required with SLED (SC Law Enforcement Division). Companies must hold Security Company License. Guards registered through employer. Background check required.',
  training_hours = '4 hours minimum pre-assignment covering legal authority, emergency procedures, and general duties. Armed guards require additional firearms training through SLED-approved program.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (SC Code § 16-11-440). No duty to retreat anywhere with right to be. Force justified to prevent imminent death, great bodily injury, or forcible felony. Castle Doctrine (§ 16-11-440(C)) presumption of reasonable fear against intruders in dwellings, residences, and occupied vehicles.',
  citizens_arrest = 'Permitted under SC Code § 17-13-10 and § 17-13-20. May arrest for felonies or larceny in view or on immediate knowledge. Breach of peace in view. Must deliver to magistrate or officer without unnecessary delay. Merchant detention authority (§ 16-13-140) for shoplifting.',
  weapons = 'Armed guard certification through SLED-approved program required. SC adopted partial permitless carry in 2024 (open carry without permit for 18+). Armed guards must still meet SLED requirements. CWP still required for some concealed carry situations.',
  regulatory_agency = 'South Carolina Law Enforcement Division (SLED) — Regulatory Services',
  notes = 'Background check required. Renewed every 2 years. SLED actively regulates. Military installations (Fort Jackson, Parris Island, Shaw AFB) create additional security employment.',
  updated_at = NOW()
WHERE state_code = 'SC';

-- ─── SOUTH DAKOTA ───
UPDATE state_laws SET
  licensing = 'No state license required. No statewide regulatory framework.',
  training_hours = 'No mandatory state training hours. Employers solely responsible.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (SDCL § 22-18-4). No duty to retreat. Force justified when reasonably necessary to prevent imminent harm. Deadly force to prevent imminent death or great bodily harm. Castle Doctrine in occupied structures and vehicles.',
  citizens_arrest = 'Permitted under SDCL § 22-18A-26 and common law. May arrest for felonies in presence or with reasonable cause. Must deliver to law enforcement without unnecessary delay.',
  weapons = 'Constitutional carry state since July 2019 (SB 47) — no permit for concealed carry for those 18+. Enhanced Permit for reciprocity. Armed guards comply with employer requirements.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal regulation. Constitutional carry since 2019. Tourism (Mount Rushmore, Sturgis Rally) creates seasonal security demand.',
  updated_at = NOW()
WHERE state_code = 'SD';

-- ─── TENNESSEE ───
UPDATE state_laws SET
  licensing = 'Security Guard/Officer License required from Tennessee Department of Commerce and Insurance, Private Protective Services. Companies must be licensed. Individual guards must be registered. Background check required.',
  training_hours = '8 hours minimum pre-assignment training covering legal authority, emergency procedures, general duties, and report writing. Armed guards require additional firearms training through approved program. Continuing education for renewal.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (TCA § 39-11-611). No duty to retreat from any place with lawful right to be. Force justified when person reasonably believes it necessary to prevent imminent death, serious bodily injury, or forcible felony. Deadly force presumed reasonable against intruders making unlawful and forcible entry into a dwelling, residence, business, or occupied vehicle.',
  citizens_arrest = 'Permitted under TCA § 40-7-109. May arrest for public offense committed in presence, or when person has committed a felony. Must deliver to peace officer without unnecessary delay. Reasonable force permitted. Tennessee also has shopkeeper''s privilege for retail theft detention.',
  weapons = 'Tennessee adopted constitutional carry (permitless carry) in July 2021 (HB 786) for those 21+ (18+ military). Enhanced Handgun Carry Permit and Concealed Handgun Carry Permit still available for reciprocity. Armed security guards must have employer-required firearms certification and meet Department of Commerce standards.',
  regulatory_agency = 'Tennessee Department of Commerce and Insurance — Private Protective Services',
  notes = 'Background check required. License renewed annually. Tennessee actively regulates private security. Constitutional carry since 2021 but armed guard certification still required. Nashville and Memphis are major security markets.',
  updated_at = NOW()
WHERE state_code = 'TN';

-- ─── TEXAS ───
UPDATE state_laws SET
  licensing = 'Level II (Noncommissioned Security Officer) registration or higher required from Texas DPS Private Security Bureau. Must pass background check with fingerprinting and complete required training. Companies must hold Private Security Company License.',
  training_hours = '6 hours pre-assignment classroom training (Level II) covering legal authority, emergency procedures, patrol techniques, and report writing. Plus employer-provided on-the-job training. Level III (Commissioned/Armed) requires additional 30-hour firearms course. Level IV (Personal Protection Officer) requires additional training. Continuing education for renewal.',
  min_age = '18 years old (21 for Level III armed)',
  use_of_force = 'Stand Your Ground state (TX Penal Code § 9.31-9.44). No duty to retreat from any place with lawful right to be. Force justified when person reasonably believes it immediately necessary to protect against unlawful force. Deadly force justified when person reasonably believes it immediately necessary to prevent imminent death, serious bodily injury, aggravated kidnapping, murder, sexual assault, or robbery. Castle Doctrine (§ 9.32) provides strong protections in habitation, vehicle, or place of business — presumption of reasonableness against intruders.',
  citizens_arrest = 'Permitted under TX Code of Criminal Procedure Art. 14.01. May arrest for felonies or offenses against the public peace committed in view. Must deliver to peace officer without unnecessary delay. Texas also has specific shopkeeper''s privilege (TX Civil Practice & Remedies Code § 124.001) for reasonable detention of shoplifting suspects.',
  weapons = 'Level III (Commissioned Security Officer) license required for armed guards. 30-hour firearms training course from DPS-approved school, written exam, and range qualification. Must qualify with each specific firearm carried. Requalification required for renewal. Texas adopted constitutional carry (permitless carry) in September 2021 (HB 1927) for those 21+. License to Carry (LTC) still available for reciprocity.',
  regulatory_agency = 'Texas Department of Public Safety (DPS) — Private Security Bureau',
  notes = 'One of the most structured security licensing systems in the nation (Level II through IV). Background check required. Licenses renewed every 2 years. DPS Private Security Bureau actively enforces regulations. Texas is one of the largest security markets nationally. Constitutional carry since 2021 but Level III still required for armed security work.',
  updated_at = NOW()
WHERE state_code = 'TX';

-- ─── UTAH ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed security guards as individuals. Private security companies may need business licensing. Utah Bureau of Criminal Identification (BCI) oversees some armed security matters.',
  training_hours = 'No mandatory state training hours for unarmed guards. Employers set own standards. Many employers provide 8-16 hours pre-assignment. Armed guards should complete firearms qualification per employer requirements.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (Utah Code § 76-2-402). Force justified when person reasonably believes it necessary to prevent imminent death or serious bodily injury. No duty to retreat from any place with lawful right to be. Deadly force when reasonably necessary to prevent death, serious bodily injury, or forcible felony. Castle Doctrine (§ 76-2-405) applies in habitation — force including deadly force presumed reasonable against unlawful and forcible entry.',
  citizens_arrest = 'Permitted under Utah Code § 77-7-3. May arrest for public offense in presence, or felony committed though not in presence. Must deliver to peace officer without unnecessary delay. Reasonable force permitted.',
  weapons = 'Utah is a constitutional carry state since May 2021 (HB 60) — no permit required for concealed carry for those 21+. Concealed Firearm Permit (CFP) still issued for reciprocity and additional locations. Armed security guards comply with employer requirements and BCI standards.',
  regulatory_agency = 'Utah Bureau of Criminal Identification (BCI) — limited oversight for armed security',
  notes = 'Minimal state regulation for unarmed guards. Constitutional carry since 2021. Utah''s growing tech sector (Silicon Slopes) and outdoor recreation create diverse security needs. Employers bear primary training responsibility.',
  updated_at = NOW()
WHERE state_code = 'UT';

-- ─── VERMONT ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed security guards. Vermont does not regulate private security at the state level. No statewide licensing framework exists.',
  training_hours = 'No mandatory state training hours. Employers solely responsible for training.',
  min_age = '18 years old',
  use_of_force = 'Duty to Retreat state (case law — State v. Hatcher). Force justified when reasonably necessary to defend against imminent unlawful force. Must retreat before using deadly force if safely possible. Deadly force only to prevent imminent death or serious bodily injury. Castle Doctrine applies in dwelling — no duty to retreat from home. Vermont courts generally apply traditional common-law self-defense standards.',
  citizens_arrest = 'Permitted under Vermont common law and 13 V.S.A. § 7559. May arrest for felonies committed in presence or with reasonable belief. Breach of peace in presence. Must deliver to law enforcement promptly. Vermont courts apply traditional common-law standards.',
  weapons = 'Vermont was the original constitutional carry state — never required a permit for concealed carry (sometimes called "Vermont carry"). No permit needed for concealed or open carry for those legally allowed to possess firearms. Armed security guards comply with employer requirements. Vermont has relatively few firearms restrictions.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal state regulation. The original constitutional carry state. No guard licensing, registration, or mandated training. Small state with rural character. Employers set all training standards.',
  updated_at = NOW()
WHERE state_code = 'VT';

-- ─── VIRGINIA ───
UPDATE state_laws SET
  licensing = 'Registration required with Virginia DCJS (Department of Criminal Justice Services). All security officers must be registered. Companies must hold a Private Security Services Business License. Background check with fingerprinting required.',
  training_hours = '18 hours minimum entry-level training (compulsory minimum training standards set by DCJS). Covers legal authority, emergency procedures, use of force, report writing, and ethics. In-service training required for renewal. Armed guards require additional DCJS-approved firearms training (minimum 24 hours) plus range qualification.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Stand Your Ground state (VA Code § 18.2-31, case law — Commonwealth v. Sands). Force justified when person reasonably believes it necessary to prevent imminent bodily harm. No duty to retreat in public places — Virginia courts have held there is no duty to retreat (though the law is largely case-law based rather than statutory). Deadly force when reasonably necessary to prevent imminent death, serious bodily harm, or commission of a forcible felony. Castle Doctrine applies in one''s home.',
  citizens_arrest = 'Permitted under VA Code § 19.2-81. May arrest for felonies committed in presence, or when person has committed a felony. For misdemeanors, only for breach of peace in presence. Must deliver to law enforcement without unnecessary delay. Virginia courts interpret citizen''s arrest authority strictly — improper arrest can lead to civil liability.',
  weapons = 'Armed security requires DCJS-approved firearms training (minimum 24 hours), written exam, and range qualification. Must qualify with each specific firearm carried. Annual requalification required. Virginia Concealed Handgun Permit (CHP) from circuit court for concealed carry. Open carry is legal without a permit in most locations.',
  regulatory_agency = 'Virginia Department of Criminal Justice Services (DCJS)',
  notes = 'DCJS is one of the most active state regulatory bodies for private security. Compulsory minimum training standards enforced. Background check and fingerprinting required. Registration renewed every 2 years. Northern Virginia''s proximity to D.C. and federal installations creates high demand for cleared security personnel.',
  updated_at = NOW()
WHERE state_code = 'VA';

-- ─── WASHINGTON ───
UPDATE state_laws SET
  licensing = 'Security Guard License required from Washington Department of Licensing (DOL). Must complete training, pass background check with fingerprinting, and submit application. License valid for 2 years. Companies must also be licensed.',
  training_hours = '8 hours pre-assignment training required, plus additional training within first 14 days of employment. Training must cover: legal authority and limitations, emergency response, observation and reporting, safety procedures, and ethics. Armed guards require additional firearms training approved by DOL.',
  min_age = '18 years old (21 for armed)',
  use_of_force = 'Duty to Retreat state (RCW § 9A.16.020, 9A.16.050). Force justified when person reasonably believes it necessary to prevent imminent harm from unlawful force. Must retreat before using deadly force if safely possible. Deadly force justified only to prevent imminent death or serious bodily harm. Castle Doctrine applies in dwelling or place of abode — no duty to retreat from home (RCW § 9A.16.110). Washington courts apply strict "reasonable person" standard.',
  citizens_arrest = 'Permitted under RCW § 10.31.100. May arrest for felonies committed in their presence, when they have probable cause to believe person committed a felony, or for gross misdemeanors or misdemeanors committed in their presence. Must deliver to peace officer or magistrate without unnecessary delay. Washington courts require reasonable grounds for the arrest.',
  weapons = 'Armed security guard license from DOL requires additional firearms training, written exam, and range qualification. Must qualify with each firearm carried. Washington Concealed Pistol License (CPL) required for concealed carry, issued by local law enforcement. Open carry is legal without a permit in most areas. Washington passed Initiative 1639 (2018) enhancing requirements for semi-automatic rifle purchases and storage.',
  regulatory_agency = 'Washington Department of Licensing (DOL) — Security Guard Program',
  notes = 'Well-regulated state for private security. Background check and fingerprinting required. License renewed every 2 years. Governed by RCW 18.170 (Private Security Guards). DOL maintains online license verification. Seattle and tech corridor create significant security employment. I-1639 added semi-auto rifle restrictions.',
  updated_at = NOW()
WHERE state_code = 'WA';

-- ─── WEST VIRGINIA ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed security guards. West Virginia does not have a comprehensive statewide regulatory framework for private security.',
  training_hours = 'No mandatory state training hours. Employers set own standards.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (WV Code § 55-7-22). No duty to retreat from any place with lawful right to be. Force justified when person reasonably believes it necessary to prevent imminent death, serious bodily injury, or commission of a forcible felony. Castle Doctrine (§ 55-7-22(b)) applies in home or vehicle — presumption of reasonable fear against intruders.',
  citizens_arrest = 'Permitted under WV common law. May arrest for felonies in presence or with reasonable grounds. Breach of peace in presence. Must deliver to law enforcement without unnecessary delay. Reasonable force only.',
  weapons = 'West Virginia is a constitutional carry state since May 2016 (SB 347) — no permit required for concealed carry for those 21+ (18+ military). Concealed Handgun License still issued for reciprocity. Armed guards comply with employer requirements.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal state regulation. Constitutional carry since 2016. Coal, natural gas, and chemical industries drive some private security employment. Employers bear primary training responsibility.',
  updated_at = NOW()
WHERE state_code = 'WV';

-- ─── WISCONSIN ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed security guards as individuals. Wisconsin does not mandate individual guard licensing. Private detective agencies must be licensed (Wis. Stat. § 440.26) but this does not cover all security guard companies.',
  training_hours = 'No mandatory state training hours for unarmed guards. Employers set own standards. Many employers provide 8-16 hours pre-assignment.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state in practice (Wis. Stat. § 939.48). Force justified when person reasonably believes it necessary to prevent imminent unlawful interference with their person. No statutory duty to retreat, though courts may consider failure to retreat when assessing reasonableness. Deadly force when person reasonably believes it necessary to prevent imminent death or great bodily harm. Castle Doctrine (§ 939.48(1m)) provides presumption of reasonable force against intruders in dwelling, vehicle, or place of business.',
  citizens_arrest = 'Permitted under Wis. Stat. § 968.07. May arrest for felonies committed in their presence. For misdemeanors, only for breach of peace committed in their presence. Must deliver to peace officer without unnecessary delay. Reasonable force only.',
  weapons = 'Wisconsin requires a Concealed Carry Weapon (CCW) license from the Department of Justice for concealed carry. Open carry is legal without a permit. Armed security guards must comply with employer requirements. Wisconsin does not have constitutional carry. CCW requires firearms training certification.',
  regulatory_agency = 'No state-level regulatory agency specifically for security guards. Wisconsin Department of Safety and Professional Services oversees private detective licensing.',
  notes = 'Minimal state regulation for security guards. Wisconsin does NOT have constitutional carry — one of the few states that still requires a permit for concealed carry. Milwaukee and other urban areas have significant security markets. Strong union presence in state affects industry.',
  updated_at = NOW()
WHERE state_code = 'WI';

-- ─── WYOMING ───
UPDATE state_laws SET
  licensing = 'No state license required for unarmed security guards. Wyoming does not regulate private security at the state level.',
  training_hours = 'No mandatory state training hours. Employers solely responsible for training.',
  min_age = '18 years old',
  use_of_force = 'Stand Your Ground state (WS § 6-2-602). Force justified when person reasonably believes it necessary to prevent imminent death, serious bodily injury, or commission of a forcible felony. No duty to retreat from any place with lawful right to be. Castle Doctrine (§ 6-2-602(b)) applies in habitation, occupied vehicle, or place of business — presumption of reasonable fear against unlawful intruders.',
  citizens_arrest = 'Permitted under WS § 7-2-102. May arrest for felonies or misdemeanors in presence. May arrest when felony committed and reasonable cause to believe person committed it. Must deliver to peace officer without unnecessary delay. Reasonable force permitted.',
  weapons = 'Wyoming is a constitutional carry state since July 2011 — one of the earliest. No permit required for concealed carry for residents 21+ (nonresidents need a permit). Concealed Firearm Permit still issued for reciprocity. Armed guards comply with employer requirements.',
  regulatory_agency = 'No state-level regulatory agency.',
  notes = 'Minimal state regulation. One of earliest constitutional carry states (2011). Lowest population density in the continental US creates unique security challenges. Energy industry (coal, oil, natural gas, wind) drives private security employment.',
  updated_at = NOW()
WHERE state_code = 'WY';

-- ═════════════════════════════════════════════════
-- VERIFICATION
-- ═════════════════════════════════════════════════
SELECT state_code, state_name, updated_at
FROM state_laws
ORDER BY state_name;
