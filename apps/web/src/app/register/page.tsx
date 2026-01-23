"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth";
import { collection, query, where, getDocs, doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Service, Customer, SetDiscountConfig, User, PaymentMethod } from "@/types";
import { Search, Star, Calculator, Check, GripVertical, Edit3, Save, X } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// デフォルトのセット割引設定
const DEFAULT_DISCOUNT_CONFIG: SetDiscountConfig = {
  enabled: true,
  rules: [
    { quantity: 2, discountRate: 0.2 }, // 2箇所で20%OFF
    { quantity: 3, discountRate: 0.3 }, // 3箇所で30%OFF
    { quantity: 4, discountRate: 0.4 }, // 4箇所で40%OFF
    { quantity: 5, discountRate: 0.5 }, // 5箇所以上で50%OFF
  ],
};

// ドラッグ可能なサービスアイテム
interface SortableServiceItemProps {
  service: Service;
  isSelected: boolean;
  onToggle: (id: string) => void;
  editMode: boolean;
}

function SortableServiceItem({ service, isSelected, onToggle, editMode }: SortableServiceItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
        isSelected
          ? "bg-blue-50 border-blue-300"
          : "bg-white border-gray-200 hover:border-gray-300"
      } ${editMode ? "cursor-move" : ""}`}
    >
      <div className="flex items-center gap-3 flex-1">
        {editMode && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
        )}
        {!editMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle(service.id)}
          />
        )}
        <div>
          <div className="font-medium flex items-center gap-2">
            {service.name}
            {service.setDiscountEligible && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          {service.description && (
            <div className="text-sm text-gray-500">{service.description}</div>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-lg">
          ¥{service.price.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">
          {service.durationMinutes}分
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { currentTenantId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 顧客検索
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // サービス選択
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());

  // 編集モード
  const [editMode, setEditMode] = useState(false);
  const [editedServices, setEditedServices] = useState<Service[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // スタッフと支払方法
  const [staffList, setStaffList] = useState<User[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  // セット割引設定
  const [discountConfig, setDiscountConfig] = useState<SetDiscountConfig>(DEFAULT_DISCOUNT_CONFIG);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadData = async () => {
      if (!user || !currentTenantId) return;

      try {

        // テナント設定からセット割引設定を取得
        const tenantDoc = await getDoc(doc(db, "tenants", currentTenantId));
        if (tenantDoc.exists()) {
          const tenantData = tenantDoc.data();
          const settings = tenantData?.settings;
          if (settings?.setDiscountConfig) {
            setDiscountConfig(settings.setDiscountConfig);
          }
        }

        // サービス一覧を取得（サブコレクション）
        const servicesQuery = query(
          collection(db, `tenants/${currentTenantId}/services`),
          where("active", "==", true)
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        const servicesData = servicesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Service[];

        // sortOrderでソート
        servicesData.sort((a, b) => a.sortOrder - b.sortOrder);
        setServices(servicesData);

        // 顧客一覧を取得
        const customersQuery = query(
          collection(db, `tenants/${currentTenantId}/customers`)
        );
        const customersSnapshot = await getDocs(customersQuery);
        const customersData = customersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          lastVisit: doc.data().lastVisit?.toDate(),
          lineLinkedAt: doc.data().lineLinkedAt?.toDate(),
        })) as Customer[];

        setCustomers(customersData);

        // スタッフ一覧を取得（ログインユーザー情報から）
        const usersQuery = query(collection(db, "users"));
        const usersSnapshot = await getDocs(usersQuery);
        const usersData = usersSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          }))
          .filter((u: any) => u.tenantIds?.includes(currentTenantId)) as User[];

        setStaffList(usersData);

        // デフォルトでログインユーザーを選択
        if (usersData.length > 0) {
          const currentUser = usersData.find((u) => u.email === user.email);
          if (currentUser) {
            setSelectedStaffId(currentUser.id);
          } else {
            setSelectedStaffId(usersData[0].id);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("データの読み込みに失敗しました");
        setLoading(false);
      }
    };

    loadData();
  }, [user, currentTenantId]);

  // カテゴリー別にサービスをグループ化
  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, Service[]> = {};
    services.forEach((service) => {
      const category = service.category || "その他";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(service);
    });
    return grouped;
  }, [services]);

  // 料金計算
  const pricing = useMemo(() => {
    const selectedServices = services.filter((s) => selectedServiceIds.has(s.id));
    const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);

    // セット割引対象のサービス数をカウント
    const eligibleServices = selectedServices.filter((s) => s.setDiscountEligible);
    const eligibleCount = eligibleServices.length;

    let discount = 0;
    let discountRate = 0;

    if (discountConfig.enabled && eligibleCount > 0) {
      // 適用される割引率を取得（数量が多い順にソートして最大の割引を適用）
      const sortedRules = [...discountConfig.rules].sort((a, b) => b.quantity - a.quantity);
      for (const rule of sortedRules) {
        if (eligibleCount >= rule.quantity) {
          discountRate = rule.discountRate;
          break;
        }
      }

      // セット割引対象サービスの合計にのみ割引を適用
      const eligibleSubtotal = eligibleServices.reduce((sum, s) => sum + s.price, 0);
      discount = Math.floor(eligibleSubtotal * discountRate);
    }

    const total = subtotal - discount;

    return {
      subtotal,
      discount,
      total,
      eligibleCount,
      discountRate,
    };
  }, [services, selectedServiceIds, discountConfig]);

  // サービス選択トグル
  const toggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServiceIds);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServiceIds(newSelected);
  };

  // 顧客検索フィルター
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.kana.toLowerCase().includes(search) ||
        c.phone?.includes(search)
    );
  }, [customers, customerSearch]);

  // 会計処理
  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setError("顧客を選択してください");
      return;
    }

    if (selectedServiceIds.size === 0) {
      setError("サービスを選択してください");
      return;
    }

    if (!selectedStaffId) {
      setError("スタッフを選択してください");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const selectedServices = services.filter((s) => selectedServiceIds.has(s.id));

      // サービス名を結合
      const serviceName = selectedServices.map((s) => s.name).join(", ");

      // 今日の日付（YYYY-MM-DD形式）
      const today = new Date().toISOString().split("T")[0];

      // セット割引情報をnotesに記載
      let notes = "";
      if (pricing.discount > 0) {
        notes = `セット割引${Math.floor(pricing.discountRate * 100)}%適用（${pricing.eligibleCount}箇所選択）\n`;
        notes += `小計: ¥${pricing.subtotal.toLocaleString()}\n`;
        notes += `割引: -¥${pricing.discount.toLocaleString()}`;
      }

      // Cloud Functionで売上記録を作成
      const createSale = httpsCallable(functions, "createSale");
      const result = await createSale({
        tenantId: currentTenantId,
        customerId: selectedCustomer.id,
        date: today,
        serviceName,
        coursePrice: pricing.total, // 割引適用後の合計金額
        quantity: 1,
        paymentMethod,
        staffId: selectedStaffId,
        notes,
      });

      setSuccess(`会計が完了しました（合計: ¥${pricing.total.toLocaleString()}）`);

      // リセット
      setSelectedServiceIds(new Set());
      setSelectedCustomer(null);
      setCustomerSearch("");

      // 3秒後に成功メッセージをクリア
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Failed to checkout:", err);
      setError(`会計処理に失敗しました: ${err.message || "不明なエラー"}`);
    } finally {
      setSaving(false);
    }
  };

  // ドラッグ&ドロップ設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 編集モード切り替え
  const toggleEditMode = () => {
    if (!editMode) {
      setEditedServices([...services]);
    }
    setEditMode(!editMode);
  };

  // ドラッグ終了時
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditedServices((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // 順序保存
  const handleSaveOrder = async () => {
    if (!currentTenantId) return;

    setSavingOrder(true);
    setError("");
    setSuccess("");

    try {
      const batch = writeBatch(db);

      editedServices.forEach((service, index) => {
        const serviceRef = doc(db, `tenants/${currentTenantId}/services`, service.id);
        batch.update(serviceRef, { sortOrder: index + 1 });
      });

      await batch.commit();

      // 更新後のservicesをセット
      const updatedServices = editedServices.map((service, index) => ({
        ...service,
        sortOrder: index + 1,
      }));
      setServices(updatedServices);
      setEditMode(false);
      setSuccess("サービスの順序を保存しました");

      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Failed to save order:", err);
      setError(`順序の保存に失敗しました: ${err.message || "不明なエラー"}`);
    } finally {
      setSavingOrder(false);
    }
  };

  // キャンセル
  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedServices([]);
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            レジ
          </h1>
          <p className="text-gray-600 mt-2">サービスを選択して会計処理を行います</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertDescription className="text-green-800 flex items-center gap-2">
              <Check className="h-4 w-4" />
              {success}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側: 顧客選択とサービス選択 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 顧客選択 */}
            <Card>
              <CardHeader>
                <CardTitle>顧客選択</CardTitle>
                <CardDescription>会計する顧客を選択してください</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="顧客名、フリガナ、電話番号で検索..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {customerSearch && filteredCustomers.length > 0 && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.slice(0, 5).map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerSearch("");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500">{customer.kana}</div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-blue-900">{selectedCustomer.name}</div>
                        <div className="text-sm text-blue-700">{selectedCustomer.kana}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCustomer(null)}
                      >
                        変更
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* サービス選択 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>サービス選択</CardTitle>
                    <CardDescription>
                      {editMode ? "ドラッグして順序を変更" : "施術するサービスを選択してください"}
                      {!editMode && discountConfig.enabled && (
                        <span className="ml-2 text-green-600 font-medium">
                          <Star className="inline h-4 w-4 mb-0.5" />
                          マーク付きはセット割引対象
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {editMode ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={savingOrder}
                        >
                          <X className="h-4 w-4 mr-1" />
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveOrder}
                          disabled={savingOrder}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          {savingOrder ? "保存中..." : "保存"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleEditMode}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        順序編集
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={editedServices.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {editedServices.map((service) => (
                          <SortableServiceItem
                            key={service.id}
                            service={service}
                            isSelected={selectedServiceIds.has(service.id)}
                            onToggle={toggleService}
                            editMode={editMode}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                      <div key={category}>
                        <h3 className="font-semibold text-lg mb-3 text-gray-900">{category}</h3>
                        <div className="space-y-2">
                          {categoryServices.map((service) => (
                            <SortableServiceItem
                              key={service.id}
                              service={service}
                              isSelected={selectedServiceIds.has(service.id)}
                              onToggle={toggleService}
                              editMode={editMode}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {services.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        サービスが登録されていません
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右側: 料金計算 */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>料金計算</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* スタッフ選択 */}
                <div className="space-y-2">
                  <Label htmlFor="staff">担当スタッフ</Label>
                  <select
                    id="staff"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">スタッフを選択</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 支払方法 */}
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">支払方法</Label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">現金</option>
                    <option value="card">クレジットカード</option>
                    <option value="paypay">PayPay</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">選択サービス数</span>
                    <span className="font-medium">{selectedServiceIds.size}件</span>
                  </div>

                  {discountConfig.enabled && pricing.eligibleCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">割引対象</span>
                      <span className="font-medium text-green-600">
                        <Star className="inline h-3 w-3 mb-0.5" />
                        {pricing.eligibleCount}件
                      </span>
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">小計</span>
                      <span className="font-medium">¥{pricing.subtotal.toLocaleString()}</span>
                    </div>

                    {pricing.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>
                          セット割引
                          <Badge variant="outline" className="ml-2 text-xs">
                            {Math.floor(pricing.discountRate * 100)}%OFF
                          </Badge>
                        </span>
                        <span className="font-medium">-¥{pricing.discount.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="border-t pt-3 flex justify-between text-lg font-bold">
                      <span>合計</span>
                      <span className="text-blue-600">¥{pricing.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* セット割引情報 */}
                {discountConfig.enabled && pricing.eligibleCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <div className="font-semibold text-green-800 mb-2">セット割引</div>
                    <div className="space-y-1 text-green-700">
                      {discountConfig.rules.map((rule) => (
                        <div
                          key={rule.quantity}
                          className={
                            pricing.eligibleCount >= rule.quantity &&
                            pricing.discountRate === rule.discountRate
                              ? "font-semibold"
                              : ""
                          }
                        >
                          {rule.quantity}箇所以上: {Math.floor(rule.discountRate * 100)}%OFF
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleCheckout}
                  disabled={!selectedCustomer || selectedServiceIds.size === 0 || !selectedStaffId || saving}
                  className="w-full"
                  size="lg"
                >
                  {saving ? "処理中..." : "会計する"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
