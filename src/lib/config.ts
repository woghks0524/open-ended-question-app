export interface AssistantConfig {
  teacherAssistantId: string;
  studentAssistantId: string;
  vectorStoreId: string;
}

const assistantMap: Record<string, AssistantConfig> = {
  "4학년 1학기|사회|비상교과서": {
    teacherAssistantId: process.env.ASSISTANT_GRADE4_SOCIAL_VISANG_TEACHER!,
    studentAssistantId: process.env.ASSISTANT_GRADE4_SOCIAL_VISANG_STUDENT!,
    vectorStoreId: process.env.VECTORSTORE_GRADE4_SOCIAL_VISANG!,
  },
  "4학년 1학기|과학|천재교과서/천재교육": {
    teacherAssistantId: process.env.ASSISTANT_GRADE4_SCIENCE_CHUNJAE_TEACHER!,
    studentAssistantId: process.env.ASSISTANT_GRADE4_SCIENCE_CHUNJAE_STUDENT!,
    vectorStoreId: process.env.VECTORSTORE_GRADE4_SCIENCE_CHUNJAE!,
  },
  "5학년 2학기|사회|천재교과서/천재교육": {
    teacherAssistantId: process.env.ASSISTANT_GRADE5_SOCIAL_CHUNJAE_TEACHER!,
    studentAssistantId: process.env.ASSISTANT_GRADE5_SOCIAL_CHUNJAE_STUDENT!,
    vectorStoreId: process.env.VECTORSTORE_GRADE5_SOCIAL_CHUNJAE!,
  },
  "4학년 1학기|과학|아이스크림미디어": {
    teacherAssistantId: process.env.ASSISTANT_GRADE4_SCIENCE_ICMEDIA_TEACHER!,
    studentAssistantId: process.env.ASSISTANT_GRADE4_SCIENCE_ICMEDIA_STUDENT!,
    vectorStoreId: process.env.VECTORSTORE_GRADE4_SCIENCE_ICMEDIA!,
  },
};

export function getAssistantConfig(grade: string, subject: string, publisher: string): AssistantConfig | null {
  const key = `${grade}|${subject}|${publisher}`;
  return assistantMap[key] || null;
}

export const GRADES = ["4학년 1학기", "4학년 2학기", "5학년 1학기", "5학년 2학기"];
export const SUBJECTS = ["과학", "사회"];
export const PUBLISHERS = ["천재교과서/천재교육", "비상교과서", "아이스크림미디어"];
