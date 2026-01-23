"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { Chart, Customer, Appointment } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Calendar, User, Image as ImageIcon, Tag, AlertCircle, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function RecordsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [filteredCharts, setFilteredCharts] = useState<Chart[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    appointmentId: "",
    staffId: "",
    notes: "",
    cautions: "",
    effectPeriodDays: 30,
    tags: [] as string[],
    photos: [] as string[],
  });

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Get tenant ID from Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        let tenantIds = (tokenResult.claims.tenantIds as string[]) || [];

        if (isDev && tenantIds.length === 0) {
          const devTenantId = localStorage.getItem("dev_tenantId");
          if (devTenantId) tenantIds = [devTenantId];
        }

        if (tenantIds.length > 0) {
          setTenantId(tenantIds[0]);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error getting tenant ID:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load data
  useEffect(() => {
    if (!tenantId) return;

    const loadData = async () => {
      try {
        // Load charts
        const functions = getFunctions();
        const getCharts = httpsCallable(functions, "getCharts");
        const chartsResult: any = await getCharts({
          tenantId,
          customerId: selectedCustomerId === "all" ? undefined : selectedCustomerId,
          limit: 100,
        });

        if (chartsResult.data.success) {
          setCharts(chartsResult.data.charts);
          setFilteredCharts(chartsResult.data.charts);
        }

        // Load customers
        const customersRef = collection(db, `tenants/${tenantId}/customers`);
        const customersSnapshot = await getDocs(customersRef);
        const customersData = customersSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as Customer[];
        setCustomers(customersData);

        // Load appointments
        const appointmentsRef = collection(db, `tenants/${tenantId}/appointments`);
        const appointmentsQuery = query(appointmentsRef, orderBy("startAt", "desc"), firestoreLimit(100));
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsData = appointmentsSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          startAt: doc.data().startAt?.toDate(),
          endAt: doc.data().endAt?.toDate(),
        })) as Appointment[];
        setAppointments(appointmentsData);
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          variant: "destructive",
          title: "データ読み込みエラー",
          description: "データの取得に失敗しました",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, selectedCustomerId]);

  // Search charts
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCharts(charts);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = charts.filter(
      (chart) =>
        chart.notes.toLowerCase().includes(term) ||
        chart.tags.some((tag) => tag.toLowerCase().includes(term)) ||
        customers.find((c) => c.id === chart.customerId)?.name.toLowerCase().includes(term)
    );
    setFilteredCharts(filtered);
  }, [searchTerm, charts, customers]);

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 photos
    const newFiles = [...photoFiles, ...files].slice(0, 5);
    setPhotoFiles(newFiles);

    // Generate preview URLs
    const newPreviewUrls = newFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls(newPreviewUrls);
  };

  // Remove photo
  const handlePhotoRemove = (index: number) => {
    const newFiles = photoFiles.filter((_, i) => i !== index);
    const newPreviewUrls = photoPreviewUrls.filter((_, i) => i !== index);
    setPhotoFiles(newFiles);
    setPhotoPreviewUrls(newPreviewUrls);
  };

  // Add tag
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  // Remove tag
  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  // Submit new chart
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !auth.currentUser) return;

    setIsSubmitting(true);

    try {
      const functions = getFunctions();
      let photoUrls: string[] = [];

      // Upload photos first
      if (photoFiles.length > 0) {
        const uploadChartPhoto = httpsCallable(functions, "uploadChartPhoto");

        for (const file of photoFiles) {
          const reader = new FileReader();
          const fileData = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          const uploadResult: any = await uploadChartPhoto({
            tenantId,
            chartId: "temp_" + Date.now(), // Temporary ID for upload
            fileName: file.name,
            fileData,
            contentType: file.type,
          });

          if (uploadResult.data.success) {
            photoUrls.push(uploadResult.data.url);
          }
        }
      }

      // Create chart
      const createChart = httpsCallable(functions, "createChart");
      const result: any = await createChart({
        tenantId,
        customerId: formData.customerId,
        appointmentId: formData.appointmentId,
        staffId: auth.currentUser.uid,
        notes: formData.notes,
        cautions: formData.cautions || undefined,
        effectPeriodDays: formData.effectPeriodDays || undefined,
        photos: photoUrls,
        tags: formData.tags,
      });

      if (result.data.success) {
        toast({
          title: "カルテを作成しました",
          description: "施術記録が正常に保存されました",
        });

        // Reset form
        setFormData({
          customerId: "",
          appointmentId: "",
          staffId: "",
          notes: "",
          cautions: "",
          effectPeriodDays: 30,
          tags: [],
          photos: [],
        });
        setPhotoFiles([]);
        setPhotoPreviewUrls([]);
        setIsDialogOpen(false);

        // Reload charts
        const getCharts = httpsCallable(functions, "getCharts");
        const chartsResult: any = await getCharts({
          tenantId,
          customerId: selectedCustomerId === "all" ? undefined : selectedCustomerId,
          limit: 100,
        });

        if (chartsResult.data.success) {
          setCharts(chartsResult.data.charts);
          setFilteredCharts(chartsResult.data.charts);
        }
      }
    } catch (error: any) {
      console.error("Error creating chart:", error);
      toast({
        variant: "destructive",
        title: "カルテ作成エラー",
        description: error.message || "カルテの作成に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get customer name
  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || "不明";
  };

  // Get appointment date
  const getAppointmentDate = (appointmentId: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment?.startAt) return null;
    return appointment.startAt;
  };

  // Calculate next appointment date
  const calculateNextAppointmentDate = (chartDate: Date, effectPeriodDays: number) => {
    const nextDate = new Date(chartDate);
    nextDate.setDate(nextDate.getDate() + effectPeriodDays);
    return nextDate;
  };

  // Filter appointments by customer
  const customerAppointments = formData.customerId
    ? appointments.filter((a) => a.customerId === formData.customerId)
    : [];

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-12">読み込み中...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">施術記録（カルテ）</h1>
            <p className="text-gray-500">顧客の施術履歴と写真管理</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新規カルテ
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="メモ、タグ、顧客名で検索..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="全顧客" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全顧客</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredCharts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>{searchTerm || selectedCustomerId !== "all" ? "該当するカルテが見つかりません" : "カルテデータがありません"}</p>
                <p className="text-sm mt-2">新規カルテボタンから施術記録を登録してください</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredCharts.map((chart) => {
                  const chartDate = new Date(chart.createdAt);
                  const nextAppointmentDate = chart.effectPeriodDays
                    ? calculateNextAppointmentDate(chartDate, chart.effectPeriodDays)
                    : null;

                  return (
                    <div
                      key={chart.id}
                      className="border-l-4 border-blue-500 pl-6 pb-6 relative"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-0 top-0 w-4 h-4 bg-blue-500 rounded-full -translate-x-[10px]" />

                      <div className="bg-white rounded-lg border p-4 shadow-sm">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-lg">{getCustomerName(chart.customerId)}様</h3>
                              <span className="text-sm text-gray-500">
                                {format(chartDate, "yyyy年M月d日(E)", { locale: ja })}
                              </span>
                            </div>
                            {chart.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {chart.tags.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                                  >
                                    <Tag className="h-3 w-3" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Photos */}
                        {chart.photos.length > 0 && (
                          <div className="mb-3">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {chart.photos.map((photo, i) => (
                                <div key={i} className="flex-shrink-0">
                                  <img
                                    src={photo}
                                    alt={`施術写真${i + 1}`}
                                    className="w-32 h-32 object-cover rounded-lg border"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-gray-700 mb-1">施術メモ</div>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{chart.notes}</p>
                        </div>

                        {/* Cautions */}
                        {chart.cautions && (
                          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <div className="text-sm font-semibold text-amber-800 mb-1">注意事項</div>
                                <p className="text-sm text-amber-700 whitespace-pre-wrap">{chart.cautions}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Next appointment recommendation */}
                        {nextAppointmentDate && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-green-600" />
                              <div>
                                <span className="text-sm font-semibold text-green-800">次回予約推奨日: </span>
                                <span className="text-sm text-green-700">
                                  {format(nextAppointmentDate, "yyyy年M月d日(E)", { locale: ja })}
                                </span>
                                <span className="text-xs text-green-600 ml-2">
                                  （効果期間: {chart.effectPeriodDays}日）
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Chart Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新規カルテ作成</DialogTitle>
              <DialogDescription>施術記録を入力してください</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Customer */}
                <div className="space-y-2">
                  <Label htmlFor="customer">
                    顧客 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => setFormData({ ...formData, customerId: value, appointmentId: "" })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="顧客を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Appointment */}
                <div className="space-y-2">
                  <Label htmlFor="appointment">
                    予約 <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.appointmentId}
                    onValueChange={(value) => setFormData({ ...formData, appointmentId: value })}
                    required
                    disabled={!formData.customerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="予約を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerAppointments.map((appointment) => (
                        <SelectItem key={appointment.id} value={appointment.id}>
                          {appointment.startAt
                            ? format(appointment.startAt, "yyyy/MM/dd HH:mm")
                            : "日時不明"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">
                    施術メモ <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    required
                    placeholder="施術内容、進捗、お客様の反応など..."
                    rows={4}
                  />
                </div>

                {/* Cautions */}
                <div className="space-y-2">
                  <Label htmlFor="cautions">注意事項（任意）</Label>
                  <Textarea
                    id="cautions"
                    value={formData.cautions}
                    onChange={(e) => setFormData({ ...formData, cautions: e.target.value })}
                    placeholder="アレルギー、痛みの有無、次回への注意点など..."
                    rows={3}
                  />
                </div>

                {/* Effect Period */}
                <div className="space-y-2">
                  <Label htmlFor="effectPeriod">効果期間（日数）</Label>
                  <Input
                    id="effectPeriod"
                    type="number"
                    value={formData.effectPeriodDays}
                    onChange={(e) => setFormData({ ...formData, effectPeriodDays: parseInt(e.target.value) })}
                    min={1}
                    max={365}
                  />
                  <p className="text-xs text-gray-500">次回予約の推奨日を自動計算します</p>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label>タグ</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="タグを入力"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddTag} variant="outline">
                      追加
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Photos */}
                <div className="space-y-2">
                  <Label htmlFor="photos">施術写真（最大5枚）</Label>
                  <Input
                    id="photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    disabled={photoFiles.length >= 5}
                  />
                  {photoPreviewUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {photoPreviewUrls.map((url, i) => (
                        <div key={i} className="relative">
                          <img
                            src={url}
                            alt={`プレビュー${i + 1}`}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <button
                            type="button"
                            onClick={() => handlePhotoRemove(i)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "作成中..." : "作成"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
