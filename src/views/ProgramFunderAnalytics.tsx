import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  BookOpen,
  Users,
  ChevronRight,
  ChevronDown,
  Award,
  DollarSign
} from 'lucide-react';
import { api } from '../api';
import { SourceRow } from '../types';

interface ProgramFunderAnalyticsProps {
  onSelectRecord: (record: SourceRow) => void;
}

export const ProgramFunderAnalytics: React.FC<ProgramFunderAnalyticsProps> = ({ onSelectRecord }) => {
  const [hierarchyData, setHierarchyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFunders, setExpandedFunders] = useState<Record<string, boolean>>({});
  const [expandedPrograms, setExpandedPrograms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    setLoading(true);
    try {
      const data = await api.getRecords({}, 1, 500);
      // Group by funder -> program -> center -> batch
      const fundersMap: Record<string, any> = {};

      data.records.forEach((r: SourceRow) => {
        const funder = r.funder_name || 'Unassigned Funder';
        const prog = r.program_name || 'Unassigned Program';
        const center = r.center_code || 'Unassigned Center';
        const batch = r.batch_code || 'Unassigned Batch';

        if (!fundersMap[funder]) {
          fundersMap[funder] = {
            name: funder,
            students: new Set<string>(),
            batches: new Set<string>(),
            dropouts: new Set<string>(),
            programs: {},
          };
        }

        fundersMap[funder].students.add(r.student_code);
        fundersMap[funder].batches.add(r.batch_code);
        if (r.enrollment_status === 'dropped out') {
          fundersMap[funder].dropouts.add(r.student_code);
        }

        if (!fundersMap[funder].programs[prog]) {
          fundersMap[funder].programs[prog] = {
            name: prog,
            students: new Set<string>(),
            batches: new Set<string>(),
            dropouts: new Set<string>(),
            centers: new Set<string>(),
          };
        }

        fundersMap[funder].programs[prog].students.add(r.student_code);
        fundersMap[funder].programs[prog].batches.add(r.batch_code);
        fundersMap[funder].programs[prog].centers.add(r.center_code);
        if (r.enrollment_status === 'dropped out') {
          fundersMap[funder].programs[prog].dropouts.add(r.student_code);
        }
      });

      const structured = Object.values(fundersMap).map((f: any) => ({
        name: f.name,
        total_students: f.students.size,
        total_batches: f.batches.size,
        total_dropouts: f.dropouts.size,
        dropout_rate: f.students.size > 0 ? ((f.dropouts.size / f.students.size) * 100).toFixed(1) : '0.0',
        programs: Object.values(f.programs).map((p: any) => ({
          name: p.name,
          total_students: p.students.size,
          total_batches: p.batches.size,
          total_dropouts: p.dropouts.size,
          total_centers: p.centers.size,
          dropout_rate: p.students.size > 0 ? ((p.dropouts.size / p.students.size) * 100).toFixed(1) : '0.0',
        }))
      }));

      setHierarchyData(structured);
      if (structured.length > 0) {
        setExpandedFunders({ [structured[0].name]: true });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFunder = (name: string) => {
    setExpandedFunders((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleProgram = (name: string) => {
    setExpandedPrograms((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-[#008C95] border-t-transparent rounded-full mx-auto mb-2" />
        Building Program &amp; Funder Hierarchy...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-[#008C95]" />
          <h2 className="text-base font-bold text-slate-900">
            Funder &amp; Program Hierarchy (Drill-down Explorer)
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Organization Hierarchy: Funder → Program → Centers → Batches → Students. Expand any funder to analyze program allocations.
        </p>
      </div>

      {/* Funder Accordions */}
      <div className="space-y-3">
        {hierarchyData.map((funder) => {
          const isExpanded = !!expandedFunders[funder.name];
          return (
            <div key={funder.name} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              {/* Funder Header Bar */}
              <div
                onClick={() => toggleFunder(funder.name)}
                className="p-4 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-[#008C95]/10 text-[#008C95] rounded-lg">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{funder.name}</h3>
                    <span className="text-[11px] text-slate-500">
                      {funder.programs.length} Active Programs
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Batches</span>
                    <div className="font-mono font-bold text-slate-800">{funder.total_batches}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Students</span>
                    <div className="font-mono font-bold text-slate-900">{funder.total_students.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Dropout %</span>
                    <div className="font-mono font-bold text-rose-600">{funder.dropout_rate}%</div>
                  </div>
                </div>
              </div>

              {/* Nested Programs Table */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-200/60 bg-white">
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Program Name</th>
                          <th className="px-4 py-2.5 text-right">Centers</th>
                          <th className="px-4 py-2.5 text-right">Batches</th>
                          <th className="px-4 py-2.5 text-right">Students</th>
                          <th className="px-4 py-2.5 text-right">Dropouts</th>
                          <th className="px-4 py-2.5 text-right">Dropout %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {funder.programs.map((prog: any) => (
                          <tr key={prog.name} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{prog.name}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{prog.total_centers}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{prog.total_batches}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{prog.total_students.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-rose-600">{prog.total_dropouts}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{prog.dropout_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
