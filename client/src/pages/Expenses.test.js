import '../i18n';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Expenses from './Expenses';
import { getExpenses, fetchSavingsGoal } from '../api';
import { useUser } from '../UserContext';

jest.mock('../api', () => ({
  getExpenses: jest.fn(),
  deleteExpense: jest.fn(),
  addExpense: jest.fn(),
  updateExpense: jest.fn(),
  fetchSavingsGoal: jest.fn(),
  saveSavingsGoal: jest.fn(),
  clearSavingsGoal: jest.fn(),
}));
jest.mock('../UserContext', () => ({
  useUser: jest.fn(),
}));
// Same rationale as Dashboard.test.js: jsPDF attaches `save` as an own
// instance property, not on jsPDF.prototype, so it must be replaced via
// a module mock rather than jest.spyOn.
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

const transactions = [
  { id: 1, date: '2026-01-05', description: 'Groceries', amount: 50, type: 'expense', category: 'Grocery' },
  { id: 2, date: '2026-01-15', description: 'Salary', amount: 2000, type: 'income', category: 'Current Work' },
  { id: 3, date: '2026-02-01', description: 'Rent', amount: 800, type: 'expense', category: 'Bills' },
];

function getFilterInputs(container) {
  const textInputs = container.querySelectorAll('input[type="text"]');
  return { start: textInputs[0], end: textInputs[1] };
}

beforeEach(() => {
  useUser.mockReturnValue({ user: { id: 'user-1' } });
  getExpenses.mockResolvedValue(transactions);
  fetchSavingsGoal.mockResolvedValue(null);
  mockCapturedPdf.current = null;
});

test('with no date filter set, all transactions are shown', async () => {
  render(<Expenses />);

  expect(await screen.findByText('Groceries')).toBeInTheDocument();
  expect(screen.getByText('Salary')).toBeInTheDocument();
  expect(screen.getByText('Rent')).toBeInTheDocument();
});

test('a start date excludes transactions before it', async () => {
  const { container } = render(<Expenses />);
  await screen.findByText('Groceries');

  fireEvent.change(getFilterInputs(container).start, { target: { value: '2026-01-10' } });

  await waitFor(() => expect(screen.queryByText('Groceries')).not.toBeInTheDocument());
  expect(screen.getByText('Salary')).toBeInTheDocument();
  expect(screen.getByText('Rent')).toBeInTheDocument();
});

test('an end date excludes transactions after it, and combined with a start date narrows to a single result', async () => {
  const { container } = render(<Expenses />);
  await screen.findByText('Groceries');

  const { start, end } = getFilterInputs(container);
  fireEvent.change(start, { target: { value: '2026-01-10' } });
  fireEvent.change(end, { target: { value: '2026-01-31' } });

  await waitFor(() => {
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.queryByText('Rent')).not.toBeInTheDocument();
  });
});

test('a date range matching nothing shows the empty state', async () => {
  const { container } = render(<Expenses />);
  await screen.findByText('Groceries');

  const { start, end } = getFilterInputs(container);
  fireEvent.change(start, { target: { value: '2027-01-01' } });
  fireEvent.change(end, { target: { value: '2027-01-31' } });

  expect(await screen.findByText('No transactions found.')).toBeInTheDocument();
});

test('with zero transactions, the empty state is shown', async () => {
  getExpenses.mockResolvedValue([]);

  render(<Expenses />);

  expect(await screen.findByText('No transactions found.')).toBeInTheDocument();
});

test('PDF export produces a well-formed PDF without throwing', async () => {
  render(<Expenses />);
  await screen.findByText('Groceries');

  // Exercises the export with the currently-filtered (here, full)
  // transaction list - addImage, setFontSize, text, and autoTable all
  // run for real, only .save() is replaced (see module mock above).
  // Structural smoke test only: %PDF- header and non-zero length, not
  // byte-size monotonicity.
  fireEvent.click(screen.getByText('Download Report'));
  fireEvent.click(screen.getByText('📄 Download PDF'));

  expect(mockCapturedPdf.current).not.toBeNull();
  const bytes = new Uint8Array(mockCapturedPdf.current);
  const header = String.fromCharCode(...bytes.slice(0, 5));
  expect(header).toBe('%PDF-');
  expect(mockCapturedPdf.current.byteLength).toBeGreaterThan(0);
});

test('PDF export with zero transactions still produces a well-formed PDF', async () => {
  getExpenses.mockResolvedValue([]);

  render(<Expenses />);
  await screen.findByText('No transactions found.');

  fireEvent.click(screen.getByText('Download Report'));
  fireEvent.click(screen.getByText('📄 Download PDF'));

  expect(mockCapturedPdf.current).not.toBeNull();
  const bytes = new Uint8Array(mockCapturedPdf.current);
  expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
});
