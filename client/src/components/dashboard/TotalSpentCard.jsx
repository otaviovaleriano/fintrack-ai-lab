import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { useTranslation } from "react-i18next";

const TotalSpentCard = ({ total }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("totalSpentCard.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-red-500">${total}</p>
      </CardContent>
    </Card>
  );
};

export default TotalSpentCard;
