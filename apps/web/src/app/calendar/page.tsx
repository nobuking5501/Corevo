"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Appointment, Customer, Service, StaffMember } from "@/types";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Calendar, Clock, DollarSign, User, Tag, Edit, Trash2, Filter } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";

interface ExtendedAppointment extends Appointment {
  customer?: Customer;
  services?: Service[];
}

interface ShiftEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status?: string;
  staffMemberId?: string;
  staffName?: string;
}

const isDev = process.env.NEXT_PUBLIC_APP_ENV === "dev";

export default function CalendarPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<ExtendedAppointment[]>([]);
  const [shifts, setShifts] = useState<ShiftEvent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<ExtendedAppointment | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editStatus, setEditStatus] = useState<
    "scheduled" | "confirmed" | "completed" | "canceled" | "noshow"
  >("scheduled");
  const [editNotes, setEditNotes] = useState("");

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

  // Load data
  useEffect(() => {
    if (!tenantId) return;

    const loadData = async () => {
      try {
        // Load appointments
        const appointmentsRef = collection(
          db,
          `tenants/${tenantId}/appointments`
        );
        const appointmentsQuery = query(
          appointmentsRef,
          orderBy("startAt", "desc")
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsData = appointmentsSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          startAt: doc.data().startAt?.toDate(),
          endAt: doc.data().endAt?.toDate(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as Appointment[];

        // Load customers
        const customersRef = collection(db, `tenants/${tenantId}/customers`);
        const customersSnapshot = await getDocs(customersRef);
        const customersData = customersSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
          lastVisit: doc.data().lastVisit?.toDate(),
        })) as Customer[];
        setCustomers(customersData);

        // Load services
        const servicesRef = collection(db, `tenants/${tenantId}/services`);
        const servicesSnapshot = await getDocs(servicesRef);
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
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        })) as StaffMember[];
        setStaffMembers(staffData);

        // Merge data
        const extendedAppointments = appointmentsData.map((apt) => ({
          ...apt,
          customer: customersData.find((c) => c.id === apt.customerId),
          services: servicesData.filter((s) =>
            apt.serviceIds?.includes(s.id)
          ),
        }));

        setAppointments(extendedAppointments);

        // 各スタッフのGoogleカレンダーからシフトデータを取得
        const allShifts: ShiftEvent[] = [];

        // Google Calendar連携状況を確認
        const connectionsRef = collection(db, `tenants/${tenantId}/googleCalendarConnections`);
        const connectionsSnapshot = await getDocs(connectionsRef);

        for (const connDoc of connectionsSnapshot.docs) {
          // お店用連携はスキップ
          if (connDoc.id === "store") {
            continue;
          }

          const connectionData = connDoc.data();

          if (!connectionData.isActive) {
            continue;
          }

          const staffMemberId = connDoc.id;
          const staff = staffData.find(s => s.id === staffMemberId);

          try {
            const response = await fetch("/api/calendar/fetch-events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantId,
                staffMemberId,
                timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1週間前
                timeMax: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 2ヶ月先
              }),
            });

            if (response.ok) {
              const data = await response.json();

              if (data.success && data.events) {
                // イベントからシフトを抽出
                const staffShifts = data.events
                  .filter((event: any) => {
                    const title = (event.title || "").toLowerCase();
                    return title.includes("シフト") ||
                           title.includes("勤務") ||
                           title.includes("出勤") ||
                           title.includes("shift") ||
                           title.includes("work");
                  })
                  .map((event: any) => ({
                    ...event,
                    staffMemberId,
                    staffName: staff?.name || connectionData.staffName || "スタッフ",
                  }));

                allShifts.push(...staffShifts);
              }
            }
          } catch (staffError) {
            // 個別スタッフのエラーは非クリティカルなので、ログのみ
            console.error("Failed to fetch shifts for staff:", staffMemberId, staffError);
          }
        }

        setShifts(allShifts);
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

  // Filter appointments by selected staff
  const filteredAppointments = selectedStaffId
    ? appointments.filter((apt) => apt.staffId === selectedStaffId)
    : appointments;

  // Convert appointments to FullCalendar events
  const appointmentEvents = filteredAppointments.map((apt) => {
    let color = "#3b82f6"; // blue for scheduled
    if (apt.status === "confirmed") color = "#10b981"; // green
    if (apt.status === "completed") color = "#6b7280"; // gray
    if (apt.status === "canceled") color = "#ef4444"; // red
    if (apt.status === "noshow") color = "#f59e0b"; // orange

    return {
      id: `apt-${apt.id}`,
      title: `予約: ${apt.customer?.name || "顧客情報なし"}`,
      start: apt.startAt,
      end: apt.endAt,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        type: "appointment",
        appointment: apt,
      },
    };
  });

  // Convert shifts to FullCalendar events
  const shiftEvents = shifts.map((shift) => {
    // スタッフ名の取得（staffNameがあればそれを使用、なければstaffMemberIdから取得）
    let displayStaffName = shift.staffName;
    if (!displayStaffName && shift.staffMemberId) {
      const staff = staffMembers.find(s => s.id === shift.staffMemberId);
      displayStaffName = staff?.name || "スタッフ";
    }

    return {
      id: `shift-${shift.id}`,
      title: `${displayStaffName || ""}シフト: ${shift.title}`,
      start: new Date(shift.startTime),
      end: new Date(shift.endTime),
      backgroundColor: "#22c55e", // emerald green for shifts
      borderColor: "#16a34a",
      editable: false, // シフトは編集不可
      extendedProps: {
        type: "shift",
        shift: shift,
      },
    };
  });

  // Merge appointment and shift events
  const events = [...appointmentEvents, ...shiftEvents];

  // Handle event click
  const handleEventClick = (info: EventClickArg) => {
    const eventType = info.event.extendedProps.type;

    // シフトイベントの場合は詳細表示をスキップ（または別のダイアログを表示）
    if (eventType === "shift") {
      const shift = info.event.extendedProps.shift as ShiftEvent;
      const startTime = new Date(shift.startTime).toLocaleString("ja-JP", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTime = new Date(shift.endTime).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });

      toast({
        title: `${shift.staffName || "スタッフ"}のシフト`,
        description: `${shift.title}\n${startTime} - ${endTime}`,
      });
      return;
    }

    // 予約イベントの場合は既存の詳細ダイアログを表示
    const apt = info.event.extendedProps.appointment as ExtendedAppointment;
    setSelectedAppointment(apt);
    setIsDetailDialogOpen(true);
  };

  // Handle event drop (drag and drop)
  const handleEventDrop = async (info: EventDropArg) => {
    if (!tenantId) return;

    const eventType = info.event.extendedProps.type;

    // シフトイベントはドラッグ不可
    if (eventType === "shift") {
      info.revert();
      toast({
        variant: "destructive",
        title: "操作エラー",
        description: "シフトイベントは移動できません",
      });
      return;
    }

    const apt = info.event.extendedProps.appointment as ExtendedAppointment;
    const newStart = info.event.start!;
    const duration = apt.endAt.getTime() - apt.startAt.getTime();
    const newEnd = new Date(newStart.getTime() + duration);

    try {
      await updateDoc(doc(db, `tenants/${tenantId}/appointments`, apt.id), {
        startAt: newStart,
        endAt: newEnd,
        updatedAt: new Date(),
      });

      // Google同期（staffIdがある場合のみ）
      if (apt.staffId) {
        try {
          await fetch("/api/calendar/sync-appointment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId,
              appointmentId: apt.id,
              staffId: apt.staffId,
              operation: "update",
            }),
          });
        } catch (syncError) {
          console.error("Google sync failed (non-critical):", syncError);
        }
      }

      // Update local state
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === apt.id ? { ...a, startAt: newStart, endAt: newEnd } : a
        )
      );

      toast({
        title: "予約時間を変更しました",
        description: `${newStart.toLocaleDateString()} ${newStart.toLocaleTimeString()}`,
      });
    } catch (error) {
      console.error("Error updating appointment:", error);
      info.revert();
      toast({
        variant: "destructive",
        title: "変更エラー",
        description: "予約時間の変更に失敗しました",
      });
    }
  };

  // Open edit dialog
  const handleEdit = () => {
    if (!selectedAppointment) return;

    const startDate = new Date(selectedAppointment.startAt);
    setEditDate(startDate.toISOString().split("T")[0]);
    setEditTime(
      startDate.toTimeString().split(" ")[0].substring(0, 5)
    );
    setEditStatus(selectedAppointment.status);
    setEditNotes(selectedAppointment.notes || "");

    setIsDetailDialogOpen(false);
    setIsEditDialogOpen(true);
  };

  // Submit edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedAppointment) return;

    setIsSubmitting(true);

    try {
      const newStartAt = new Date(`${editDate}T${editTime}`);
      const duration =
        selectedAppointment.endAt.getTime() -
        selectedAppointment.startAt.getTime();
      const newEndAt = new Date(newStartAt.getTime() + duration);

      await updateDoc(
        doc(db, `tenants/${tenantId}/appointments`, selectedAppointment.id),
        {
          startAt: newStartAt,
          endAt: newEndAt,
          status: editStatus,
          notes: editNotes || null,
          updatedAt: new Date(),
        }
      );

      // Google同期（staffIdがある場合のみ）
      if (selectedAppointment.staffId) {
        try {
          await fetch("/api/calendar/sync-appointment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId,
              appointmentId: selectedAppointment.id,
              staffId: selectedAppointment.staffId,
              operation: "update",
            }),
          });
        } catch (syncError) {
          console.error("Google sync failed (non-critical):", syncError);
        }
      }

      // Update local state
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === selectedAppointment.id
            ? {
                ...a,
                startAt: newStartAt,
                endAt: newEndAt,
                status: editStatus,
                notes: editNotes,
              }
            : a
        )
      );

      toast({
        title: "予約を更新しました",
      });

      setIsEditDialogOpen(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast({
        variant: "destructive",
        title: "更新エラー",
        description: "予約の更新に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete appointment
  const handleDelete = async () => {
    if (!tenantId || !selectedAppointment) return;
    if (!confirm(`「${selectedAppointment.customer?.name}」の予約を削除してもよろしいですか？`))
      return;

    try {
      // Google同期（削除）
      if (selectedAppointment.staffId) {
        try {
          await fetch("/api/calendar/sync-appointment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId,
              appointmentId: selectedAppointment.id,
              staffId: selectedAppointment.staffId,
              operation: "delete",
            }),
          });
        } catch (syncError) {
          console.error("Google sync failed (non-critical):", syncError);
        }
      }

      await deleteDoc(
        doc(db, `tenants/${tenantId}/appointments`, selectedAppointment.id)
      );

      // Update local state
      setAppointments((prev) =>
        prev.filter((a) => a.id !== selectedAppointment.id)
      );

      toast({
        title: "予約を削除しました",
      });

      setIsDetailDialogOpen(false);
      setSelectedAppointment(null);
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast({
        variant: "destructive",
        title: "削除エラー",
        description: "予約の削除に失敗しました",
      });
    }
  };

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
          <h1 className="text-3xl font-bold">カレンダー</h1>
          <p className="text-gray-500">予約スケジュール管理</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>予約カレンダー</CardTitle>
              <div className="flex items-center gap-4">
                {/* 凡例 */}
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    <span className="text-gray-600">予約</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-gray-600">シフト</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <Select
                    value={selectedStaffId || "all"}
                    onValueChange={(value) => setSelectedStaffId(value === "all" ? null : value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="全スタッフ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全スタッフ</SelectItem>
                      {staffMembers.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: staff.color }}
                            />
                            {staff.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              locale="ja"
              buttonText={{
                today: "今日",
                month: "月",
                week: "週",
                day: "日",
              }}
              events={events}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              editable={true}
              droppable={true}
              height="auto"
              slotMinTime="09:00:00"
              slotMaxTime="21:00:00"
              allDaySlot={false}
              nowIndicator={true}
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
            />
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>予約詳細</DialogTitle>
            </DialogHeader>
            {selectedAppointment && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span className="font-semibold">顧客</span>
                  </div>
                  <p className="text-lg">
                    {selectedAppointment.customer?.name || "顧客情報なし"}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span className="font-semibold">日時</span>
                  </div>
                  <p>
                    {selectedAppointment.startAt.toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {selectedAppointment.startAt.toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {selectedAppointment.endAt.toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Tag className="h-4 w-4" />
                    <span className="font-semibold">サービス</span>
                  </div>
                  <div className="space-y-1">
                    {selectedAppointment.services?.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {service.name}
                          {service.setDiscountEligible && (
                            <span className="text-yellow-500 ml-1">★</span>
                          )}
                        </span>
                        <span className="text-gray-600">
                          {formatCurrency(service.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedAppointment.pricing && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-semibold">料金</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">小計</span>
                        <span>
                          {formatCurrency(selectedAppointment.pricing.subtotal)}
                        </span>
                      </div>
                      {selectedAppointment.pricing.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>セット割引</span>
                          <span>
                            -
                            {formatCurrency(
                              selectedAppointment.pricing.discount
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>合計</span>
                        <span className="text-primary">
                          {formatCurrency(selectedAppointment.pricing.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-semibold">ステータス</span>
                  </div>
                  <div>
                    {selectedAppointment.status === "scheduled" && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                        予約済み
                      </span>
                    )}
                    {selectedAppointment.status === "confirmed" && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                        確定
                      </span>
                    )}
                    {selectedAppointment.status === "completed" && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
                        完了
                      </span>
                    )}
                    {selectedAppointment.status === "canceled" && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                        キャンセル
                      </span>
                    )}
                    {selectedAppointment.status === "noshow" && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                        来店なし
                      </span>
                    )}
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 font-semibold">
                      メモ
                    </div>
                    <p className="text-sm">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDetailDialogOpen(false)}
              >
                閉じる
              </Button>
              <Button variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                編集
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>予約編集</DialogTitle>
              <DialogDescription>予約情報を編集します</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">日付</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-time">時刻</Label>
                    <Input
                      id="edit-time"
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-status">ステータス</Label>
                  <Select value={editStatus} onValueChange={(value: any) => setEditStatus(value)}>
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">予約済み</SelectItem>
                      <SelectItem value="confirmed">確定</SelectItem>
                      <SelectItem value="completed">完了</SelectItem>
                      <SelectItem value="canceled">キャンセル</SelectItem>
                      <SelectItem value="noshow">来店なし</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-notes">メモ</Label>
                  <Input
                    id="edit-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="メモ（任意）"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "更新中..." : "更新"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
