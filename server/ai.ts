import { GoogleGenAI } from '@google/genai';
import { getExecutiveAnalytics, getDropoutAnalytics, getExceptionAnalytics, getBatchClosureAnalytics, getFacultyAnalytics, getStudentValidationAnalytics, getAttendanceAnalytics, getPlacementAnalytics, getCenterAnalytics } from './db.ts';
import type { FilterParams } from './types.ts';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  genAIClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
  return genAIClient;
}

export async function askAeInsight(query: string, filters: FilterParams = {}) {
  // Retrieve verified ground-truth data from the live database
  const [
    exec,
    dropouts,
    exceptions,
    closure,
    faculty,
    validation,
    attendance,
    placement,
    centers
  ] = await Promise.all([
    getExecutiveAnalytics(filters),
    getDropoutAnalytics(filters),
    getExceptionAnalytics(filters),
    getBatchClosureAnalytics(filters),
    getFacultyAnalytics(filters),
    getStudentValidationAnalytics(filters),
    getAttendanceAnalytics(filters),
    getPlacementAnalytics(filters),
    getCenterAnalytics(filters)
  ]);

  const groundTruthContext = {
    executive_summary: exec.kpis,
    academic_health: exec.academic_health,
    attention_areas: exec.attention_areas,
    batch_closure: closure.kpis,
    delayed_batches_sample: closure.delayed_batches.slice(0, 5),
    dropout_kpis: dropouts.kpis,
    dropout_by_program: dropouts.by_program.slice(0, 5),
    exceptions: exceptions.kpis,
    faculty_deployment: faculty.kpis,
    top_trainers: faculty.trainers.slice(0, 5),
    student_validation: validation.kpis,
    attendance_and_completion: attendance.kpis,
    placement: placement.kpis,
    top_centers: centers.slice(0, 8),
  };

  const ai = getGenAI();

  if (!ai) {
    // Return precise rule-grounded response if Gemini key is not configured in local dev
    return generateDeterministicAnswer(query, groundTruthContext);
  }

  const systemInstruction = `
You are the AE INSIGHT Analytical Engine for the Academic Excellence Team at Anudip Foundation.
Tagline: "Turning Academic Data into Actionable Insights".

CRITICAL AI SAFETY & PRECISION RULES:
1. Ground every answer strictly in the provided GROUND TRUTH DATABASE METRICS.
2. NEVER invent numbers, percentages, students, batches, trainers, centers, trends, or exceptions.
3. If data is unavailable, state: "The uploaded dataset does not contain sufficient information to calculate this metric."
4. ALWAYS explain the calculation basis (e.g. "There are X students marked as dropped out out of Y identifiable distinct students in the current dataset.").
5. Use distinct counting principles (Students = COUNT(DISTINCT student_code), Batches = COUNT(DISTINCT batch_code)).
6. Format your output with clear markdown headings, bullet points, and data tables where helpful.
7. Mention relevant centers, programs, trainers, or batches specifically when answering.
`;

  try {
    const prompt = `
USER QUERY:
${query}

GROUND TRUTH DATABASE METRICS (LIVE REAL-TIME DATA):
${JSON.stringify(groundTruthContext, null, 2)}

Please answer the user query clearly, citing the exact figures, distinct denominators, and actionable operational insights for the Academic Excellence team.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for high precision & zero hallucination
      }
    });

    return {
      answer: response.text || 'Unable to generate response from the model.',
      groundTruthContext,
      status: 'success'
    };
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    // Fallback to deterministic grounded generator
    return generateDeterministicAnswer(query, groundTruthContext);
  }
}

function generateDeterministicAnswer(query: string, ctx: any) {
  const q = query.toLowerCase();
  let answer = '';

  if (q.includes('dropout') || q.includes('drop out')) {
    answer = `### 📊 Dropout Analytics Summary\n\n` +
      `* **Total Distinct Students:** ${ctx.executive_summary.total_students.toLocaleString()}\n` +
      `* **Total Dropouts:** ${ctx.dropout_kpis.total_dropouts.toLocaleString()} students\n` +
      `* **Overall Dropout Rate:** **${ctx.dropout_kpis.dropout_rate}%** *(Calculated as: ${ctx.dropout_kpis.total_dropouts} dropped out / ${ctx.executive_summary.total_students} total students × 100)*\n\n` +
      `#### Dropout Type Breakdown:\n` +
      `* **Initial Session Dropout:** ${ctx.dropout_kpis.initial_session_dropouts.toLocaleString()} students\n` +
      `* **Regular Session Dropout:** ${ctx.dropout_kpis.regular_session_dropouts.toLocaleString()} students\n` +
      `* **M&E Dropout:** ${ctx.dropout_kpis.me_dropouts.toLocaleString()} students\n\n` +
      `#### Top Centers by Dropout Volume:\n` +
      ctx.top_centers.slice(0, 4).map((c: any) => `* **${c.center_code}:** ${c.dropouts} dropouts (${c.dropout_rate}% of ${c.total_students} students across ${c.total_batches} batches)`).join('\n');
  } else if (q.includes('delay') || q.includes('closure') || q.includes('batch')) {
    answer = `### ⏱️ Batch Closure & Delay Analysis\n\n` +
      `* **Total Batches:** ${ctx.batch_closure.total_batches}\n` +
      `* **Active / Running Batches:** ${ctx.batch_closure.running_batches}\n` +
      `* **Completed Batches:** ${ctx.batch_closure.completed_batches}\n` +
      `* **On-Time Closure Rate:** **${ctx.batch_closure.on_time_closure_pct}%** *(Based on ${ctx.batch_closure.on_time_batches} on-time batches out of ${ctx.batch_closure.eligible_completed_batches} completed batches with end dates)*\n` +
      `* **Delayed Batches Identified:** **${ctx.batch_closure.delayed_batches_count}**\n\n` +
      (ctx.delayed_batches_sample.length > 0
        ? `#### Highest Delayed Batches:\n` +
          ctx.delayed_batches_sample.map((b: any) => `* **${b.batch_code}** (${b.center_code} - ${b.program_name}): **+${b.delay_days} days delay** (Planned: ${b.batch_end_date}, Actual: ${b.batch_actual_end_date})`).join('\n')
        : '');
  } else if (q.includes('trainer') || q.includes('faculty') || q.includes('workload')) {
    answer = `### 👨‍🏫 Faculty Deployment & Workload Summary\n\n` +
      `* **Total Faculty/Trainers:** ${ctx.faculty_deployment.total_trainers}\n` +
      `* **Trainers on Active Batches:** ${ctx.faculty_deployment.trainers_assigned_active_batches}\n` +
      `* **Trainers Handling Multiple Active Batches:** ${ctx.faculty_deployment.trainers_multiple_active_batches}\n` +
      `* **Average Active Batches per Trainer:** ${ctx.faculty_deployment.avg_active_batches_per_trainer}\n` +
      `* **Average Students per Active Trainer:** ${ctx.faculty_deployment.avg_students_per_active_trainer}\n\n` +
      `> *Note: Faculty Deployment Index is an analytical proxy based on available batch and student allocation data. It is not a calculation of actual working-hour utilisation.*`;
  } else if (q.includes('exception')) {
    answer = `### ⚠️ Exception Monitoring Report\n\n` +
      `* **Total Exceptions:** **${ctx.exceptions.total_exceptions}** records\n` +
      `* **Exception Rate:** **${ctx.exceptions.exception_rate}%** *(Calculated as: ${ctx.exceptions.total_exceptions} exceptions / ${ctx.exceptions.total_records} applicable students × 100)*\n` +
      `* **Criteria Evaluated:** Trained candidates (Batch Complete, Enrolled, Final Exam Marks >= 50) non-compliant with ILT completion & attendance thresholds based on placement category. Candidates with Special Approval have 0 exceptions.`;
  } else if (q.includes('validation')) {
    answer = `### 📋 Student & Batch Validation Status\n\n` +
      `* **Validated Students:** ${ctx.student_validation.validated_students}\n` +
      `* **ReValidated Students:** ${ctx.student_validation.revalidated_students}\n` +
      `* **Pending Students:** ${ctx.student_validation.pending_students}\n` +
      `* **Validation Completion Rate:** **${ctx.student_validation.validation_completion_pct}%** *(Calculated as: (${ctx.student_validation.validated_students} + ${ctx.student_validation.revalidated_students}) / ${ctx.student_validation.students_with_validation_status} students with validation status × 100)*`;
  } else {
    answer = `### 🎯 Academic Excellence Executive Snapshot\n\n` +
      `* **Total Students:** ${ctx.executive_summary.total_students.toLocaleString()} distinct students\n` +
      `* **Total Batches:** ${ctx.executive_summary.total_batches} (${ctx.executive_summary.active_batches} running, ${ctx.executive_summary.completed_batches} completed, ${ctx.executive_summary.hold_batches} on hold)\n` +
      `* **Total Centers:** ${ctx.executive_summary.total_centers} centers\n` +
      `* **Overall Dropout Rate:** **${ctx.executive_summary.dropout_rate}%** (${ctx.executive_summary.total_dropouts} students)\n` +
      `* **Average Running Attendance:** **${ctx.academic_health.avg_running_attendance}%**\n` +
      `* **Average ILT Completion:** **${ctx.academic_health.avg_ilt_completion}%**\n` +
      `* **Attention Areas:** ${ctx.attention_areas.pending_validation_count} pending validations, ${ctx.attention_areas.delayed_batches_count} delayed batches, ${ctx.attention_areas.exceptions_count} exception flags.`;
  }

  return {
    answer,
    groundTruthContext: ctx,
    status: 'success'
  };
}
