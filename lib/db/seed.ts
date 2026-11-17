import type { Category, PlannerEvent, Settings, Task } from "../types";
import { addDaysKey, combineDateTime, todayKey } from "../date";
import { newId } from "./index-utils";
import vnEvents from "../../data/vn-events.json";

interface VnEventSeed {
  slug: string;
  title: string;
  calendarType: "solar" | "lunar";
  day: number;
  month: number;
  recurrence: PlannerEvent["recurrence"];
  reminderDaysBefore: number[];
  category: string;
  description: string;
  notes: string;
}

export function seedSettings(): Settings {
  return {
    id: "app",
    viewMode: "month",
    calendarDisplay: "both",
    digestTime: "07:30",
    weeklyPlanTime: "19:00",
    monthlyReviewTime: "19:00",
    quietHours: { enabled: true, start: "22:00", end: "07:00" },
    theme: "system",
    lang: "vi",
    weekStartsOn: 1,
    notificationsEnabled: false,
    reminderLeadMinutes: 15,
    seededVersion: 1,
  };
}

export function seedCategories(): Category[] {
  return [
    { id: "cat-work", name: "Công việc", color: "#2563eb" },
    { id: "cat-personal", name: "Cá nhân", color: "#8b5cf6" },
    { id: "cat-study", name: "Học tập", color: "#d97706" },
    { id: "cat-health", name: "Sức khỏe", color: "#059669" },
    { id: "cat-family", name: "Gia đình", color: "#db2777" },
  ];
}

const EVENT_COLORS: Record<string, string> = {
  "Lễ hội": "#dc2626",
  "Quốc gia": "#b91c1c",
  "Tôn giáo": "#7c3aed",
  "Truyền thống": "#d97706",
  "Gia đình": "#db2777",
  "Kỷ niệm": "#059669",
};

export function seedEvents(now: string): PlannerEvent[] {
  return (vnEvents as VnEventSeed[]).map((event) => ({
    id: `builtin-${event.slug}`,
    title: event.title,
    calendarType: event.calendarType,
    day: event.day,
    month: event.month,
    recurrence: event.recurrence,
    reminderDaysBefore: event.reminderDaysBefore,
    category: event.category,
    isBuiltin: true,
    notes: event.notes,
    description: event.description,
    color: EVENT_COLORS[event.category] ?? "#dc2626",
    createdAt: now,
    updatedAt: now,
  }));
}

