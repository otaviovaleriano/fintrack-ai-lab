import '../i18n';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { getExpenses, fetchSavingsGoal } from '../api';
import { useUser } from '../UserContext';

jest.mock('../api', () => ({
  getExpenses: jest.fn(),
  fetchSavingsGoal: jest.fn(),
}));
jest.mock('../UserContext', () => ({
  useUser: jest.fn(),
}));
// jsPDF attaches `save` as an own instance property inside its own
// constructor (not on jsPDF.prototype), so it can't be jest.spyOn'd
// directly - this subclass overrides it after super() runs, capturing
// the real PDF bytes via the real (unmocked) .output() instead of
// letting .save() reach the browser-download DOM APIs jsdom lacks.
const mockCapturedPdf = { current: null };
jest.mock('jspdf', () => {
  const actual = jest.requireActual('jspdf');
  class TestJsPDF extends actual.default {
    constructor(...args) {
      super(...args);
      this.save = () => {
        mockCapturedPdf.current = this.output('arraybuffer');
      };
    }
  }
  return { __esModule: true, default: TestJsPDF };
});
// The category/income-source charts are recharts components with their
// own jsdom-in-a-zero-size-container quirks unrelated to what this file
// tests (Dashboard's own grouping calculations) - stubbed out so the
// data they'd be given can be asserted on directly instead.
jest.mock('../components/dashboard/SpendingByCategoryChart', () => ({ data }) => (
  <div data-testid="spending-chart">{JSON.stringify(data)}</div>
));
jest.mock('../components/dashboard/IncomeSourceChart', () => ({ data }) => (
  <div data-testid="income-chart">{JSON.stringify(data)}</div>
));

const transactions = [
  { type: 'expense', category: 'Grocery', amount: 100 },
  { type: 'expense', category: 'Grocery', amount: 50 },
  { type: 'expense', category: 'Bills', amount: 75 },
  { type: 'income', category: 'Salary', amount: 2000 },
  { type: 'income', category: 'Freelance', amount: 300 },
];

beforeEach(() => {
  useUser.mockReturnValue({ user: { id: 'user-1' } });
});

test('computes total spent from expense-type transactions only', async () => {
  getExpenses.mockResolvedValue(transactions);
  fetchSavingsGoal.mockResolvedValue(null);

  render(<Dashboard />);

  // 100 + 50 + 75 = 225; income transactions must not be included.
  expect(await screen.findByText('$225.00')).toBeInTheDocument();
});

test('groups spending by category and income by source correctly', async () => {
  getExpenses.mockResolvedValue(transactions);
  fetchSavingsGoal.mockResolvedValue(null);

  render(<Dashboard />);

  // findByTestId only waits for the element to exist - it's present
  // (with empty data) from the first render, before getExpenses
  // resolves, so the assertion must wait on its content instead.
  await waitFor(() =>
    expect(JSON.parse(screen.getByTestId('spending-chart').textContent)).toEqual([
      { name: 'Grocery', amount: 150 },
      { name: 'Bills', amount: 75 },
    ])
  );

  expect(JSON.parse(screen.getByTestId('income-chart').textContent)).toEqual([
    { name: 'Salary', amount: 2000 },
    { name: 'Freelance', amount: 300 },
  ]);
});

test('with no transactions, totals are zero and category groupings are empty', async () => {
  getExpenses.mockResolvedValue([]);
  fetchSavingsGoal.mockResolvedValue(null);

  render(<Dashboard />);

  // $0.00 and empty arrays are both the pre-fetch initial state and
  // the correct post-fetch result here, so there's no risk of this
  // false-passing on stale data the way the category-grouping test
  // above could - but still wait for the effect's promise to actually
  // settle before asserting, for the same reason as elsewhere in this
  // file.
  await waitFor(() => expect(getExpenses).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(fetchSavingsGoal).toHaveBeenCalledTimes(1));
  expect(screen.getByText('$0.00')).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId('spending-chart').textContent)).toEqual([]);
  expect(JSON.parse(screen.getByTestId('income-chart').textContent)).toEqual([]);
});

test('PDF export produces a well-formed PDF without throwing', async () => {
  getExpenses.mockResolvedValue(transactions);
  fetchSavingsGoal.mockResolvedValue({ amount: 500, startDate: '2026-01-01', endDate: '2026-01-31' });
  mockCapturedPdf.current = null;

  render(<Dashboard />);
  await screen.findByText('$225.00');

  // addImage, setFontSize, text, and both chained autoTable calls
  // (including the doc.lastAutoTable.finalY offset) all run for real -
  // only the module-mocked .save() (see top of file) is replaced, to
  // avoid jsdom's lack of browser-download DOM APIs. This is a
  // structural smoke test only: it asserts the output is a well-formed
  // PDF, not that its byte size relates to any prior run - see
  // Modernization 4/5's note against treating size as a compatibility
  // contract.
  fireEvent.click(screen.getByText('Download Report'));
  fireEvent.click(screen.getByText('📄 Download PDF'));

  expect(mockCapturedPdf.current).not.toBeNull();
  const bytes = new Uint8Array(mockCapturedPdf.current);
  const header = String.fromCharCode(...bytes.slice(0, 5));
  expect(header).toBe('%PDF-');
  expect(mockCapturedPdf.current.byteLength).toBeGreaterThan(0);
});
