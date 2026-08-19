import axios from 'axios';
import { supabase } from './supabaseClient';


const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

export default API;

// Auth (register/login/me) is now handled directly via supabase-js
// (see UserContext.jsx, LoginPage.jsx) - these Express endpoints are no
// longer called by the client. Savings-goal functions below still go
// through the old Express/Mongo backend - that migration is deferred
// (Phase 6). Expense functions now go directly through Supabase.

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

export const fetchSavingsGoal = async (token) => {
  const res = await API.get("/savings-goal", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const saveSavingsGoal = async (goal, token) => {
  const res = await API.post("/savings-goal", goal, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const clearSavingsGoal = async (token) => {
  await API.delete("/savings-goal", {
    headers: { Authorization: `Bearer ${token}` },
  });
};