export function seedCustomEvents(now: string): PlannerEvent[] {
  return [
    {
      id: "sample-gio-ba-noi",
      title: "Giỗ bà nội",
      calendarType: "lunar",
      day: 12,
      month: 8,
      recurrence: { type: "yearly-lunar", leapPolicy: "regular" },
      reminderDaysBefore: [7, 1, 0],
      category: "Gia đình",
      isBuiltin: false,
      notes: "Cúng giỗ tại nhà, chuẩn bị mâm cơm và mời họ hàng. Đây là sự kiện mẫu, bạn có thể sửa hoặc xoá.",
      description: "Ngày giỗ của bà nội (âm lịch 12/8).",
      color: "#db2777",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

interface TaskSeed {
  title: string;
  desc: string;
  offset: number;
  time: string;
  duration: number;
  priority: 1 | 2 | 3;
  categoryId: string;
  status: "todo" | "doing" | "done";
  tags: string[];
  allDay?: boolean;
  subtasks?: string[];
}

const SAMPLE_TASKS: TaskSeed[] = [
  { title: "Lập kế hoạch tuần", desc: "Xem lại mục tiêu và sắp xếp lịch tuần mới.", offset: -13, time: "08:30", duration: 45, priority: 1, categoryId: "cat-work", status: "done", tags: ["kế hoạch"] },
  { title: "Chạy bộ 5km", desc: "Chạy buổi sáng ở công viên.", offset: -12, time: "06:00", duration: 40, priority: 2, categoryId: "cat-health", status: "done", tags: ["thể thao"] },
  { title: "Đọc sách chuyên môn", desc: "Đọc 30 trang sách về quản lý dự án.", offset: -11, time: "21:00", duration: 30, priority: 3, categoryId: "cat-study", status: "done", tags: ["đọc sách"] },
  { title: "Họp nhóm dự án", desc: "Đồng bộ tiến độ sprint và các rủi ro.", offset: -10, time: "10:00", duration: 60, priority: 1, categoryId: "cat-work", status: "done", tags: ["họp", "dự án"] },
  { title: "Dọn dẹp nhà cửa", desc: "Vệ sinh phòng khách và sắp xếp lại bàn làm việc.", offset: -9, time: "16:00", duration: 90, priority: 3, categoryId: "cat-personal", status: "done", tags: ["nhà cửa"] },
  { title: "Học tiếng Anh", desc: "Luyện nghe 20 phút và học 10 từ mới.", offset: -8, time: "20:00", duration: 30, priority: 2, categoryId: "cat-study", status: "done", tags: ["tiếng Anh"] },
  { title: "Tổng kết tuần", desc: "Ghi lại điều làm tốt và điều cần cải thiện.", offset: -7, time: "17:00", duration: 30, priority: 2, categoryId: "cat-work", status: "done", tags: ["review"] },
  { title: "Đi chợ cuối tuần", desc: "Mua thực phẩm cho cả tuần.", offset: -6, time: "09:00", duration: 60, priority: 3, categoryId: "cat-family", status: "done", tags: ["gia đình"] },
  { title: "Tập gym", desc: "Buổi tập thân trên.", offset: -5, time: "18:00", duration: 60, priority: 2, categoryId: "cat-health", status: "done", tags: ["gym"] },
  { title: "Viết báo cáo tháng", desc: "Tổng hợp số liệu và nhận xét.", offset: -4, time: "14:00", duration: 120, priority: 1, categoryId: "cat-work", status: "done", tags: ["báo cáo"] },
  { title: "Gọi điện cho bố mẹ", desc: "Hỏi thăm sức khỏe và kể chuyện tuần qua.", offset: -3, time: "19:30", duration: 20, priority: 3, categoryId: "cat-family", status: "done", tags: ["gia đình"] },
  { title: "Ôn tập chứng chỉ", desc: "Làm đề thử số 3 và chữa lỗi.", offset: -2, time: "20:00", duration: 60, priority: 2, categoryId: "cat-study", status: "done", tags: ["chứng chỉ"] },
  { title: "Họp khách hàng", desc: "Chuẩn bị slide và xác nhận yêu cầu.", offset: -2, time: "10:00", duration: 60, priority: 1, categoryId: "cat-work", status: "todo", tags: ["khách hàng"] },
  { title: "Nộp hồ sơ bảo hiểm", desc: "Bổ sung giấy khám sức khỏe còn thiếu.", offset: -1, time: "17:00", duration: 30, priority: 1, categoryId: "cat-personal", status: "todo", tags: ["giấy tờ"] },
  { title: "Chạy bộ buổi sáng", desc: "Chạy nhẹ 3km.", offset: -1, time: "06:30", duration: 30, priority: 2, categoryId: "cat-health", status: "done", tags: ["thể thao"] },
  { title: "Họp giao ban", desc: "Cập nhật đầu ngày cùng team.", offset: 0, time: "09:00", duration: 30, priority: 1, categoryId: "cat-work", status: "doing", tags: ["họp"], subtasks: ["Chuẩn bị số liệu", "Gửi agenda", "Ghi biên bản"] },
  { title: "Review kế hoạch tháng", desc: "Rà soát mục tiêu và điều chỉnh ưu tiên.", offset: 0, time: "14:00", duration: 60, priority: 2, categoryId: "cat-work", status: "todo", tags: ["kế hoạch"] },
  { title: "Tập thể dục 30 phút", desc: "Bài tập giãn cơ và plank.", offset: 0, time: "18:30", duration: 30, priority: 3, categoryId: "cat-health", status: "todo", tags: ["sức khỏe"] },
  { title: "Uống đủ nước", desc: "Mục tiêu 2 lít nước.", offset: 0, time: "00:00", duration: 0, priority: 3, categoryId: "cat-health", status: "done", tags: ["thói quen"], allDay: true },
  { title: "Gửi báo cáo tiến độ", desc: "Gửi trước 11h cho quản lý.", offset: 1, time: "10:00", duration: 45, priority: 1, categoryId: "cat-work", status: "todo", tags: ["báo cáo"], subtasks: ["Tổng hợp số liệu", "Viết nhận xét", "Gửi email"] },
  { title: "Học tiếng Anh", desc: "Buổi học trực tuyến với giáo viên.", offset: 1, time: "20:00", duration: 60, priority: 2, categoryId: "cat-study", status: "todo", tags: ["tiếng Anh"] },
  { title: "Sinh nhật mẹ", desc: "Đặt bánh và chuẩn bị quà.", offset: 2, time: "00:00", duration: 0, priority: 1, categoryId: "cat-family", status: "todo", tags: ["gia đình"], allDay: true },
  { title: "Chuẩn bị thuyết trình", desc: "Hoàn thiện slide và tập thuyết trình.", offset: 3, time: "15:00", duration: 90, priority: 1, categoryId: "cat-work", status: "todo", tags: ["thuyết trình"] },
  { title: "Dã ngoại cuối tuần", desc: "Lên kế hoạch đi picnic cùng gia đình.", offset: 5, time: "00:00", duration: 0, priority: 2, categoryId: "cat-family", status: "todo", tags: ["gia đình"], allDay: true },
];

export function seedSampleTasks(now: string, categories: Category[]): Task[] {
  const today = todayKey();
  const categoryIds = new Set(categories.map((c) => c.id));
  const tasks: Task[] = SAMPLE_TASKS.map((seed) => {
    const date = addDaysKey(today, seed.offset);
    const allDay = seed.allDay ?? false;
    const start = allDay ? combineDateTime(date, "00:00") : combineDateTime(date, seed.time);
    const end = allDay
      ? combineDateTime(date, "23:59")
      : new Date(new Date(start).getTime() + seed.duration * 60000).toISOString();
    return {
      id: newId(),
      title: seed.title,
      desc: seed.desc,
      date,
      start,
      end,
      allDay,
      priority: seed.priority,
      categoryId: categoryIds.has(seed.categoryId) ? seed.categoryId : "cat-personal",
      tags: seed.tags,
      status: seed.status,
      subtasks: (seed.subtasks ?? []).map((title) => ({ id: newId(), title, done: false })),
      completedAt: seed.status === "done" ? new Date(start).toISOString() : undefined,
      createdAt: now,
      updatedAt: now,
    };
  });

  const monday = addDaysKey(today, -((new Date(`${today}T00:00:00`).getDay() + 6) % 7));
  tasks.push({
    id: newId(),
    title: "Tập gym",
    desc: "Lịch tập cố định thứ 2, 4, 6.",
    date: monday,
    start: combineDateTime(monday, "07:00"),
    end: combineDateTime(monday, "08:00"),
    allDay: false,
    priority: 2,
    categoryId: "cat-health",
    tags: ["gym", "định kỳ"],
    status: "todo",
    subtasks: [],
    recurrence: { freq: "weekly", weekdays: [1, 3, 5] },
    createdAt: now,
    updatedAt: now,
  });

  return tasks;
}
