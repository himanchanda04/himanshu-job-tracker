import { Router }  from 'express';
import ExcelJS      from 'exceljs';
import pool         from '../db/database.js';

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

  let result;
  if (status && status !== 'All') {
    result = await pool.query(
      'SELECT * FROM applications WHERE user_id = $1 AND status = $2 ORDER BY applied_date DESC',
      [uid, status]
    );
  } else {
    result = await pool.query(
      'SELECT * FROM applications WHERE user_id = $1 ORDER BY applied_date DESC',
      [uid]
    );
  }
  const rows = result.rows;

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Himanshu Job Application Tracker';
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Applications', {
    views:     [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  });

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

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.font      = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF00BFA5' } } };
  });

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
