import AttendanceView from "@/components/attendance/AttendanceView";
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Attendance Manager | Notice Board',
    description: 'CR Attendance Management Dashboard.',
};

export default function AttendanceManagerPage() {
    return <AttendanceView />;
}
