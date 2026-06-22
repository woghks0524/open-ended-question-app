"use client";

import { useState, useCallback } from "react";
import Stepper from "@/components/Stepper";
import StepNavigation from "@/components/StepNavigation";
import Step1Code from "@/components/teacher/Step1Code";
import Step2BasicInfo, { BasicInfo } from "@/components/teacher/Step2BasicInfo";
import Step3Materials from "@/components/teacher/Step3Materials";
import Step4Questions from "@/components/teacher/Step4Questions";
import Step5Instructions from "@/components/teacher/Step5Instructions";
import Step6Review from "@/components/teacher/Step6Review";

const STEPS = [
  "평가 코드",
  "교과서·단원",
  "추가 자료",
  "문항 입력",
  "주의 사항",
  "확인/저장",
];

const EMPTY_INFO: BasicInfo = { grade: "", semester: "", subject: "", publisher: "", unit: "", unitKey: "" };

export default function TeacherPage() {
  const [step, setStep] = useState(0);

  // State
  const [settingName, setSettingName] = useState("");
  const [info, setInfo] = useState<BasicInfo>(EMPTY_INFO);
  // 이 평가 전용 교사 추가자료 보관함(선택). 비어있으면 단원 라이브러리만 사용.
  const [extraVectorStoreId, setExtraVectorStoreId] = useState("");
  const [questions, setQuestions] = useState(["", "", ""]);
  const [correctAnswers, setCorrectAnswers] = useState(["", "", ""]);
  const [images, setImages] = useState(["", "", ""]);
  const [feedbackInstruction, setFeedbackInstruction] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

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
          <Step2BasicInfo value={info} onSave={setInfo} />
        )}
        {step === 2 && (
          <Step3Materials
            settingName={settingName}
            unitKey={info.unitKey}
            extraVectorStoreId={extraVectorStoreId}
            onExtraVectorStore={setExtraVectorStoreId}
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
            info={info}
            questions={questions}
            correctAnswers={correctAnswers}
            images={images}
            feedbackInstruction={feedbackInstruction}
            extraVectorStoreId={extraVectorStoreId}
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
        nextDisabled={(step === 0 && !settingName) || (step === 1 && !info.unitKey)}
      />
    </div>
  );
}
