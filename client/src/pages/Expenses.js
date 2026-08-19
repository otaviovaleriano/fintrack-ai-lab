import React, { useState, useEffect } from "react";
import AddTransactionModal from "../components/AddTransactionModal";
import SummaryCards from "../components/SummaryCards";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import DatePicker from "react-datepicker";
import { isAfter, isBefore, parseISO } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";
import { getExpenses, deleteExpense } from "../api";
import { useUser } from "../UserContext";
import {
  fetchSavingsGoal,
  saveSavingsGoal,
  clearSavingsGoal as clearGoalAPI,
} from "../api";
import SetGoalModal from "../components/SetGoalModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button } from "../components/ui/button";
import i18n from "i18next";
import { useTranslation } from "react-i18next";

const Expenses = () => {
  const [transactions, setTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [goal, setGoal] = useState(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { t } = useTranslation();

  const { user } = useUser();

  const fetchExpenses = async () => {
    try {
      const data = await getExpenses();
      setTransactions(data);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [user]);

  useEffect(() => {
    if (startDate)
      localStorage.setItem("filterStartDate", startDate.toISOString());
    else localStorage.removeItem("filterStartDate");

    if (endDate) localStorage.setItem("filterEndDate", endDate.toISOString());
    else localStorage.removeItem("filterEndDate");
  }, [startDate, endDate]);

  const handleAddOrUpdateTransaction = (savedTx) => {
    setTransactions((prev) => {
      const index = prev.findIndex((tx) => tx.id === savedTx.id);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = savedTx;
        return updated.sort((a, b) => new Date(b.date) - new Date(a.date));
      } else {
        return [savedTx, ...prev].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
      }
    });

    setEditTarget(null);
  };

  useEffect(() => {
    const fetchGoal = async () => {
      try {
        // Savings Goal is still on the old Express/Mongo path (Phase 6,
        // deferred) and has no working auth of its own now - left
        // intentionally broken rather than propped up with a dead
        // localStorage token read.
        const goalData = await fetchSavingsGoal();
        setGoal(goalData);
      } catch (err) {
        console.error("Failed to load goal:", err);
      }
    };

    if (user) {
      fetchGoal();
    }
  }, [user]);

  const handleEdit = (tx) => {
    setEditTarget(tx);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteExpense(id);
        setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      } catch (err) {
        console.error("Failed to delete:", err);
        alert("Error deleting transaction.");
      }
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const txDate = parseISO(tx.date);
    if (startDate && isBefore(txDate, startDate)) return false;
    if (endDate && isAfter(txDate, endDate)) return false;
    return true;
  });

  const handleGoalEdit = () => {
    setIsGoalModalOpen(true);
  };

  const handleGoalClear = async () => {
    if (window.confirm("Are you sure you want to clear your savings goal?")) {
      try {
        await clearGoalAPI();
        setGoal(null);
      } catch (err) {
        console.error("Error clearing goal:", err);
        alert("Failed to clear goal.");
      }
    }
  };

  const handlePDFExport = () => {
    const doc = new jsPDF();
    const logoBase64 =
      "data:image/jpeg;base64,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";
    doc.addImage(logoBase64, "PNG", 160, 15, 30, 20);
    doc.setFontSize(18);
    doc.text(t("expensesPage.transactionReport"), 14, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableData = filteredTransactions.map((t) => [
      t.date,
      t.description,
      t.amount,
      t.type,
      t.category,
    ]);

    console.log("autoTable?", typeof doc.autoTable);
    autoTable(doc, {
      startY: 40,
      head: [["Date", "Description", "Amount", "Type", "Category"]],
      body: tableData,
    });

    doc.save("expenses_report.pdf");
  };

  const handleExcelExport = () => {
    const formatted = filteredTransactions.map((t) => ({
      Date: t.date,
      Description: t.description,
      Amount: t.amount,
      Type: t.type,
      Category: t.category,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, "Expenses_Report.xlsx");
  };

  return (
    <div className="relative min-h-screen bg-gray-100 px-4 py-8">
      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditTarget(null);
        }}
        onAdd={handleAddOrUpdateTransaction}
        defaultData={editTarget}
      />

      <button
        onClick={() => {
          setIsModalOpen(true);
          setEditTarget(null);
        }}
        className="fixed bottom-6 right-6 bg-blue-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-blue-700 transition z-40"
      >
        + {t("expensesPage.addTransaction")}
      </button>

      <SetGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onSave={async (newGoal) => {
          try {
            const saved = await saveSavingsGoal(newGoal);
            setGoal(saved);
          } catch (err) {
            console.error("Error saving goal:", err);
            alert("Failed to save goal.");
          }
        }}
        initialGoal={goal}
      />

      <SummaryCards
        transactions={filteredTransactions}
        goalAmount={goal}
        handleGoalEdit={handleGoalEdit}
        handleGoalClear={handleGoalClear}
      />

      {/* Date Filters */}
      <div className="max-w-2xl mx-auto mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("expensesPage.filterByDateRange")}:
        </label>
        <div className="flex flex-wrap sm:flex-nowrap items-end gap-4">
          <div className="flex flex-col">
            <span className="text-sm text-gray-600">{t("expensesPage.startDate")}</span>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              className="border px-3 py-2 rounded"
              placeholderText={t("expensesPage.startDate")}
              dateFormat="yyyy-MM-dd"
              isClearable
            />
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-gray-600">{t("expensesPage.endDate")}</span>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              className="border px-3 py-2 rounded"
              placeholderText={t("expensesPage.endDate")}
              dateFormat="yyyy-MM-dd"
              isClearable
            />
          </div>
          <div className="ml-auto relative">
            <Button
              variant="outline"
              onClick={() => setShowDropdown((prev) => !prev)}
            >
              {t("expensesPage.downloadReport")}
            </Button>

            {showDropdown && (
              <div className="absolute z-50 mt-2 bg-white border rounded shadow-md p-2 right-0 w-48">
                <div
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded"
                  onClick={() => {
                    handlePDFExport();
                    setShowDropdown(false);
                  }}
                >
                  {t("expensesPage.downloadPdf")}
                </div>
                <div
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer rounded"
                  onClick={() => {
                    handleExcelExport();
                    setShowDropdown(false);
                  }}
                >
                  {t("expensesPage.downloadExcel")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow-md">
        <h2 className="text-lg font-semibold mb-4">{t("expensesPage.Transactions")}</h2>
        <div className="max-h-[400px] overflow-y-auto pr-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-gray-500">{t("expensesPage.noTransactions")}</p>
          ) : (
            <ul className="divide-y">
              {filteredTransactions.map((tx) => (
                <li
                  key={tx.id}
                  className="py-3 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{tx.description}</div>
                    <div className="text-sm text-gray-500">
                      {tx.category} — {tx.date}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`font-semibold ${
                        tx.type === "income" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </div>
                    <button
                      onClick={() => handleEdit(tx)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Edit"
                    >
                      <FiEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Expenses;
