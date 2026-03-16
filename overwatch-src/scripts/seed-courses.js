/**
 * Seed REAL Evenfall Advantage courses into Overwatch Supabase
 * Usage: node scripts/seed-courses.js
 *
 * Source: sql/MIGRATE_UNARMED_GUARD_CORE.sql,
 *         sql/CREATE_SYSTEMA_SCOUT_COURSE.sql,
 *         sql/SURVEILLANCE_DETECTION_COURSE.sql
 *
 * 1. Deletes any old/fake placeholder courses
 * 2. Inserts the 3 real Evenfall Advantage courses
 */

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Parse .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=["']?(.+?)["']?\s*$/);
  if (match) envVars[match[1]] = match[2];
}

const OW_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const OW_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
if (!OW_URL || !OW_SERVICE_KEY) {
  console.error("❌ Supabase credentials not found in .env.local");
  process.exit(1);
}

const supabase = createClient(OW_URL, OW_SERVICE_KEY);

// ── REAL courses from Evenfall Advantage SQL definitions ──────
const REAL_COURSES = [
  {
    title: "Unarmed Guard Core",
    description: "Comprehensive training program covering essential security guard competencies including radio communications, emergency medical response, threat assessment, incident command systems, cultural competency, crowd management, and legal aspects of security work. This course prepares students for professional unarmed security positions at events, venues, and facilities.",
    price: 50.00,
    duration_hours: 16,
    difficulty_level: "beginner",
    is_required: true,
    passing_score: 70,
    is_active: true,
    display_order: 1,
  },
  {
    title: "Systema Scout",
    description: "Systema Scout is a foundational, experiential training framework rooted in Systema principles. This course builds internal regulation, perceptual awareness, and self-accountability before proximity, contact, or force. The outcomes are qualitative and experiential, based on first-person awareness and observable behavioral changes. Participants can expect a noticeable change in how stress affects them in professional work and daily life. With consistent practice, many report a shift in perception, decision-making, and a growing, evolving relationship with empathy.",
    price: 50.00,
    duration_hours: 5,
    difficulty_level: "beginner",
    is_required: false,
    passing_score: 70,
    is_active: true,
    display_order: 2,
  },
  {
    title: "Advanced Surveillance & Stalking Recognition",
    description: "Master the art of detecting physical surveillance, technical monitoring, and stalking behaviors. This comprehensive course covers surveillance detection routes (SDRs), pre-attack indicators, cyber stalking, OPSEC principles, and legal reporting procedures. Designed for both security professionals and civilians concerned about personal safety.",
    price: 75.00,
    duration_hours: 14,
    difficulty_level: "intermediate",
    is_required: false,
    passing_score: 70,
    is_active: true,
    display_order: 3,
  },
];

async function main() {
  try {
    // ── Step 1: Find company ──────────────────────────────────
    console.log("🔍 Looking up company...");
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .order("created_at")
      .limit(5);

    if (!companies || companies.length === 0) {
      console.error("❌ No companies found. Register first.");
      return;
    }

    const company = companies[0];
    console.log(`   🏢 "${company.name}" (${company.id})\n`);

    // ── Step 2: Delete old/fake courses ───────────────────────
    console.log("🗑️  Cleaning up old courses...");
    const { data: existing } = await supabase
      .from("courses")
      .select("id, title")
      .eq("company_id", company.id);

    if (existing && existing.length > 0) {
      for (const c of existing) {
        console.log(`   Removing: "${c.title}"`);
      }
      const { error: delErr } = await supabase
        .from("courses")
        .delete()
        .eq("company_id", company.id);

      if (delErr) {
        console.error("   ❌ Delete error:", delErr.message);
      } else {
        console.log(`   ✅ Removed ${existing.length} old course(s)\n`);
      }
    } else {
      console.log("   No old courses to remove.\n");
    }

    // ── Step 3: Insert REAL courses ───────────────────────────
    console.log("📚 Inserting real Evenfall Advantage courses...\n");
    let inserted = 0;

    for (const course of REAL_COURSES) {
      const { error: insertErr } = await supabase.from("courses").insert({
        id: crypto.randomUUID(),
        company_id: company.id,
        title: course.title,
        description: course.description,
        price: course.price,
        duration_hours: course.duration_hours,
        difficulty_level: course.difficulty_level,
        is_required: course.is_required,
        passing_score: course.passing_score,
        is_active: course.is_active,
        display_order: course.display_order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertErr) {
        console.log(`   ❌ "${course.title}": ${insertErr.message}`);
      } else {
        const priceStr = course.price === 0 ? "FREE" : `$${course.price}`;
        console.log(`   ✅ "${course.title}" — ${priceStr} • ${course.duration_hours}h • ${course.difficulty_level}`);
        inserted++;
      }
    }

    // ── Step 4: Verify ────────────────────────────────────────
    const { data: final } = await supabase
      .from("courses")
      .select("id, title, price, is_active, display_order")
      .eq("company_id", company.id)
      .order("display_order");

    console.log(`\n🎉 Done! ${inserted} real course(s) seeded.\n`);
    console.log("📋 Course catalog:");
    (final || []).forEach((c, i) => {
      const priceStr = Number(c.price) === 0 ? "FREE" : `$${c.price}`;
      console.log(`   ${i + 1}. ${c.title} — ${priceStr} ${c.is_active ? "✅" : "❌"}`);
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
  }
}

main();
