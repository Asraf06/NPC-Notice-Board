import AttendanceOverview from "@/components/attendance/AttendanceOverview";
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Attendance | Notice Board',
    description: 'View your attendance history and statistics.',
};

export default function AttendancePage() {
    return <AttendanceOverview />;
}
