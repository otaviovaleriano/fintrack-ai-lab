import React from "react";
import SavingsGoalCard from "./SavingsGoalCard";
import { DollarSign, TrendingDown } from "lucide-react";
import { useTranslation } from "react-i18next";

const SummaryCards = ({
  transactions,
  goalAmount,
  handleGoalClear,
  handleGoalEdit,
}) => {
  const incomeTotal = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const { t } = useTranslation();

  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = incomeTotal - expenseTotal;

  const cardBase =
    "bg-white rounded-xl shadow-md border px-2 py-1 flex items-center justify-center flex-col text-center";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
      {/* Current Balance */}
      <div className={`${cardBase} border-blue-200`}>
        <DollarSign className="text-blue-600 w-8 h-8 mb-2" />
        <p className="text-lg text-gray-500 font-medium">{t("summaryCard.current")}</p>
        <p className="text-3xl font-bold text-blue-600">
          ${balance.toFixed(2)}
        </p>
      </div>

      {/* Amount Spent */}
      <div className={`${cardBase} border-red-200`}>
        <TrendingDown className="text-red-500 w-8 h-8 mb-2" />
        <p className="text-lg text-gray-500 font-medium">{t("summaryCard.amount")}</p>
        <p className="text-3xl font-bold text-red-500">
          ${expenseTotal.toFixed(2)}
        </p>
      </div>

      {/* Savings Goal */}
      <SavingsGoalCard
        goal={goalAmount}
        spent={expenseTotal}
        onEdit={handleGoalEdit}
        onClear={handleGoalClear}
      />
    </div>
  );
};

export default SummaryCards;
