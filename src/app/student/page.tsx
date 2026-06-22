"use client";

import { useState, useCallback } from "react";
import Stepper from "@/components/Stepper";
import StepNavigation from "@/components/StepNavigation";
import Step1Code from "@/components/student/Step1Code";
import Step2StudentInfo from "@/components/student/Step2StudentInfo";
import Step3Answers from "@/components/student/Step3Answers";
import Step4Feedback from "@/components/student/Step4Feedback";
import Step5Save from "@/components/student/Step5Save";

const STEPS = ["평가 코드", "학생 정보", "답안 작성", "채점/피드백", "결과 저장"];

interface FeedbackItem {
  feedback: string;
  score: number | null;
}

export default function StudentPage() {
  const [step, setStep] = useState(0);

  // Assessment data (from teacher)
  const [settingName, setSettingName] = useState("");
  const [questions, setQuestions] = useState(["", "", ""]);
  const [images, setImages] = useState(["", "", ""]);
  const [feedbackInstruction, setFeedbackInstruction] = useState("");
  const [unitKey, setUnitKey] = useState("");
  const [extraVectorStoreId, setExtraVectorStoreId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [assessmentLoaded, setAssessmentLoaded] = useState(false);

  // Student data
  const [grade, setGrade] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");
  const [answers, setAnswers] = useState(["", "", ""]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleAssessmentLoaded = useCallback((data: Record<string, string>) => {
    setSettingName(data.settingname || "");
    setQuestions([data.question1 || "", data.question2 || "", data.question3 || ""]);
    setImages([data.image1 || "", data.image2 || "", data.image3 || ""]);
    setFeedbackInstruction(data.feedbackinstruction || "");
    setUnitKey(data.unitkey || "");
    setExtraVectorStoreId(data.vectorapi || "");
    setSheetUrl(data.sheeturl || "");
    setAssessmentLoaded(true);
  }, []);

  const handleStudentInfoSave = useCallback(
    (info: { grade: string; studentClass: string; studentNumber: string; studentName: string }) => {
      setGrade(info.grade);
      setStudentClass(info.studentClass);
      setStudentNumber(info.studentNumber);
      setStudentName(info.studentName);
    },
    []
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">서술형 평가 연습하기 (학생용)</h1>
      <p className="text-sm text-gray-500 mb-6">
        자동채점과 맞춤형 피드백
      </p>

      <Stepper steps={STEPS} currentStep={step} />

      <div className="mt-6">
        {step === 0 && (
          <Step1Code onLoaded={handleAssessmentLoaded} loaded={assessmentLoaded} />
        )}
        {step === 1 && (
          <Step2StudentInfo
            info={{ grade, studentClass, studentNumber, studentName }}
            onSave={handleStudentInfoSave}
          />
        )}
        {step === 2 && (
          <Step3Answers
            questions={questions}
            images={images}
            answers={answers}
            onSave={setAnswers}
          />
        )}
        {step === 3 && (
          <Step4Feedback
            questions={questions}
            answers={answers}
            feedbackInstruction={feedbackInstruction}
            unitKey={unitKey}
            extraVectorStoreId={extraVectorStoreId}
            feedbacks={feedbacks}
            onFeedbacksReceived={setFeedbacks}
          />
        )}
        {step === 4 && (
          <Step5Save
            settingName={settingName}
            grade={grade}
            studentClass={studentClass}
            studentNumber={studentNumber}
            studentName={studentName}
            questions={questions}
            answers={answers}
            feedbacks={feedbacks}
            sheetUrl={sheetUrl}
          />
        )}
      </div>

      <StepNavigation
        onPrev={step > 0 ? prev : undefined}
        onNext={step < STEPS.length - 1 ? next : undefined}
        showPrev={step > 0}
        showNext={step < STEPS.length - 1}
        nextDisabled={step === 0 && !assessmentLoaded}
      />
    </div>
  );
}
