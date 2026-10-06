// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  getLegacyClasses: vi.fn(), createLegacyClass: vi.fn(), updateLegacyClass: vi.fn(),
  getClassEnrollments: vi.fn(), markAttendance: vi.fn(), getClassAttendance: vi.fn(),
  getLegacyAssessmentQuestions: vi.fn(), saveLegacyAssessmentQuestions: vi.fn(),
  getLegacyAssessments: vi.fn(), getLegacyModules: vi.fn(), createLegacyAssessment: vi.fn(),
  updateLegacyAssessment: vi.fn(), deleteLegacyAssessment: vi.fn(),
}));

vi.mock("@/lib/legacy-bridge", async () => {
  const classes = await vi.importActual<typeof import("@/lib/legacy/classes")>("@/lib/legacy/classes");
  const assessments = await vi.importActual<typeof import("@/lib/legacy/assessments")>("@/lib/legacy/assessments");
  return { ...api, LEGACY_CLASS_TYPES: classes.LEGACY_CLASS_TYPES, validateLegacyQuestions: assessments.validateLegacyQuestions };
});
vi.mock("@/lib/legacy/client", () => ({ getLegacyClient: () => ({}) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/stores/auth-store", () => ({ useAuthStore: { getState: () => ({}) } }));

import { ClassesTab } from "@/app/admin/instructor/components/classes-tab";
import { QuestionsEditor } from "@/app/admin/instructor/components/questions-editor";
import { AssessmentsTab } from "@/app/admin/instructor/components/assessments-tab";

const alertSpy = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("alert", alertSpy);
  api.getLegacyClasses.mockResolvedValue([]);
});

describe("ClassesTab create", () => {
  async function fillAndCreate() {
    render(<ClassesTab instructorId="i-1" triggerNew={1} />);
    await screen.findByText("Schedule New Class");
    fireEvent.change(screen.getByPlaceholderText("Class Name *"), { target: { value: "Night shift" } });
    fireEvent.change(screen.getByLabelText("Class type"), { target: { value: "scenario" } });
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
  }

  it("sends class_type and reloads on success", async () => {
    api.createLegacyClass.mockResolvedValue({ success: true, id: "c-1" });
    await fillAndCreate();
    await waitFor(() => expect(api.createLegacyClass).toHaveBeenCalledWith(expect.objectContaining({ class_type: "scenario", class_name: "Night shift" })));
    await waitFor(() => expect(api.getLegacyClasses).toHaveBeenCalledTimes(2));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the form open when the save fails (it used to close silently)", async () => {
    api.createLegacyClass.mockResolvedValue({ success: false, error: "write_failed" });
    await fillAndCreate();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't create the class: write_failed."));
    expect(screen.getByText("Schedule New Class")).toBeDefined();
  });
});

describe("QuestionsEditor", () => {
  it("validates, then saves the questions", async () => {
    api.getLegacyAssessmentQuestions.mockResolvedValue({ success: true, questions: [] });
    api.saveLegacyAssessmentQuestions.mockResolvedValue({ success: true });
    const onSaved = vi.fn();
    render(<QuestionsEditor assessmentId="a-1" assessmentName="Radio" onClose={() => {}} onSaved={onSaved} />);
    await screen.findByLabelText("Question 1");

    fireEvent.click(screen.getByRole("button", { name: /save questions/i }));
    expect(await screen.findByText("Question 1 has no text.")).toBeDefined();
    expect(api.saveLegacyAssessmentQuestions).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Question 1"), { target: { value: "Which channel is emergencies?" } });
    ["Ch 1", "Ch 2", "Ch 9", "Ch 16"].forEach((v, k) =>
      fireEvent.change(screen.getByLabelText(`Question 1 answer ${"ABCD"[k]}`), { target: { value: v } }));
    fireEvent.click(screen.getByLabelText("Answer C is correct"));
    fireEvent.click(screen.getByRole("button", { name: /save questions/i }));

    await waitFor(() => expect(api.saveLegacyAssessmentQuestions).toHaveBeenCalledWith("a-1", [
      { question: "Which channel is emergencies?", options: ["Ch 1", "Ch 2", "Ch 9", "Ch 16"], correctAnswer: 2, explanation: "" },
    ]));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("loads existing questions and can add another", async () => {
    api.getLegacyAssessmentQuestions.mockResolvedValue({ success: true, questions: [
      { question: "Q1", options: ["a", "b", "c", "d"], correctAnswer: 1 },
    ] });
    render(<QuestionsEditor assessmentId="a-2" assessmentName="X" onClose={() => {}} onSaved={() => {}} />);
    expect(((await screen.findByLabelText("Question 1")) as HTMLInputElement).value).toBe("Q1");
    expect((screen.getByLabelText("Answer B is correct") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /add question/i }));
    expect(screen.getByLabelText("Question 2")).toBeDefined();
  });
});

describe("AssessmentsTab delete", () => {
  const A = { id: "a-9", assessment_name: "Old quiz", module_id: "m-1", total_questions: 10, passing_score: 70 };
  beforeEach(() => {
    api.getLegacyAssessments.mockResolvedValue([A]);
    api.getLegacyModules.mockResolvedValue([{ id: "m-1", module_name: "Radio Basics" }]);
  });

  async function clickDeleteAndConfirm() {
    render(<AssessmentsTab triggerNew={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete assessment" }));
    expect(await screen.findByText(/Students on the "Radio Basics" module will no longer get this quiz/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  }

  it("deletes after confirm and reloads the list", async () => {
    api.deleteLegacyAssessment.mockResolvedValue({ success: true });
    await clickDeleteAndConfirm();
    await waitFor(() => expect(api.deleteLegacyAssessment).toHaveBeenCalledWith("a-9"));
    await waitFor(() => expect(api.getLegacyAssessments).toHaveBeenCalledTimes(2));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows why when students have already taken it", async () => {
    api.deleteLegacyAssessment.mockResolvedValue({ success: false, error: "assessment_in_use" });
    await clickDeleteAndConfirm();
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/^Couldn't delete the assessment: students have already taken it/)));
    expect(api.getLegacyAssessments).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the confirm is cancelled", async () => {
    render(<AssessmentsTab triggerNew={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete assessment" }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText("Delete assessment?")).toBeNull());
    expect(api.deleteLegacyAssessment).not.toHaveBeenCalled();
  });
});
