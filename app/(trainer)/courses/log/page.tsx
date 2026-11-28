"use client";

import { useRouter } from "next/navigation";
import { LogCourseForm } from "@/components/log-course-form";

// Fallback-Seite; im Alltag öffnet „Kurs eintragen“ den Drawer bzw. das Bottom-Sheet.
export default function LogCoursePage() {
  const router = useRouter();
  return (
    <LogCourseForm onDone={() => router.push("/courses")} onCancel={() => router.push("/courses")} />
  );
}
