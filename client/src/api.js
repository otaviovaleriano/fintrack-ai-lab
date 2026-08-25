import { supabase } from './supabaseClient';

// Auth (register/login/me), expenses, and savings goals all now go
// directly through Supabase. Nothing in the client imports axios or an
// `API` instance anymore - confirmed via grep before removing it here -
// so the Express-backed HTTP client that used to live in this file is
// gone rather than left as unused dead code.

export const getExpenses = async () => {
  const { data, error } = await supabase
    .from('expenses')
    .select()
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
};

export async function addExpense(expenseData) {
  // Ownership identity is derived here, inside the data layer, from the
  // already-established local session (supabase.auth.getSession() reads
  // the client's cached session - no network round trip) - not passed
  // in by the caller alongside form data. RLS's WITH CHECK is still the
  // real enforcement: even if this value were somehow wrong, Postgres
  // independently verifies it against the session's actual JWT.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...expenseData, user_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const deleteExpense = async (id) => {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
};

export const updateExpense = async (id, updatedTx) => {
  const { data, error } = await supabase
    .from('expenses')
    .update(updatedTx)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// public.savings_goals uses snake_case columns (start_date/end_date),
// but the UI (SavingsGoalCard.jsx, SetGoalModal.jsx) already expects
// camelCase (startDate/endDate), matching the old Mongoose shape. api.js
// is the seam that translates between the two, so nothing else in the
// app needs to change.
const toClientGoal = (row) =>
  row && {
    amount: row.amount,
    startDate: row.start_date,
    endDate: row.end_date,
  };

export const fetchSavingsGoal = async () => {
  // maybeSingle(), not single(): zero rows is a valid, expected state
  // (a user who hasn't set a goal yet) - single() would throw on that,
  // treating "no goal" as an error rather than a normal result.
  const { data, error } = await supabase
    .from('savings_goals')
    .select()
    .maybeSingle();
  if (error) throw error;
  return toClientGoal(data); // null when no goal is set
};

export const saveSavingsGoal = async (goal) => {
  // A savings goal is one-per-user (savings_goals.user_id is unique),
  // matching the old Mongo controller's findOneAndUpdate(..., {upsert:
  // true}) - a plain insert() would fail with a duplicate-key error the
  // second time a user sets a goal. upsert() with onConflict: 'user_id'
  // replicates "create if absent, otherwise update" in one call.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from('savings_goals')
    .upsert(
      {
        user_id: session.user.id,
        amount: goal.amount,
        start_date: goal.startDate,
        end_date: goal.endDate,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return toClientGoal(data);
};

export const clearSavingsGoal = async () => {
  // Unlike deleteExpense(id), there's no id to target here - user_id is
  // how the one row to delete is identified, not a redundant filter
  // RLS would have applied anyway.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('user_id', session.user.id);
  if (error) throw error;
};
