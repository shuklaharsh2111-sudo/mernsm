import { Donut, GroupedBars, StackedRows, Legend, Card, Empty, C } from './MonthlyCharts';

/*
  Charts for the designer monthly report. Same hand-drawn SVG blocks as the SME report,
  fed with the data from GET /des/monthly-reports.
*/

const STATUS_COLORS = { approved: C.approved, submitted: C.pending, redo: C.redo, pending: '#9aa5a0' };
const STATUS_LABELS = { approved: 'Approved', submitted: 'Awaiting review', redo: 'Redo requested', pending: 'To do' };
const STATUS_ORDER = ['approved', 'submitted', 'redo', 'pending'];

const countBy = (list, key) => list.reduce((acc, item) => {
  acc[item[key]] = (acc[item[key]] || 0) + 1;
  return acc;
}, {});

export const DesStatusChart = ({ r, monthLabel }) => {
  const counts = countBy(r.creatives, 'status');
  const slices = STATUS_ORDER.map((k) => ({ label: STATUS_LABELS[k], value: counts[k] || 0, color: STATUS_COLORS[k] }));
  return (
    <div className="mr-charts one">
      <Card title="Creative status" sub={`Where each creative stands now · ${monthLabel}`}>
        {r.creatives.length > 0 ? (
          <div className="mr-donut-row">
            <Donut slices={slices} center={r.creatives.length} sub="creatives" />
            <Legend items={slices.map((s) => ({ ...s, value: s.value }))} />
          </div>
        ) : <Empty />}
      </Card>
    </div>
  );
};

export const DesWeeklyChart = ({ r }) => {
  // the fifth week only exists for the last days of long months
  const weeks = r.weekly.filter((w, i) => i < 4 || w.submitted + w.approved + w.redo > 0);
  const total = weeks.reduce((a, w) => a + w.submitted + w.approved + w.redo, 0);
  const series = [{ color: C.pending }, { color: C.approved }, { color: C.redo }];
  return (
    <div className="mr-charts one">
      <Card title="Weekly activity" sub="Designs delivered, approved and sent back">
        {total > 0 ? (
          <>
            <GroupedBars groups={weeks.map((w) => ({ label: w.label, values: [w.submitted, w.approved, w.redo] }))} series={series} />
            <Legend items={[{ label: 'Delivered', color: C.pending }, { label: 'Approved', color: C.approved }, { label: 'Redo', color: C.redo }]} />
          </>
        ) : <Empty text="No activity this month" />}
      </Card>
    </div>
  );
};

export const DesCompareChart = ({ r, monthLabel, previousLabel }) => {
  const s = r.stats;
  const p = r.previousStats;
  const groups = [['Assigned', 'assigned'], ['Delivered', 'submitted'], ['Approved', 'approved'], ['Redo', 'redo'], ['To do', 'pending']]
    .map(([label, k]) => ({ label, values: [p[k], s[k]] }));
  const any = groups.some((g) => g.values.some((v) => v > 0));
  return (
    <div className="mr-charts one">
      <Card title="This month vs last month" sub="Creative counts">
        {any ? (
          <>
            <GroupedBars groups={groups} series={[{ color: C.lastMonth }, { color: C.thisMonth }]} />
            <Legend items={[{ label: previousLabel, color: C.lastMonth }, { label: monthLabel, color: C.thisMonth }]} />
          </>
        ) : <Empty />}
      </Card>
    </div>
  );
};

export const DesCompanyChart = ({ r }) => {
  const byCompany = {};
  r.creatives.forEach((c) => {
    byCompany[c.company] = byCompany[c.company] || { label: c.company, approved: 0, submitted: 0, redo: 0, pending: 0 };
    byCompany[c.company][c.status] = (byCompany[c.company][c.status] || 0) + 1;
  });
  const rows = Object.values(byCompany);
  const parts = STATUS_ORDER.map((k) => ({ key: k, color: STATUS_COLORS[k] }));
  return (
    <div className="mr-charts one">
      <Card title="Company-wise creatives" sub="Current status of each company’s creatives">
        {rows.length ? (
          <>
            <StackedRows rows={rows} parts={parts} />
            <Legend items={STATUS_ORDER.map((k) => ({ label: STATUS_LABELS[k], color: STATUS_COLORS[k] }))} />
          </>
        ) : <Empty />}
      </Card>
    </div>
  );
};
