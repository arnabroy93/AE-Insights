import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type GuideScreenshotId =
  | 'main_layout'
  | 'filters_bar'
  | 'student_dashboards'
  | 'batch_dashboards'
  | 'hiring_challenges'
  | 'presentation_mode'
  | 'drilldown_export'
  | 'admin_portal';

export interface GuideSection {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  screenshotId: GuideScreenshotId;
  screenshotCaption: string;
  whatIsIt: string;
  callouts: { badge: string; title: string; text: string }[];
  steps: string[];
  proTip: string;
}

export const USER_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'getting-started',
    number: 'Section 1',
    title: 'Welcome & Main Screen Tour',
    subtitle: 'Understanding the layout of AE INSIGHT in 60 seconds',
    screenshotId: 'main_layout',
    screenshotCaption: 'Figure 1: The AE INSIGHT Main Screen showing the Top Bar, Left Menu, Summary Cards, and Charts.',
    whatIsIt:
      'AE INSIGHT is an easy-to-use visual dashboard built for the Anudip Foundation Academic Excellence team and partners. Instead of searching through huge Excel files, you can see student progress, attendance, assessments, dropouts, and batch health in clean charts and tables.',
    callouts: [
      {
        badge: '1',
        title: 'Left Navigation Menu',
        text: 'Use this menu on the left side to switch between different topics (like Dashboard, Assessment Status, Dropout Status, Exception Status, or Hiring Concerns).',
      },
      {
        badge: '2',
        title: 'Top Summary Cards (KPIs)',
        text: 'At the top of every page, big colorful boxes show the most important numbers at a glance—such as Total Students, Total Batches, Trained Students, and Dropouts.',
      },
      {
        badge: '3',
        title: 'Global Filters & Refresh Buttons',
        text: 'Located in the top-right corner. Click "Filters" to narrow down the whole app by Center, RM, AE, or Program, or click the Refresh icon to reload the latest numbers.',
      },
      {
        badge: '4',
        title: 'Active Data Source Bar',
        text: 'Right below the main header, a slim bar tells you which Excel file is currently loaded and the exact date and time it was last updated.',
      },
    ],
    steps: [
      'Open the platform in your web browser. You will land on the main "Dashboard" screen automatically.',
      'Look at the top grey status bar to confirm the latest Excel dataset is loaded.',
      'Read the top Summary Cards to get the big picture (Total Students, Running Batches, Completed Batches, Trained, and Dropouts).',
      'Click any tab in the Left Sidebar Menu to open a detailed view for that specific topic.',
    ],
    proTip:
      'On a mobile phone or tablet, the left menu folds neatly into a "Menu" button at the top-left so your charts have plenty of room.',
  },
  {
    id: 'filtering-data',
    number: 'Section 2',
    title: 'How to Filter & Narrow Down Data',
    subtitle: 'View numbers for your specific Region Manager (RM), AE, Center, or Program',
    screenshotId: 'filters_bar',
    screenshotCaption: 'Figure 2: The Filter Bar lets you pick Diya or DeepTech and select specific RMs, AEs, Centers, or Programs.',
    whatIsIt:
      'By default, AE INSIGHT shows numbers for the entire organization. Filters let you zoom in on just the data you care about—for example, viewing only "DeepTech" courses, or checking only the centers managed by a specific Regional Manager (RM) or Academic Executive (AE).',
    callouts: [
      {
        badge: '1',
        title: 'Program Type Switcher (Diya / DeepTech)',
        text: 'Quickly switch between "Diya and Deeptech" (combined), "Diya" only, or "DeepTech" only.',
      },
      {
        badge: '2',
        title: 'Multi-Select Dropdowns (RM, AE, Center, Program)',
        text: 'Click any dropdown box to tick one or multiple names. Every chart on the page updates immediately.',
      },
      {
        badge: '3',
        title: 'Built-in Search Inside Dropdowns',
        text: 'Type a Center Code or RM name inside the dropdown search box to find it without scrolling.',
      },
      {
        badge: '4',
        title: 'Reset All Filters Button',
        text: 'Done filtering? Click the "Reset" button to clear all selections and return to the full organization view.',
      },
    ],
    steps: [
      'Click the "Filters" button in the top-right header (or use the filter bar right at the top of the current dashboard page).',
      'Choose your Program Type (for example, "Diya" or "DeepTech") if you want to separate those streams.',
      'Click on "RM / SH / ZH", "AE Name", or "Center" and check the boxes next to the names you want to inspect.',
      'Watch the Summary Cards and Charts update automatically—no "Submit" button needed!',
      'When finished, click "Reset" to go back to seeing all records.',
    ],
    proTip:
      'A small teal number badge appears on the "Filters" button at the top-right whenever a filter is active, reminding you that you are looking at filtered numbers.',
  },
  {
    id: 'student-dashboards',
    number: 'Section 3',
    title: 'Student Status Tabs: Assessments, Dropouts & Exceptions',
    subtitle: 'Tracking how many students are trained, dropping out, or flagged with exceptions',
    screenshotId: 'student_dashboards',
    screenshotCaption: 'Figure 3: Student Analytics tabs showing metric toggles (Counts vs 100% Distribution), chart styles, and Excel export.',
    whatIsIt:
      'These three core tabs track the student journey from enrollment to final certification:\n• Assessment Status: Shows how many students completed training and passed their final assessment.\n• Dropout Status: Breaks down students who left early into Initial Session Dropouts vs. Regular Session Dropouts.\n• Exception Status: Highlights students with policy or attendance/assessment exceptions and shows a true 100% proportional breakdown across Programs, RMs, AEs, and Centers.',
    callouts: [
      {
        badge: '1',
        title: 'Metric Switcher Pills (Count vs. % Share)',
        text: 'Switch the chart between raw student counts (e.g., 245 students) and percentage distribution (e.g., Program Wise Exception Rate % adding up cleanly to 100%).',
      },
      {
        badge: '2',
        title: 'Chart Style Buttons (Bar, Column, Pie, Table)',
        text: 'Prefer a table or a pie chart instead of bars? Click the small view icons on the top-right of any chart card to change how it looks.',
      },
      {
        badge: '3',
        title: 'Quick Search Box on Every Chart',
        text: 'Type an RM name, Center code, or Program name directly into the chart’s search box to highlight just that row.',
      },
      {
        badge: '4',
        title: 'Export Excel Button',
        text: 'Click "Export Excel" to download the underlying student or summary table onto your computer as an `.xlsx` spreadsheet.',
      },
    ],
    steps: [
      'Click "Assessment Status", "Dropout Status", or "Exception Status" in the left menu.',
      'Review the top KPI cards to see the overall counts and percentages.',
      'Scroll down to see breakdowns by RM, AE, Center, Course, and Program.',
      'Click the Metric Pills at the top of a chart to switch between Student Count and Percentage (%).',
      'Scroll to the bottom table to inspect individual student records or click "Export Excel" to save a copy.',
    ],
    proTip:
      'In Exception Status -> Program Wise Exception Breakdown, switching to "Exception Rate %" shows each program’s exact share out of 100% of total exceptions so you can immediately see which program contributes the most.',
  },
  {
    id: 'batch-operations',
    number: 'Section 4',
    title: 'Batch Progress & Class Conduction Tabs',
    subtitle: 'Monitoring Running Batches, Closed Batches, Batch Closure Delays & Class Adherence',
    screenshotId: 'batch_dashboards',
    screenshotCaption: 'Figure 4: Running Batch Progress showing both Total Students and Attendance <50% Count side-by-side.',
    whatIsIt:
      'These four operational tabs help academic managers keep batches on schedule:\n• Batch Closure Progress: Tracks whether completed batches are being officially closed on time or delayed.\n• Running Batch Progress: Monitors currently active batches, comparing Total Students against students with low attendance (<50%).\n• Closed Batch Progress: Summarizes final outcomes for batches that have already finished.\n• Class Conduction Adherence: Compares scheduled classes vs. actually conducted classes by Trainer and Center.',
    callouts: [
      {
        badge: '1',
        title: 'Dual-Bar Comparison (<50% Attendance vs Total Students)',
        text: 'In Running Batch Progress, choosing the "<50% Count" metric displays two bars side-by-side for every RM: Total Students (slate) and Attendance <50% Count (red), making risk comparison effortless.',
      },
      {
        badge: '2',
        title: 'Batch Closure Delay Buckets',
        text: 'Groups delayed batches by how many days overdue they are so teams can clear the oldest backlog first.',
      },
      {
        badge: '3',
        title: 'Class Conduction Adherence %',
        text: 'Highlights trainers and centers with high or low class conduction adherence so rescheduling issues are caught early.',
      },
    ],
    steps: [
      'Click "Running Batch Progress" in the left sidebar to inspect active batches.',
      'In the "RM Wise Running Batch Progress Breakdown" chart, click the "<50% Count" pill to view both Total Students and Attendance <50% Count together.',
      'Click "Batch Closure Progress" to check how many batches are pending closure and which centers have delays.',
      'Click "Class Conduction Adherence" to review scheduled vs. conducted sessions across RMs and Centers.',
    ],
    proTip:
      'Hover your mouse over any bar in the chart to see a clean popup card with the exact numbers and percentages for that RM or Center.',
  },
  {
    id: 'hiring-and-challenges',
    number: 'Section 5',
    title: 'Hiring Concerns & Operational Challenges',
    subtitle: 'Reviewing open trainer positions, hiring aging, and ground-level RM challenges',
    screenshotId: 'hiring_challenges',
    screenshotCaption: 'Figure 5: Hiring Concerns and Challenges & Impact tables with one-click Presentation Mode.',
    whatIsIt:
      'Numbers only tell half the story. These two tabs explain the real-world operational reasons behind the numbers:\n• Hiring Concerns: Lists open trainer/faculty positions by Region Lead, Location/Project, Role Required, RFR Date/Aging, and Operational Impact (e.g., "Batch launch delayed" or "Severe: Center halted").\n• Challenges & Impact: Lists ground-level challenges reported by Regional Managers (such as college timetable conflicts or unapproved trainer leaves) and their direct impact on students.',
    callouts: [
      {
        badge: '1',
        title: 'Hiring Concerns & Aging Severity',
        text: 'Shows exactly where trainer vacancies exist, how long the requisition (RFR) has been open, and how it impacts batch delivery.',
      },
      {
        badge: '2',
        title: 'Challenges & Impact Register',
        text: 'A clean, readable register pairing each RM’s reported operational challenge with its business impact.',
      },
      {
        badge: '3',
        title: 'Presentation Mode Button',
        text: 'Click "Presentation Mode" at the top-right of either table to expand it cleanly across the entire screen during leadership review calls.',
      },
      {
        badge: '4',
        title: 'Always-Visible Exit Presentation Mode Button',
        text: 'When in Presentation Mode, a sticky header at the top keeps the "Exit Presentation Mode" button clearly visible at all times—or simply press the ESC key.',
      },
    ],
    steps: [
      'Click "Hiring Concerns" in the left menu (right above Challenges & Impact) to view open faculty roles and aging severity.',
      'Click "Challenges & Impact" to read the operational challenges reported by Regional Managers.',
      'Use the search box on Challenges & Impact to filter by RM Name or keyword (e.g., "rescheduling" or "placement").',
      'Click "Presentation Mode" when sharing your screen in a meeting, and click "Exit Presentation Mode" (or press Esc) when done.',
    ],
    proTip:
      'Critical impacts like "Severe: Center halted" or "Highest Aging Severity" are highlighted in bold inside Hiring Concerns so leadership can prioritize urgent hiring immediately.',
  },
  {
    id: 'presentation-mode',
    number: 'Section 6',
    title: 'Presentation Mode (For Google Meet & Leadership Reviews)',
    subtitle: 'Enlarge any chart or table for crystal-clear screen sharing',
    screenshotId: 'presentation_mode',
    screenshotCaption: 'Figure 6: Presentation Mode enlarges charts with high-contrast labels and auto-generated talking points.',
    whatIsIt:
      'When you share your screen on Google Meet, Zoom, or Microsoft Teams, regular dashboard text can look small to other participants. "Presentation Mode" turns any chart or table into a high-contrast, full-screen slide with larger numbers and automatic summary bullet points.',
    callouts: [
      {
        badge: '1',
        title: 'Spotlight Chart / Table Canvas',
        text: 'Isolates the selected chart or table in full-screen view with extra-large, easy-to-read labels.',
      },
      {
        badge: '2',
        title: 'Slide Switcher & Navigation Arrows',
        text: 'Use the left/right arrows or slide list to flip smoothly between different charts without leaving Presentation Mode.',
      },
      {
        badge: '3',
        title: 'Key Metrics & Talking Points',
        text: 'Automatically summarizes the top insights and active filter settings so you can read them out during your meeting.',
      },
      {
        badge: '4',
        title: 'Exit Presentation Mode Button (or ESC Key)',
        text: 'Pinned at the top-right corner so you can return to the normal dashboard anytime with a single click.',
      },
    ],
    steps: [
      'Find any chart or table you want to discuss during a meeting.',
      'Click the "Presentation Mode" button on the top-right corner of that card.',
      'Use the Next / Previous buttons (or keyboard arrow keys) to move through the charts.',
      'Click "Exit Presentation Mode" in the top bar (or press the Escape key on your keyboard) to return to normal view.',
    ],
    proTip:
      'Apply your RM or Center filters BEFORE clicking Presentation Mode—the presentation slides will automatically reflect your filtered data!',
  },
  {
    id: 'drilldowns-and-reports',
    number: 'Section 7',
    title: 'Student Details, AI Insights & Formal PDF Reports',
    subtitle: 'Inspecting individual student records and downloading official reports',
    screenshotId: 'drilldown_export',
    screenshotCaption: 'Figure 7: Clicking any Center or Student opens detailed popup cards; Reports Center exports formal PDFs.',
    whatIsIt:
      'AE INSIGHT lets you drill all the way down from a 10,000-student summary to a single student’s record, or generate a ready-to-print PDF report:\n• Center Drilldown Popup: Click any Center Code in a table to see all batches, trainers, and students inside that center.\n• 30-Column Student Profile: Click any student row to inspect all 30 fields (Attendance %, ILT completion, Final Exam score, Exception status, Placement details).\n• AI Insights & Reports Center: View automated executive summaries under "AI Insights", or download formatted PDF reports under "Reports".',
    callouts: [
      {
        badge: '1',
        title: 'Center Drilldown Modal',
        text: 'Clicking a Center name opens a dedicated popup summarizing that center’s batches, trainers, and student roster.',
      },
      {
        badge: '2',
        title: '30-Column Student Detail Card',
        text: 'Clicking any student row opens their complete profile organized neatly into Identity, Batch, Attendance, Validation, and Placement sections.',
      },
      {
        badge: '3',
        title: 'Formal PDF Report Generator',
        text: 'Under "Reports" in the left menu, choose from 10 pre-built report templates and click "Export Formal PDF Report".',
      },
    ],
    steps: [
      'In any table showing Centers, click on a Center Code to open the Center Drilldown window.',
      'In any student table (such as in Dropout Status or Exception Status), click on a student row to view their full 30-column profile.',
      'Click "AI Insights" in the left sidebar to read automated takeaways and action recommendations.',
      'Click "Reports" in the left sidebar, select a report topic (e.g., "Executive Academic Excellence Summary"), and click "Export Formal PDF Report".',
    ],
    proTip:
      'Any filters you have active (such as a specific Funder or RM) are automatically stamped onto the header of the exported PDF report.',
  },
  {
    id: 'admin-portal',
    number: 'Section 8',
    title: 'Admin Control Portal (/admin) — Uploading Data & Backups',
    subtitle: 'For Administrators: Uploading new Excel sheets, checking data quality, and managing backups',
    screenshotId: 'admin_portal',
    screenshotCaption: 'Figure 8: The Admin Portal (/admin) provides Upload Center, Data Explorer, Data Quality, and Restore Points.',
    whatIsIt:
      'Administrators can access the dedicated Admin Control Portal by adding `/admin` (or `#/admin`) to the website address. This keeps heavy data-management tools separate from the everyday viewer dashboards so regular users never accidentally overwrite or delete data.',
    callouts: [
      {
        badge: '1',
        title: 'Upload Center (Drag & Drop Excel / CSV)',
        text: 'Upload fresh Excel files for the Main Student Dataset, Class Conduction Adherence, or Operational Challenges.',
      },
      {
        badge: '2',
        title: 'Data Explorer (Search All Raw Records)',
        text: 'Browse, search, and export the entire raw database table with instant keyword filtering.',
      },
      {
        badge: '3',
        title: 'Restore Points (Database Backups)',
        text: 'Create a 1-click snapshot before uploading new data, or restore the portal to a previous date anytime.',
      },
      {
        badge: '4',
        title: 'Data Quality & Safe Clear Data',
        text: 'Audit missing fields in "Data Quality", or use "Clear All Data" (protected by email verification) when resetting the portal.',
      },
    ],
    steps: [
      'To open the Admin Portal, go to `/admin` (or `#/admin`) in your browser address bar.',
      'Before uploading a new file, click "Restore Points" in the top bar and save a backup snapshot of current data.',
      'Click "Upload Center" in the left menu, drag and drop your latest `.xlsx` or `.csv` file, and wait for the green confirmation banner.',
      'Switch back to the main dashboard (`/`) to see all charts updated with your newly uploaded numbers!',
    ],
    proTip:
      'Every upload automatically creates a safety backup in "Settings & Restore", so you can roll back with a single click if an Excel sheet had a mistake.',
  },
];

