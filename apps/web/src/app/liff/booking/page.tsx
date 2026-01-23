"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Service } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  getPricingBreakdown,
  getDiscountDescription,
  PricingBreakdown,
} from "@/lib/pricing";
import liff from "@line/liff";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export default function LiffBookingPage() {
  const [loading, setLoading] = useState(true);
  const [liffError, setLiffError] = useState<string>("");
  const [tenantId, setTenantId] = useState<string>("");
  const [lineUserId, setLineUserId] = useState<string>("");
  const [userProfile, setUserProfile] = useState<any>(null);

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);

  // Booking flow state
  const [bookingStep, setBookingStep] = useState<number>(1); // 1: staff & date, 2: time slot, 3: services, 4: confirm
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Available dates (dates with available slots)
  const [availableDates, setAvailableDates] = useState<Array<{ date: string; count: number }>>([]);
  const [loadingDates, setLoadingDates] = useState<boolean>(false);

  // Pricing
  const [pricing, setPricing] = useState<PricingBreakdown>({
    subtotal: 0,
    discount: 0,
    discountRate: 0,
    total: 0,
    eligibleCount: 0,
    totalDuration: 0,
  });

  // Initialize LIFF
  useEffect(() => {
    const initializeLiff = async () => {
      try {
        // Get LIFF ID from URL parameter or environment
        const urlParams = new URLSearchParams(window.location.search);
        const liffId = urlParams.get("liffId") || process.env.NEXT_PUBLIC_LIFF_ID || "";

        if (!liffId) {
          setLiffError("LIFF IDが設定されていません");
          setLoading(false);
          return;
        }

        // Initialize LIFF
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        // Get user profile
        const profile = await liff.getProfile();
        setUserProfile(profile);
        setLineUserId(profile.userId);

        // Get tenant ID from LIFF context
        const context = liff.getContext();
        console.log("LIFF Context:", context);

        // For now, we'll need to pass tenantId as URL parameter
        const tid = urlParams.get("tenantId");
        if (!tid) {
          setLiffError("テナント情報が見つかりません");
          setLoading(false);
          return;
        }

        setTenantId(tid);

        // Register or get LINE customer
        try {
          const registerCustomer = httpsCallable(functions, "registerLineCustomer");
          await registerCustomer({
            lineUserId: profile.userId,
            tenantId: tid,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
          });
        } catch (regError) {
          console.error("Customer registration error:", regError);
          // Continue even if registration fails
        }
      } catch (error: any) {
        console.error("LIFF initialization error:", error);
        setLiffError(`LIFF初期化エラー: ${error.message || "不明なエラー"}`);
      } finally {
        setLoading(false);
      }
    };

    initializeLiff();
  }, []);

  // Load data
  useEffect(() => {
    if (!tenantId) return;

    const loadData = async () => {
      try {
        // Load services
        const servicesRef = collection(db, `tenants/${tenantId}/services`);
        const servicesQuery = query(
          servicesRef,
          where("active", "==", true),
          orderBy("sortOrder", "asc")
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        const servicesData = servicesSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Service[];
        setServices(servicesData);

        // Load staff members
        const staffRef = collection(db, `tenants/${tenantId}/staffMembers`);
        const staffQuery = query(staffRef, orderBy("name", "asc"));
        const staffSnapshot = await getDocs(staffQuery);
        const staffData = staffSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setStaffMembers(staffData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          variant: "destructive",
          title: "データ読み込みエラー",
          description: "データの取得に失敗しました",
        });
      }
    };

    loadData();
  }, [tenantId]);

  // Calculate pricing when services change
  useEffect(() => {
    const selectedServices = services.filter((s) =>
      selectedServiceIds.has(s.id)
    );
    const breakdown = getPricingBreakdown(selectedServices);
    setPricing(breakdown);
  }, [selectedServiceIds, services]);

  // Load available dates (multiple days)
  const loadAvailableDates = async (staffId: string | null = null) => {
    if (!tenantId) return;

    setLoadingDates(true);
    setAvailableDates([]);

    try {
      const dates: Array<{ date: string; count: number }> = [];
      const today = new Date();

      // Check next 21 days (3 weeks)
      for (let i = 0; i < 21; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dateStr = format(checkDate, "yyyy-MM-dd");

        const response = await fetch("/api/calendar/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            staffId: staffId || undefined, // staffId が null の場合は全スタッフの空き枠
            date: dateStr,
            serviceDuration: pricing.totalDuration || 60,
          }),
        });

        const data = await response.json();

        if (data.success && data.availableSlots && data.availableSlots.length > 0) {
          dates.push({
            date: dateStr,
            count: data.availableSlots.length,
          });
        }
      }

      setAvailableDates(dates);
    } catch (error) {
      console.error("Failed to load available dates:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "空き日程の取得に失敗しました",
      });
    } finally {
      setLoadingDates(false);
    }
  };

  // Load available slots for a specific date
  const loadAvailableSlots = async (staffId: string | null, date: string) => {
    if (!tenantId || !date) return;

    setLoadingSlots(true);
    try {
      const response = await fetch("/api/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          staffId: staffId || undefined, // staffId が null の場合は全スタッフの空き枠
          date,
          serviceDuration: pricing.totalDuration || 60,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAvailableSlots(data.availableSlots || []);
      } else {
        setAvailableSlots([]);
        toast({
          variant: "destructive",
          title: "空き枠取得エラー",
          description: data.message || "空き枠の取得に失敗しました",
        });
      }
    } catch (error) {
      console.error("Failed to load available slots:", error);
      setAvailableSlots([]);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "空き枠の取得に失敗しました",
      });
    } finally {
      setLoadingSlots(false);
    }
  };

  // 初期表示時に全スタッフの空き日程を自動取得
  useEffect(() => {
    if (tenantId) {
      loadAvailableDates(null); // null = 全スタッフ
    }
  }, [tenantId]);

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    const newSet = new Set(selectedServiceIds);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setSelectedServiceIds(newSet);
  };

  // Submit booking
  const handleSubmit = async () => {
    if (!tenantId || !lineUserId) return;

    setSubmitting(true);

    try {
      const startAtISO = new Date(`${selectedDate}T${selectedTime}`).toISOString();

      // Create appointment via Cloud Function
      const createAppointment = httpsCallable(functions, "createCustomerAppointment");
      const result = await createAppointment({
        lineUserId,
        tenantId,
        serviceIds: Array.from(selectedServiceIds),
        startAt: startAtISO,
        notes: "",
      });

      const response = result.data as any;

      if (response.success) {
        toast({
          title: "予約が完了しました！",
          description: response.message || `予約日時: ${selectedDate} ${selectedTime}`,
        });

        // Close LIFF window
        setTimeout(() => {
          liff.closeWindow();
        }, 2000);
      } else {
        throw new Error(response.message || "予約の登録に失敗しました");
      }
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast({
        variant: "destructive",
        title: "予約エラー",
        description: error.message || "予約の登録に失敗しました",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || "その他";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (liffError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">エラー</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{liffError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        {/* LINE Header */}
        <div className="bg-white rounded-t-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-400 to-green-500 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-green-500">
              店
            </div>
            <div>
              <p className="text-white font-semibold text-sm">予約システム</p>
              <p className="text-white/90 text-xs">オンライン予約</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white shadow-lg px-4 py-6 space-y-6 rounded-b-2xl min-h-[500px]">
          {/* Step 1: Staff & Date Selection */}
          {bookingStep === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  👤 スタッフと日付を選択
                </h2>
                <p className="text-sm text-gray-600">
                  担当スタッフとご希望の日付を選択してください
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">
                    担当スタッフ（任意）
                  </Label>
                  <Select
                    value={selectedStaffId}
                    onValueChange={(value) => {
                      const newStaffId = value === "none" ? "" : value;
                      setSelectedStaffId(newStaffId);
                      setSelectedDate("");
                      setAvailableDates([]);
                      loadAvailableDates(newStaffId || null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="指定なし（全スタッフ）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">指定なし（全スタッフ）</SelectItem>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedStaffId
                      ? "選択中のスタッフの空き枠を表示"
                      : "全スタッフの空き枠を表示中"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    ご希望の日付（空き枠がある日のみ表示）
                  </Label>
                  {loadingDates ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
                      <p className="text-sm text-gray-600">空き日程を確認中...</p>
                      <p className="text-xs text-gray-500 mt-1">最大3週間分</p>
                    </div>
                  ) : availableDates.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border">
                      <p className="text-gray-600 mb-1">😔 空き枠がありません</p>
                      <p className="text-xs text-gray-500">
                        {selectedStaffId
                          ? "別のスタッフまたは「指定なし」をお選びください"
                          : "現在予約可能な日程がありません"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {availableDates.map((dateInfo) => {
                        const date = new Date(dateInfo.date);
                        const isSelected = selectedDate === dateInfo.date;
                        return (
                          <button
                            key={dateInfo.date}
                            onClick={async () => {
                              setSelectedDate(dateInfo.date);
                              await loadAvailableSlots(selectedStaffId || null, dateInfo.date);
                              setBookingStep(2);
                            }}
                            className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${
                              isSelected
                                ? "border-green-500 bg-green-50"
                                : "border-gray-200 bg-white hover:border-green-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-base text-gray-900">
                                  {format(date, "M月d日(E)", { locale: ja })}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {format(date, "yyyy年", { locale: ja })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-green-600 font-bold text-sm">
                                  ⏰ {dateInfo.count}件
                                </p>
                                <p className="text-xs text-gray-500">空き枠</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Time Slot Selection */}
          {bookingStep === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  🕒 時間を選択
                </h2>
                <p className="text-sm text-gray-600">
                  ご希望の時間帯を選択してください
                </p>
              </div>

              {loadingSlots ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">空き枠を確認中...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <p className="text-gray-600 mb-2">😔 この日は空きがありません</p>
                  <p className="text-sm text-gray-500">他の日付をお選びください</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[350px] overflow-y-auto p-2">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedTime(slot.startTime);
                        setBookingStep(3);
                      }}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all hover:scale-105 ${
                        selectedTime === slot.startTime
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 bg-white text-gray-700 hover:border-green-300"
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={() => setBookingStep(1)}
                variant="outline"
                className="w-full py-6"
              >
                戻る
              </Button>
            </div>
          )}

          {/* Step 3: Service Selection */}
          {bookingStep === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  ✨ メニューを選択
                </h2>
                <p className="text-sm text-gray-600">
                  施術箇所を選択してください（複数選択可）
                </p>
                <p className="text-xs text-green-600 mt-1 font-medium">
                  ★マーク2箇所以上でセット割引！
                </p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {Object.entries(servicesByCategory).map(
                  ([category, categoryServices]) => (
                    <div key={category}>
                      <div className="sticky top-0 bg-gray-100 px-3 py-2 rounded-t-lg font-semibold text-sm text-gray-700 border-b-2 border-green-400">
                        {category}
                      </div>
                      <div className="space-y-2 p-2 bg-gray-50 rounded-b-lg">
                        {categoryServices.map((service) => (
                          <div
                            key={service.id}
                            onClick={() => toggleService(service.id)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedServiceIds.has(service.id)
                                ? "border-green-500 bg-green-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                    selectedServiceIds.has(service.id)
                                      ? "bg-green-500 border-green-500"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {selectedServiceIds.has(service.id) && (
                                    <span className="text-white text-xs">✓</span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-sm text-gray-900">
                                      {service.name}
                                    </span>
                                    {service.setDiscountEligible && (
                                      <span className="text-yellow-500 text-base">★</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {service.durationMinutes}分
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm font-bold text-gray-900">
                                ¥{service.price.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Price Summary */}
              {selectedServiceIds.size > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-700">
                      <span>選択: {selectedServiceIds.size}件</span>
                      <span>{pricing.totalDuration}分</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>小計</span>
                      <span>¥{pricing.subtotal.toLocaleString()}</span>
                    </div>
                    {pricing.discount > 0 && (
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>
                          🎉 セット割引 ({getDiscountDescription(pricing.eligibleCount)})
                        </span>
                        <span>-¥{pricing.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t-2 border-green-300">
                      <span>合計</span>
                      <span className="text-green-600">
                        ¥{pricing.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => setBookingStep(2)}
                  variant="outline"
                  className="flex-1 py-6"
                >
                  戻る
                </Button>
                <Button
                  onClick={() => setBookingStep(4)}
                  disabled={selectedServiceIds.size === 0}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-6"
                >
                  確認画面へ
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {bookingStep === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  ✅ 予約内容の確認
                </h2>
                <p className="text-sm text-gray-600">
                  以下の内容で予約します
                </p>
              </div>

              <div className="space-y-4">
                {/* Date/Time */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">予約日時</p>
                  <p className="text-base font-semibold text-gray-900">
                    {selectedDate && format(new Date(selectedDate), "M月d日(E)", { locale: ja })}
                    {" "}
                    {selectedTime}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    所要時間: 約{pricing.totalDuration}分
                  </p>
                </div>

                {/* Services */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">施術内容</p>
                  <div className="space-y-2">
                    {services
                      .filter((s) => selectedServiceIds.has(s.id))
                      .map((service) => (
                        <div
                          key={service.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900">• {service.name}</span>
                            {service.setDiscountEligible && (
                              <span className="text-yellow-500 text-base">★</span>
                            )}
                          </div>
                          <span className="text-gray-600">
                            ¥{service.price.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Price Summary */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-300">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-700">
                      <span>小計</span>
                      <span>¥{pricing.subtotal.toLocaleString()}</span>
                    </div>
                    {pricing.discount > 0 && (
                      <>
                        <div className="flex justify-between text-green-600 font-semibold">
                          <span>セット割引</span>
                          <span>-¥{pricing.discount.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          🎉 {pricing.eligibleCount}箇所で
                          {getDiscountDescription(pricing.eligibleCount)}適用！
                        </p>
                      </>
                    )}
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t-2 border-green-400">
                      <span>お支払い金額</span>
                      <span className="text-green-600">
                        ¥{pricing.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ お支払いは当日、店舗にてお願いいたします
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setBookingStep(3)}
                  variant="outline"
                  className="flex-1 py-6"
                  disabled={submitting}
                >
                  戻る
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-6 text-base"
                >
                  {submitting ? "予約中..." : "予約を確定"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
