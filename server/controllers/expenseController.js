import Expense from "../models/Expense.js";

export const getUserExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user._id }).sort({
      date: -1,
    });
    res.json(expenses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { type, category, description, amount, date } = req.body;
    if (
      typeof type !== "string" ||
      !["income", "expense"].includes(type) ||
      typeof category !== "string" ||
      typeof description !== "string" ||
      typeof date !== "string" ||
      isNaN(parseFloat(amount))
    ) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const newExpense = new Expense({
      type,
      category,
      description,
      amount: parseFloat(amount),
      date,
      user: req.user._id,
    });

    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const deleted = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deleted) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { type, category, description, amount, date } = req.body;

    const updated = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { type, category, description, amount, date },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Expense not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
