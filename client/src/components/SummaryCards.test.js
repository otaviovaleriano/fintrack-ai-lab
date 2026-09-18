import '../i18n';
import { render, screen } from '@testing-library/react';
import SummaryCards from './SummaryCards';

test('balance and amount-spent totals are computed correctly from mixed transactions', () => {
  const transactions = [
    { type: 'income', amount: 1000 },
    { type: 'income', amount: 200 },
    { type: 'expense', amount: 300 },
    { type: 'expense', amount: 50 },
  ];

  render(
    <SummaryCards
      transactions={transactions}
      goalAmount={null}
      handleGoalEdit={jest.fn()}
      handleGoalClear={jest.fn()}
    />
  );

  // balance = income (1200) - expense (350) = 850
  expect(screen.getByText('$850.00')).toBeInTheDocument();
  expect(screen.getByText('$350.00')).toBeInTheDocument();
});

test('with no transactions, both totals are zero', () => {
  render(
    <SummaryCards
      transactions={[]}
      goalAmount={null}
      handleGoalEdit={jest.fn()}
      handleGoalClear={jest.fn()}
    />
  );

  // Both the balance and amount-spent cards read $0.00 here.
  expect(screen.getAllByText('$0.00')).toHaveLength(2);
});

test('a balance can go negative when expenses exceed income', () => {
  const transactions = [
    { type: 'income', amount: 100 },
    { type: 'expense', amount: 250 },
  ];

  render(
    <SummaryCards
      transactions={transactions}
      goalAmount={null}
      handleGoalEdit={jest.fn()}
      handleGoalClear={jest.fn()}
    />
  );

  expect(screen.getByText('$-150.00')).toBeInTheDocument();
});
