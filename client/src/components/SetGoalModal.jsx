import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from "react-i18next";

const SetGoalModal = ({ isOpen, onClose, onSave, initialGoal }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (initialGoal) {
      setAmount(initialGoal.amount);
      setStartDate(new Date(initialGoal.startDate));
      setEndDate(new Date(initialGoal.endDate));
    } else {
      setAmount("");
      setStartDate(null);
      setEndDate(null);
    }
  }, [initialGoal, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !startDate || !endDate) {
      alert("Please fill in all fields.");
      return;
    }
    onSave({
      amount: parseFloat(amount),
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button
          className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="text-xl font-semibold mb-4">{t("savingsGoalModal.title")}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">{t("savingsGoalModal.goal")}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{t("savingsGoalModal.start")}</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              className="w-full border rounded px-3 py-2"
              dateFormat="yyyy-MM-dd"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{t("savingsGoalModal.end")}</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              className="w-full border rounded px-3 py-2"
              dateFormat="yyyy-MM-dd"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            {t("savingsGoalModal.setGoal")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetGoalModal;
