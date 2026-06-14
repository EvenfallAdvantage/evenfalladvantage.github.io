-- ============================================================
-- OVERWATCH -- Sevier County, TN Radio Frequencies
-- Analog FM frequencies suitable for SDR testing near Seymour, TN
-- ============================================================

INSERT INTO radio_frequencies (id, name, frequency, mode, band, ctcss_dcs, description, category, state, city, county, latitude, longitude, priority, is_reference, sort_order)
VALUES
  -- Seymour Fire / EMS
  ('28c367d1-48f8-491e-8122-f00728c84140', 'Seymour VFD Dispatch', 154.310, 'FM', 'VHF-Hi', '103.5', 'Primary fire dispatch for Seymour Volunteer Fire Department', 'fire', 'TN', 'Seymour', 'Sevier', 35.890, -83.770, 1, true, 1),
  ('cf21dab6-9322-4078-bca9-165add9f8ffc', 'Seymour VFD Tactical', 155.775, 'FM', 'VHF-Hi', NULL, 'Seymour VFD secondary / tactical channel', 'fire', 'TN', 'Seymour', 'Sevier', 35.890, -83.770, 2, true, 2),
  ('ad583b9c-5410-4eb4-abe1-6b340aaf973f', 'Seymour VFD Bluff Mtn Backup', 453.4125, 'FM', 'UHF', '712', 'Backup repeater at Bluff Mountain for Seymour VFD', 'fire', 'TN', 'Seymour', 'Sevier', 35.890, -83.770, 3, true, 3),

  -- County-wide Law Enforcement
  ('9f8bd5e4-5378-43b2-8176-db670dd0aa17', 'Sevier County Sheriff Dispatch', 460.025, 'FM', 'UHF', NULL, 'Sevier County Sheriff primary dispatch (NXDN48E encrypted — analog may be heard)', 'sheriff', 'TN', NULL, 'Sevier', 35.870, -83.560, 4, true, 4),
  ('87225d42-dc4a-492b-ab1d-73568f74bd65', 'Sevier County Law 911 Interop', 460.500, 'FM', 'UHF', '100.0', 'County-wide law interop / 911 coordination', 'sheriff', 'TN', NULL, 'Sevier', 35.870, -83.560, 5, true, 5),
  ('27fc4b5b-473b-4c79-a7f8-c4e7b3d6352d', 'Sevierville Police Dispatch', 460.075, 'FM', 'UHF', NULL, 'Sevierville Police primary (may be NXDN)', 'city_pd', 'TN', 'Sevierville', 'Sevier', 35.870, -83.560, 6, true, 6),
  ('1f6a05a8-3a56-4267-8d90-233e3649d4fa', 'Pigeon Forge Police Dispatch', 460.050, 'FM', 'UHF', '100.0', 'Pigeon Forge Police analog backup', 'city_pd', 'TN', 'Pigeon Forge', 'Sevier', 35.790, -83.560, 7, true, 7),

  -- EMS
  ('57e60887-ef82-477e-ae24-a46ad7511b21', 'Sevier County EMS Dispatch', 462.950, 'FM', 'UHF', '127.3', 'Sevier County EMS ambulance dispatch', 'ems', 'TN', NULL, 'Sevier', 35.870, -83.560, 8, true, 8),
  ('ace4c2af-f64c-433a-93ce-15c7ed05c328', 'Sevier Rescue Squad A', 453.650, 'FM', 'UHF', '94.8', 'Sevier County Rescue Squad primary', 'ems', 'TN', NULL, 'Sevier', 35.870, -83.560, 9, true, 9),
  ('859ccb3c-59b2-4fda-a2a0-c8f0d8fd8b2c', 'Sevier Rescue Squad B', 451.850, 'FM', 'UHF', '346', 'Sevier County Rescue Squad secondary', 'ems', 'TN', NULL, 'Sevier', 35.870, -83.560, 10, true, 10),
  ('8b4b307c-693f-4749-92ab-6db4c897cdc2', 'Fort Sanders Sevier ER', 463.000, 'FM', 'UHF', '127.3', 'Fort Sanders Sevier Medical Center hospital link', 'ems', 'TN', 'Sevierville', 'Sevier', 35.870, -83.560, 11, true, 11),
  ('5f56ebe3-d596-4e11-9b1f-1c3b632e3b90', 'MedComm', 155.205, 'FM', 'VHF-Hi', '100.0', 'Regional medical communications', 'ems', 'TN', NULL, 'Sevier', 35.870, -83.560, 12, true, 12),
  ('a1e2ea37-9178-4577-b6eb-9d401cc3464b', 'EMS HEAR Net', 155.340, 'FM', 'VHF-Hi', '100.0', 'National EMS HEAR (Hospital Emergency Administrative Radio) network', 'ems', 'TN', NULL, 'Sevier', 35.870, -83.560, 13, true, 13),
  ('9e972e6b-61ae-4890-9f81-d8cb891baa68', 'UT Medical Center Ops', 155.295, 'FM', 'VHF-Hi', '229.1', 'UT Medical Center emergency operations / mass casualty', 'ems', 'TN', 'Knoxville', 'Knox', 35.900, -83.940, 14, true, 14),
  ('2bad8f61-6a94-4e00-a31c-cd8a54c61c60', 'Lifestar Helicopter 1/2', 453.500, 'FM', 'UHF', NULL, 'Lifestar aeromedical helicopter CH 1/2', 'ems', 'TN', NULL, NULL, 35.870, -83.560, 15, true, 15),
  ('e93994a5-6aea-4aa9-839c-77762d1e005e', 'Lifestar Helicopter 3', 453.450, 'FM', 'UHF', NULL, 'Lifestar aeromedical helicopter CH 3', 'ems', 'TN', NULL, NULL, 35.870, -83.560, 16, true, 16),

  -- Fire Departments (County-wide)
  ('39df1510-ea9d-4ddb-bb83-1c42fd4a37b9', 'Sevierville Fire Dispatch', 451.400, 'FM', 'UHF', '136.5', 'Sevierville Fire Department paging/dispatch', 'fire', 'TN', 'Sevierville', 'Sevier', 35.870, -83.560, 17, true, 17),
  ('e11c7bea-e749-4e22-b6eb-bdfe8a53211e', 'Sevierville Fire Ops', 460.2875, 'FM', 'UHF', '179.9', 'Sevierville Fire operations channel', 'fire', 'TN', 'Sevierville', 'Sevier', 35.870, -83.560, 18, true, 18),
  ('25fdc006-9897-4595-b3e1-cf4ed2969a26', 'Gatlinburg Fire Dispatch', 453.850, 'FM', 'UHF', '100.0', 'Gatlinburg Fire CH 1 analog', 'fire', 'TN', 'Gatlinburg', 'Sevier', 35.720, -83.510, 19, true, 19),
  ('00492c1e-6cff-4c8d-bfc6-ad0838988b40', 'Gatlinburg Fire Tac 2', 458.300, 'FM', 'UHF', '100.0', 'Gatlinburg Fire tactical CH 2', 'fire', 'TN', 'Gatlinburg', 'Sevier', 35.720, -83.510, 20, true, 20),
  ('448819c4-234a-48af-9677-d9bd4cd56cbd', 'Gatlinburg Fire Tac 3', 453.550, 'FM', 'UHF', '100.0', 'Gatlinburg Fire tactical CH 3', 'fire', 'TN', 'Gatlinburg', 'Sevier', 35.720, -83.510, 21, true, 21),
  ('7fe26f70-0eb4-47e8-a22c-63c3d2e84912', 'Northview-Kodak Fire Dispatch', 154.445, 'FM', 'VHF-Hi', '073', 'Northview-Kodak Volunteer Fire Department dispatch', 'fire', 'TN', 'Kodak', 'Sevier', 35.940, -83.630, 22, true, 22),
  ('097b2247-b289-44fb-9103-2a845e41e6b5', 'English Mountain Fire Tac', 453.125, 'FM', 'UHF', '100.0', 'English Mountain Fire tactical operations', 'fire', 'TN', NULL, 'Sevier', 35.870, -83.560, 23, true, 23),
  ('71eca4a4-e1d0-4259-acf1-ebebd3449092', 'Waldens Creek Fire Tac', 154.250, 'FM', 'VHF-Hi', NULL, 'Waldens Creek Volunteer Fire tactical', 'fire', 'TN', NULL, 'Sevier', 35.870, -83.560, 24, true, 24),
  ('fa8eea4f-4375-427b-8271-50c7b48d89cd', 'Wears Valley Fire Tac', 154.175, 'FM', 'VHF-Hi', NULL, 'Wears Valley Volunteer Fire tactical', 'fire', 'TN', NULL, 'Sevier', 35.810, -83.620, 25, true, 25),

  -- Emergency Management
  ('a3d4e5f6-1111-2222-3333-444455556666', 'Sevier Co EMA Primary', 155.6925, 'FM', 'VHF-Hi', '127.3', 'Sevier County Emergency Management Agency primary', 'emergency_management', 'TN', NULL, 'Sevier', 35.870, -83.560, 26, true, 26),
  ('b3d4e5f6-1111-2222-3333-444455556667', 'Sevier Co EMA UHF Backup', 453.875, 'FM', 'UHF', '073', 'Sevier County EMA UHF backup repeater', 'emergency_management', 'TN', NULL, 'Sevier', 35.870, -83.560, 27, true, 27),

  -- State Agencies
  ('c3d4e5f6-1111-2222-3333-444455556668', 'TBI CH 1', 460.525, 'FM', 'UHF', NULL, 'Tennessee Bureau of Investigation primary', 'state_police', 'TN', NULL, NULL, 35.517, -86.580, 28, true, 28),
  ('d3d4e5f6-1111-2222-3333-444455556669', 'TBI CH 2', 460.550, 'FM', 'UHF', NULL, 'Tennessee Bureau of Investigation secondary', 'state_police', 'TN', NULL, NULL, 35.517, -86.580, 29, true, 29),
  ('e3d4e5f6-1111-2222-3333-444455556670', 'TN Game Warden Dispatch', 159.300, 'FM', 'VHF-Hi', NULL, 'Tennessee Wildlife Resources Agency game wardens (P25 — analog may be heard)', 'state_police', 'TN', NULL, NULL, 35.517, -86.580, 30, true, 30),
  ('f3d4e5f6-1111-2222-3333-444455556671', 'TN Forestry Greentop', 159.330, 'FM', 'VHF-Hi', NULL, 'Tennessee Division of Forestry Greentop repeater', 'fire', 'TN', NULL, NULL, 35.517, -86.580, 31, true, 31),
  ('a4d4e5f6-1111-2222-3333-444455556672', 'TN Forestry English Mtn', 159.435, 'FM', 'VHF-Hi', NULL, 'Tennessee Division of Forestry English Mountain repeater', 'fire', 'TN', NULL, 'Cocke', 35.517, -86.580, 32, true, 32),

  -- Public Works / Other
  ('b4d4e5f6-1111-2222-3333-444455556673', 'Sevier Co Road Dept', 156.195, 'FM', 'VHF-Hi', NULL, 'Sevier County Road Department operations (good for road condition info)', 'custom', 'TN', NULL, 'Sevier', 35.870, -83.560, 33, true, 33),

  -- Weather / Ham (always active for testing)
  ('c4d4e5f6-1111-2222-3333-444455556674', 'NOAA Weather Radio Knoxville', 162.475, 'FM', 'WX', NULL, 'NOAA Weather Radio station WXK46 — continuous weather broadcasts, great for SDR testing', 'custom', 'TN', 'Knoxville', NULL, 35.960, -83.920, 34, true, 34),
  ('d4d4e5f6-1111-2222-3333-444455556675', 'Sevier Skywarn Repeater', 146.940, 'FM', 'VHF-Hi', NULL, 'Sevier County Amateur Radio Skywarn weather repeater', 'custom', 'TN', NULL, 'Sevier', 35.870, -83.560, 35, true, 35)
ON CONFLICT (id) DO NOTHING;
