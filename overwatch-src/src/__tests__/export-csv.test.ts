import { describe, it, expect } from "vitest";
import { parseCSV, validateStaffRows } from "@/lib/csv-import";

// Note: exportCSV triggers a browser download (Blob + anchor click), so we
// test the CSV *import* parser thoroughly and the export escaping logic
// indirectly via round-trip tests where possible.

describe("parseCSV", () => {
  it("parses basic CSV with headers and rows", () => {
    const text = "Name,Age,City\nAlice,30,Denver\nBob,25,Austin";
    const result = parseCSV(text);
    expect(result.headers).toEqual(["name", "age", "city"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ name: "Alice", age: "30", city: "Denver" });
    expect(result.rows[1]).toEqual({ name: "Bob", age: "25", city: "Austin" });
    expect(result.errors).toHaveLength(0);
  });

  it("returns error for empty input", () => {
    const result = parseCSV("");
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe("Empty file");
  });

  it("lowercases and underscores header names", () => {
    const text = "First Name,Last Name\nJohn,Doe";
    const result = parseCSV(text);
    expect(result.headers).toEqual(["first_name", "last_name"]);
    expect(result.rows[0]).toEqual({ first_name: "John", last_name: "Doe" });
  });

  it("handles quoted fields with commas", () => {
    const text = 'Name,Note\nAlice,"Hello, World"';
    const result = parseCSV(text);
    expect(result.rows[0].note).toBe("Hello, World");
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const text = 'Name,Quote\nBob,"He said ""hello"""';
    const result = parseCSV(text);
    expect(result.rows[0].quote).toBe('He said "hello"');
  });

  it("reports error for mismatched field count", () => {
    const text = "A,B,C\n1,2\n4,5,6";
    const result = parseCSV(text);
    // First data row has 2 fields instead of 3 → error
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ a: "4", b: "5", c: "6" });
  });

  it("handles Windows-style CRLF line endings", () => {
    const text = "X,Y\r\n1,2\r\n3,4";
    const result = parseCSV(text);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ x: "1", y: "2" });
  });

  it("skips blank lines", () => {
    const text = "A,B\n1,2\n\n3,4\n\n";
    const result = parseCSV(text);
    expect(result.rows).toHaveLength(2);
  });

  it("handles header-only CSV (no data rows)", () => {
    const text = "Name,Email";
    const result = parseCSV(text);
    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("handles single column CSV", () => {
    const text = "Value\n10\n20\n30";
    const result = parseCSV(text);
    expect(result.headers).toEqual(["value"]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[2]).toEqual({ value: "30" });
  });
});

describe("validateStaffRows", () => {
  it("validates correct rows", () => {
    const rows = [
      { first_name: "Jane", last_name: "Doe", email: "jane@test.com", role: "staff" },
    ];
    const { valid, errors } = validateStaffRows(rows);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(valid[0].email).toBe("jane@test.com");
  });

  it("rejects rows with missing first_name", () => {
    const rows = [{ first_name: "", last_name: "Doe", email: "j@t.com" }];
    const { valid, errors } = validateStaffRows(rows);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("first_name");
  });

  it("rejects rows with missing last_name", () => {
    const rows = [{ first_name: "Jane", last_name: "", email: "j@t.com" }];
    const { valid, errors } = validateStaffRows(rows);
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("last_name");
  });

  it("rejects invalid email", () => {
    const rows = [{ first_name: "Jane", last_name: "Doe", email: "not-an-email" }];
    const { valid, errors } = validateStaffRows(rows);
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("email");
  });

  it("detects duplicate emails", () => {
    const rows = [
      { first_name: "Jane", last_name: "Doe", email: "jane@test.com" },
      { first_name: "John", last_name: "Doe", email: "JANE@test.com" },
    ];
    const { valid, errors } = validateStaffRows(rows);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Duplicate");
  });

  it("rejects invalid role", () => {
    const rows = [
      { first_name: "Jane", last_name: "Doe", email: "j@t.com", role: "king" },
    ];
    const { valid, errors } = validateStaffRows(rows);
    expect(valid).toHaveLength(0);
    expect(errors[0].message).toContain("Invalid role");
  });

  it("defaults role to 'staff' when not provided", () => {
    const rows = [{ first_name: "Jane", last_name: "Doe", email: "j@t.com" }];
    const { valid } = validateStaffRows(rows);
    expect(valid[0].role).toBe("staff");
  });

  it("trims whitespace from fields", () => {
    const rows = [
      { first_name: "  Jane  ", last_name: " Doe ", email: "  jane@test.com  " },
    ];
    const { valid } = validateStaffRows(rows);
    expect(valid[0].first_name).toBe("Jane");
    expect(valid[0].last_name).toBe("Doe");
    expect(valid[0].email).toBe("jane@test.com");
  });
});
