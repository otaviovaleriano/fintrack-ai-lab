import '../i18n';
import { render, fireEvent } from '@testing-library/react';
import SetGoalModal from './SetGoalModal';

// Date-value conversion itself (parseCalendarDate/formatCalendarDate)
// is already covered by lib/calendarDate.test.js under both timezones -
// these tests only cover the modal's own state wiring: prefill, reset,
// and the shape of the payload it hands to onSave.

function getInputs(container) {
  return {
    amount: container.querySelector('input[type="number"]'),
    // Both DatePickers render a plain text input with no distinguishing
    // attribute beyond DOM order (start before end), matching the JSX.
    start: container.querySelectorAll('input[type="text"]')[0],
    end: container.querySelectorAll('input[type="text"]')[1],
  };
}

const initialGoal = { amount: 500, startDate: '2026-01-01', endDate: '2026-01-31' };

test('prefills amount and dates from initialGoal when opened', () => {
  const { container } = render(
    <SetGoalModal isOpen onClose={jest.fn()} onSave={jest.fn()} initialGoal={initialGoal} />
  );

  const { amount, start, end } = getInputs(container);
  expect(amount.value).toBe('500');
  expect(start.value).toBe('2026-01-01');
  expect(end.value).toBe('2026-01-31');
});

test('resets to blank fields when reopened with no goal', () => {
  const { container, rerender } = render(
    <SetGoalModal isOpen onClose={jest.fn()} onSave={jest.fn()} initialGoal={initialGoal} />
  );

  rerender(<SetGoalModal isOpen onClose={jest.fn()} onSave={jest.fn()} initialGoal={null} />);

  const { amount, start, end } = getInputs(container);
  expect(amount.value).toBe('');
  expect(start.value).toBe('');
  expect(end.value).toBe('');
});

test('submitting sends amount as a parsed number alongside the unchanged dates', () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  const { container } = render(
    <SetGoalModal isOpen onClose={onClose} onSave={onSave} initialGoal={initialGoal} />
  );

  fireEvent.change(getInputs(container).amount, { target: { value: '750' } });
  fireEvent.submit(container.querySelector('form'));

  expect(onSave).toHaveBeenCalledWith({
    amount: 750,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });
  expect(typeof onSave.mock.calls[0][0].amount).toBe('number');
  expect(onClose).toHaveBeenCalledTimes(1);
});
