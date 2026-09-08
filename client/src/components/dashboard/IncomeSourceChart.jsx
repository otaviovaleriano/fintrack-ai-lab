import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { useTranslation } from "react-i18next";

const COLORS = ["#10b981", "#6366f1"];
  

const IncomeSourceChart = ({ data }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("incomeSourceChart.title")}</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              outerRadius={100}
              label
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default IncomeSourceChart;