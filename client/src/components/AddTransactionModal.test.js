import '../i18n';
import { render, fireEvent, waitFor } from '@testing-library/react';
import AddTransactionModal from './AddTransactionModal';
import { addExpense, updateExpense } from '../api';

// The form's inputs have no htmlFor/id association with their labels
// (a pre-existing markup gap, not something this test phase changes),
// so fields are queried by their `name` attribute via the container
// rather than by accessible label text.
jest.mock('../api', () => ({
  addExpense: jest.fn(),
  updateExpense: jest.fn(),
}));

function fillField(container, name, value) {
  fireEvent.change(container.querySelector(`[name="${name}"]`), {
    target: { value },
  });
}

test('adding a new transaction sends a positive payload contract to addExpense, not updateExpense', async () => {
  const savedTx = { id: 1, type: 'expense', category: 'Grocery', description: 'Coffee', amount: 12.5, date: '2026-01-01' };
  addExpense.mockResolvedValue(savedTx);
  const onAdd = jest.fn();
  const onClose = jest.fn();

  const { container } = render(
    <AddTransactionModal isOpen onClose={onClose} onAdd={onAdd} defaultData={null} />
  );

  fillField(container, 'category', 'Grocery');
  fillField(container, 'description', 'Coffee');
  fillField(container, 'amount', '12.50');
  fillField(container, 'date', '2026-01-01');

  fireEvent.submit(container.querySelector('form'));

  await waitFor(() => expect(addExpense).toHaveBeenCalledTimes(1));

  const payload = addExpense.mock.calls[0][0];
  expect(payload).toEqual({
    type: 'expense',
    category: 'Grocery',
    description: 'Coffee',
    amount: 12.5,
    date: '2026-01-01',
  });
  // amount must be a parsed number, not the raw string from the input
  expect(typeof payload.amount).toBe('number');
  // ownership/identity fields are api.js's responsibility, not the
  // modal's - the payload must not leak them.
  expect(payload).not.toHaveProperty('id');
  expect(payload).not.toHaveProperty('user_id');

  expect(updateExpense).not.toHaveBeenCalled();
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(savedTx));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('editing an existing transaction sends its id to updateExpense, not addExpense', async () => {
  const existing = {
    id: 42,
    type: 'income',
    category: 'Current Work',
    description: 'Freelance',
    amount: 100,
    date: '2026-02-02',
  };
  const updated = { ...existing, amount: 150 };
  updateExpense.mockResolvedValue(updated);
  const onAdd = jest.fn();
  const onClose = jest.fn();

  const { container } = render(
    <AddTransactionModal isOpen onClose={onClose} onAdd={onAdd} defaultData={existing} />
  );

  // Prefilled from defaultData - confirm before changing anything.
  expect(container.querySelector('[name="description"]').value).toBe('Freelance');
  expect(container.querySelector('[name="amount"]').value).toBe('100');

  fillField(container, 'amount', '150');
  fireEvent.submit(container.querySelector('form'));

  await waitFor(() => expect(updateExpense).toHaveBeenCalledTimes(1));

  const [id, payload] = updateExpense.mock.calls[0];
  expect(id).toBe(42);
  expect(payload).toEqual({
    type: 'income',
    category: 'Current Work',
    description: 'Freelance',
    amount: 150,
    date: '2026-02-02',
  });
  expect(payload).not.toHaveProperty('id');

  expect(addExpense).not.toHaveBeenCalled();
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(updated));
});
