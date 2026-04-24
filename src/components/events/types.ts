export interface CustomField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'tel';
    required: boolean;
}

export interface EventData {
    id?: string;
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
    deadline: string;
    createdBy: string;
    createdByUid: string;
    createdByRole: 'admin' | 'cr';
    targetDept: string;   // 'all' or specific dept
    targetSem: string;    // 'all' or specific sem
    targetSection: string;// 'all' or specific section
    customFields: CustomField[];
    images: { url: string; fileId: string | null; service: string }[];
    isActive: boolean;
    createdAt?: any;
    updatedAt?: any;
    enrollmentCount: number;
}

export interface EnrollmentData {
    id?: string;
    eventId: string;
    uid: string;
    name: string;
    roll: string;
    dept: string;
    sem: string;
    section: string;
    customData: Record<string, string>;
    enrolledAt?: any;
}
