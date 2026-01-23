"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  where,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Service, Customer } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { CalendarPlus, Clock, DollarSign, Percent, Trash2, Edit, X as XIcon, GripVertical, Edit3, Save } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  getPricingBreakdown,
  getDiscountDescription,
  PricingBreakdown,
} from "@/lib/pricing";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
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

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

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
      className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 border ${
        editMode ? "cursor-move" : ""
      }`}
    >
      {editMode && (
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
      )}
      {!editMode && (
        <Checkbox
          id={service.id}
          checked={isSelected}
          onCheckedChange={() => onToggle(service.id)}
        />
      )}
      <label
        htmlFor={service.id}
        className="flex-1 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{service.name}</span>
          {service.setDiscountEligible && (
            <span className="text-yellow-500 text-lg" title="セット割引対象">
              ★
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{service.durationMinutes}分</span>
          <span className="font-semibold">{formatCurrency(service.price)}</span>
        </div>
      </label>
    </div>
  );
}

interface Appointment {
  id: string;
  tenantId: string;
  customerId: string;
  customerName?: string;
  serviceIds: string[];
  services?: Service[];
  startAt: Date;
  endAt: Date;
  status: string;
  notes?: string;
  pricing: {
    subtotal: number;
    discount: number;
    total: number;
    eligibleCount: number;
  };
  staffId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function AppointmentsPage() {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("create");

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);

  // Form state for creating appointments
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [appointmentDate, setAppointmentDate] = useState<string>("");
  const [appointmentTime, setAppointmentTime] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Available slots for admin form
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Edit state
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);

  // Customer view state (LINE booking preview)
  const [lineBookingStep, setLineBookingStep] = useState<number>(1); // 1: staff & date, 2: time slot, 3: services, 4: confirm
  const [lineSelectedStaffId, setLineSelectedStaffId] = useState<string>("");
  const [lineSelectedDate, setLineSelectedDate] = useState<string>("");
  const [lineSelectedTime, setLineSelectedTime] = useState<string>("");
  const [lineSelectedServiceIds, setLineSelectedServiceIds] = useState<Set<string>>(new Set());
  const [lineCustomerName, setLineCustomerName] = useState<string>("山田太郎");
  const [lineAvailableSlots, setLineAvailableSlots] = useState<any[]>([]);
  const [lineLoadingSlots, setLineLoadingSlots] = useState<boolean>(false);

  // Available dates for LINE preview
  const [lineAvailableDates, setLineAvailableDates] = useState<Array<{ date: string; count: number }>>([]);
  const [lineLoadingDates, setLineLoadingDates] = useState<boolean>(false);

  // Pricing
  const [pricing, setPricing] = useState<PricingBreakdown>({
    subtotal: 0,
    discount: 0,
    discountRate: 0,
    total: 0,
    eligibleCount: 0,
    totalDuration: 0,
  });

  // 編集モード (drag-and-drop for service ordering)
  const [editMode, setEditMode] = useState(false);
  const [editedServices, setEditedServices] = useState<Service[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

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

        // Dev mode: use localStorage if no tenantIds
        if (isDev && tenantIds.length === 0) {
          const devTenantId = localStorage.getItem("dev_tenantId");
          if (devTenantId) {
            tenantIds = [devTenantId];
          }
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

  // Load services and customers
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

        // Load customers
        const customersRef = collection(db, `tenants/${tenantId}/customers`);
        const customersQuery = query(customersRef, orderBy("name", "asc"));
        const customersSnapshot = await getDocs(customersQuery);
        const customersData = customersSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          lastVisit: doc.data().lastVisit?.toDate(),
        })) as Customer[];
        setCustomers(customersData);

        // Load staff members
        const staffRef = collection(db, `tenants/${tenantId}/staffMembers`);
        const staffQuery = query(staffRef, orderBy("name", "asc"));
        const staffSnapshot = await getDocs(staffQuery);
        const staffData = staffSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setStaffMembers(staffData);

        // Load appointments
        await loadAppointments(tenantId);
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
  }, [tenantId]);

  // Load appointments
  const loadAppointments = async (tid: string) => {
    try {
      const appointmentsRef = collection(db, `tenants/${tid}/appointments`);
      const appointmentsQuery = query(
        appointmentsRef,
        orderBy("startAt", "desc")
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);

      const appointmentsData = await Promise.all(
        appointmentsSnapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();

          // Get customer name
          let customerName = "不明";
          if (data.customerId) {
            const customerDoc = await getDoc(doc(db, `tenants/${tid}/customers`, data.customerId));
            if (customerDoc.exists()) {
              customerName = customerDoc.data().name;
            }
          }

          // Get service details
          const serviceDetails = await Promise.all(
            (data.serviceIds || []).map(async (serviceId: string) => {
              const serviceDoc = await getDoc(doc(db, `tenants/${tid}/services`, serviceId));
              if (serviceDoc.exists()) {
                return { id: serviceId, ...serviceDoc.data() } as Service;
              }
              return null;
            })
          );

          return {
            ...data,
            id: docSnapshot.id,
            startAt: data.startAt?.toDate(),
            endAt: data.endAt?.toDate(),
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            customerName,
            services: serviceDetails.filter(Boolean) as Service[],
          } as Appointment;
        })
      );

      setAppointments(appointmentsData);
    } catch (error) {
      console.error("Error loading appointments:", error);
      throw error;
    }
  };

  // Calculate pricing when services change (admin form)
  useEffect(() => {
    const selectedServices = services.filter((s) =>
      selectedServiceIds.has(s.id)
    );
    const breakdown = getPricingBreakdown(selectedServices);
    setPricing(breakdown);
  }, [selectedServiceIds, services]);

  // Calculate pricing for LINE booking preview
  const [linePricing, setLinePricing] = useState<PricingBreakdown>({
    subtotal: 0,
    discount: 0,
    discountRate: 0,
    total: 0,
    eligibleCount: 0,
    totalDuration: 0,
  });

  useEffect(() => {
    const selectedServices = services.filter((s) =>
      lineSelectedServiceIds.has(s.id)
    );
    const breakdown = getPricingBreakdown(selectedServices);
    setLinePricing(breakdown);
  }, [lineSelectedServiceIds, services]);

  // Auto-load all staff availability for LINE preview when tenantId is available
  useEffect(() => {
    if (tenantId && activeTab === "customer") {
      loadLineAvailableDates(null); // null = all staff
    }
  }, [tenantId, activeTab]);

  // Load available slots when date or staff changes (admin form)
  useEffect(() => {
    if (appointmentDate && !editingAppointment) {
      const staffId = selectedStaffId || null;
      loadAdminAvailableSlots(staffId, appointmentDate);
    } else {
      setAvailableSlots([]);
    }
  }, [appointmentDate, selectedStaffId, pricing.totalDuration]);

  // Toggle service selection (admin form)
  const toggleService = (serviceId: string) => {
    const newSet = new Set(selectedServiceIds);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setSelectedServiceIds(newSet);
  };

  // Toggle service selection (LINE preview)
  const toggleLineService = (serviceId: string) => {
    const newSet = new Set(lineSelectedServiceIds);
    if (newSet.has(serviceId)) {
      newSet.delete(serviceId);
    } else {
      newSet.add(serviceId);
    }
    setLineSelectedServiceIds(newSet);
  };

  // Load available slots for admin form
  const loadAdminAvailableSlots = async (staffId: string | null, date: string) => {
    if (!tenantId || !date) return;

    setLoadingSlots(true);
    try {
      const response = await fetch("/api/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          staffId: staffId || undefined,
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

  // Load available dates for LINE booking preview (multiple days)
  const loadLineAvailableDates = async (staffId: string | null = null) => {
    if (!tenantId) return;

    setLineLoadingDates(true);
    setLineAvailableDates([]);

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
            serviceDuration: linePricing.totalDuration || 60,
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

      setLineAvailableDates(dates);
    } catch (error) {
      console.error("Failed to load available dates:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "空き日程の取得に失敗しました",
      });
    } finally {
      setLineLoadingDates(false);
    }
  };

  // Load available slots for LINE booking
  const loadAvailableSlots = async (staffId: string | null, date: string) => {
    if (!tenantId || !date) return;

    setLineLoadingSlots(true);
    try {
      console.log("🔍 [Availability Debug] リクエスト:", {
        tenantId,
        staffId: staffId || undefined,
        date,
        serviceDuration: linePricing.totalDuration || 60,
      });

      const response = await fetch("/api/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          staffId: staffId || undefined,
          date,
          serviceDuration: linePricing.totalDuration || 60,
        }),
      });

      const data = await response.json();
      console.log("🔍 [Availability Debug] レスポンス:", data);

      if (data.success) {
        console.log("🔍 [Availability Debug] 空き枠数:", data.availableSlots?.length || 0);
        console.log("🔍 [Availability Debug] シフト枠:", data.workingSlots);
        setLineAvailableSlots(data.availableSlots || []);
      } else {
        console.error("🔍 [Availability Debug] エラー:", data.error || data.message);
        setLineAvailableSlots([]);
        toast({
          variant: "destructive",
          title: "空き枠取得エラー",
          description: data.message || "空き枠の取得に失敗しました",
        });
      }
    } catch (error) {
      console.error("🔍 [Availability Debug] 例外:", error);
      setLineAvailableSlots([]);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "空き枠の取得に失敗しました",
      });
    } finally {
      setLineLoadingSlots(false);
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
    if (!tenantId) return;
    setSavingOrder(true);

    try {
      const batch = writeBatch(db);
      editedServices.forEach((service, index) => {
        const serviceRef = doc(db, `tenants/${tenantId}/services`, service.id);
        batch.update(serviceRef, { sortOrder: index + 1 });
      });
      await batch.commit();

      const updatedServices = editedServices.map((service, index) => ({
        ...service,
        sortOrder: index + 1,
      }));
      setServices(updatedServices);
      setEditMode(false);
      toast({
        title: "順序を保存しました",
        description: "サービスの表示順序を更新しました",
      });
    } catch (err: any) {
      console.error("Failed to save order:", err);
      toast({
        variant: "destructive",
        title: "保存エラー",
        description: `順序の保存に失敗しました: ${err.message || "不明なエラー"}`,
      });
    } finally {
      setSavingOrder(false);
    }
  };

  // キャンセル
  const handleCancelEditOrder = () => {
    setEditMode(false);
    setEditedServices([]);
  };

  // Submit appointment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (selectedServiceIds.size === 0) {
      toast({
        variant: "destructive",
        title: "サービス未選択",
        description: "少なくとも1つのサービスを選択してください",
      });
      return;
    }

    if (!selectedCustomerId) {
      toast({
        variant: "destructive",
        title: "顧客未選択",
        description: "顧客を選択してください",
      });
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      toast({
        variant: "destructive",
        title: "日時未入力",
        description: "予約日時を入力してください",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const startAt = new Date(`${appointmentDate}T${appointmentTime}`);
      const endAt = new Date(startAt.getTime() + pricing.totalDuration * 60000);

      if (editingAppointment) {
        // Update existing appointment
        const appointmentRef = doc(db, `tenants/${tenantId}/appointments`, editingAppointment.id);
        await updateDoc(appointmentRef, {
          customerId: selectedCustomerId,
          staffId: selectedStaffId || "",
          serviceIds: Array.from(selectedServiceIds),
          startAt: startAt,
          endAt: endAt,
          notes: notes || null,
          pricing: {
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            total: pricing.total,
            eligibleCount: pricing.eligibleCount,
          },
          updatedAt: serverTimestamp(),
        });

        // Googleカレンダーに同期
        if (selectedStaffId) {
          try {
            await fetch("/api/calendar/sync-appointment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId,
                appointmentId: editingAppointment.id,
                staffId: selectedStaffId,
                operation: "update",
              }),
            });
          } catch (syncError) {
            console.error("Calendar sync error:", syncError);
            // 同期エラーは無視して続行
          }
        }

        toast({
          title: "予約を更新しました",
          description: `予約日時: ${appointmentDate} ${appointmentTime}`,
        });
        setEditingAppointment(null);
      } else {
        // Create new appointment
        const appointmentData = {
          tenantId: tenantId,
          customerId: selectedCustomerId,
          staffId: selectedStaffId || "",
          serviceIds: Array.from(selectedServiceIds),
          startAt: startAt,
          endAt: endAt,
          status: "scheduled",
          notes: notes || null,
          pricing: {
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            total: pricing.total,
            eligibleCount: pricing.eligibleCount,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(
          collection(db, `tenants/${tenantId}/appointments`),
          appointmentData
        );

        // Googleカレンダーに同期
        if (selectedStaffId) {
          try {
            await fetch("/api/calendar/sync-appointment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId,
                appointmentId: docRef.id,
                staffId: selectedStaffId,
                operation: "create",
              }),
            });
          } catch (syncError) {
            console.error("Calendar sync error:", syncError);
            // 同期エラーは無視して続行
          }
        }

        toast({
          title: "予約を登録しました",
          description: `予約日時: ${appointmentDate} ${appointmentTime}`,
        });
      }

      // Reset form
      setSelectedCustomerId("");
      setSelectedStaffId("");
      setSelectedServiceIds(new Set());
      setAppointmentDate("");
      setAppointmentTime("");
      setNotes("");
      setAvailableSlots([]);

      // Reload appointments
      await loadAppointments(tenantId);

      // Switch to list tab
      setActiveTab("list");
    } catch (error) {
      console.error("Error creating/updating appointment:", error);
      toast({
        variant: "destructive",
        title: "予約エラー",
        description: editingAppointment ? "予約の更新に失敗しました" : "予約の登録に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit appointment
  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setSelectedCustomerId(appointment.customerId);
    setSelectedStaffId(appointment.staffId || "");
    setSelectedServiceIds(new Set(appointment.serviceIds));
    setAppointmentDate(format(appointment.startAt, "yyyy-MM-dd"));
    setAppointmentTime(format(appointment.startAt, "HH:mm"));
    setNotes(appointment.notes || "");
    setActiveTab("create");
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingAppointment(null);
    setSelectedCustomerId("");
    setSelectedStaffId("");
    setSelectedServiceIds(new Set());
    setAppointmentDate("");
    setAppointmentTime("");
    setNotes("");
    setAvailableSlots([]);
  };

  // Delete appointment
  const handleDelete = async () => {
    if (!tenantId || !deletingAppointmentId) return;

    try {
      // 予約データを取得してスタッフIDを確認
      const appointmentDoc = await getDoc(doc(db, `tenants/${tenantId}/appointments`, deletingAppointmentId));
      const appointmentData = appointmentDoc.data();
      const staffId = appointmentData?.staffId;

      // Firestoreから削除
      await deleteDoc(doc(db, `tenants/${tenantId}/appointments`, deletingAppointmentId));

      // Googleカレンダーから削除
      if (staffId) {
        try {
          await fetch("/api/calendar/sync-appointment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId,
              appointmentId: deletingAppointmentId,
              staffId: staffId,
              operation: "delete",
            }),
          });
        } catch (syncError) {
          console.error("Calendar sync error:", syncError);
          // 同期エラーは無視して続行
        }
      }

      toast({
        title: "予約を削除しました",
      });

      await loadAppointments(tenantId);
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast({
        variant: "destructive",
        title: "削除エラー",
        description: "予約の削除に失敗しました",
      });
    } finally {
      setShowDeleteDialog(false);
      setDeletingAppointmentId(null);
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
      <MainLayout>
        <div className="text-center py-12">読み込み中...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">予約管理</h1>
          <p className="text-gray-500">予約の作成・編集・削除を管理します</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="create">
              {editingAppointment ? "予約編集" : "予約作成"}
            </TabsTrigger>
            <TabsTrigger value="list">予約一覧</TabsTrigger>
            <TabsTrigger value="customer">LINE予約UI</TabsTrigger>
          </TabsList>

          {/* Create/Edit Tab */}
          <TabsContent value="create" className="space-y-6">
            {editingAppointment && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-900">
                      予約を編集中です
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-2" />
                      キャンセル
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Form Section */}
              <div className="lg:col-span-2">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Customer Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle>顧客選択</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="customer">
                          顧客 <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={selectedCustomerId}
                          onValueChange={setSelectedCustomerId}
                        >
                          <SelectTrigger id="customer">
                            <SelectValue placeholder="顧客を選択してください" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} ({customer.kana})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {customers.length === 0 && (
                          <p className="text-sm text-gray-500">
                            顧客が登録されていません。先に顧客を登録してください。
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Staff Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle>担当スタッフ選択</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="staff">
                          担当スタッフ
                        </Label>
                        <Select
                          value={selectedStaffId}
                          onValueChange={setSelectedStaffId}
                        >
                          <SelectTrigger id="staff">
                            <SelectValue placeholder="スタッフを選択してください（任意）" />
                          </SelectTrigger>
                          <SelectContent>
                            {staffMembers.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id}>
                                {staff.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-gray-500">
                          スタッフを選択すると、Googleカレンダーに同期されます
                        </p>
                        {staffMembers.length === 0 && (
                          <p className="text-sm text-amber-600">
                            スタッフが登録されていません
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Service Selection */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>
                            サービス選択 <span className="text-red-500">*</span>
                          </CardTitle>
                          <p className="text-sm text-gray-500">
                            {editMode ? "ドラッグして順序を変更" : "複数選択可能です。★マークはセット割引対象です。"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {editMode ? (
                            <>
                              <Button variant="outline" size="sm" onClick={handleCancelEditOrder} disabled={savingOrder}>
                                <XIcon className="h-4 w-4 mr-1" />
                                キャンセル
                              </Button>
                              <Button size="sm" onClick={handleSaveOrder} disabled={savingOrder}>
                                <Save className="h-4 w-4 mr-1" />
                                {savingOrder ? "保存中..." : "保存"}
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={toggleEditMode}>
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
                        <>
                          {Object.entries(servicesByCategory).map(
                            ([category, categoryServices]) => (
                              <div key={category} className="mb-6 last:mb-0">
                                <h3 className="font-semibold text-lg mb-3 text-primary">
                                  {category}
                                </h3>
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
                            )
                          )}
                          {services.length === 0 && (
                            <p className="text-center text-gray-500 py-8">
                              サービスが登録されていません
                            </p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Date & Time */}
                  <Card>
                    <CardHeader>
                      <CardTitle>予約日時</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="date">
                            日付 <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="date"
                            type="date"
                            value={appointmentDate}
                            onChange={(e) => setAppointmentDate(e.target.value)}
                            required
                            min={format(new Date(), "yyyy-MM-dd")}
                          />
                        </div>

                        {/* Available Time Slots */}
                        {appointmentDate && (
                          <div className="space-y-2">
                            <Label>
                              空き時間 <span className="text-red-500">*</span>
                            </Label>
                            {loadingSlots ? (
                              <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                                <p className="text-sm text-gray-600">空き枠を確認中...</p>
                              </div>
                            ) : availableSlots.length === 0 ? (
                              <div className="text-center py-6 bg-gray-50 rounded-lg border">
                                <p className="text-sm text-gray-600 mb-1">
                                  😔 この日は空きがありません
                                </p>
                                <p className="text-xs text-gray-500">
                                  {selectedStaffId
                                    ? "他の日付または別のスタッフをお選びください"
                                    : "他の日付をお選びください"}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-3 bg-gray-50 rounded-lg border">
                                  {availableSlots.map((slot, index) => (
                                    <button
                                      key={index}
                                      type="button"
                                      onClick={() => setAppointmentTime(slot.startTime)}
                                      className={`p-2 rounded-md border-2 text-sm font-medium transition-all hover:scale-105 ${
                                        appointmentTime === slot.startTime
                                          ? "border-primary bg-primary text-white"
                                          : "border-gray-300 bg-white text-gray-700 hover:border-primary/50"
                                      }`}
                                    >
                                      {slot.startTime}
                                    </button>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {selectedStaffId
                                    ? `選択されたスタッフの空き枠: ${availableSlots.length}件`
                                    : `全スタッフの空き枠: ${availableSlots.length}件`}
                                </p>
                              </>
                            )}
                          </div>
                        )}

                        {!appointmentDate && (
                          <div className="text-center py-6 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-700">
                              📅 まず日付を選択してください
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              選択後、空き時間が表示されます
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notes */}
                  <Card>
                    <CardHeader>
                      <CardTitle>メモ</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Input
                        id="notes"
                        placeholder="予約に関するメモ（任意）"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </CardContent>
                  </Card>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting || selectedServiceIds.size === 0}
                  >
                    <CalendarPlus className="mr-2 h-5 w-5" />
                    {isSubmitting
                      ? (editingAppointment ? "更新中..." : "登録中...")
                      : (editingAppointment ? "予約を更新" : "予約を登録")}
                  </Button>
                </form>
              </div>

              {/* Pricing Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle>料金サマリー</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedServiceIds.size === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        サービスを選択してください
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">選択数</span>
                            <span className="font-medium">
                              {selectedServiceIds.size}件
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              所要時間
                            </span>
                            <span className="font-medium">
                              {pricing.totalDuration}分
                            </span>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              小計
                            </span>
                            <span className="font-medium">
                              {formatCurrency(pricing.subtotal)}
                            </span>
                          </div>

                          {pricing.discount > 0 && (
                            <>
                              <div className="flex items-center justify-between text-green-600">
                                <span className="flex items-center gap-1">
                                  <Percent className="h-4 w-4" />
                                  {getDiscountDescription(pricing.eligibleCount)}
                                </span>
                                <span className="font-medium">
                                  -{formatCurrency(pricing.discount)}
                                </span>
                              </div>
                              {pricing.eligibleCount >= 2 && (
                                <p className="text-xs text-green-600 bg-green-50 p-2 rounded">
                                  ★マークのサービス{pricing.eligibleCount}
                                  箇所でセット割引が適用されました！
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between text-lg font-bold">
                            <span>合計金額</span>
                            <span className="text-primary">
                              {formatCurrency(pricing.total)}
                            </span>
                          </div>
                        </div>

                        {pricing.eligibleCount === 1 && (
                          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            ★マークのサービスを2箇所以上選択すると、セット割引が適用されます
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* List Tab */}
          <TabsContent value="list" className="space-y-4">
            {appointments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-600">予約がありません</p>
                  <Button
                    className="mt-4"
                    onClick={() => setActiveTab("create")}
                  >
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    予約を作成
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <Card key={appointment.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {appointment.customerName}
                          </CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            {format(appointment.startAt, "yyyy年M月d日(E) HH:mm", { locale: ja })}
                            {" - "}
                            {format(appointment.endAt, "HH:mm")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(appointment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDeletingAppointmentId(appointment.id);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Services */}
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            施術内容
                          </p>
                          <div className="space-y-1">
                            {appointment.services?.map((service) => (
                              <div
                                key={service.id}
                                className="flex justify-between text-sm text-gray-600"
                              >
                                <span>• {service.name}</span>
                                <span>{formatCurrency(service.price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="border-t pt-3">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between text-gray-600">
                              <span>小計</span>
                              <span>
                                {formatCurrency(appointment.pricing.subtotal)}
                              </span>
                            </div>
                            {appointment.pricing.discount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>セット割引</span>
                                <span>
                                  -{formatCurrency(appointment.pricing.discount)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t">
                              <span>合計</span>
                              <span>
                                {formatCurrency(appointment.pricing.total)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {appointment.notes && (
                          <div className="text-sm text-gray-600 border-t pt-3">
                            <p className="font-medium mb-1">メモ</p>
                            <p className="text-gray-500">{appointment.notes}</p>
                          </div>
                        )}

                        {/* Status */}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">ステータス:</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              appointment.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : appointment.status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {appointment.status === "completed"
                              ? "完了"
                              : appointment.status === "cancelled"
                              ? "キャンセル"
                              : "予約済み"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* LINE Booking UI Preview Tab */}
          <TabsContent value="customer" className="space-y-4">
            <div className="bg-gradient-to-br from-green-50 via-blue-50 to-indigo-100 p-6 rounded-lg">
              <div className="max-w-md mx-auto">
                {/* LINE Header */}
                <div className="bg-white rounded-t-2xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-green-400 to-green-500 px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-green-500">
                      店
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">ディープ＆モア</p>
                      <p className="text-white/90 text-xs">脱毛サロン予約</p>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="bg-white shadow-lg px-4 py-6 space-y-6 rounded-b-2xl min-h-[500px]">
                  {/* Step 1: Staff & Date Selection */}
                  {lineBookingStep === 1 && (
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
                            value={lineSelectedStaffId}
                            onValueChange={(value) => {
                              const newStaffId = value === "none" ? "" : value;
                              setLineSelectedStaffId(newStaffId);
                              setLineSelectedDate("");
                              setLineAvailableDates([]);
                              loadLineAvailableDates(newStaffId || null);
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
                            {lineSelectedStaffId
                              ? "選択中のスタッフの空き枠を表示"
                              : "全スタッフの空き枠を表示中"}
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">
                            ご希望の日付（空き枠がある日のみ表示）
                          </Label>
                          {lineLoadingDates ? (
                            <div className="text-center py-12">
                              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
                              <p className="text-sm text-gray-600">空き日程を確認中...</p>
                              <p className="text-xs text-gray-500 mt-1">最大3週間分</p>
                            </div>
                          ) : lineAvailableDates.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border">
                              <p className="text-gray-600 mb-1">😔 空き枠がありません</p>
                              <p className="text-xs text-gray-500">
                                {lineSelectedStaffId
                                  ? "別のスタッフをお選びください"
                                  : "別の日付をお選びください"}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                              {lineAvailableDates.map((dateInfo) => {
                                const date = new Date(dateInfo.date);
                                const isSelected = lineSelectedDate === dateInfo.date;
                                return (
                                  <button
                                    key={dateInfo.date}
                                    onClick={async () => {
                                      setLineSelectedDate(dateInfo.date);
                                      await loadAvailableSlots(lineSelectedStaffId || null, dateInfo.date);
                                      setLineBookingStep(2);
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
                  {lineBookingStep === 2 && (
                    <div className="space-y-4">
                      <div className="text-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                          🕒 時間を選択
                        </h2>
                        <p className="text-sm text-gray-600">
                          ご希望の時間帯を選択してください
                        </p>
                      </div>

                      {lineLoadingSlots ? (
                        <div className="text-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                          <p className="text-gray-600">空き枠を確認中...</p>
                        </div>
                      ) : lineAvailableSlots.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-600 mb-2">😔 この日は空きがありません</p>
                          <p className="text-sm text-gray-500">他の日付をお選びください</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-[350px] overflow-y-auto p-2">
                          {lineAvailableSlots.map((slot, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setLineSelectedTime(slot.startTime);
                                setLineBookingStep(3);
                              }}
                              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all hover:scale-105 ${
                                lineSelectedTime === slot.startTime
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
                        onClick={() => setLineBookingStep(1)}
                        variant="outline"
                        className="w-full py-6"
                      >
                        戻る
                      </Button>
                    </div>
                  )}

                  {/* Step 3: Service Selection */}
                  {lineBookingStep === 3 && (
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
                                    onClick={() => toggleLineService(service.id)}
                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                      lineSelectedServiceIds.has(service.id)
                                        ? "border-green-500 bg-green-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1">
                                        <div
                                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                            lineSelectedServiceIds.has(service.id)
                                              ? "bg-green-500 border-green-500"
                                              : "border-gray-300"
                                          }`}
                                        >
                                          {lineSelectedServiceIds.has(service.id) && (
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
                      {lineSelectedServiceIds.size > 0 && (
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-gray-700">
                              <span>選択: {lineSelectedServiceIds.size}件</span>
                              <span>{linePricing.totalDuration}分</span>
                            </div>
                            <div className="flex justify-between text-gray-700">
                              <span>小計</span>
                              <span>¥{linePricing.subtotal.toLocaleString()}</span>
                            </div>
                            {linePricing.discount > 0 && (
                              <div className="flex justify-between text-green-600 font-semibold">
                                <span>
                                  🎉 セット割引 ({getDiscountDescription(linePricing.eligibleCount)})
                                </span>
                                <span>-¥{linePricing.discount.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t-2 border-green-300">
                              <span>合計</span>
                              <span className="text-green-600">
                                ¥{linePricing.total.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={() => setLineBookingStep(2)}
                          variant="outline"
                          className="flex-1 py-6"
                        >
                          戻る
                        </Button>
                        <Button
                          onClick={() => setLineBookingStep(4)}
                          disabled={lineSelectedServiceIds.size === 0}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-6"
                        >
                          確認画面へ
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Confirmation */}
                  {lineBookingStep === 4 && (
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
                            {lineSelectedDate && format(new Date(lineSelectedDate), "M月d日(E)", { locale: ja })}
                            {" "}
                            {lineSelectedTime}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            所要時間: 約{linePricing.totalDuration}分
                          </p>
                        </div>

                        {/* Services */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">施術内容</p>
                          <div className="space-y-2">
                            {services
                              .filter((s) => lineSelectedServiceIds.has(s.id))
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
                              <span>¥{linePricing.subtotal.toLocaleString()}</span>
                            </div>
                            {linePricing.discount > 0 && (
                              <>
                                <div className="flex justify-between text-green-600 font-semibold">
                                  <span>セット割引</span>
                                  <span>-¥{linePricing.discount.toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  🎉 {linePricing.eligibleCount}箇所で
                                  {getDiscountDescription(linePricing.eligibleCount)}適用！
                                </p>
                              </>
                            )}
                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t-2 border-green-400">
                              <span>お支払い金額</span>
                              <span className="text-green-600">
                                ¥{linePricing.total.toLocaleString()}
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
                          onClick={() => setLineBookingStep(3)}
                          variant="outline"
                          className="flex-1 py-6"
                        >
                          戻る
                        </Button>
                        <Button
                          disabled
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-6 text-base"
                        >
                          予約を確定（プレビュー）
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Note */}
                <div className="mt-4 text-center bg-white/80 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 font-medium">
                    💡 これはLINE予約画面のプレビューです
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    実際の予約機能を実装する際のUI参考として使用できます
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLineBookingStep(1);
                        setLineSelectedStaffId("");
                        setLineSelectedDate("");
                        setLineSelectedTime("");
                        setLineSelectedServiceIds(new Set());
                        setLineAvailableSlots([]);
                        setLineAvailableDates([]);
                      }}
                      className="text-xs"
                    >
                      リセット
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (lineBookingStep > 1) setLineBookingStep(lineBookingStep - 1);
                      }}
                      disabled={lineBookingStep === 1}
                      className="text-xs"
                    >
                      前のステップ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (lineBookingStep < 4) setLineBookingStep(lineBookingStep + 1);
                      }}
                      disabled={lineBookingStep === 4}
                      className="text-xs"
                    >
                      次のステップ
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>予約を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この操作は取り消せません。予約データが完全に削除されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
