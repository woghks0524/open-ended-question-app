"use client";

import { useState, useCallback } from "react";
import Stepper from "@/components/Stepper";
import StepNavigation from "@/components/StepNavigation";
import Step1Code from "@/components/teacher/Step1Code";
import Step2BasicInfo from "@/components/teacher/Step2BasicInfo";
import Step3Materials from "@/components/teacher/Step3Materials";
import Step4Questions from "@/components/teacher/Step4Questions";
import Step5Instructions from "@/components/teacher/Step5Instructions";
import Step6Review from "@/components/teacher/Step6Review";

const STEPS = [
  "평가 코드",
  "기본정보",
  "참고자료",
  "문항 입력",
  "주의 사항",
  "확인/저장",
];

// 교과서 선택(학년|과목|출판사) → 기본 벡터스토어(교과서 자료) 매핑
const VECTORSTORE_MAP: Record<string, string> = {
  "4학년 1학기|사회|비상교과서": "vs_6854160fff988191b8501574aa4bc607",
  "4학년 1학기|과학|천재교과서/천재교육": "vs_686a385a08e48191b39c585677beb24d",
  "5학년 2학기|사회|천재교과서/천재교육": "vs_6852f0add000819192ca520c178ed3a8",
  "4학년 1학기|과학|아이스크림미디어": "vs_68738b9f916c8191ac60d8db176b7207",
};

export default function TeacherPage() {
  const [step, setStep] = useState(0);

  // State
  const [settingName, setSettingName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [publisher, setPublisher] = useState("");
  const [defaultVectorStoreId, setDefaultVectorStoreId] = useState("");
  const [vectorStoreId, setVectorStoreId] = useState("");
  const [questions, setQuestions] = useState(["", "", ""]);
  const [correctAnswers, setCorrectAnswers] = useState(["", "", ""]);
  const [images, setImages] = useState(["", "", ""]);
  const [feedbackInstruction, setFeedbackInstruction] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleBasicInfoSave = useCallback((g: string, s: string, p: string) => {
    setGrade(g);
    setSubject(s);
    setPublisher(p);

    const key = `${g}|${s}|${p}`;
    setDefaultVectorStoreId(VECTORSTORE_MAP[key] || "");
  }, []);

  const handleResourcesCreated = useCallback((data: { vectorStoreId: string }) => {
    setVectorStoreId(data.vectorStoreId);
  }, []);

  const handleUseExisting = useCallback((vsId: string) => {
    setVectorStoreId(vsId);
  }, []);

  const handleQuestionsSave = useCallback((qs: string[], ans: string[], imgs: string[]) => {
    setQuestions(qs);
    setCorrectAnswers(ans);
    setImages(imgs);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">서술형 평가 설계하기 (교사용)</h1>
      <p className="text-sm text-gray-500 mb-6">
        자동채점과 맞춤형 피드백
      </p>

      <Stepper steps={STEPS} currentStep={step} onStepClick={setStep} />

      <div className="mt-6">
        {step === 0 && (
          <Step1Code settingName={settingName} onSettingNameChange={setSettingName} />
        )}
        {step === 1 && (
          <Step2BasicInfo
            grade={grade}
            subject={subject}
            publisher={publisher}
            onSave={handleBasicInfoSave}
          />
        )}
        {step === 2 && (
          <Step3Materials
            settingName={settingName}
            defaultVectorStoreId={defaultVectorStoreId}
            onResourcesCreated={handleResourcesCreated}
            onUseExisting={handleUseExisting}
          />
        )}
        {step === 3 && (
          <Step4Questions
            questions={questions}
            correctAnswers={correctAnswers}
            images={images}
            onSave={handleQuestionsSave}
          />
        )}
        {step === 4 && (
          <Step5Instructions
            feedbackInstruction={feedbackInstruction}
            onSave={setFeedbackInstruction}
          />
        )}
        {step === 5 && (
          <Step6Review
            settingName={settingName}
            questions={questions}
            correctAnswers={correctAnswers}
            images={images}
            feedbackInstruction={feedbackInstruction}
            vectorStoreId={vectorStoreId}
            sheetUrl={sheetUrl}
            onSheetUrlChange={setSheetUrl}
          />
        )}
      </div>

      <StepNavigation
        onPrev={step > 0 ? prev : undefined}
        onNext={step < STEPS.length - 1 ? next : undefined}
        showPrev={step > 0}
        showNext={step < STEPS.length - 1}
        nextDisabled={step === 0 && !settingName}
      />
    </div>
  );
}
