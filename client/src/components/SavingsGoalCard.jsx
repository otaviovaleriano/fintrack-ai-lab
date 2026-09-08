import React from "react";
import { useTranslation } from "react-i18next";

const SavingsGoalCard = ({ goal, spent, onEdit, onClear }) => {
  const { t } = useTranslation();
  const progress =
    goal && goal.amount ? Math.min((spent / goal.amount) * 100, 100) : 0;

  let alertMessage = null;

  if (progress >= 80) {
    alertMessage = t("savingsGoalCard.alert80percent");
  } else if (progress >= 75) {
    alertMessage = t("savingsGoalCard.alert75percent");
  }

  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm flex flex-col justify-between">
      {goal ? (
        <>
          <h3 className="text-lg font-semibold">{t("savingsGoalCard.title")}</h3>
          <p className="text-gray-600">
            {goal.startDate} – {goal.endDate}
          </p>
          <p className="text-gray-700 mt-2">
            {t("savingsGoalCard.goal")} <strong>${(goal.amount ?? 0).toFixed(2)}</strong>
          </p>
          {alertMessage && (
            <div className="mt-2 text-sm font-medium text-yellow-700 bg-yellow-100 p-2 rounded">
              {alertMessage}
            </div>
          )}
          <p
            className={`mt-1 ${
              progress >= 80 ? "text-red-600" : "text-green-600"
            }`}
          >
            {t("savingsGoalCard.spent")} ${(spent ?? 0).toFixed(2)} ({progress.toFixed(0)}%)
          </p>

          <div className="flex gap-2 mt-4">
            <button
              onClick={onEdit}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              {t("savingsGoalCard.edit")}
            </button>
            <button
              onClick={onClear}
              className="bg-gray-300 text-gray-800 px-3 py-1 rounded hover:bg-gray-400"
            >
              {t("savingsGoalCard.clear")}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-gray-500 mb-4">{t("savingsGoalCard.noGoal")}</p>
          <button
            onClick={onEdit}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {t("savingsGoalCard.setGoal")}
          </button>
        </div>
      )}
    </div>
  );
};

export default SavingsGoalCard;