export const FAQ_ITEMS = [
  {
    q: 'Why do the numbers look smaller than usual?',
    a: 'Check the top-right "Filters" button! If there is a number badge on it (e.g., "1" or "2"), you have an active filter applied. Click "Filters" and then click "Reset" to see all records again.',
  },
  {
    q: 'How do I exit Presentation Mode?',
    a: 'Click the prominent "Exit Presentation Mode" button in the top-right bar of the presentation screen, or simply press the "Esc" (Escape) key on your keyboard.',
  },
  {
    q: 'Can I download chart data into Microsoft Excel?',
    a: 'Yes! Almost every dashboard tab (such as Exception Status, Dropout Status, and Assessment Status) has an "Export Excel" button that downloads a clean .xlsx file.',
  },
  {
    q: 'How is Program Wise Exception Rate % calculated?',
    a: 'In the Exception Status tab, Program Wise Exception Rate % is calculated on a 100% proportional basis—showing each program’s exact share of the total exceptions so the slices add up to 100%.',
  },
  {
    q: 'How do I see both Total Students and <50% Attendance in Running Batch Progress?',
    a: 'Open "Running Batch Progress" from the left sidebar, go to the "RM Wise Running Batch Progress Breakdown" chart, and click the "<50% Count" button. It displays both Total Students and Attendance <50% Count bars together.',
  },
  {
    q: 'Where do I upload a new Excel file?',
    a: 'Open the Admin Portal by visiting `/admin` (or `#/admin`), click "Upload Center" in the left menu, and select your Excel (.xlsx) or CSV file.',
  },
];

