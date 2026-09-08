import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { useTranslation } from "react-i18next";

const GoalProgressCard = ({ totalSpent, savingGoal }) => {
  const { t } = useTranslation();

  if (!savingGoal || savingGoal === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("goalProgressCard.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">{t("goalProgressCard.noGoal")}</p>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.min((totalSpent / savingGoal) * 100, 100);

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>{t("goalProgressCard.title")}</CardTitle>
        <Badge variant={percent >= 100 ? "destructive" : "default"}>
          {percent >= 100 ? t("goalProgressCard.goalExceeded") : t("goalProgressCard.goalNotExceeded")}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          ${totalSpent} {t("goalProgressCard.of")} ${savingGoal} {t("goalProgressCard.spent")}
        </p>
      </CardContent>
    </Card>
  );
};

export default GoalProgressCard;
