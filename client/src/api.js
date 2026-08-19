import axios from 'axios';


const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

export default API;

// Auth (register/login/me) is now handled directly via supabase-js
// (see UserContext.jsx, LoginPage.jsx) - these Express endpoints are no
// longer called by the client. Expense/goal functions below still go
// through the old Express/Mongo backend until Phase 5.

export const getExpenses = async (token) => {
  try {
    const { data } = await API.get('/expenses', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return data;
  } catch (err) {
    console.error('Failed to fetch expenses:', err);
    return [];
  }
};

export async function addExpense(expenseData) {
  const token = localStorage.getItem("token");

  const response = await axios.post(
    "http://localhost:5000/api/expenses",
    expenseData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
}

export const deleteExpense = async (id, token) => {
  const res = await API.delete (`/expenses/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const updateExpense = async (id, updatedTx, token) => {
  const res = await API.put(`/expenses/${id}`, updatedTx, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
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