/**
 * Draws a crisp, high-resolution annotated UI mockup screenshot onto an HTML5 Canvas
 * and returns a PNG data URL suitable for both on-screen display and embedding into jsPDF.
 */
export function renderGuideScreenshotCanvas(type: GuideScreenshotId): string {
  const canvas = document.createElement('canvas');
  const W = 1200;
  const H = 660;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Helper functions
  const roundRect = (x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lineWidth = 1.5) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 14,
    color = '#0f172a',
    weight: 'normal' | 'bold' = 'normal',
    align: CanvasTextAlign = 'left'
  ) => {
    ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  const drawCallout = (num: string, cx: number, cy: number, targetX?: number, targetY?: number) => {
    if (targetX !== undefined && targetY !== undefined) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(targetX, targetY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#e11d48';
      ctx.fill();
    }

    // Outer white halo
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Red circle badge
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#e11d48';
    ctx.fill();

    drawText(num, cx, cy + 6, 16, '#ffffff', 'bold', 'center');
  };

  // Base Browser Frame
  roundRect(0, 0, W, H, 14, '#f8fafc', '#cbd5e1', 3);

  // Top App Header (Common across most views except full presentation mode)
  if (type !== 'presentation_mode') {
    roundRect(3, 3, W - 6, 62, 10, '#ffffff', '#e2e8f0', 1);
    // AE Logo Box
    roundRect(20, 14, 38, 38, 8, '#008C95');
    drawText('AE', 39, 39, 18, '#ffffff', 'bold', 'center');
    drawText('AE INSIGHT', 70, 32, 20, '#0f172a', 'bold');
    roundRect(195, 16, 145, 22, 5, '#E6F4F5', '#99d5d9', 1);
    drawText(type === 'admin_portal' ? 'Admin Portal (/admin)' : 'Academic Excellence', 267, 31, 11, '#005F66', 'bold', 'center');
    drawText('Turning Academic Data into Actionable Insights', 70, 50, 11, '#64748b');

    // Top Right Header Buttons
    roundRect(755, 18, 128, 30, 8, '#f0fdf4', '#86efac', 1.5);
    drawText('User Guide PDF', 819, 37, 12, '#166534', 'bold', 'center');

    roundRect(895, 18, 34, 30, 8, '#f8fafc', '#cbd5e1', 1);
    drawText('↻', 912, 38, 16, '#008C95', 'bold', 'center');

    roundRect(940, 18, 105, 30, 8, '#E6F4F5', '#008C95', 1.5);
    drawText('Filters (2)', 992, 37, 12, '#005F66', 'bold', 'center');

    roundRect(1058, 18, 120, 30, 8, '#f8fafc', '#cbd5e1', 1);
    drawText('Viewer Role ▾', 1118, 37, 12, '#334155', 'bold', 'center');

    // Subheader bar
    roundRect(3, 65, W - 6, 28, 0, '#f1f5f9', '#e2e8f0', 1);
    drawText('Source: Academic_Excellence_Master_Data.xlsx  ·  Sheet: Export  ·  Updated: Today, 11:30 AM', 22, 83, 11, '#475569', 'bold');
    drawText('Operational Grains: Students · Batches · Centers · Trainers · AEs', W - 22, 83, 11, '#64748b', 'normal', 'right');
  }

  // Render Specific Screenshot Content
  if (type === 'main_layout') {
    // Left Sidebar
    roundRect(14, 105, 235, 540, 12, '#ffffff', '#e2e8f0', 1.5);
    drawText('CORE DASHBOARDS', 28, 128, 11, '#475569', 'bold');
    const navs = [
      { label: 'Dashboard', active: true },
      { label: 'Assessment Status', active: false },
      { label: 'Dropout Status', active: false },
      { label: 'Exception Status', active: false },
      { label: 'Batch Closure Progress', active: false },
      { label: 'Running Batch Progress', active: false },
      { label: 'Closed Batch Progress', active: false },
      { label: 'Class Conduction Adherence', active: false },
      { label: 'Hiring Concerns', active: false },
      { label: 'Challenges & Impact', active: false },
    ];
    navs.forEach((n, idx) => {
      const y = 140 + idx * 36;
      roundRect(24, y, 215, 30, 8, n.active ? '#008C95' : '#ffffff');
      drawText(n.label, 40, y + 20, 12, n.active ? '#ffffff' : '#1e293b', 'bold');
    });
    drawText('INTELLIGENCE & REPORTS', 28, 518, 11, '#475569', 'bold');
    ['AI Insights', 'Reports', 'User Guide (PDF)'].forEach((label, idx) => {
      const y = 530 + idx * 34;
      roundRect(24, y, 215, 28, 8, '#f8fafc', '#e2e8f0', 1);
      drawText(label, 40, y + 19, 12, '#0f172a', 'bold');
    });

    // Main Area KPI Cards
    const kpis = [
      { title: 'TOTAL STUDENTS', val: '28,450', sub: 'Across 112 Centers', color: '#008C95', bg: '#E6F4F5' },
      { title: 'TOTAL BATCHES', val: '842', sub: '310 Running · 532 Closed', color: '#2563eb', bg: '#eff6ff' },
      { title: 'TOTAL TRAINED', val: '19,820', sub: '69.7% Completion Rate', color: '#059669', bg: '#ecfdf5' },
      { title: 'TOTAL DROPOUTS', val: '3,412', sub: '12.0% Overall Attrition', color: '#e11d48', bg: '#fff1f2' },
    ];
    kpis.forEach((k, i) => {
      const x = 266 + i * 230;
      roundRect(x, 105, 216, 105, 12, '#ffffff', '#cbd5e1', 1.5);
      roundRect(x + 14, 118, 188, 22, 6, k.bg);
      drawText(k.title, x + 22, 133, 11, k.color, 'bold');
      drawText(k.val, x + 20, 172, 28, '#0f172a', 'bold');
      drawText(k.sub, x + 20, 195, 11, '#64748b');
    });

    // Main Charts Area
    roundRect(266, 225, 595, 420, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Center & RM Performance Overview', 286, 255, 16, '#0f172a', 'bold');
    drawText('Click any bar or center row to drill down into batches and students', 286, 275, 12, '#64748b');
    roundRect(720, 238, 125, 28, 6, '#f1f5f9', '#cbd5e1', 1);
    drawText('Presentation Mode', 782, 256, 11, '#0f172a', 'bold', 'center');

    const bars = [
      { name: 'Sanjeev Kumar', pct: 86, val: '4,210 Students' },
      { name: 'Jinsmon Devasia', pct: 78, val: '3,890 Students' },
      { name: 'Pradeep Biswas', pct: 72, val: '3,540 Students' },
      { name: 'Krishna S. Adhikari', pct: 68, val: '3,120 Students' },
      { name: 'Vivek Kumar', pct: 61, val: '2,780 Students' },
      { name: 'N. P. Maurya', pct: 54, val: '2,410 Students' },
    ];
    bars.forEach((b, idx) => {
      const y = 305 + idx * 52;
      drawText(b.name, 286, y + 18, 13, '#1e293b', 'bold');
      roundRect(430, y + 4, 320, 22, 6, '#f1f5f9');
      roundRect(430, y + 4, (320 * b.pct) / 100, 22, 6, '#008C95');
      drawText(b.val, 760, y + 19, 12, '#0f172a', 'bold');
    });

    // Right Health Card
    roundRect(875, 225, 308, 420, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Academic Health Indicators', 895, 255, 16, '#0f172a', 'bold');
    const health = [
      { label: 'Running Batch Attendance', val: '81.4%', color: '#008C95' },
      { label: 'Beneficiary Attendance', val: '84.2%', color: '#059669' },
      { label: 'ILT Class Completion', val: '79.6%', color: '#2563eb' },
      { label: 'Student Validation Rate', val: '91.8%', color: '#7c3aed' },
    ];
    health.forEach((h, i) => {
      const y = 285 + i * 82;
      roundRect(895, y, 268, 68, 10, '#f8fafc', '#e2e8f0', 1);
      drawText(h.label, 910, y + 25, 12, '#475569', 'bold');
      drawText(h.val, 910, y + 52, 22, h.color, 'bold');
    });

    // Callouts
    drawCallout('1', 130, 320);
    drawCallout('2', 580, 155);
    drawCallout('3', 985, 55, 985, 35);
    drawCallout('4', 440, 80);
  } else if (type === 'filters_bar') {
    // Filter Panel Expanded
    roundRect(20, 108, W - 40, 250, 14, '#ffffff', '#008C95', 2);
    drawText('GLOBAL & PAGE FILTER BAR — NARROW DOWN YOUR DATA', 42, 138, 15, '#005F66', 'bold');

    // Program Type Pills
    drawText('Program Stream:', 42, 175, 13, '#334155', 'bold');
    roundRect(165, 156, 150, 30, 8, '#008C95');
    drawText('Diya and Deeptech', 240, 175, 12, '#ffffff', 'bold', 'center');
    roundRect(325, 156, 90, 30, 8, '#f1f5f9', '#cbd5e1', 1);
    drawText('Diya Only', 370, 175, 12, '#334155', 'bold', 'center');
    roundRect(425, 156, 110, 30, 8, '#f1f5f9', '#cbd5e1', 1);
    drawText('DeepTech Only', 480, 175, 12, '#334155', 'bold', 'center');

    // Reset button
    roundRect(1010, 152, 145, 34, 8, '#fff1f2', '#fecdd3', 1.5);
    drawText('✕ Reset All Filters', 1082, 173, 12, '#be123c', 'bold', 'center');

    // Filter Dropdown Boxes
    const boxes = [
      { label: 'RM / SH / ZH (2 Selected)', val: 'Sanjeev Kumar, Jinsmon...' },
      { label: 'AE Name', val: 'All Academic Executives (24)' },
      { label: 'Center Code', val: 'All Centers (112)' },
      { label: 'Program Name', val: 'IBM, Accenture, Diya...' },
    ];
    boxes.forEach((b, idx) => {
      const x = 42 + idx * 280;
      roundRect(x, 205, 260, 62, 10, '#f8fafc', idx === 0 ? '#008C95' : '#cbd5e1', idx === 0 ? 2 : 1.5);
      drawText(b.label, x + 14, 227, 11, '#64748b', 'bold');
      drawText(b.val, x + 14, 250, 13, '#0f172a', 'bold');
      drawText('▾', x + 238, 245, 14, '#008C95', 'bold');
    });

    // Open Multi-select Dropdown Preview
    roundRect(42, 274, 310, 260, 12, '#ffffff', '#008C95', 2);
    roundRect(56, 288, 282, 32, 8, '#f1f5f9', '#cbd5e1', 1);
    drawText('🔍 Search RM name...', 70, 309, 12, '#64748b');

    const rms = [
      { name: 'Select All RMs', checked: false },
      { name: 'Sanjeev Kumar', checked: true },
      { name: 'Jinsmon Devasia', checked: true },
      { name: 'Pradeep Biswas', checked: false },
      { name: 'Krishna S. Adhikari', checked: false },
      { name: 'Vivek Kumar', checked: false },
    ];
    rms.forEach((r, idx) => {
      const y = 332 + idx * 32;
      roundRect(56, y, 282, 28, 6, r.checked ? '#E6F4F5' : '#ffffff');
      roundRect(66, y + 6, 16, 16, 4, r.checked ? '#008C95' : '#ffffff', '#008C95', 1.5);
      if (r.checked) drawText('✓', 74, y + 19, 12, '#ffffff', 'bold', 'center');
      drawText(r.name, 94, y + 19, 12, '#0f172a', r.checked ? 'bold' : 'normal');
    });

    // Preview of Filtered Dashboard below
    roundRect(380, 375, 798, 260, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Instant Live Update: Showing Data for 2 Selected RMs', 404, 408, 16, '#0f172a', 'bold');
    drawText('Charts, KPIs, and Excel Exports automatically filter to match your selection.', 404, 430, 13, '#475569');
    roundRect(404, 455, 220, 95, 10, '#E6F4F5', '#008C95', 1);
    drawText('FILTERED STUDENTS', 420, 480, 11, '#005F66', 'bold');
    drawText('8,100', 420, 520, 28, '#0f172a', 'bold');
    roundRect(644, 455, 220, 95, 10, '#ecfdf5', '#059669', 1);
    drawText('FILTERED TRAINED', 660, 480, 11, '#065f46', 'bold');
    drawText('6,240 (77%)', 660, 520, 26, '#0f172a', 'bold');

    drawCallout('1', 350, 132, 350, 160);
    drawCallout('2', 375, 405, 340, 405);
    drawCallout('3', 375, 304, 338, 304);
    drawCallout('4', 1082, 125, 1082, 152);
  } else if (type === 'student_dashboards') {
    // Student Status / Exception Status 100% Breakdown
    roundRect(20, 105, W - 40, 535, 14, '#ffffff', '#cbd5e1', 1.5);
    drawText('Exception Status — Program Wise Exception Breakdown (100% Proportional Basis)', 42, 138, 17, '#0f172a', 'bold');
    drawText('Switch between Student Counts and 100% Proportional Rate %, change chart styles, or export to Excel', 42, 160, 12, '#64748b');

    // Metric Switcher Pills
    roundRect(42, 178, 135, 32, 8, '#f1f5f9', '#cbd5e1', 1);
    drawText('Exception Count', 109, 198, 12, '#334155', 'bold', 'center');
    roundRect(185, 178, 185, 32, 8, '#008C95');
    drawText('Exception Rate % (100% Share)', 277, 198, 12, '#ffffff', 'bold', 'center');

    // Search & Chart Type & Export
    roundRect(540, 178, 210, 32, 8, '#f8fafc', '#cbd5e1', 1);
    drawText('🔍 Search Program...', 555, 198, 12, '#64748b');

    roundRect(765, 178, 195, 32, 8, '#f1f5f9', '#cbd5e1', 1);
    drawText('Bar  |  Column  |  Pie  |  Table', 862, 198, 11, '#0f172a', 'bold', 'center');

    roundRect(975, 178, 180, 32, 8, '#059669');
    drawText('⬇ Export Excel (.xlsx)', 1065, 198, 12, '#ffffff', 'bold', 'center');

    // 100% Distribution Bars
    const progs = [
      { name: 'Diya Core Foundation Program', share: 34.2, count: '695 Exceptions' },
      { name: 'DeepTech Java & Full Stack', share: 24.8, count: '504 Exceptions' },
      { name: 'Accenture Digital Skills', share: 18.5, count: '376 Exceptions' },
      { name: 'IBM SkillsBuild Cohort', share: 13.0, count: '264 Exceptions' },
      { name: 'ICRA & OpenText Special Project', share: 9.5, count: '193 Exceptions' },
    ];
    progs.forEach((p, idx) => {
      const y = 240 + idx * 58;
      drawText(p.name, 42, y + 22, 13, '#0f172a', 'bold');
      roundRect(310, y + 6, 560, 26, 6, '#f1f5f9');
      roundRect(310, y + 6, (560 * p.share) / 40, 26, 6, '#008C95');
      drawText(`${p.share}% of Total Exceptions (${p.count})`, 885, y + 24, 13, '#0f172a', 'bold');
    });

    // Total 100% Verification Banner
    roundRect(42, 545, W - 84, 72, 10, '#E6F4F5', '#008C95', 1.5);
    drawText('✓ 100.0% Total Program Exception Distribution Verified', 62, 574, 14, '#005F66', 'bold');
    drawText('All program percentages represent their exact share of total exceptions (34.2% + 24.8% + 18.5% + 13.0% + 9.5% = 100.0%).', 62, 598, 12, '#1e293b');

    drawCallout('1', 277, 152, 277, 178);
    drawCallout('2', 862, 152, 862, 178);
    drawCallout('3', 645, 152, 645, 178);
    drawCallout('4', 1065, 152, 1065, 178);
  } else if (type === 'batch_dashboards') {
    // Running Batch Progress Dual Metric View
    roundRect(20, 105, W - 40, 535, 14, '#ffffff', '#cbd5e1', 1.5);
    drawText('Running Batch Progress — RM Wise Breakdown (<50% Attendance Count View)', 42, 138, 17, '#0f172a', 'bold');
    drawText('Displays both Total Students and Attendance <50% Count side-by-side for immediate risk visibility', 42, 160, 12, '#64748b');

    // Metric Selector
    roundRect(42, 178, 190, 32, 8, '#e11d48');
    drawText('Attendance <50% Count (Active)', 137, 198, 12, '#ffffff', 'bold', 'center');
    roundRect(242, 178, 160, 32, 8, '#f1f5f9', '#cbd5e1', 1);
    drawText('Attendance <50% Rate %', 322, 198, 12, '#334155', 'bold', 'center');

    // Legend
    roundRect(500, 184, 18, 18, 4, '#64748b');
    drawText('Total Students in Running Batches', 526, 198, 12, '#334155', 'bold');
    roundRect(760, 184, 18, 18, 4, '#e11d48');
    drawText('Attendance <50% Count (At-Risk Students)', 786, 198, 12, '#be123c', 'bold');

    const rmRows = [
      { rm: 'Sanjeev Kumar', total: 1420, low: 185 },
      { rm: 'Jinsmon Devasia', total: 1180, low: 162 },
      { rm: 'Pradeep Biswas', total: 960, low: 114 },
      { rm: 'Krishna S. Adhikari', total: 840, low: 98 },
    ];
    rmRows.forEach((r, idx) => {
      const y = 235 + idx * 66;
      drawText(r.rm, 42, y + 25, 13, '#0f172a', 'bold');
      // Total students bar
      roundRect(230, y + 4, (r.total / 1500) * 520, 18, 4, '#64748b');
      drawText(`${r.total} Total Students`, 240 + (r.total / 1500) * 520, y + 18, 11, '#334155', 'bold');
      // Low attendance bar
      roundRect(230, y + 26, (r.low / 1500) * 520 + 40, 18, 4, '#e11d48');
      drawText(`${r.low} Students <50% Attendance`, 280 + (r.low / 1500) * 520, y + 40, 11, '#be123c', 'bold');
    });

    // Bottom Cards for Closure & Class Conduction
    roundRect(42, 510, 540, 110, 10, '#f8fafc', '#cbd5e1', 1.5);
    drawText('Batch Closure Progress & Delay Aging', 62, 538, 14, '#0f172a', 'bold');
    drawText('• On-Time Closures vs. Delayed Batches (+7, +15, +30 Days)', 62, 564, 12, '#334155');
    drawText('• Identify pending batch closures by Center and Trainer', 62, 588, 12, '#334155');

    roundRect(610, 510, 548, 110, 10, '#f8fafc', '#cbd5e1', 1.5);
    drawText('Class Conduction Adherence', 630, 538, 14, '#0f172a', 'bold');
    drawText('• Compares Planned/Scheduled Classes vs. Conducted Classes', 630, 564, 12, '#334155');
    drawText('• Tracks Trainer-wise and Center-wise session adherence %', 630, 588, 12, '#334155');

    drawCallout('1', 450, 265);
    drawCallout('2', 310, 510);
    drawCallout('3', 880, 510);
  } else if (type === 'hiring_challenges') {
    // Split view showing Hiring Concerns and Challenges & Impact + Presentation Mode Header
    roundRect(20, 105, W - 40, 260, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Hiring Concerns Tab (Core Dashboards)', 40, 134, 16, '#0f172a', 'bold');
    roundRect(960, 114, 195, 30, 8, '#008C95');
    drawText('⛶ Presentation Mode', 1057, 133, 12, '#ffffff', 'bold', 'center');

    // Table Header
    roundRect(40, 152, W - 80, 32, 4, '#00665E');
    drawText('REGION LEAD', 55, 173, 11, '#ffffff', 'bold');
    drawText('LOCATION / PROJECT', 235, 173, 11, '#ffffff', 'bold');
    drawText('ROLE REQUIRED', 465, 173, 11, '#ffffff', 'bold');
    drawText('RFR DATE / AGING', 715, 173, 11, '#ffffff', 'bold');
    drawText('OPERATIONAL IMPACT', 925, 173, 11, '#ffffff', 'bold');

    const hiringRows = [
      ['Krishna S. Adhikari', 'Jalpaiguri (Accenture)', 'Soft Skill Trainer', '1.5+ Months', 'Project timeline strain'],
      ['Vivek Kumar', 'Varanasi Center', 'Hospitality & IT/Soft Skill', '2 Months', 'Severe: Center halted'],
      ['N. P. Maurya', 'Bhopal (Deeptech)', 'IT Trainer', 'May (5+ Mos)', 'Highest Aging Severity'],
    ];
    hiringRows.forEach((r, idx) => {
      const y = 186 + idx * 52;
      roundRect(40, y, W - 80, 50, 0, idx % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0', 1);
      drawText(r[0], 55, y + 30, 12, '#1e293b', 'bold');
      drawText(r[1], 235, y + 30, 12, '#334155');
      drawText(r[2], 465, y + 30, 12, '#334155');
      drawText(r[3], 715, y + 30, 12, '#334155');
      drawText(r[4], 925, y + 30, 12, idx > 0 ? '#be123c' : '#334155', idx > 0 ? 'bold' : 'normal');
    });

    // Bottom: Challenges & Impact in Presentation Mode with Visible Exit Button
    roundRect(20, 382, W - 40, 260, 12, '#ffffff', '#008C95', 2);
    roundRect(22, 384, W - 44, 46, 10, '#0f172a');
    drawText('Challenges & Impact Register — Presentation Mode Active', 42, 412, 15, '#ffffff', 'bold');
    roundRect(940, 392, 215, 30, 8, '#e11d48');
    drawText('✕ Exit Presentation Mode', 1047, 412, 12, '#ffffff', 'bold', 'center');

    roundRect(40, 442, W - 80, 30, 4, '#f1f5f9', '#cbd5e1', 1);
    drawText('SL NO.', 55, 462, 11, '#334155', 'bold');
    drawText('RM NAME', 130, 462, 11, '#334155', 'bold');
    drawText('CHALLENGES', 310, 462, 11, '#334155', 'bold');
    drawText('IMPACT', 760, 462, 11, '#334155', 'bold');

    const chRows = [
      ['1', 'Sanjeev Kumar', 'Excessive rescheduling occurred; sessions not as per timetable.', 'Delays learning outcomes and timely batch closure.'],
      ['2', 'Jinsmon Devasia', 'College allocates session timings conflicting with planned schedule.', 'Disrupts planned classes and trainer availability.'],
    ];
    chRows.forEach((r, idx) => {
      const y = 476 + idx * 68;
      roundRect(40, y, W - 80, 64, 0, '#ffffff', '#e2e8f0', 1);
      drawText(r[0], 65, y + 36, 12, '#0f172a', 'bold');
      drawText(r[1], 130, y + 36, 12, '#0f172a', 'bold');
      drawText(r[2], 310, y + 36, 12, '#1e293b');
      drawText(r[3], 760, y + 36, 12, '#334155');
    });

    drawCallout('1', 650, 260);
    drawCallout('2', 520, 520);
    drawCallout('3', 935, 129);
    drawCallout('4', 915, 407);
  } else if (type === 'presentation_mode') {
    // Full Dark Spotlight Presentation Mode
    roundRect(10, 10, W - 20, H - 20, 16, '#0f172a', '#334155', 2);

    // Sticky Top Bar
    roundRect(24, 24, W - 48, 58, 12, '#1e293b', '#334155', 1.5);
    roundRect(40, 36, 34, 34, 8, '#008C95');
    drawText('AE', 57, 59, 16, '#ffffff', 'bold', 'center');
    drawText('AE INSIGHT — Presentation Mode (Google Meet Spotlight)', 88, 50, 16, '#ffffff', 'bold');
    drawText('Slide 2 of 5  ·  Active Filter: Diya and Deeptech', 88, 69, 12, '#94a3b8');

    roundRect(935, 36, 220, 34, 8, '#e11d48');
    drawText('✕ Exit Presentation Mode (Esc)', 1045, 58, 12, '#ffffff', 'bold', 'center');

    // Left Slide Selector
    roundRect(24, 98, 230, 530, 12, '#1e293b', '#334155', 1);
    drawText('PRESENTATION SLIDES', 40, 125, 11, '#94a3b8', 'bold');
    ['1. Executive KPIs', '2. RM Dropout Breakdown', '3. Program Exceptions (100%)', '4. Running Batch <50%', '5. Hiring Concerns'].forEach((s, i) => {
      const y = 142 + i * 48;
      roundRect(36, y, 206, 38, 8, i === 1 ? '#008C95' : '#0f172a', '#334155', 1);
      drawText(s, 48, y + 24, 12, '#ffffff', i === 1 ? 'bold' : 'normal');
    });

    // Center Big Chart Canvas
    roundRect(270, 98, 600, 530, 12, '#1e293b', '#334155', 1.5);
    drawText('RM Wise Student Attrition & Dropout Breakdown', 294, 134, 18, '#ffffff', 'bold');
    drawText('Enlarged high-contrast view optimized for screen sharing', 294, 156, 12, '#94a3b8');

    const pBars = [
      { name: 'Sanjeev Kumar', pct: 82, label: '412 Dropouts (11.2%)' },
      { name: 'Jinsmon Devasia', pct: 70, label: '355 Dropouts (10.4%)' },
      { name: 'Pradeep Biswas', pct: 62, label: '298 Dropouts (9.8%)' },
      { name: 'Krishna S. Adhikari', pct: 50, label: '240 Dropouts (8.6%)' },
      { name: 'Vivek Kumar', pct: 42, label: '195 Dropouts (7.9%)' },
    ];
    pBars.forEach((b, idx) => {
      const y = 195 + idx * 72;
      drawText(b.name, 294, y + 22, 14, '#f8fafc', 'bold');
      roundRect(455, y + 4, 240, 28, 6, '#0f172a');
      roundRect(455, y + 4, (240 * b.pct) / 100, 28, 6, '#38bdf8');
      drawText(b.label, 708, y + 23, 13, '#38bdf8', 'bold');
    });

    // Right Talking Points & Summary
    roundRect(886, 98, 290, 530, 12, '#1e293b', '#334155', 1);
    drawText('KEY MEETING INSIGHTS', 906, 130, 13, '#2dd4bf', 'bold');
    const notes = [
      '• Total Students: 28,450',
      '• Overall Dropout Rate: 12.0%',
      '• Initial Dropouts: 1,920 (6.7%)',
      '• Regular Dropouts: 1,492 (5.3%)',
      '• Action: Review initial session',
      '  counseling in top 3 centers.',
    ];
    notes.forEach((n, idx) => {
      drawText(n, 906, 168 + idx * 32, 13, '#e2e8f0');
    });

    drawCallout('1', 560, 420);
    drawCallout('2', 140, 395);
    drawCallout('3', 1030, 380);
    drawCallout('4', 910, 53);
  } else if (type === 'drilldown_export') {
    // Left: Center Drilldown & 30-Column Student Profile
    roundRect(20, 105, 565, 535, 12, '#ffffff', '#008C95', 2);
    roundRect(22, 107, 561, 48, 10, '#E6F4F5');
    drawText('30-Column Student Record Detail Popup', 42, 136, 16, '#005F66', 'bold');
    drawText('Click any student row in any table to inspect all 30 fields', 42, 178, 12, '#64748b');

    const fields = [
      ['Student ID', 'STU-908412'],
      ['Student Name', 'Riya Chatterjee'],
      ['Center Code', 'KOL-ULTADANGA-01'],
      ['Batch Code', 'BAT-2026-JAVA-09'],
      ['Program Name', 'DeepTech Java Full Stack'],
      ['Enrollment Status', 'Enrolled (Complete)'],
      ['Running Attendance %', '88.5%'],
      ['Final Exam Score', '76 / 100 (Passed)'],
      ['Exception Flag', '0 (No Exception)'],
      ['Placement Status', 'Placed — Central CRD'],
    ];
    fields.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 42 + col * 265;
      const y = 198 + row * 70;
      roundRect(x, y, 250, 56, 8, '#f8fafc', '#e2e8f0', 1);
      drawText(f[0], x + 12, y + 20, 11, '#64748b', 'bold');
      drawText(f[1], x + 12, y + 42, 13, '#0f172a', 'bold');
    });

    // Right: Reports Center & Center Drilldown
    roundRect(605, 105, 575, 250, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Center Drilldown Popup (Click Any Center Code)', 625, 136, 16, '#0f172a', 'bold');
    drawText('Shows Center Batches, Assigned Trainers, Attendance %, and Student List', 625, 158, 12, '#64748b');
    roundRect(625, 175, 535, 155, 8, '#f8fafc', '#cbd5e1', 1);
    drawText('Center: KOL-ULTADANGA-01  |  14 Batches  |  420 Students  |  86% Attendance', 642, 205, 13, '#005F66', 'bold');
    drawText('• Batch BAT-01 (Running) — 32 Students — Trainer: A. Sen', 642, 240, 12, '#334155');
    drawText('• Batch BAT-02 (Closed)  — 30 Students — Trainer: M. Das', 642, 270, 12, '#334155');
    drawText('• Click any student inside the center popup to view their full profile', 642, 300, 12, '#008C95', 'bold');

    roundRect(605, 375, 575, 265, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Executive Report Generation Center ("Reports" Tab)', 625, 406, 16, '#0f172a', 'bold');
    roundRect(945, 390, 215, 34, 8, '#008C95');
    drawText('🖨 Export Formal PDF Report', 1052, 412, 12, '#ffffff', 'bold', 'center');

    const reps = [
      '1. Executive Academic Excellence Summary',
      '2. Dropout Analytics & Center Distribution',
      '3. Exception Monitoring Register',
      '4. Batch Closure Efficiency & Delay Analysis',
    ];
    reps.forEach((r, idx) => {
      const y = 440 + idx * 44;
      roundRect(625, y, 535, 36, 8, idx === 0 ? '#E6F4F5' : '#f8fafc', idx === 0 ? '#008C95' : '#e2e8f0', 1);
      drawText(r, 642, y + 23, 12, '#0f172a', 'bold');
    });

    drawCallout('1', 880, 240);
    drawCallout('2', 300, 380);
    drawCallout('3', 920, 407);
  } else if (type === 'admin_portal') {
    // Admin Portal (/admin)
    roundRect(14, 105, 235, 535, 12, '#ffffff', '#e2e8f0', 1.5);
    drawText('ADMIN PORTAL (/admin)', 28, 130, 11, '#005F66', 'bold');
    ['Data Explorer', 'Upload Center', 'Data Quality', 'Upload History', 'Settings & Restore'].forEach((item, idx) => {
      const y = 148 + idx * 44;
      roundRect(24, y, 215, 34, 8, idx === 1 ? '#008C95' : '#f8fafc');
      drawText(item, 42, y + 22, 13, idx === 1 ? '#ffffff' : '#1e293b', 'bold');
    });

    // Upload Center Box
    roundRect(266, 105, 590, 320, 12, '#ffffff', '#008C95', 2);
    drawText('Upload Center — Import Fresh Excel / CSV Datasets', 288, 136, 16, '#0f172a', 'bold');
    drawText('Supports Main Academic Dataset, Class Conduction Adherence, and Challenges', 288, 158, 12, '#64748b');

    roundRect(288, 178, 546, 165, 12, '#E6F4F5', '#008C95', 2);
    drawText('⬆ Drag & Drop Your Excel (.xlsx) or CSV File Here', 561, 248, 16, '#005F66', 'bold', 'center');
    drawText('or click "Browse Files" to upload from your computer', 561, 276, 13, '#475569', 'normal', 'center');
    roundRect(486, 294, 150, 32, 8, '#008C95');
    drawText('Browse Excel File', 561, 315, 12, '#ffffff', 'bold', 'center');

    // Data Explorer Preview
    roundRect(266, 440, 590, 200, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Data Explorer — Search & Filter All Raw Records', 288, 472, 16, '#0f172a', 'bold');
    drawText('Search by Student ID, Name, Batch Code, or Center and export to CSV/Excel.', 288, 496, 12, '#475569');
    roundRect(288, 515, 546, 100, 8, '#f8fafc', '#e2e8f0', 1);
    drawText('🔍 Search 28,450 student records across all 30 columns...', 306, 545, 13, '#64748b');
    drawText('STU-908412  |  Riya Chatterjee  |  KOL-ULTADANGA-01  |  BAT-2026-JAVA-09', 306, 585, 12, '#0f172a', 'bold');

    // Right Governance Cards: Restore Points & Clear Data
    roundRect(872, 105, 310, 255, 12, '#ffffff', '#cbd5e1', 1.5);
    drawText('Database Restore Points', 892, 136, 16, '#0f172a', 'bold');
    drawText('Save or restore 1-click backups anytime:', 892, 160, 12, '#64748b');
    roundRect(892, 180, 270, 52, 8, '#E6F4F5', '#008C95', 1);
    drawText('Snapshot: Pre-Upload Backup', 906, 202, 12, '#005F66', 'bold');
    drawText('Click "Restore" to roll back instantly', 906, 220, 11, '#475569');
    roundRect(892, 248, 270, 36, 8, '#008C95');
    drawText('+ Create New Restore Point', 1027, 271, 12, '#ffffff', 'bold', 'center');

    roundRect(872, 380, 310, 260, 12, '#ffffff', '#fecdd3', 1.5);
    drawText('Data Quality & Safe Reset', 892, 412, 16, '#0f172a', 'bold');
    drawText('• Audit missing or invalid rows', 892, 442, 12, '#334155');
    drawText('• View full Upload History log', 892, 468, 12, '#334155');
    roundRect(892, 510, 270, 40, 8, '#fff1f2', '#e11d48', 1.5);
    drawText('🗑 Clear All Portal Data', 1027, 535, 12, '#be123c', 'bold', 'center');

    drawCallout('1', 561, 210);
    drawCallout('2', 561, 560);
    drawCallout('3', 1027, 315);
    drawCallout('4', 1027, 580);
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generates and downloads the complete, illustrated, layman-friendly
 * AE INSIGHT User Guide PDF with embedded screenshots and step-by-step instructions.
 */
export async function generateUserGuidePdf(): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // =========================================================================
  // PAGE 1: COVER PAGE & TABLE OF CONTENTS
  // =========================================================================
  // Teal Hero Header Banner
  doc.setFillColor(0, 140, 149); // #008C95
  doc.rect(0, 0, pageWidth, 78, 'F');

  // Subtle Accent Stripe
  doc.setFillColor(0, 95, 102); // #005F66
  doc.rect(0, 72, pageWidth, 6, 'F');

  // Badge Pill
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 14, 68, 8, 2, 2, 'F');
  doc.setTextColor(0, 95, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('OFFICIAL EXTERNAL USER GUIDE', margin + 4, 19.5);

  // Main Cover Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('AE INSIGHT', margin, 36);

  doc.setFontSize(13);
  doc.text('Complete Step-by-Step Visual User Guide (Simple English)', margin, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    'Academic Excellence Intelligence & Insights Platform  |  Anudip Foundation',
    margin,
    54
  );
  doc.text(
    'Designed for External Users, Regional Managers, Academic Executives & Leadership',
    margin,
    61
  );

  // Welcome Box in Plain English
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(0, 140, 149);
  doc.roundedRect(margin, 86, contentWidth, 34, 3, 3, 'FD');

  doc.setTextColor(0, 95, 102);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Who is this guide for?', margin + 5, 95);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  const introText = doc.splitTextToSize(
    'This guide is written in simple, everyday English for anyone using the AE INSIGHT platform—even if you have never used a data dashboard before. Every section includes an annotated visual screenshot with numbered red circles (1, 2, 3, 4) showing you exactly where to look and what to click.',
    contentWidth - 10
  );
  doc.text(introText, margin + 5, 102);

  // Embed Cover Overview Screenshot
  const coverImg = renderGuideScreenshotCanvas('main_layout');
  if (coverImg) {
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, 126, contentWidth, 96, 2, 2, 'S');
    doc.addImage(coverImg, 'PNG', margin + 1, 127, contentWidth - 2, 94);
  }

  // Table of Contents Table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('What You Will Learn Inside This Guide (Table of Contents)', margin, 231);

  autoTable(doc, {
    startY: 234,
    margin: { left: margin, right: margin },
    head: [['Section', 'Topic Covered', 'What It Helps You Do']],
    body: [
      ['Section 1', 'Welcome & Main Screen Tour', 'Understand the Sidebar, Top KPI Cards, and Data Source bar'],
      ['Section 2', 'How to Filter & Narrow Down Data', 'Filter numbers by Diya/DeepTech, RM, AE, Center, or Program'],
      ['Section 3', 'Student Status Dashboards', 'Check Assessments, Dropouts, and 100% Exception Breakdowns'],
      ['Section 4', 'Batch & Class Operations', 'Track Running Batches (<50% Attendance), Closures & Adherence'],
      ['Section 5', 'Hiring Concerns & Challenges', 'View open trainer roles, aging severity, and RM challenges'],
      ['Section 6', 'Presentation Mode (Google Meet)', 'Enlarge any chart or table full-screen for review meetings'],
      ['Section 7', 'Student Details & PDF Reports', 'Inspect 30-column student profiles and print formal PDFs'],
      ['Section 8', 'Admin Control Portal (/admin)', 'Upload new Excel sheets, explore data, and manage backups'],
    ],
    styles: { fontSize: 7.8, cellPadding: 1.8 },
    headStyles: { fillColor: [0, 140, 149], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // =========================================================================
  // PAGES 2 TO 9: ONE DEDICATED VISUAL PAGE PER SECTION
  // =========================================================================
  USER_GUIDE_SECTIONS.forEach((sec) => {
    doc.addPage();

    // Top Section Banner
    doc.setFillColor(0, 140, 149);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`${sec.number}: ${sec.title}`, margin, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sec.subtitle, margin, 18);

    let y = 31;

    // 1. Plain English Explanation Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    const whatLines = doc.splitTextToSize(sec.whatIsIt, contentWidth - 8);
    const boxH = Math.max(20, whatLines.length * 4.3 + 10);
    doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD');

    doc.setTextColor(0, 95, 102);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('What is this feature in simple terms?', margin + 4, y + 6);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.text(whatLines, margin + 4, y + 11.5);

    y += boxH + 5;

    // 2. Annotated Screenshot Image
    const shotDataUrl = renderGuideScreenshotCanvas(sec.screenshotId);
    const imgH = 96;
    if (shotDataUrl) {
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(margin, y, contentWidth, imgH, 2, 2, 'S');
      doc.addImage(shotDataUrl, 'PNG', margin + 1, y + 1, contentWidth - 2, imgH - 2);
      y += imgH + 4;

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(sec.screenshotCaption, margin, y);
      y += 5;
    }

    // 3. Numbered Screenshot Callouts Table
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Understanding the Numbered Red Circles on the Screenshot:', margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Circle #', 'Screen Element', 'What It Does for You']],
      body: sec.callouts.map((c) => [`(${c.badge})`, c.title, c.text]),
      styles: { fontSize: 8.2, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold', textColor: [225, 29, 72], halign: 'center' },
        1: { cellWidth: 48, fontStyle: 'bold', textColor: [15, 23, 42] },
        2: { cellWidth: contentWidth - 66, textColor: [51, 65, 85] },
      },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    y = (doc as any).lastAutoTable.finalY + 5;

    // 4. Step-by-Step Instructions
    doc.setTextColor(0, 95, 102);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('How to Use It Step-by-Step:', margin, y);
    y += 4.5;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    sec.steps.forEach((step, idx) => {
      const stepLines = doc.splitTextToSize(`Step ${idx + 1}: ${step}`, contentWidth - 4);
      doc.text(stepLines, margin + 2, y);
      y += stepLines.length * 4.1 + 1.2;
    });

    // 5. Helpful Tip Box at Bottom
    y += 2;
    if (y < 272) {
      doc.setFillColor(230, 244, 245);
      doc.setDrawColor(0, 140, 149);
      const tipLines = doc.splitTextToSize(`Helpful Tip: ${sec.proTip}`, contentWidth - 8);
      const tipH = Math.max(11, tipLines.length * 4 + 5);
      doc.roundedRect(margin, y, contentWidth, tipH, 2, 2, 'FD');
      doc.setTextColor(0, 95, 102);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.text(tipLines, margin + 4, y + 5.5);
    }
  });

  // =========================================================================
  // FINAL PAGE: QUICK CHEAT SHEET & FREQUENTLY ASKED QUESTIONS (FAQ)
  // =========================================================================
  doc.addPage();
  doc.setFillColor(0, 140, 149);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Quick Reference Cheat Sheet & Troubleshooting FAQ', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Fast answers to common questions for everyday external users', margin, 18);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('1. Everyday Tasks — Quick Cheat Sheet', margin, 33);

  autoTable(doc, {
    startY: 36,
    margin: { left: margin, right: margin },
    head: [['If You Want To...', 'Where to Click']],
    body: [
      ['See overall organization numbers', 'Click "Dashboard" at the top of the Left Sidebar'],
      ['Filter by Diya or DeepTech', 'Use the "Program Type" dropdown at the top of the page'],
      ['Filter by multiple RMs, AEs, or Centers', 'Click the dropdown, tick the checkboxes you want, and view live charts'],
      ['Clear all active filters', 'Click the "Reset" button in the Filter Bar'],
      ['See 100% Program Exception share', 'Open "Exception Status" -> Program Wise chart -> click "Exception Rate %"'],
      ['See Total Students + <50% Attendance', 'Open "Running Batch Progress" -> RM Wise chart -> click "<50% Count"'],
      ['Check open trainer hiring roles', 'Click "Hiring Concerns" in the Left Sidebar'],
      ['Read RM operational challenges', 'Click "Challenges & Impact" in the Left Sidebar'],
      ['Enlarge a chart or table for Google Meet', 'Click "Presentation Mode" on the top-right of that chart/table'],
      ['Exit Presentation Mode', 'Click "Exit Presentation Mode" at the top-right or press the ESC key'],
      ['View all 30 details of a single student', 'Click directly on any student row in any table'],
      ['Download an Excel (.xlsx) spreadsheet', 'Click the green "Export Excel" button on the chart or table'],
      ['Upload a new Excel file (Admins)', 'Visit `/admin` in your browser -> click "Upload Center"'],
    ],
    styles: { fontSize: 8.3, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 68, fontStyle: 'bold', textColor: [0, 95, 102] },
      1: { cellWidth: contentWidth - 68, textColor: [30, 41, 59] },
    },
    headStyles: { fillColor: [0, 140, 149], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const faqStartY = (doc as any).lastAutoTable.finalY + 9;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('2. Frequently Asked Questions (FAQ)', margin, faqStartY);

  autoTable(doc, {
    startY: faqStartY + 3,
    margin: { left: margin, right: margin },
    head: [['Common Question', 'Simple Solution']],
    body: FAQ_ITEMS.map((item) => [item.q, item.a]),
    styles: { fontSize: 8.2, cellPadding: 2.4 },
    columnStyles: {
      0: { cellWidth: 62, fontStyle: 'bold', textColor: [15, 23, 42] },
      1: { cellWidth: contentWidth - 62, textColor: [51, 65, 85] },
    },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Add Page Numbers and Footer on All Pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'AE INSIGHT Complete User Guide  |  Academic Excellence Team  |  Anudip Foundation',
      margin,
      pageHeight - 7
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save('AE_INSIGHT_User_Guide.pdf');
}
