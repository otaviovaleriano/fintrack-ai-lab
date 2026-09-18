import '../i18n';
import { render, screen, fireEvent } from '@testing-library/react';
import SavingsGoalCard from './SavingsGoalCard';

test('with no goal set, shows the empty state and Set Goal triggers onEdit', () => {
  const onEdit = jest.fn();
  render(<SavingsGoalCard goal={null} spent={0} onEdit={onEdit} onClear={jest.fn()} />);

  expect(screen.getByText('No goal set yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Set an Expenses Limit Goal'));
  expect(onEdit).toHaveBeenCalledTimes(1);
});

test('below the 75% threshold, no alert is shown and progress is reported correctly', () => {
  render(
    <SavingsGoalCard
      goal={{ amount: 100, startDate: '2026-01-01', endDate: '2026-01-31' }}
      spent={50}
      onEdit={jest.fn()}
      onClear={jest.fn()}
    />
  );

  expect(screen.getByText(/Spent \$50\.00 \(50%\)/)).toBeInTheDocument();
  expect(screen.queryByText(/80% of your goal/)).not.toBeInTheDocument();
  expect(screen.queryByText(/75% of your goal/)).not.toBeInTheDocument();
});

test('at exactly the 75% threshold, the 75% alert shows but not the 80% one', () => {
  render(
    <SavingsGoalCard
      goal={{ amount: 100, startDate: '2026-01-01', endDate: '2026-01-31' }}
      spent={75}
      onEdit={jest.fn()}
      onClear={jest.fn()}
    />
  );

  expect(screen.getByText(/75% of your goal/)).toBeInTheDocument();
  expect(screen.queryByText(/80% of your goal/)).not.toBeInTheDocument();
});

test('at or above the 80% threshold, the 80% alert takes over from the 75% one', () => {
  render(
    <SavingsGoalCard
      goal={{ amount: 100, startDate: '2026-01-01', endDate: '2026-01-31' }}
      spent={80}
      onEdit={jest.fn()}
      onClear={jest.fn()}
    />
  );

  expect(screen.getByText(/80% of your goal/)).toBeInTheDocument();
  expect(screen.queryByText(/75% of your goal/)).not.toBeInTheDocument();
});

test('spending past the goal amount caps displayed progress at 100%, not over', () => {
  render(
    <SavingsGoalCard
      goal={{ amount: 100, startDate: '2026-01-01', endDate: '2026-01-31' }}
      spent={150}
      onEdit={jest.fn()}
      onClear={jest.fn()}
    />
  );

  expect(screen.getByText(/Spent \$150\.00 \(100%\)/)).toBeInTheDocument();
});

test('Edit and Clear buttons call their respective handlers', () => {
  const onEdit = jest.fn();
  const onClear = jest.fn();
  render(
    <SavingsGoalCard
      goal={{ amount: 100, startDate: '2026-01-01', endDate: '2026-01-31' }}
      spent={10}
      onEdit={onEdit}
      onClear={onClear}
    />
  );

  fireEvent.click(screen.getByText('Edit'));
  fireEvent.click(screen.getByText('Clear'));

  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onClear).toHaveBeenCalledTimes(1);
});
