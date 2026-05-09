import { Router }  from 'express';
import ExcelJS      from 'exceljs';
import db           from '../db/database.js';

// Excel status colours are duplicated here from the frontend design/colors.js
// because this runs on the server (no ES module sharing with client).
// If you add a status, update both files.
const STATUS_FILL = {
  Applied:       'FFBFDBFE',
  Interview:     'FFD1FAE5',
  Offer:         'FFCCFBF1',
  Rejected:      'FFFECDD3',
  'No Response': 'FFFEF3C7',
  Discarded:     'FFF1F5F9',
};

const router = Router();

// GET /api/export/excel?status=Applied
router.get('/excel', async (req, res) => {
  const { status } = req.query;
  const uid = req.user.id;

  const rows = (status && status !== 'All')
    ? db.prepare('SELECT * FROM applications WHERE user_id = ? AND status = ? ORDER BY applied_date DESC').all(uid, status)
    : db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY applied_date DESC').all(uid);

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Himanshu Job Application Tracker';
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Applications', {
    views:     [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  });

  // Column definitions — to add a column: add an entry here
  ws.columns = [
    { header: 'ID',              key: 'id',              width: 6  },
    { header: 'Company',         key: 'company',         width: 22 },
    { header: 'Role',            key: 'role',            width: 28 },
    { header: 'Location',        key: 'location',        width: 18 },
    { header: 'Portal',          key: 'portal',          width: 14 },
    { header: 'Status',          key: 'status',          width: 14 },
    { header: 'Applied Date',    key: 'applied_date',    width: 14 },
    { header: 'Interview Date',  key: 'interview_date',  width: 14 },
    { header: 'Salary Min',      key: 'salary_min',      width: 12 },
    { header: 'Salary Max',      key: 'salary_max',      width: 12 },
    { header: 'Currency',        key: 'salary_currency', width: 10 },
    { header: 'Recruiter',       key: 'recruiter_name',  width: 20 },
    { header: 'Recruiter Email', key: 'recruiter_email', width: 28 },
    { header: 'Remarks',         key: 'remarks',         width: 36 },
    { header: 'Job URL',         key: 'job_url',         width: 42 },
  ];

  // Style the header row
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF00BFA5' } } };
  });

  // Data rows — colour-coded by status
  for (const row of rows) {
    const dataRow = ws.addRow(row);
    const argb    = STATUS_FILL[row.status] ?? 'FFFFFFFF';
    dataRow.height = 20;
    dataRow.eachCell((cell) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      cell.alignment = { vertical: 'middle', wrapText: false };
    });
  }

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + ws.columns.length)}1` };

  const filename = `Job_Applications_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await wb.xlsx.write(res);
  res.end();
});

export default router;
