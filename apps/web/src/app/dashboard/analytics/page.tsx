"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, TrendingUp, DollarSign, Target } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658"];

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function AnalyticsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sales");

  // Date ranges
  const [salesDateRange, setSalesDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  });

  const [expenseDateRange, setExpenseDateRange] = useState({
    startMonth: format(subMonths(new Date(), 3), "yyyy-MM"),
    endMonth: format(new Date(), "yyyy-MM"),
  });

  const [adDateRange, setAdDateRange] = useState({
    startMonth: format(subMonths(new Date(), 3), "yyyy-MM"),
    endMonth: format(new Date(), "yyyy-MM"),
  });

  // Analysis data
  const [salesAnalysis, setSalesAnalysis] = useState<any>(null);
  const [expenseAnalysis, setExpenseAnalysis] = useState<any>(null);
  const [adAnalysis, setAdAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Get tenant ID from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        let tenantIds = (tokenResult.claims.tenantIds as string[]) || [];

        // Dev mode: use localStorage if no tenantIds
        if (isDev && tenantIds.length === 0) {
          const devTenantId = localStorage.getItem("dev_tenantId");
          if (devTenantId) {
            tenantIds = [devTenantId];
          }
        }

        if (tenantIds.length > 0) {
          setTenantId(tenantIds[0]);
        }
      } catch (error) {
        console.error("Error getting tenant ID:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch sales analysis
  const fetchSalesAnalysis = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getSalesAnalysisFunc = httpsCallable(functions, "getSalesAnalysis");
      const result = await getSalesAnalysisFunc({
        tenantId: tenantId,
        ...salesDateRange,
      });
      setSalesAnalysis((result.data as any).analysis);
    } catch (error) {
      console.error("Failed to fetch sales analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch expense analysis
  const fetchExpenseAnalysis = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getExpenseAnalysisFunc = httpsCallable(functions, "getExpenseAnalysis");
      const result = await getExpenseAnalysisFunc({
        tenantId: tenantId,
        ...expenseDateRange,
      });
      setExpenseAnalysis((result.data as any).analysis);
    } catch (error) {
      console.error("Failed to fetch expense analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch ad analysis
  const fetchAdAnalysis = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const functions = getFunctions(undefined, "asia-northeast1");
      const getAdAnalysisFunc = httpsCallable(functions, "getAdAnalysis");
      const result = await getAdAnalysisFunc({
        tenantId: tenantId,
        ...adDateRange,
      });
      setAdAnalysis((result.data as any).analysis);
    } catch (error) {
      console.error("Failed to fetch ad analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>テナント情報を読み込んでいます...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-3xl font-bold">分析レポート</h1>
        <p className="text-muted-foreground">
          売上・経費・広告の詳細分析
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sales">売上分析</TabsTrigger>
          <TabsTrigger value="expense">経費分析</TabsTrigger>
          <TabsTrigger value="ad">広告効果分析</TabsTrigger>
        </TabsList>

        {/* 売上分析タブ */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>期間設定</CardTitle>
              <CardDescription>分析対象の期間を指定してください</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">開始日</label>
                  <Input
                    type="date"
                    value={salesDateRange.startDate}
                    onChange={(e) =>
                      setSalesDateRange({ ...salesDateRange, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">終了日</label>
                  <Input
                    type="date"
                    value={salesDateRange.endDate}
                    onChange={(e) =>
                      setSalesDateRange({ ...salesDateRange, endDate: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchSalesAnalysis} disabled={loading} className="w-full">
                    {loading ? "分析中..." : "分析を実行"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {salesAnalysis && (
            <>
              {/* サマリ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">総売上</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(salesAnalysis.summary.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">販売件数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{salesAnalysis.summary.totalCount}件</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">平均単価</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(salesAnalysis.summary.averagePrice)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* コース別売上 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    コース別売上
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>コース名</TableHead>
                          <TableHead className="text-right">売上</TableHead>
                          <TableHead className="text-right">件数</TableHead>
                          <TableHead className="text-right">構成比</TableHead>
                          <TableHead className="text-right">平均単価</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesAnalysis.byCourse.map((course: any) => (
                          <TableRow key={course.courseName}>
                            <TableCell className="font-medium">{course.courseName}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(course.revenue)}
                            </TableCell>
                            <TableCell className="text-right">{course.count}件</TableCell>
                            <TableCell className="text-right">
                              {(course.ratio * 100).toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(course.averagePrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {salesAnalysis.byCourse.length > 0 && (
                    <div className="mt-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={salesAnalysis.byCourse.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="courseName" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                          <Legend />
                          <Bar dataKey="revenue" fill="#8884d8" name="売上" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 顧客タイプ別 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>顧客タイプ別売上</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">新規顧客</p>
                          <p className="text-xs text-muted-foreground">
                            {salesAnalysis.byCustomerType.new.count}件
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {formatCurrency(salesAnalysis.byCustomerType.new.revenue)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(salesAnalysis.byCustomerType.new.ratio * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">既存顧客</p>
                          <p className="text-xs text-muted-foreground">
                            {salesAnalysis.byCustomerType.existing.count}件
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {formatCurrency(salesAnalysis.byCustomerType.existing.revenue)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(salesAnalysis.byCustomerType.existing.ratio * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "新規顧客", value: salesAnalysis.byCustomerType.new.revenue },
                              { name: "既存顧客", value: salesAnalysis.byCustomerType.existing.revenue },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill={COLORS[0]} />
                            <Cell fill={COLORS[1]} />
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* スタッフ別売上 */}
                <Card>
                  <CardHeader>
                    <CardTitle>スタッフ別売上（Top 5）</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {salesAnalysis.byStaff.slice(0, 5).map((staff: any, index: number) => (
                        <div key={staff.staffId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{index + 1}</span>
                            <div>
                              <p className="font-medium">{staff.staffName}</p>
                              <p className="text-xs text-muted-foreground">{staff.count}件</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(staff.revenue)}</p>
                            <p className="text-xs text-muted-foreground">
                              {(staff.ratio * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* 経費分析タブ */}
        <TabsContent value="expense" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>期間設定</CardTitle>
              <CardDescription>分析対象の期間を指定してください</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">開始月</label>
                  <Input
                    type="month"
                    value={expenseDateRange.startMonth}
                    onChange={(e) =>
                      setExpenseDateRange({ ...expenseDateRange, startMonth: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">終了月</label>
                  <Input
                    type="month"
                    value={expenseDateRange.endMonth}
                    onChange={(e) =>
                      setExpenseDateRange({ ...expenseDateRange, endMonth: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchExpenseAnalysis} disabled={loading} className="w-full">
                    {loading ? "分析中..." : "分析を実行"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {expenseAnalysis && (
            <>
              {/* サマリ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">総経費</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(expenseAnalysis.summary.totalExpenses)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">月平均</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(expenseAnalysis.summary.averageMonthly)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">対象月数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{expenseAnalysis.summary.monthCount}ヶ月</div>
                  </CardContent>
                </Card>
              </div>

              {/* 推移グラフ */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    経費推移
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={expenseAnalysis.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} name="総経費" />
                      <Line type="monotone" dataKey="labor" stroke="#82ca9d" name="人件費" />
                      <Line type="monotone" dataKey="advertising" stroke="#ffc658" name="広告費" />
                      <Line type="monotone" dataKey="rent" stroke="#ff8042" name="家賃" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 構成比 */}
              <Card>
                <CardHeader>
                  <CardTitle>経費構成比</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={expenseAnalysis.composition}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ category, ratio }) => `${category}: ${(ratio * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="amount"
                            nameKey="category"
                          >
                            {expenseAnalysis.composition.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value as number)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                      {expenseAnalysis.composition.map((item: any, index: number) => (
                        <div key={item.category} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: COLORS[index % COLORS.length] + "20" }}>
                          <span className="font-medium">{item.category}</span>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(item.amount)}</p>
                            <p className="text-xs text-muted-foreground">{(item.ratio * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 広告効果分析タブ */}
        <TabsContent value="ad" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>期間設定</CardTitle>
              <CardDescription>分析対象の期間を指定してください</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">開始月</label>
                  <Input
                    type="month"
                    value={adDateRange.startMonth}
                    onChange={(e) =>
                      setAdDateRange({ ...adDateRange, startMonth: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">終了月</label>
                  <Input
                    type="month"
                    value={adDateRange.endMonth}
                    onChange={(e) =>
                      setAdDateRange({ ...adDateRange, endMonth: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={fetchAdAnalysis} disabled={loading} className="w-full">
                    {loading ? "分析中..." : "分析を実行"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {adAnalysis && (
            <>
              {/* サマリ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">総広告費</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(adAnalysis.summary.totalAdCost)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">総成約数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adAnalysis.summary.totalConversions}件</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">媒体数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{adAnalysis.summary.mediumCount}媒体</div>
                  </CardContent>
                </Card>
              </div>

              {/* 媒体別パフォーマンス */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    媒体別パフォーマンス
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>媒体名</TableHead>
                          <TableHead className="text-right">広告費</TableHead>
                          <TableHead className="text-right">成約数</TableHead>
                          <TableHead className="text-right">平均CPA</TableHead>
                          <TableHead className="text-right">平均ROI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adAnalysis.byMedium.map((medium: any) => (
                          <TableRow key={medium.medium}>
                            <TableCell className="font-medium">{medium.medium}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(medium.totalAdCost)}
                            </TableCell>
                            <TableCell className="text-right">{medium.totalConversions}件</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(medium.averageCPA)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`font-semibold ${medium.averageROI > 3 ? "text-green-600" : medium.averageROI > 2 ? "text-blue-600" : "text-yellow-600"}`}>
                                {(medium.averageROI * 100).toFixed(0)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 推移グラフ */}
              <Card>
                <CardHeader>
                  <CardTitle>広告費推移</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={adAnalysis.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend />
                      <Line type="monotone" dataKey="totalAdCost" stroke="#8884d8" strokeWidth={2} name="広告費" />
                      <Line type="monotone" dataKey="totalConversions" stroke="#82ca9d" strokeWidth={2} name="成約数" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
