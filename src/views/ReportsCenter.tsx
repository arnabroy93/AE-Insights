import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  FileSpreadsheet,
  BookOpen
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FilterParams } from '../types';
import { api } from '../api';
import { generateUserGuidePdf } from '../utils/userGuidePdf';

interface ReportsCenterProps {
  filters: FilterParams;
}

export const ReportsCenter: React.FC<ReportsCenterProps> = ({ filters }) => {
  const [selectedReport, setSelectedReport] = useState<string>('executive');
  const [generating, setGenerating] = useState(false);
  const [generatingGuide, setGeneratingGuide] = useState(false);

  const handleDownloadGuide = async () => {
    setGeneratingGuide(true);
    try {
      await generateUserGuidePdf();
    } finally {
      setGeneratingGuide(false);
    }
  };

  const reportList = [
    { id: 'executive', name: '1. Executive Academic Excellence Summary', desc: 'Overall snapshot of students, batches, dropouts, attendance & closure' },
    { id: 'dropouts', name: '2. Dropout Analytics & Center Distribution', desc: 'Detailed breakdown of initial, regular, and M&E dropouts by center' },
    { id: 'exceptions', name: '3. Exception Monitoring Register', desc: 'Student exception flags across centers and trainers' },
    { id: 'closure', name: '4. Batch Closure Efficiency & Delay Analysis', desc: 'On-time closure rates and delayed batch registers' },
    { id: 'faculty', name: '5. Faculty Deployment & Workload Report', desc: 'Trainer batch allocations, student loads, and deployment index proxy' },
    { id: 'validation', name: '6. Student & Batch Validation Report', desc: 'Validation status completion and validator breakdown' },
    { id: 'attendance', name: '7. Attendance & Completion Health Report', desc: 'Running & beneficiary attendance, ILT & FM class progress' },
    { id: 'placement', name: '8. Placement Analytics Report', desc: 'Central CRD, self-placement, local, and campus placements' },
    { id: 'center', name: '9. Center Performance Comprehensive Matrix', desc: 'Aggregated center-level analytical dataset' },
    { id: 'program', name: '10. Program & Funder Distribution Report', desc: 'Multi-funder program metrics and batch coverage' },
  ];

  const generateReportPdf = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Anudip Brand Header
      doc.setFillColor(0, 140, 149); // #008C95
      doc.rect(0, 0, 210, 28, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('AE INSIGHT', 14, 11);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Academic Excellence Intelligence & Insights Platform', 14, 18);
      doc.text('Anudip Foundation | Academic Excellence Team', 14, 24);

      // Report Metadata Box
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const activeReport = reportList.find((r) => r.id === selectedReport);
      doc.text(activeReport?.name || 'Academic Excellence Report', 14, 38);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated Date: ${new Date().toLocaleString('en-IN')}`, 14, 45);
      doc.text(`Data Source: data (1).xlsx | Active Upload ID: UPL-SYSTEM`, 14, 50);
      doc.text(`Applied Filters: ${Object.keys(filters).length > 0 ? JSON.stringify(filters) : 'All Organizational Records'}`, 14, 55);

      // Fetch dynamic data based on selected report
      if (selectedReport === 'executive') {
        const data = await api.getExecutiveAnalytics(filters);
        autoTable(doc, {
          startY: 62,
          head: [['Metric', 'Reported Value', 'Calculation Basis']],
          body: [
            ['Total Students', data.kpis.total_students.toLocaleString(), 'COUNT(Enrolled student records)'],
            ['Total Trained', (data.kpis.total_trained ?? 0).toLocaleString(), 'Batch Complete · Enrolled · Final Exam >= 50'],
            ['Total Batches', data.kpis.total_batches.toLocaleString(), 'COUNT(Batch Code)'],
            ['Active (Running) Batches', data.kpis.active_batches.toLocaleString(), 'Batch Status = running'],
            ['Completed Batches', data.kpis.completed_batches.toLocaleString(), 'Batch Status = complete'],
            ['Total Dropouts', data.kpis.total_dropouts.toLocaleString(), 'Enrollment Status = dropped out'],
            ['Dropout Rate %', `${data.kpis.dropout_rate}%`, 'Dropouts / Total Students * 100'],
            ['Running Attendance %', `${data.academic_health.avg_running_attendance}%`, 'Average decimal converted to %'],
            ['ILT Completion %', `${data.academic_health.avg_ilt_completion}%`, 'Average ILT completion decimal'],
            ['Total Exceptions', data.kpis.total_exceptions.toLocaleString(), 'Exception Logic Flag = 1 (Trained cohort criteria)'],
          ],
          headStyles: { fillColor: [0, 140, 149], textColor: [255, 255, 255], fontStyle: 'bold' },
        });
      } else if (selectedReport === 'dropouts') {
        const data = await api.getDropoutAnalytics(filters);
        autoTable(doc, {
          startY: 62,
          head: [['Center Code', 'Students', 'Dropouts', 'Dropout %', 'Initial Dropout', 'Regular Dropout', 'M&E Dropout']],
          body: data.center_table.slice(0, 20).map((c: any) => [
            c.center_code,
            c.students,
            c.dropouts,
            `${c.dropout_rate}%`,
            c.initial_dropouts,
            c.regular_dropouts,
            c.me_dropouts,
          ]),
          headStyles: { fillColor: [0, 140, 149], textColor: [255, 255, 255] },
        });
      } else if (selectedReport === 'closure') {
        const data = await api.getBatchClosureAnalytics(filters);
        autoTable(doc, {
          startY: 62,
          head: [['Batch Code', 'Center', 'Program', 'Trainer', 'Planned End', 'Actual End', 'Delay Days']],
          body: data.delayed_batches.slice(0, 20).map((b: any) => [
            b.batch_code,
            b.center_code,
            b.program_name,
            b.assigned_trainers,
            b.batch_end_date || '—',
            b.batch_actual_end_date || '—',
            `+${b.delay_days} days`,
          ]),
          headStyles: { fillColor: [0, 140, 149], textColor: [255, 255, 255] },
        });
      } else {
        const data = await api.getCenterAnalytics(filters);
        autoTable(doc, {
          startY: 62,
          head: [['Center Code', 'Batches', 'Students', 'Dropouts', 'Dropout %', 'Attendance %', 'Exceptions', 'Validated']],
          body: data.slice(0, 20).map((c: any) => [
            c.center_code,
            c.total_batches,
            c.total_students,
            c.dropouts,
            `${c.dropout_rate}%`,
            `${c.avg_attendance}%`,
            c.exceptions,
            c.validated_students,
          ]),
          headStyles: { fillColor: [0, 140, 149], textColor: [255, 255, 255] },
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('AE INSIGHT | Developed by Academic Excellence Team | Anudip Foundation', 14, 290);
        doc.text(`Page ${i} of ${pageCount}`, 180, 290);
      }

      doc.save(`AE_INSIGHT_${selectedReport}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Executive Report Generation Center</h2>
          <p className="text-xs text-slate-500">
            Generate printable PDF &amp; CSV reports compliant with Anudip Foundation Academic Excellence formatting
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleDownloadGuide}
            disabled={generatingGuide}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#E6F4F5] hover:bg-[#d5edf0] text-[#005F66] border border-[#008C95]/40 disabled:opacity-50 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#008C95]" />
            <span>{generatingGuide ? 'Building Guide PDF...' : 'Download User Guide (PDF)'}</span>
          </button>

          <button
            onClick={generateReportPdf}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#008C95] hover:bg-[#00747C] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{generating ? 'Generating PDF...' : 'Export Formal PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportList.map((r) => (
          <div
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedReport === r.id
                ? 'bg-[#E6F4F5]/60 border-[#008C95] shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className={`w-4 h-4 ${selectedReport === r.id ? 'text-[#008C95]' : 'text-slate-400'}`} />
              <h3 className="text-xs font-bold text-slate-900">{r.name}</h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 pl-6">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Official Header Preview Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-800">Formal Anudip Report Header Format:</div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-700 space-y-1">
          <div className="font-bold text-[#008C95]">AE INSIGHT</div>
          <div className="text-slate-900 font-semibold">Academic Excellence Intelligence &amp; Insights Platform</div>
          <div className="text-slate-500">Anudip Foundation | Academic Excellence Team</div>
          <div className="pt-2 text-slate-400">--------------------------------------------------</div>
          <div>Report: {reportList.find((r) => r.id === selectedReport)?.name}</div>
          <div>Date: {new Date().toLocaleString('en-IN')}</div>
          <div>Grain: Operational Records · Batch Cohorts · Centers</div>
        </div>
      </div>
    </div>
  );
};
