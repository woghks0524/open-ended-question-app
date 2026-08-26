import { NextRequest, NextResponse } from "next/server";
import { uploadImageToFirebase } from "@/lib/firebase";
import { requireTeacher } from "@/lib/teacher-auth";

// 교사만: Firebase Storage에 쓰는 경로라 열어두면 남의 저장소를 무료 호스팅으로 쓸 수 있다.
export async function POST(req: NextRequest) {
  const denied = requireTeacher(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const prefix = (formData.get("prefix") as string) || "img";

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImageToFirebase(buffer, file.name, file.type, prefix);

    return NextResponse.json({ url });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json({ error: "업로드 중 오류가 발생했습니다." }, { status: 500 });
  }
}
